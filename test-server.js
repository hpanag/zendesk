const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`📥 ${req.method} ${req.url}`);
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/api/gpt5-chat' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk;
    });
    
    req.on('end', () => {
      try {
        console.log('📦 Request body:', body);
        const data = JSON.parse(body);
        console.log('✅ Parsed data:', data);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          reply: 'Test response from minimal server',
          source: 'test-server'
        }));
      } catch (error) {
        console.error('❌ Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

server.listen(3001, () => {
  console.log('🧪 Test server running on http://localhost:3001');
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
});