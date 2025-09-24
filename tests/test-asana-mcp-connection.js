const axios = require('axios');

async function testAsanaMCP() {
    try {
        console.log('Testing connection to Asana MCP server...');
        
        // Test the SSE endpoint
        const response = await axios.get('http://localhost:8000/sse', {
            timeout: 5000
        });
        
        console.log('✅ Successfully connected to Asana MCP server');
        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        
        // Test health endpoint if available
        try {
            const healthResponse = await axios.get('http://localhost:8000/health', {
                timeout: 5000
            });
            console.log('✅ Health check passed:', healthResponse.data);
        } catch (e) {
            console.log('ℹ️  No health endpoint available');
        }
        
    } catch (error) {
        console.error('❌ Failed to connect to Asana MCP server:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('🔍 Server might not be running on port 8000');
        }
    }
}

testAsanaMCP();