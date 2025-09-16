import { getPreferenceValues } from "@raycast/api";

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
  
  // Use fresh tokens from preferences (with fallbacks)
  const xsrfToken = prefs.npidXsrfToken || "eyJpdiI6Inpnb3RqNVF4bUE1bG12Q25Xb0NTTWc9PSIsInZhbHVlIjoicEtHKzZcL252RER0aW1WZGFjVktJeEhnZG9MZDB1ZTNVcVZmQ1R1ZGkxdEd3aFFrWUpmM2JMMnNLMW9ZeVhaU1NMQmxHWlRZOG9OSmxQZk9QXC9xQ0swUT09IiwibWFjIjoiYjlmM2U5Y2E1OTZmYzI1MjhkZGE3N2FiMmI4MmVhY2I5ZThlMjNmNmJjYjAzN2E0OGE3OWI0MTBhNzUyMjI3YiJ9";
  const sessionCookie = prefs.npidSession || "eyJpdiI6InBWN2kwaWlENzhRVENodlpPZGpcLytBPT0iLCJ2YWx1ZSI6IkxoaktBSnNzd08yaG95bWU0d1hRSk5oQ0RsdEFpZ1hzYWh0Q2EzcHdzQ3c3WUFUbUd5ekhNNk5DaWwrWWJxSnl0SmhIVGxRV2I2bHBISUl0MjhmR0FnPT0iLCJtYWMiOiI5YjZlZjU2NzQ3NTNjYzg5MTZmYTg0YTRjNzJiMDk5YTllZmRlNDA0ZjMwM2E1M2U0NGQzNzkyM2FkNGI0Y2M0In0%3D";
  
  return {
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-XSRF-TOKEN": xsrfToken,
    "X-Requested-With": "XMLHttpRequest",
    "Cookie": `XSRF-TOKEN=${xsrfToken}; myapp_session=${sessionCookie}`,
  };
}

export function getAsanaHeaders(preferences?: AsanaPreferences) {
  const prefs = preferences || getAsanaAuth();
  
  return {
    "Authorization": `Bearer ${prefs.asanaAccessToken}`,
    "Content-Type": "application/json",
  };
}
