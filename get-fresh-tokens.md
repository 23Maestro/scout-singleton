# How to Get Fresh NPID Tokens

## Step 1: Get Fresh Tokens from Browser

1. **Open NPID Dashboard**: Go to https://dashboard.nationalpid.com/vide've oteammsg/videomailprogress
2. **Open Developer Tools**: Press F12 or right-click → Inspect
3. **Go to Network Tab**: Clear existing requests
4. **Refresh the page**: This will show the authentication requests
5. **Find the XSRF token**: Look for any request and check the Request Headers for `X-XSRF-TOKEN`
6. **Find the session cookie**: Look for the `Cookie` header with `myapp_session` value

## Step 2: Extract the Tokens

From the browser developer tools, copy:

### XSRF Token
- Look for `X-XSRF-TOKEN` in request headers
- Copy the full token value (it's a long base64 string)

### Session Cookie  
- Look for `Cookie` header
- Find the `myapp_session` value (it's a long base64 string)

## Step 3: Update Environment Variables

```bash
cd /Users/singleton23/Raycast/scout-singleton/scout-mcp-servers

# Edit the .env file
nano .env
```

Update these lines with your fresh tokens:
```
NPID_XSRF_TOKEN=YOUR_FRESH_XSRF_TOKEN_HERE
NPID_SESSION=YOUR_FRESH_SESSION_COOKIE_HERE
```

## Step 4: Restart MCP Servers

```bash
# Stop the servers
docker compose down

# Start them again with fresh tokens
docker compose up -d

# Check if they're running
docker ps | grep -E "(npid|asana)"
```

## Step 5: Test the Connection

The inbox-check command should now work without authentication errors.

## Alternative: Use Fallback Tokens

If you can't get fresh tokens right now, the code has fallback tokens that might work. You can try using those by commenting out the current tokens in the .env file:

```bash
# NPID_XSRF_TOKEN=current_expired_token
# NPID_SESSION=current_expired_token
```

The MCP servers will then use the fallback tokens from the code.
