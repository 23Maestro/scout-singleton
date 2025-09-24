// Test script for MCP servers
const MCP_GATEWAY_URL = "http://127.0.0.1:8811";

async function testServer(server, tool, args = {}) {
  try {
    console.log(`🧪 Testing ${server}.${tool}...`);
    
    const response = await fetch(`${MCP_GATEWAY_URL}/tools/call`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        server,
        tool,
        arguments: args
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ ${server}.${tool} - SUCCESS`);
    return result;
  } catch (error) {
    console.log(`❌ ${server}.${tool} - FAILED: ${error.message}`);
    return null;
  }
}

async function runTests() {
  console.log("🚀 Testing MCP Server Setup...\n");
  
  // Test NPID server
  await testServer("scout-npid", "get_inbox_threads", { limit: "3" });
  
  // Test custom Asana server
  await testServer("scout-asana", "get_video_tasks", { assignee_filter: "me" });
  
  // Test official Asana server
  await testServer("asana-official", "get_workspaces", {});
  await testServer("asana-official", "get_tasks", {});
  
  console.log("\n🎉 Test completed!");
}

runTests();
