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
  process.env.NPID_TOKEN_PATH,
  path.join(process.cwd(), 'state', 'npid_tokens.json'),
  path.join(process.cwd(), 'metadata', 'npid_tokens.json'),
  path.join(process.env.HOME || '', '.scout', 'npid_tokens.json'),
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
  for (const candidate of FALLBACK_PATHS) {
    const expanded = candidate.startsWith('~')
      ? path.join(process.env.HOME || '', candidate.slice(1))
      : candidate;
    if (!expanded) {
      continue;
    }
    if (!fs.existsSync(expanded)) {
      continue;
    }
    const tokens = readJsonFile(expanded);
    if (tokens) {
      return tokens;
    }
  }
  return null;
}
