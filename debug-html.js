const http = require('http');

// Test to get raw HTML from NPID API
async function getRawHTML() {
    const payload = {
        tool: "get_inbox_threads",
        arguments: {
            limit: "5"
        }
    };

    const postData = JSON.stringify(payload);
    
    const options = {
        hostname: 'localhost',
        port: 8812,
        path: '/mcp-call',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    console.log('✅ Raw MCP Response:', response.data);
                    resolve(response);
                } catch (error) {
                    console.error('❌ JSON Parse Error:', error);
                    console.log('Raw Response:', data);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Request Error:', error);
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

getRawHTML().catch(console.error);
