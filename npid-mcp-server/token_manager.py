#!/usr/bin/env python3
"""Utility for managing NPID authentication tokens.

This module is responsible for logging into the NPID dashboard, persisting the
current session/XSRF tokens, and keeping them refreshed on a cadence so API
clients can operate without manual intervention.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Optional, Tuple

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger("npid-token-manager")


@dataclass
class TokenBundle:
    """Container for the cookies/tokens we require for API calls."""

    xsrf_token: str
    session_cookie: str
    form_token: str
    refreshed_at: str
    expires_at: Optional[str] = None

    def to_headers(self, base_url: str) -> Dict[str, str]:
        # Compose headers that mirror browser requests from the HAR
        return {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "application/json;charset=UTF-8",
            "DNT": "1",
            "Origin": base_url,
            "Pragma": "no-cache",
            "Referer": f"{base_url}/videoteammsg/videomailprogress",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
            "X-XSRF-TOKEN": self.xsrf_token,
            "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
        }

    def to_cookies(self) -> Dict[str, str]:
        return {"XSRF-TOKEN": self.xsrf_token, "myapp_session": self.session_cookie}


class TokenManager:
    """Manage refresh + persistence of NPID auth tokens."""

    def __init__(self) -> None:
        self.base_url = os.environ.get("NPID_BASE_URL", "https://dashboard.nationalpid.com").rstrip("/")
        self.username = os.environ.get("NPID_USERNAME") or os.environ.get("NPID_EMAIL")
        self.password = os.environ.get("NPID_PASSWORD")
        if not self.username or not self.password:
            logger.warning("NPID credentials not provided; token refresh will be disabled.")

        default_path = os.environ.get("NPID_TOKEN_PATH", "/app/state/npid_tokens.json")
        self.token_path = Path(default_path).expanduser()
        self.token_path.parent.mkdir(parents=True, exist_ok=True)

        self.refresh_interval = int(os.environ.get("NPID_REFRESH_INTERVAL_MINUTES", "90"))
        self.keepalive_interval = int(os.environ.get("NPID_KEEPALIVE_INTERVAL_MINUTES", "20"))
        self.keepalive_endpoint = os.environ.get("NPID_KEEPALIVE_ENDPOINT", "/external/logincheck")
        self._lock = threading.RLock()
        self._tokens: Optional[TokenBundle] = None
        self._stop_event = threading.Event()

        # Hydrate cache from disk if available
        self._load_tokens_from_disk()

        # Fall back to environment-provided tokens if available
        if not self._tokens:
            env_xsrf = os.environ.get("NPID_XSRF_TOKEN")
            env_session = os.environ.get("NPID_SESSION")
            if env_xsrf and env_session:
                refreshed_at = datetime.now(timezone.utc)
                env_form_token = os.environ.get("NPID_FORM_TOKEN", env_xsrf)
                self._tokens = TokenBundle(
                    xsrf_token=env_xsrf,
                    session_cookie=env_session,
                    form_token=env_form_token,
                    refreshed_at=refreshed_at.isoformat(),
                    expires_at=None,
                )
                logger.info("Loaded NPID tokens from environment variables")

        if not self._tokens:
            try:
                self.refresh_tokens()
            except Exception as exc:  # noqa: BLE001
                logger.error("Unable to obtain initial NPID tokens: %s", exc, exc_info=True)

        # Launch background threads only if we have credentials
        if self.username and self.password:
            self._start_background_threads()

    # ------------------------------------------------------------------
    # Public accessors
    # ------------------------------------------------------------------
    def get_headers_and_cookies(self) -> Tuple[Dict[str, str], Dict[str, str]]:
        with self._lock:
            if not self._tokens:
                raise RuntimeError("NPID authentication tokens are not available")
            headers = self._tokens.to_headers(self.base_url)
            cookies = self._tokens.to_cookies()
            return headers, cookies

    def get_form_token(self) -> str:
        with self._lock:
            if not self._tokens:
                raise RuntimeError("NPID authentication tokens are not available")
            return self._tokens.form_token

    # ------------------------------------------------------------------
    # Background scheduling
    # ------------------------------------------------------------------
    def _start_background_threads(self) -> None:
        refresh_thread = threading.Thread(target=self._refresh_loop, name="npid-token-refresh", daemon=True)
        refresh_thread.start()

        keepalive_thread = threading.Thread(target=self._keepalive_loop, name="npid-token-keepalive", daemon=True)
        keepalive_thread.start()

    def stop(self) -> None:
        self._stop_event.set()

    def _refresh_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                next_refresh = self._next_refresh_due()
                sleep_seconds = max(10, (next_refresh - datetime.now(timezone.utc)).total_seconds())
            except Exception:  # noqa: BLE001
                sleep_seconds = self.refresh_interval * 60

            if self._stop_event.wait(timeout=sleep_seconds):
                break

            try:
                logger.info("Refreshing NPID auth tokens via scheduled task")
                self.refresh_tokens()
            except Exception as exc:  # noqa: BLE001
                logger.error("Scheduled token refresh failed: %s", exc, exc_info=True)

    def _keepalive_loop(self) -> None:
        if self.keepalive_interval <= 0:
            return

        while not self._stop_event.is_set():
            if self._stop_event.wait(timeout=self.keepalive_interval * 60):
                break
            try:
                self._perform_keepalive()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Keepalive ping failed: %s", exc)

    # ------------------------------------------------------------------
    # Token lifecycle helpers
    # ------------------------------------------------------------------
    def refresh_tokens(self) -> None:
        if not self.username or not self.password:
            raise RuntimeError("Cannot refresh tokens without NPID_USERNAME / NPID_PASSWORD")

        login_url = f"{self.base_url}/auth/login"
        submit_url = f"{self.base_url}/auth/login"

        with httpx.Client(timeout=20, follow_redirects=True) as client:
            login_page = client.get(login_url)
            login_page.raise_for_status()

            form_token = self._extract_form_token(login_page.text)
            if not form_token:
                raise RuntimeError("Unable to locate login _token in response")

            payload = {
                "email": self.username,
                "password": self.password,
                "_token": form_token,
            }

            response = client.post(
                submit_url,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()

            xsrf_cookie = client.cookies.get("XSRF-TOKEN")
            session_cookie = client.cookies.get("myapp_session")

            if not xsrf_cookie or not session_cookie:
                raise RuntimeError("Login succeeded but expected cookies were missing")

            refreshed_at = datetime.now(timezone.utc)
            expires_at = refreshed_at + timedelta(minutes=self.refresh_interval)

            token_bundle = TokenBundle(
                xsrf_token=xsrf_cookie,
                session_cookie=session_cookie,
                form_token=form_token,
                refreshed_at=refreshed_at.isoformat(),
                expires_at=expires_at.isoformat(),
            )

            with self._lock:
                self._tokens = token_bundle
                self._write_tokens_to_disk()

            logger.info("Obtained fresh NPID tokens; next refresh due by %s", expires_at.isoformat())

    def _perform_keepalive(self) -> None:
        with self._lock:
            tokens = self._tokens
        if not tokens:
            return

        keepalive_url = f"{self.base_url}{self.keepalive_endpoint}"

        with httpx.Client(timeout=15, follow_redirects=True) as client:
            client.cookies.update(tokens.to_cookies())
            params = {"_token": tokens.form_token}
            response = client.get(keepalive_url, params=params)
            if response.status_code >= 400:
                raise RuntimeError(f"Keepalive returned HTTP {response.status_code}")
            logger.debug("NPID keepalive successful (%s)", response.status_code)

    def _next_refresh_due(self) -> datetime:
        with self._lock:
            if self._tokens and self._tokens.expires_at:
                try:
                    return datetime.fromisoformat(self._tokens.expires_at)
                except ValueError:
                    pass
        return datetime.now(timezone.utc) + timedelta(minutes=self.refresh_interval)

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------
    def _write_tokens_to_disk(self) -> None:
        if not self._tokens:
            return
        tmp_path = self.token_path.with_suffix(".tmp")
        data = asdict(self._tokens)
        with tmp_path.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
        tmp_path.replace(self.token_path)

    def _load_tokens_from_disk(self) -> None:
        if not self.token_path.exists():
            return
        try:
            with self.token_path.open("r", encoding="utf-8") as fh:
                raw = json.load(fh)
            self._tokens = TokenBundle(
                xsrf_token=raw["xsrf_token"],
                session_cookie=raw["session_cookie"],
                form_token=raw.get("form_token", ""),
                refreshed_at=raw.get("refreshed_at", datetime.now(timezone.utc).isoformat()),
                expires_at=raw.get("expires_at"),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to load cached NPID tokens: %s", exc)
            self._tokens = None

    # ------------------------------------------------------------------
    # Parsing helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _extract_form_token(html: str) -> Optional[str]:
        soup = BeautifulSoup(html, "html.parser")
        hidden_input = soup.find("input", {"name": "_token"})
        if hidden_input and hidden_input.has_attr("value"):
            return hidden_input["value"]
        meta_token = soup.find("meta", {"name": "csrf-token"})
        if meta_token and meta_token.has_attr("content"):
            return meta_token["content"]
        return None


# Convenience singleton for modules that want easy access
_token_manager: Optional[TokenManager] = None


def get_token_manager() -> TokenManager:
    global _token_manager  # noqa: PLW0603
    if _token_manager is None:
        _token_manager = TokenManager()
    return _token_manager


__all__ = ["TokenBundle", "TokenManager", "get_token_manager"]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    manager = get_token_manager()
    try:
        manager.refresh_tokens()
        logger.info("Token cache updated at %s", manager.token_path)
    finally:
        manager.stop()
