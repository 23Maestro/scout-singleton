#!/usr/bin/env node

// Simple test to check what tools are available in the Asana MCP
const MCP_GATEWAY_URL = "http://127.0.0.1:8811/mcp";

async function testAsanaTools() {
  try {
    console.log("🔧 Testing Asana MCP tools...");
    
    // 1. Initialize session
    const initResponse = await fetch(MCP_GATEWAY_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            roots: { listChanged: false },
            sampling: {}
          },
          clientInfo: {
            name: "Tool Test",
            version: "1.0.0"
          }
        },
        id: 1
      })
    });

    const sessionId = initResponse.headers.get('mcp-session-id');
    console.log("🆔 Session ID:", sessionId);

    // 2. Send initialized notification
    await fetch(MCP_GATEWAY_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "mcp-session-id": sessionId
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {}
      })
    });

    // 3. List tools
    const headers = { 
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    };
    
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }

    const toolsResponse = await fetch(MCP_GATEWAY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
        id: 2
      })
    });

    const toolsResult = await toolsResponse.text();
    console.log("🛠️ Available tools:", toolsResult);

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testAsanaTools();