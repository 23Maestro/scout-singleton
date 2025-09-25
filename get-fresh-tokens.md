# NPID Token Refresh Guide

The NPID integration now maintains its own login session. A lightweight token
manager logs into the dashboard on a schedule (default 90 minutes), writes the
session cookies to a shared JSON file, and keeps the session alive with
keep-alive pings. Manual token copy/paste is no longer required once the
service is configured.

## Quick Setup

1. **Create a shared state directory** (already provided as `state/` in the repo).
2. **Configure environment variables** for the Docker compose stack or your
   shell:

   ```bash
   export NPID_USERNAME="your@npid-account.com"
   export NPID_PASSWORD="super-secret"
   export NPID_BASE_URL="https://dashboard.nationalpid.com"
   export NPID_TOKEN_PATH="$(pwd)/state/npid_tokens.json"
   ```

3. **Start / restart the MCP containers**:

   ```bash
   cd scout-mcp-servers
   docker compose up -d --build
   ```

   The `scout-npid-mcp` container will perform the login immediately and then
   refresh on the configured interval.

4. **Point the Raycast extension at the shared cache** (optional if running the
   code outside Docker). The extension automatically looks for the file using
   `NPID_TOKEN_PATH`, `state/npid_tokens.json`, then `~/.scout/npid_tokens.json`.

## Manual Refresh (Optional)

If you need to force a refresh—for example, after changing your password—you can
invoke the token manager directly from the host machine:

```bash
python npid-mcp-server/token_manager.py
```

This command logs in with the configured credentials and updates the cache file
specified by `NPID_TOKEN_PATH`.

## Verifying the Session

- Inspect `state/npid_tokens.json` — it should contain `xsrf_token`,
  `session_cookie`, and the most recent `refreshed_at` timestamp.
- Run a simple MCP tool (`check_inbox_updates`) from Raycast or via MCP CLI to
  confirm the requests succeed without authentication errors.
- Check the container logs for messages from `npid-token-manager`; successful
  refreshes and keep-alive pings are logged at INFO / DEBUG levels.

## Troubleshooting

- **Missing token file:** ensure the container has write access to
  `/app/state`. The compose file mounts the host `state/` directory to that
  location.
- **Expired credentials:** update `NPID_USERNAME` / `NPID_PASSWORD` and run the
  manual refresh command.
- **Firewall or MFA prompts:** the automated login assumes username/password
  only. Accounts protected by SSO/MFA must use an app-specific credential.

Once configured, the scheduled refresh eliminates the recurring 90-minute token
expiry and keeps the Raycast workflow operating without Selenium fallbacks.
