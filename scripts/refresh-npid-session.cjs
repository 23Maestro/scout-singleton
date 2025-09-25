#!/usr/bin/env node

/**
 * NPID Session Refresh Script
 * 
 * Performs a full login flow to refresh NPID tokens:
 * 1. Hits /auth/login to get initial XSRF token
 * 2. Posts credentials to authenticate
 * 3. Fetches /admin/videomailbox to get session cookies
 * 4. Saves fresh tokens to state/npid_tokens.json
 * 
 * Usage: 
 *   NPID_EMAIL="you@example.com" NPID_PASSWORD="secret" npm run refresh-npid-session
 *   npm run refresh-npid-session -- --email you@example.com --password secret
 */

/* eslint-env node */
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    email: process.env.NPID_EMAIL,
    password: process.env.NPID_PASSWORD,
    baseUrl: process.env.NPID_BASE_URL || 'https://dashboard.nationalpid.com'
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      options.email = args[i + 1];
      i++;
    } else if (args[i] === '--password' && args[i + 1]) {
      options.password = args[i + 1];
      i++;
    } else if (args[i] === '--base-url' && args[i + 1]) {
      options.baseUrl = args[i + 1];
      i++;
    }
  }
  
  return options;
}

// Extract cookies from Set-Cookie header
function parseSetCookie(setCookieHeader) {
  const cookies = {};
  const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  
  for (const cookieString of cookieStrings) {
    const parts = cookieString.split(';');
    const nameValue = parts[0].split('=');
    if (nameValue.length === 2) {
      cookies[nameValue[0].trim()] = nameValue[1].trim();
    }
  }
  
  return cookies;
}

// Extract form token from HTML response
function extractFormToken(html) {
  const tokenMatch = html.match(/name="_token"\s+value="([^"]+)"/);
  return tokenMatch ? tokenMatch[1] : null;
}

// Update token file with new tokens
function updateTokenFile(tokens) {
  const tokenFilePath = path.join(__dirname, '..', 'state', 'npid_tokens.json');
  const stateDir = path.dirname(tokenFilePath);
  
  // Ensure state directory exists
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (90 * 60 * 1000)); // 90 minutes from now
  
  const tokenData = {
    xsrf_token: tokens.xsrfToken,
    session_cookie: tokens.sessionCookie,
    form_token: tokens.formToken,
    refreshed_at: now.toISOString(),
    expires_at: expiresAt.toISOString()
  };
  
  try {
    fs.writeFileSync(tokenFilePath, JSON.stringify(tokenData, null, 2));
    console.log('✅ Successfully updated state/npid_tokens.json');
    console.log(`   XSRF Token: ${tokens.xsrfToken ? 'Found' : 'Missing'}`);
    console.log(`   Session Cookie: ${tokens.sessionCookie ? 'Found' : 'Missing'}`);
    console.log(`   Form Token: ${tokens.formToken ? 'Found' : 'Missing'}`);
    console.log(`   Expires: ${expiresAt.toISOString()}`);
  } catch (error) {
    console.error('Error writing token file:', error.message);
    process.exit(1);
  }
}

// Main login flow
async function refreshNPIDSession() {
  const options = parseArgs();
  
  if (!options.email || !options.password) {
    console.error('❌ Missing credentials');
    console.error('   Set NPID_EMAIL and NPID_PASSWORD environment variables, or use --email and --password flags');
    console.error('   Example: NPID_EMAIL="you@example.com" NPID_PASSWORD="secret" npm run refresh-npid-session');
    process.exit(1);
  }
  
  console.log(`🔐 Refreshing NPID session for: ${options.email}`);
  console.log(`   Base URL: ${options.baseUrl}`);
  
  try {
    // Step 1: Get initial login page to extract XSRF token
    console.log('📄 Fetching login page...');
    const loginResponse = await fetch(`${options.baseUrl}/auth/login`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Failed to fetch login page: ${loginResponse.status} ${loginResponse.statusText}`);
    }
    
    const loginHtml = await loginResponse.text();
    const initialCookies = parseSetCookie(loginResponse.headers.get('set-cookie'));
    
    // Extract XSRF token from login page
    const xsrfToken = extractFormToken(loginHtml);
    if (!xsrfToken) {
      throw new Error('Could not extract XSRF token from login page');
    }
    
    console.log('✅ Extracted XSRF token from login page');
    
    // Step 2: Perform login
    console.log('🔑 Authenticating...');
    const loginFormData = new URLSearchParams({
      email: options.email,
      password: options.password,
      _token: xsrfToken
    });
    
    const authResponse = await fetch(`${options.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': `${options.baseUrl}/auth/login`,
        'Cookie': Object.entries(initialCookies).map(([name, value]) => `${name}=${value}`).join('; ')
      },
      body: loginFormData.toString(),
      redirect: 'manual' // Don't follow redirects automatically
    });
    
    if (authResponse.status !== 302) {
      throw new Error(`Login failed: ${authResponse.status} ${authResponse.statusText}`);
    }
    
    const authCookies = parseSetCookie(authResponse.headers.get('set-cookie'));
    console.log('✅ Authentication successful');
    
    // Step 3: Fetch videomailbox to get full session
    console.log('📬 Fetching videomailbox to establish session...');
    const allCookies = { ...initialCookies, ...authCookies };
    const cookieHeader = Object.entries(allCookies).map(([name, value]) => `${name}=${value}`).join('; ');
    
    const mailboxResponse = await fetch(`${options.baseUrl}/admin/videomailbox`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cookie': cookieHeader
      }
    });
    
    if (!mailboxResponse.ok) {
      throw new Error(`Failed to fetch videomailbox: ${mailboxResponse.status} ${mailboxResponse.statusText}`);
    }
    
    const mailboxHtml = await mailboxResponse.text();
    const finalCookies = parseSetCookie(mailboxResponse.headers.get('set-cookie'));
    const finalFormToken = extractFormToken(mailboxHtml);
    
    // Combine all cookies
    const allFinalCookies = { ...allCookies, ...finalCookies };
    
    // Extract the tokens we need
    const tokens = {
      xsrfToken: allFinalCookies['XSRF-TOKEN'] || xsrfToken,
      sessionCookie: allFinalCookies['myapp_session'] || allFinalCookies['laravel_session'],
      formToken: finalFormToken || xsrfToken
    };
    
    if (!tokens.xsrfToken || !tokens.sessionCookie) {
      throw new Error('Could not extract required tokens from session');
    }
    
    console.log('✅ Session established successfully');
    
    // Step 4: Update token file
    updateTokenFile(tokens);
    
  } catch (error) {
    console.error('❌ Failed to refresh NPID session:', error.message);
    process.exit(1);
  }
}

// Check if Node.js version supports fetch
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ for built-in fetch support');
  console.error('   Current Node.js version:', process.version);
  console.error('   Please upgrade to Node.js 18 or higher');
  process.exit(1);
}

if (require.main === module) {
  refreshNPIDSession();
}