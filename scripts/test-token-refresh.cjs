#!/usr/bin/env node

/**
 * Test script for NPID token refresh
 * Edit the credentials below and run: node scripts/test-token-refresh.cjs
 */

// EDIT THESE WITH YOUR ACTUAL CREDENTIALS
const NPID_EMAIL = "jsingleton@prospectid.com";
const NPID_PASSWORD = "YBh@Y8Us@1&qwd$";

// Set environment variables and run the refresh script
process.env.NPID_EMAIL = NPID_EMAIL;
process.env.NPID_PASSWORD = NPID_PASSWORD;

console.log('🔄 Testing NPID token refresh...');
console.log(`📧 Email: ${NPID_EMAIL}`);
console.log('🔑 Password: [HIDDEN]');
console.log('');

// Import and run the refresh function
const { execSync } = require('child_process');

try {
  execSync('npm run refresh-npid-session', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ Token refresh completed successfully!');
} catch (error) {
  console.error('❌ Token refresh failed:', error.message);
  process.exit(1);
}
