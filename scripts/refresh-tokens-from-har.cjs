#!/usr/bin/env node

/**
 * NPID Token Refresh from HAR Export
 * 
 * Scans a HAR export for Set-Cookie headers and hidden _token values,
 * then rewrites state/npid_tokens.json with the refreshed trio.
 * 
 * Usage: npm run refresh-tokens-from-har -- ~/Downloads/npid-session.har
 */

const fs = require('fs');
const path = require('path');

function parseCookie(cookieString) {
  const parts = cookieString.split(';');
  const nameValue = parts[0].split('=');
  return {
    name: nameValue[0].trim(),
    value: nameValue[1] ? nameValue[1].trim() : ''
  };
}

function extractTokensFromHAR(harPath) {
  try {
    const harContent = fs.readFileSync(harPath, 'utf8');
    const har = JSON.parse(harContent);
    
    let xsrfToken = null;
    let sessionCookie = null;
    let formToken = null;
    
    // Look through all entries for cookies and form data
    for (const entry of har.log.entries) {
      const request = entry.request;
      const response = entry.response;
      
      // Check response headers for Set-Cookie
      if (response.headers) {
        for (const header of response.headers) {
          if (header.name.toLowerCase() === 'set-cookie') {
            const cookie = parseCookie(header.value);
            
            if (cookie.name === 'XSRF-TOKEN') {
              xsrfToken = decodeURIComponent(cookie.value);
            } else if (cookie.name === 'myapp_session') {
              sessionCookie = decodeURIComponent(cookie.value);
            }
          }
        }
      }
      
      // Check request postData for form tokens
      if (request.postData && request.postData.text) {
        const postData = request.postData.text;
        
        // Look for _token in form data
        const tokenMatch = postData.match(/_token=([^&]+)/);
        if (tokenMatch) {
          formToken = decodeURIComponent(tokenMatch[1]);
        }
      }
      
      // Also check request headers for cookies
      if (request.headers) {
        for (const header of request.headers) {
          if (header.name.toLowerCase() === 'cookie') {
            const cookies = header.value.split(';');
            for (const cookie of cookies) {
              const parsed = parseCookie(cookie);
              if (parsed.name === 'XSRF-TOKEN') {
                xsrfToken = decodeURIComponent(parsed.value);
              } else if (parsed.name === 'myapp_session') {
                sessionCookie = decodeURIComponent(parsed.value);
              }
            }
          }
        }
      }
    }
    
    return { xsrfToken, sessionCookie, formToken };
  } catch (error) {
    console.error('Error parsing HAR file:', error.message);
    process.exit(1);
  }
}

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

function main() {
  const harPath = process.argv[2];
  
  if (!harPath) {
    console.error('Usage: npm run refresh-tokens-from-har -- <path-to-har-file>');
    console.error('Example: npm run refresh-tokens-from-har -- ~/Downloads/npid-session.har');
    process.exit(1);
  }
  
  if (!fs.existsSync(harPath)) {
    console.error(`HAR file not found: ${harPath}`);
    process.exit(1);
  }
  
  console.log(`📁 Scanning HAR file: ${harPath}`);
  
  const tokens = extractTokensFromHAR(harPath);
  
  if (!tokens.xsrfToken && !tokens.sessionCookie && !tokens.formToken) {
    console.error('❌ No NPID tokens found in HAR file');
    console.error('   Make sure the HAR contains a login sequence with XSRF-TOKEN, myapp_session, and _token values');
    process.exit(1);
  }
  
  updateTokenFile(tokens);
}

if (require.main === module) {
  main();
}