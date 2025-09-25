import { getPreferenceValues } from '@raycast/api';
import { loadStoredNPIDTokens } from './token-store';

export interface NPIDPreferences {
  npidXsrfToken?: string;
  npidSession?: string;
  npidBaseUrl?: string;
}

export interface AsanaPreferences {
  asanaAccessToken: string;
}

export function getNPIDAuth(): NPIDPreferences {
  return getPreferenceValues<NPIDPreferences>();
}

export function getAsanaAuth(): AsanaPreferences {
  return getPreferenceValues<AsanaPreferences>();
}

export function getNPIDHeaders(preferences?: NPIDPreferences) {
  const prefs = preferences || getNPIDAuth();
  const storedTokens = loadStoredNPIDTokens();

  // Use fresh tokens from preferences (with fallbacks)
  const xsrfToken = storedTokens?.xsrf_token || prefs.npidXsrfToken;
  const sessionCookie = storedTokens?.session_cookie || prefs.npidSession;

  if (!xsrfToken || !sessionCookie) {
    throw new Error('Missing NPID authentication configuration');
  }

  return {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-XSRF-TOKEN': xsrfToken,
    'X-Requested-With': 'XMLHttpRequest',
    Cookie: `XSRF-TOKEN=${xsrfToken}; myapp_session=${sessionCookie}`,
  };
}

export function getAsanaHeaders(preferences?: AsanaPreferences) {
  const prefs = preferences || getAsanaAuth();

  return {
    Authorization: `Bearer ${prefs.asanaAccessToken}`,
    'Content-Type': 'application/json',
  };
}
