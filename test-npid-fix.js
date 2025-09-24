const http = require('http');

// Test the fixed NPID search_player tool
async function testNPIDSearch() {
    const payload = {
        method: "tools/call",
        params: {
            name: "get_inbox_threads",
            arguments: {
                limit: "10"
            }
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
                    console.log('✅ NPID Search Response:', response);
                    
                    // Try to parse the actual player data
                    if (response.result) {
                        const playerData = JSON.parse(response.result);
                        console.log('✅ Parsed Player Data:', playerData);
                        console.log('✅ This should now work in your backfill command!');
                    }
                    
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

testNPIDSearch().catch(console.error);
