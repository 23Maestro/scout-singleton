# Playwright Migration Plan - Replace Token Management System

## Overview
This document outlines the comprehensive plan to replace the entire NPID token-based authentication system with Playwright browser automation while maintaining the same MCP interface and functionality.

## Problem Statement
- Tokens expire and cause authentication failures
- No REST API available on the target website
- Current system works when tokens are fresh but fails when expired
- Complex token refresh scripts and HAR file parsing are unreliable

## Goal
Replace the ENTIRE token management system with Playwright browser automation while maintaining the same interface and functionality.

## Current System Analysis

### NPID MCP Server Endpoints (to be replaced):
1. `get_inbox_threads()` - `/videoteammsg/inbox`
2. `get_thread_details()` - `/videoteammsg/inbox/{thread_id}`
3. `get_assignment_modal_data()` - `/videoteammsg/inbox/{thread_id}/assignprefetch`
4. `assign_thread()` - `/videoteammsg/inbox/assign`
5. `search_player()` - `/videoteammsg/videoprogress`
6. `get_my_assignments()` - `/videoteammsg/videoprogress`
7. `check_inbox_updates()` - `/videoteammsg/inbox`

### Current Dependencies:
- `mcp[cli]>=1.2.0`
- `httpx`
- `beautifulsoup4`
- `python-dateutil`

### Files to be Modified/Replaced:
- `npid-mcp-server/npid_server.py` - Main MCP server
- `npid-mcp-server/token_manager.py` - Token management (to be replaced)
- `npid-mcp-server/requirements.txt` - Add Playwright
- `npid-mcp-server/Dockerfile` - Add Playwright installation
- `scout-mcp-servers/docker-compose.yml` - Environment variables
- Token refresh scripts (to be deleted)

## Implementation Plan

### Phase 1: Investigation and Setup ✅
- [x] Analyze current NPID MCP server endpoints
- [x] Understand token refresh logic
- [x] Add Playwright to requirements.txt
- [x] Update Dockerfile for Playwright installation

### Phase 2: Core Playwright Implementation
- [ ] Create `npid-mcp-server/npid_automator.py`
- [ ] Design `NpidAutomator` class with:
  - Browser instance management
  - Login functionality
  - Session validation
  - API data fetching via browser
  - Error handling and retry logic

### Phase 3: Integration with MCP Server
- [ ] Add feature flag `USE_PLAYWRIGHT_AUTH=false`
- [ ] Modify `npid_server.py` to use automator when flag is enabled
- [ ] Maintain identical function signatures and return formats
- [ ] Ensure no breaking changes to Raycast extension

### Phase 4: Migration and Rollout Strategy
- [ ] Implement feature flag in docker-compose.yml
- [ ] Test with `USE_PLAYWRIGHT_AUTH=false` (old system)
- [ ] Test with `USE_PLAYWRIGHT_AUTH=true` (new system)
- [ ] Verify identical responses from both systems

### Phase 5: Testing and Reliability
- [ ] Create integration tests in `tests/test_playwright_mcp.py`
- [ ] Test all MCP endpoints with both systems
- [ ] End-to-end testing with Raycast extension
- [ ] Performance testing and optimization

### Phase 6: Cleanup
- [ ] Remove feature flag logic
- [ ] Delete `token_manager.py`
- [ ] Delete token refresh scripts
- [ ] Remove unused dependencies
- [ ] Update documentation

## Technical Implementation Details

### NpidAutomator Class Structure:
```python
class NpidAutomator:
    def __init__(self, username, password):
        # Initialize Playwright and browser instance
        # Launch persistent browser to maintain session

    def login(self):
        # Navigate to NPID login page
        # Fill username/password from secure env variables
        # Handle submission and wait for successful login
        # Store authenticated page context

    def is_session_valid(self):
        # Check if current browser session is still authenticated
        # Visit protected page and check for redirect

    def get_api_data(self, endpoint_url, params):
        # Use authenticated page context to make fetch call
        # Directly to internal API endpoint
        # Return JSON response from API call

    def ensure_login_and_fetch(self, endpoint_url, params):
        # Wrapper that calls is_session_valid()
        # Runs login() if needed
        # Calls get_api_data()
```

### Environment Variables:
- `USE_PLAYWRIGHT_AUTH=true/false` - Feature flag
- `NPID_USERNAME` - Login username
- `NPID_PASSWORD` - Login password
- `NPID_BASE_URL` - Base URL (default: https://dashboard.nationalpid.com)

### Docker Configuration:
- Add Playwright browser installation
- Ensure proper permissions for browser execution
- Maintain existing volume mounts for state persistence

## Benefits of Playwright Approach:
1. **No token management** - Browser handles authentication automatically
2. **More reliable** - Works like a real user, handles JavaScript
3. **Session persistence** - Can maintain login state across requests
4. **Simpler maintenance** - No complex token refresh logic
5. **Better error handling** - Can detect and handle login failures gracefully

## Risk Mitigation:
1. **Feature flag** - Allows safe rollback to old system
2. **Identical interface** - No changes to Raycast extension
3. **Comprehensive testing** - Verify both systems work identically
4. **Gradual rollout** - Test thoroughly before removing old system

## Success Criteria:
- [ ] All MCP endpoints work identically with Playwright
- [ ] Raycast extension functions without any changes
- [ ] No authentication failures due to expired tokens
- [ ] Improved reliability and maintainability
- [ ] Clean removal of old token management system

## Notes:
- This plan was generated with assistance from Gemini CLI
- Focus on clean, well-planned implementation
- Avoid common pitfalls like file path issues
- Maintain backward compatibility throughout migration
- Document all changes for future reference
