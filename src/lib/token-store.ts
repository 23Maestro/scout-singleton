import fs from 'fs';
import path from 'path';

export interface StoredNPIDTokens {
  xsrf_token: string;
  session_cookie: string;
  form_token?: string;
  refreshed_at?: string;
  expires_at?: string | null;
}

const FALLBACK_PATHS = [
  // ONLY use the correct path - no more wasted checking of wrong paths
  '/Users/singleton23/Raycast/scout-singleton/state/npid_tokens.json',
].filter((entry): entry is string => Boolean(entry));

function readJsonFile(filePath: string): StoredNPIDTokens | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed) {
      return null;
    }
    if (parsed.xsrf_token && parsed.session_cookie) {
      return parsed as StoredNPIDTokens;
    }
  } catch {
    // Silent failover – caller will try next path
  }
  return null;
}

export function loadStoredNPIDTokens(): StoredNPIDTokens | null {
  console.log('🔍 loadStoredNPIDTokens: Checking paths:', FALLBACK_PATHS);
  
  for (const candidate of FALLBACK_PATHS) {
    const expanded = candidate.startsWith('~')
      ? path.join(process.env.HOME || '', candidate.slice(1))
      : candidate;
    if (!expanded) {
      continue;
    }
    console.log('🔍 Checking path:', expanded, 'exists:', fs.existsSync(expanded));
    if (!fs.existsSync(expanded)) {
      continue;
    }
    const tokens = readJsonFile(expanded);
    if (tokens) {
      console.log('🔍 Found tokens at:', expanded);
      return tokens;
    }
  }
  console.log('🔍 No tokens found in any path');
  return null;
}
