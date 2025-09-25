#!/usr/bin/env node

/**
 * NPID Token Extractor from HAR
 * 
 * Extracts only the essential NPID tokens from a HAR file, focusing on:
 * - XSRF-TOKEN cookies
 * - myapp_session/laravel_session cookies  
 * - _token form values from videomailbox and assignment modal
 * 
 * Usage: node scripts/extract-npid-tokens-from-har.cjs <har-file>
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
    
    const tokens = {
      xsrfToken: null,
      sessionCookie: null,
      formToken: null,
      foundUrls: []
    };
    
    console.log('🔍 Scanning HAR for NPID tokens...');
    
    // Look through all entries for relevant requests
    for (const entry of har.log.entries) {
      const request = entry.request;
      const response = entry.response;
      const url = request.url;
      
      // Focus on NPID dashboard URLs
      if (url.includes('dashboard.nationalpid.com') || url.includes('nationalpid.com')) {
        tokens.foundUrls.push(url);
        
        // Check response headers for Set-Cookie
        if (response.headers) {
          for (const header of response.headers) {
            if (header.name.toLowerCase() === 'set-cookie') {
              const cookie = parseCookie(header.value);
              
              if (cookie.name === 'XSRF-TOKEN') {
                tokens.xsrfToken = decodeURIComponent(cookie.value);
                console.log(`✅ Found XSRF-TOKEN from: ${url}`);
              } else if (cookie.name === 'myapp_session' || cookie.name === 'laravel_session') {
                tokens.sessionCookie = decodeURIComponent(cookie.value);
                console.log(`✅ Found session cookie (${cookie.name}) from: ${url}`);
              }
            }
          }
        }
        
        // Check request postData for form tokens (assignment modal, etc.)
        if (request.postData && request.postData.text) {
          const postData = request.postData.text;
          
          // Look for _token in form data
          const tokenMatch = postData.match(/_token=([^&]+)/);
          if (tokenMatch) {
            tokens.formToken = decodeURIComponent(tokenMatch[1]);
            console.log(`✅ Found form _token from: ${url}`);
          }
        }
        
        // Also check request headers for cookies (in case they're being sent)
        if (request.headers) {
          for (const header of request.headers) {
            if (header.name.toLowerCase() === 'cookie') {
              const cookies = header.value.split(';');
              for (const cookie of cookies) {
                const parsed = parseCookie(cookie);
                if (parsed.name === 'XSRF-TOKEN' && !tokens.xsrfToken) {
                  tokens.xsrfToken = decodeURIComponent(parsed.value);
                  console.log(`✅ Found XSRF-TOKEN in request headers from: ${url}`);
                } else if ((parsed.name === 'myapp_session' || parsed.name === 'laravel_session') && !tokens.sessionCookie) {
                  tokens.sessionCookie = decodeURIComponent(parsed.value);
                  console.log(`✅ Found session cookie (${parsed.name}) in request headers from: ${url}`);
                }
              }
            }
          }
        }
      }
    }
    
    return tokens;
  } catch (error) {
    console.error('❌ Error parsing HAR file:', error.message);
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
    console.log('\n✅ Successfully updated state/npid_tokens.json');
    console.log(`   XSRF Token: ${tokens.xsrfToken ? 'Found' : 'Missing'}`);
    console.log(`   Session Cookie: ${tokens.sessionCookie ? 'Found' : 'Missing'}`);
    console.log(`   Form Token: ${tokens.formToken ? 'Found' : 'Missing'}`);
    console.log(`   Expires: ${expiresAt.toISOString()}`);
  } catch (error) {
    console.error('❌ Error writing token file:', error.message);
    process.exit(1);
  }
}

function main() {
  const harPath = process.argv[2];
  
  if (!harPath) {
    console.error('Usage: node scripts/extract-npid-tokens-from-har.cjs <path-to-har-file>');
    console.error('Example: node scripts/extract-npid-tokens-from-har.cjs ~/Downloads/npid-session.har');
    process.exit(1);
  }
  
  if (!fs.existsSync(harPath)) {
    console.error(`❌ HAR file not found: ${harPath}`);
    process.exit(1);
  }
  
  console.log(`📁 Extracting NPID tokens from: ${harPath}`);
  console.log('');
  
  const tokens = extractTokensFromHAR(harPath);
  
  console.log(`\n📊 Summary:`);
  console.log(`   NPID URLs found: ${tokens.foundUrls.length}`);
  console.log(`   XSRF Token: ${tokens.xsrfToken ? '✅ Found' : '❌ Missing'}`);
  console.log(`   Session Cookie: ${tokens.sessionCookie ? '✅ Found' : '❌ Missing'}`);
  console.log(`   Form Token: ${tokens.formToken ? '✅ Found' : '❌ Missing'}`);
  
  if (!tokens.xsrfToken && !tokens.sessionCookie && !tokens.formToken) {
    console.error('\n❌ No NPID tokens found in HAR file');
    console.error('   Make sure the HAR contains NPID dashboard interactions');
    console.error('   Try navigating to /admin/videomailbox and opening the assignment modal');
    process.exit(1);
  }
  
  updateTokenFile(tokens);
  
  console.log('\n🎉 Token extraction complete!');
  console.log('   Your Raycast extension should now have fresh tokens.');
}

if (require.main === module) {
  main();
}
