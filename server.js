const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// MIME types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Default to index.html if requesting root
  let filePath = req.url === '/' ? '/web/dash.html' : req.url;
  
  // Remove query string if present
  filePath = filePath.split('?')[0];
  
  // Build full file path
  const fullPath = path.join(__dirname, filePath);
  
  // Get file extension
  const ext = path.extname(fullPath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  // Check if file exists
  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (err) {
      console.log(`  404 Not Found: ${fullPath}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // Read and serve the file
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        console.log(`  500 Error reading file: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }

      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*' // Allow CORS
      });
      res.end(data);
      console.log(`  ✓ 200 OK (${contentType})`);
    });
  });
});

server.listen(PORT, () => {
  console.log('🌐 Zendesk Dashboard Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running at http://localhost:${PORT}/`);
  console.log('');
  console.log('📊 Available dashboards:');
  console.log(`   • Executive Dashboard: http://localhost:${PORT}/web/dash.html`);
  console.log(`   • Tickets Dashboard:   http://localhost:${PORT}/web/tickets.html`);
  console.log('');
  console.log('📂 Data file:');
  console.log(`   • API Data: http://localhost:${PORT}/data/execView.json`);
  console.log('');
  console.log('💡 Press Ctrl+C to stop the server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});
