const http = require('http');

// Get ALL raw data without any filtering
async function getRawData() {
    const payload = {
        tool: "get_inbox_threads",
        arguments: {
            limit: "50"
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
                    const threads = JSON.parse(response.data.replace('✅ Found 50 inbox threads:\n', ''));
                    
                    console.log('🔍 COMPLETE RAW DATA - ALL THREADS:');
                    console.log('='.repeat(100));
                    
                    threads.forEach((thread, index) => {
                        console.log(`\n--- THREAD ${index + 1} ---`);
                        console.log(JSON.stringify(thread, null, 2));
                        console.log('-'.repeat(80));
                    });
                    
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

getRawData().catch(console.error);
