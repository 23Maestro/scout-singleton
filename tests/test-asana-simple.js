#!/usr/bin/env node

// Test the simplest possible Asana call
const MCP_GATEWAY_URL = "http://127.0.0.1:8811/mcp";

async function testSimpleAsanaCall() {
  try {
    console.log("🔧 Testing simplest Asana call...");
    
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
          capabilities: { roots: { listChanged: false }, sampling: {} },
          clientInfo: { name: "Test", version: "1.0.0" }
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

    // 3. Try the simplest Asana call - list workspaces
    console.log("📋 Trying asana_list_workspaces...");
    const workspaceResponse = await fetch(MCP_GATEWAY_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "mcp-session-id": sessionId
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "asana_list_workspaces",
          arguments: {}
        },
        id: 3
      })
    });

    const workspaceResult = await workspaceResponse.text();
    console.log("📊 Workspace result:", workspaceResult);

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testSimpleAsanaCall();