# 🔄 Token Refresh Guide

## **Current Status**
✅ **Your tokens are working and expire at: 5:24 AM (Sept 26)**
✅ **You have about 1.5 hours before they expire**

## **🚨 RELIABLE Token Refresh Method**

When your tokens expire (you'll see login pages instead of inbox data), use this **manual method that always works**:

### **Step 1: Get Fresh Login Token**
```bash
curl -s -c cookies.txt 'https://dashboard.nationalpid.com/auth/login' | grep 'name="_token"' | sed 's/.*value="\([^"]*\)".*/\1/'
```

### **Step 2: Login (Replace TOKEN with output from Step 1)**
```bash
TOKEN="PUT_TOKEN_HERE"
curl -s -c cookies.txt -b cookies.txt -X POST 'https://dashboard.nationalpid.com/auth/login' \
  -d "email=jsingleton@prospectid.com&password=YBh%40Y8Us%401%26qwd%24&_token=$TOKEN" \
  -H 'Content-Type: application/x-www-form-urlencoded' -L > /dev/null
```

### **Step 3: Update Token File**
```bash
XSRF_TOKEN=$(grep XSRF-TOKEN cookies.txt | cut -f7)
SESSION_COOKIE=$(grep myapp_session cookies.txt | cut -f7)

cat > state/npid_tokens.json << EOF
{
  "xsrf_token": "$XSRF_TOKEN",
  "session_cookie": "$SESSION_COOKIE", 
  "form_token": "$XSRF_TOKEN",
  "refreshed_at": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "expires_at": "$(date -u -v+90M +%Y-%m-%dT%H:%M:%S.000Z)"
}
EOF

rm cookies.txt
echo "✅ Tokens refreshed!"
```


## **📅 Token Schedule**

- **Current tokens expire**: Sept 26, 5:24 AM
- **Token lifetime**: 90 minutes
- **Manual refresh takes**: ~30 seconds
- **Signs tokens expired**: Raycast shows "login page" instead of inbox data

## **🔍 Quick Token Check**

```bash
# Check expiration time
cat state/npid_tokens.json | jq '.expires_at'

# Test if tokens work
curl -s 'https://dashboard.nationalpid.com/rulestemplates/template/videoteammessagelist?athleteid=&user_timezone=America/New_York&type=inbox&is_mobile=&filter_self=Me/Un&refresh=false&page_start_number=1&search_text=' -H 'Accept: text/html' -b "$(cat state/npid_tokens.json | jq -r '"XSRF-TOKEN=" + .xsrf_token + "; myapp_session=" + .session_cookie')" | head -5
```

If you see `<div class="ImageProfile"` → ✅ Tokens work  
If you see `<title>National Prospect ID | Login</title>` → ❌ Tokens expired

## **💡 Pro Tips**

1. **Set a reminder** for 5:00 AM to refresh tokens before they expire
2. **Test the extension** before important work to catch expired tokens early  
3. **Keep this guide handy** - the manual method always works
4. **Your working code is safe** on GitHub, tokens are just temporary auth

