const axios = require('axios');

async function testAsanaMCPEndpoints() {
    console.log('Testing Asana MCP server endpoints...');
    
    const endpoints = [
        'http://localhost:8000/mcp',
        'http://localhost:8000/sse', 
        'http://localhost:8000/',
        'http://localhost:8000/health',
        'http://localhost:8000/metrics'
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`\n🔍 Testing ${endpoint}...`);
            const response = await axios.get(endpoint, {
                timeout: 3000,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            console.log(`✅ ${endpoint} - Status: ${response.status}`);
            if (response.data) {
                console.log('Response data:', JSON.stringify(response.data, null, 2).substring(0, 200));
            }
            
        } catch (error) {
            if (error.response) {
                console.log(`⚠️  ${endpoint} - Status: ${error.response.status} - ${error.response.statusText}`);
            } else {
                console.log(`❌ ${endpoint} - ${error.message}`);
            }
        }
    }
}

testAsanaMCPEndpoints();