// Test NPID MCP server from Raycast extension perspective
const MCP_GATEWAY_URL = "http://127.0.0.1:8811";

async function testNPIDServer() {
  console.log("🧪 Testing NPID MCP Server for scout-singleton...");
  
  try {
    const response = await fetch(`${MCP_GATEWAY_URL}/tools/call`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        server: "scout-npid",
        tool: "get_inbox_threads",
        arguments: { limit: "5" }
      })
    });

    console.log("📡 Response status:", response.status);
    console.log("📡 Response headers:", Object.fromEntries(response.headers));
    
    if (!response.ok) {
      throw new Error(`MCP Gateway error: ${response.status}`);
    }

    const result = await response.text();
    console.log("✅ Raw response:", result);
    
    // Try to parse as JSON
    try {
      const jsonResult = JSON.parse(result);
      console.log("📋 Parsed JSON:", jsonResult);
    } catch (e) {
      console.log("⚠️ Response is not JSON");
    }

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Also test Asana official server
async function testAsanaServer() {
  console.log("\n🧪 Testing Official Asana MCP Server...");
  
  try {
    const response = await fetch(`${MCP_GATEWAY_URL}/tools/call`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        server: "asana-official",
        tool: "get_workspaces",
        arguments: {}
      })
    });

    console.log("📡 Asana response status:", response.status);
    const result = await response.text();
    console.log("✅ Asana response:", result);

  } catch (error) {
    console.error("❌ Asana test failed:", error.message);
  }
}

// Run tests
testNPIDServer().then(() => testAsanaServer());
