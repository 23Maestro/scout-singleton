// Simple HTTP bridge for NPID MCP server - for scout-singleton Raycast extension
const http = require('http');
const { spawn } = require('child_process');

const PORT = 8812; // Different port from Docker MCP gateway

// Attempt to extract JSON string from noisy tool outputs
function extractJsonString(text) {
  if (typeof text !== 'string') {
    try { return JSON.stringify(text); } catch { return String(text); }
  }
  const s1 = text.indexOf('{');
  const e1 = text.lastIndexOf('}');
  if (s1 !== -1 && e1 !== -1 && e1 > s1) {
    const candidate = text.slice(s1, e1 + 1);
    try { JSON.parse(candidate); return candidate; } catch {}
  }
  const s2 = text.indexOf('[');
  const e2 = text.lastIndexOf(']');
  if (s2 !== -1 && e2 !== -1 && e2 > s2) {
    const candidate = text.slice(s2, e2 + 1);
    try { JSON.parse(candidate); return candidate; } catch {}
  }
  return text;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Enable CORS for Raycast
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method !== 'POST' || req.url !== '/mcp-call') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const { tool, arguments: args } = JSON.parse(body);
      
      // Call NPID MCP server directly
      const result = await callMCPTool(tool, args);
      const normalized = extractJsonString(result);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: normalized }));
      
    } catch (error) {
      console.error('MCP Bridge Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  });
});

// Function to call MCP tool
async function callMCPTool(tool, args) {
  return new Promise((resolve, reject) => {
    const pythonBin = process.env.PYTHON_BIN || 'python3';
    const mcp = spawn(pythonBin, ['npid-mcp-server/npid_server.py'], {
      env: {
        ...process.env,
        NPID_XSRF_TOKEN: "eyJpdiI6ImV5ZGkwTDNNYjBQUDNvR2g2bGRGb2c9PSIsInZhbHVlIjoiV21JMmh3ZnBzWnQxNmpjUzNHbmJ0Vm5EakZhVXFHZytqXC9Wbk56cWFoeTllQXZnS050S3RKMDNuU2E3ZnFqTlQ0WXJKdzE5Tkd2RERkTitWU3hhRnBnPT0iLCJtYWMiOiI1Yzk1MzBjYjc5ZDQwMWFhNWY5ZjNjMmY5ZDgxNWU2ZmI0M2MwYTAxODc5Mjk5ZThiNGRjODBjMDBhNzE1YjI1In0=",
        NPID_SESSION: "eyJpdiI6IkZDTkZCQ0c5RnZYaGhVeUJBbjgrdnc9PSIsInZhbHVlIjoiUnFCWFRrNWVNOWxybEZQbG4rVlNPOHdcL3oxRWthY3Fqa2I4a3FjUG9idGhHSnNGU2dxUzMyWUNDb2tjM2N5ejBEdzZXXC9ETFJNRkI0YlJpRENTRzc4dz09IiwibWFjIjoiYzZmOGFmZTQ3NWZiMjdjMjZlNDU1MmY0NmNkZTUyZWQ0MzEyOTJlYWNlYmI4NTI4NzY5Y2IyN2IzYzZhMjU5ZSJ9",
        NPID_BASE_URL: "https://dashboard.nationalpid.com"
      }
    });
    
    let output = '';
    let error = '';
    
    // Send MCP request
    const request = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: tool, arguments: args },
      id: 1
    };
    
    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdin.end();
    
    mcp.stdout.on('data', data => { output += data; });
    mcp.stderr.on('data', data => { error += data; });
    
    mcp.on('close', code => {
      if (code === 0) {
        try {
          const lines = output.trim().split('\n');
          const response = JSON.parse(lines[lines.length - 1]);
          resolve(response.result);
        } catch (e) {
          resolve(output);
        }
      } else {
        reject(new Error(`MCP tool failed: ${error}`));
      }
    });
  });
}

server.listen(PORT, () => {
  console.log(`🚀 Simple MCP Bridge running on http://localhost:${PORT}`);
  console.log(`🎯 Ready for scout-singleton Raycast extension calls`);
});

// Test endpoint
setTimeout(async () => {
  console.log('🧪 Testing NPID server...');
  try {
    const result = await callMCPTool('get_inbox_threads', { limit: '3' });
    console.log('✅ NPID server test successful:', typeof result);
  } catch (error) {
    console.log('❌ NPID server test failed:', error.message);
  }
}, 2000);
