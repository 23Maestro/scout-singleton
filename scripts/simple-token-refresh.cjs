#!/usr/bin/env node

/**
 * Simple Token Refresh - Uses curl approach that actually works
 * Usage: NPID_EMAIL="your@email.com" NPID_PASSWORD="password" node scripts/simple-token-refresh.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get credentials from environment
const email = process.env.NPID_EMAIL;
const password = process.env.NPID_PASSWORD;
const baseUrl = process.env.NPID_BASE_URL || 'https://dashboard.nationalpid.com';

if (!email || !password) {
  console.error('❌ Missing credentials');
  console.error('   Usage: NPID_EMAIL="your@email.com" NPID_PASSWORD="password" node scripts/simple-token-refresh.cjs');
  process.exit(1);
}

console.log(`🔐 Refreshing NPID session for: ${email}`);

try {
  // Step 1: Get login page and extract token
  console.log('📄 Getting login token...');
  const loginHtml = execSync(`curl -s -c /tmp/npid_cookies.txt '${baseUrl}/auth/login'`, { encoding: 'utf8' });
  const tokenMatch = loginHtml.match(/name="_token"\s+value="([^"]+)"/);
  
  if (!tokenMatch) {
    throw new Error('Could not extract login token');
  }
  
  const token = tokenMatch[1];
  console.log('✅ Got login token');

  // Step 2: Login with credentials
  console.log('🔑 Logging in...');
  const loginResult = execSync(
    `curl -s -c /tmp/npid_cookies.txt -b /tmp/npid_cookies.txt -X POST '${baseUrl}/auth/login' ` +
    `-d "email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&_token=${token}" ` +
    `-H 'Content-Type: application/x-www-form-urlencoded' -L -w '%{http_code}'`,
    { encoding: 'utf8' }
  );

  if (!loginResult.includes('200') && !loginResult.includes('302')) {
    throw new Error(`Login failed with status: ${loginResult}`);
  }
  
  console.log('✅ Login successful');

  // Step 3: Extract cookies from file
  console.log('📂 Extracting tokens...');
  const cookiesContent = fs.readFileSync('/tmp/npid_cookies.txt', 'utf8');
  
  const xsrfMatch = cookiesContent.match(/XSRF-TOKEN\t(.+)/);
  const sessionMatch = cookiesContent.match(/myapp_session\t(.+)/);
  
  if (!xsrfMatch || !sessionMatch) {
    console.log('🔍 Cookie file contents:');
    console.log(cookiesContent);
    throw new Error('Could not extract required cookies');
  }

  const xsrfToken = xsrfMatch[1];
  const sessionCookie = sessionMatch[1];

  // Step 4: Update token file
  console.log('💾 Saving tokens...');
  const tokenFilePath = path.join(__dirname, '..', 'state', 'npid_tokens.json');
  const stateDir = path.dirname(tokenFilePath);
  
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (90 * 60 * 1000)); // 90 minutes
  
  const tokenData = {
    xsrf_token: xsrfToken,
    session_cookie: sessionCookie,
    form_token: xsrfToken,
    refreshed_at: now.toISOString(),
    expires_at: expiresAt.toISOString()
  };
  
  fs.writeFileSync(tokenFilePath, JSON.stringify(tokenData, null, 2));
  
  // Clean up
  try {
    fs.unlinkSync('/tmp/npid_cookies.txt');
  } catch (e) {
    // Ignore cleanup errors
  }
  
  console.log('✅ Tokens refreshed successfully!');
  console.log(`   XSRF Token: ${xsrfToken.substring(0, 50)}...`);
  console.log(`   Session Cookie: ${sessionCookie.substring(0, 50)}...`);
  console.log(`   Expires: ${expiresAt.toISOString()}`);
  
} catch (error) {
  console.error('❌ Token refresh failed:', error.message);
  
  // Clean up on error
  try {
    fs.unlinkSync('/tmp/npid_cookies.txt');
  } catch (e) {
    // Ignore cleanup errors
  }
  
  process.exit(1);
}
