const http = require('http');

// Get complete data for Caleb Hudson and James Angstman threads
async function getThreadData() {
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
                    
                    // Find Caleb Hudson and James Angstman threads
                    const calebThreads = threads.filter(thread => 
                        thread.content && thread.content.toLowerCase().includes('caleb') ||
                        thread.email && thread.email.toLowerCase().includes('caleb')
                    );
                    
                    const jamesThreads = threads.filter(thread => 
                        thread.content && thread.content.toLowerCase().includes('james angstman') ||
                        thread.email && thread.email.toLowerCase().includes('james')
                    );
                    
                    console.log('🔍 CALEB HUDSON THREADS:');
                    console.log('='.repeat(80));
                    calebThreads.forEach((thread, index) => {
                        console.log(`\nThread ${index + 1}:`);
                        console.log(JSON.stringify(thread, null, 2));
                    });
                    
                    console.log('\n\n🔍 JAMES ANGTMAN THREADS:');
                    console.log('='.repeat(80));
                    jamesThreads.forEach((thread, index) => {
                        console.log(`\nThread ${index + 1}:`);
                        console.log(JSON.stringify(thread, null, 2));
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

getThreadData().catch(console.error);
