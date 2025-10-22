require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateChatReply } = require('./src/services/gptResponder');
const CallAnalyticsService = require('./src/services/CallAnalyticsService');
const TicketAnalyticsService = require('./src/services/TicketAnalyticsService');

const PORT = 3000;
const callAnalytics = new CallAnalyticsService();
const ticketAnalytics = new TicketAnalyticsService();

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

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

async function handleChatRequest(req, res) {
  console.log(`📝 Handling chat request: ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
    if (body.length > 1e6) {
      console.log('❌ Request too large');
      req.socket.destroy();
    }
  });

  req.on('end', async () => {
    try {
      console.log('📄 Request body received, length:', body.length);
      const payload = body ? JSON.parse(body) : {};
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      
      console.log('🤖 Generating chat reply...');
      const result = await generateChatReply(messages);
      
      console.log('✅ Chat reply generated, source:', result.source);
      sendJson(res, 200, {
        reply: result.reply,
        source: result.source
      });
    } catch (error) {
      console.error('❌ Error handling GPT-5 chat request:', error);
      sendJson(res, 500, {
        error: 'Failed to process GPT-5 request',
        details: error.message
      });
    }
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error);
    sendJson(res, 400, { error: 'Bad request' });
  });
}

// Handle call analytics requests
async function handleCallAnalyticsRequest(req, res, period = '5-day') {
  try {
    console.log(`📊 Fetching ${period} call analytics...`);
    
    // Check for forceRefresh query parameter
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';
    
    if (forceRefresh) {
      console.log('🔄 Force refresh requested - fetching all call data from API');
    }
    
    let analytics;
    if (period === '30-day') {
      analytics = await callAnalytics.get30DayCallAnalytics(null, forceRefresh);
    } else {
      analytics = await callAnalytics.get5DayCallAnalytics(forceRefresh);
    }
    
    console.log('📈 Analytics data received, preparing response...');
    console.log('📋 Analytics success:', analytics?.success);
    console.log('📋 Analytics data keys:', analytics?.data ? Object.keys(analytics.data) : 'No data');
    console.log('📋 Cache info:', analytics?.data?.cache_info ? `${analytics.data.cache_info.fresh_entries} fresh, ${analytics.data.cache_info.expired_entries} expired` : 'No cache info');
    
    console.log('📤 Sending JSON response...');
    sendJson(res, 200, analytics);
    console.log('✅ Response sent successfully');
  } catch (error) {
    console.error(`❌ Error fetching ${period} call analytics:`, error);
    sendJson(res, 500, {
      success: false,
      error: `Failed to fetch ${period} call analytics`,
      details: error.message
    });
  }
}

// Handle real-time call analytics requests
async function handleRealTimeCallAnalyticsRequest(req, res) {
  try {
    console.log('🔴 Fetching real-time call analytics...');
    const analytics = await callAnalytics.getRealTimeCallAnalytics();
    sendJson(res, 200, analytics);
  } catch (error) {
    console.error('❌ Error fetching real-time analytics:', error);
    sendJson(res, 500, {
      success: false,
      error: 'Failed to fetch real-time analytics',
      details: error.message
    });
  }
}

// Handle ticket analytics requests
async function handleTicketAnalyticsRequest(req, res, period = '5-day') {
  try {
    console.log(`🎫 Fetching ${period} ticket analytics...`);
    
    // Check for forceRefresh query parameter
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';
    
    if (forceRefresh) {
      console.log('🔄 Force refresh requested - fetching all data from API');
    }
    
    let analytics;
    if (period === '5-day') {
      analytics = await ticketAnalytics.get5DayTicketAnalytics(forceRefresh);
    } else {
      // For future expansion
      analytics = await ticketAnalytics.get5DayTicketAnalytics(forceRefresh);
    }
    
    console.log('📈 Ticket analytics data received, preparing response...');
    console.log('📋 Analytics success:', analytics?.success);
    console.log('📋 Analytics data keys:', analytics?.data ? Object.keys(analytics.data) : 'No data');
    console.log('📋 Cache info:', analytics?.data?.cache_info ? `${analytics.data.cache_info.fresh_entries} fresh, ${analytics.data.cache_info.expired_entries} expired` : 'No cache info');
    
    console.log('📤 Sending JSON response...');
    sendJson(res, 200, analytics);
    console.log('✅ Response sent successfully');
  } catch (error) {
    console.error(`❌ Error fetching ${period} ticket analytics:`, error);
    sendJson(res, 500, {
      success: false,
      error: `Failed to fetch ${period} ticket analytics`,
      details: error.message
    });
  }
}

// Handle current ticket counts request
async function handleCurrentTicketCountsRequest(req, res) {
  try {
    console.log('🎫 Fetching current ticket counts...');
    const counts = await ticketAnalytics.getCurrentTicketCounts();
    sendJson(res, 200, counts);
  } catch (error) {
    console.error('❌ Error fetching current ticket counts:', error);
    sendJson(res, 500, {
      success: false,
      error: 'Failed to fetch current ticket counts',
      details: error.message
    });
  }
}

// Handle clear cache request
async function handleClearCacheRequest(req, res) {
  try {
    console.log('🗑️ Clearing ticket analytics cache...');
    const result = await ticketAnalytics.clearCache();
    
    console.log('📈 Cache clear result:', result?.success);
    
    sendJson(res, 200, result);
    console.log('✅ Cache clear response sent');
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    sendJson(res, 500, {
      success: false,
      error: 'Failed to clear cache',
      details: error.message
    });
  }
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  console.log('🔍 Debug - Full URL:', req.url);
  console.log('🔍 Debug - Starts with /api/gpt5-chat:', req.url.startsWith('/api/gpt5-chat'));

  // Health check endpoint
  if (req.url === '/health' || req.url === '/api/health') {
    console.log('❤️ Health check request');
    sendJson(res, 200, { 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mode: 'real-time'
    });
    return;
  }

  // Call Analytics endpoints
  if (req.url === '/api/call-analytics' || req.url === '/api/call-analytics/5-day') {
    console.log('📞 Call analytics request (5-day)');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleCallAnalyticsRequest(req, res, '5-day');
      return;
    }
  }

  // 30-day Call Analytics endpoint
  if (req.url === '/api/call-analytics/30-day') {
    console.log('📞 Call analytics request (30-day)');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleCallAnalyticsRequest(req, res, '30-day');
      return;
    }
  }

  // Real-time call analytics endpoint
  if (req.url === '/api/call-analytics/realtime') {
    console.log('🔴 Real-time call analytics request');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization', 
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleRealTimeCallAnalyticsRequest(req, res);
      return;
    }
  }

  // Ticket Analytics endpoints
  if (req.url === '/api/ticket-analytics' || req.url === '/api/ticket-analytics/5-day') {
    console.log('🎫 Ticket analytics request (5-day)');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleTicketAnalyticsRequest(req, res, '5-day');
      return;
    }
  }

  // Current ticket counts endpoint
  if (req.url === '/api/ticket-analytics/current') {
    console.log('🎫 Current ticket counts request');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleCurrentTicketCountsRequest(req, res);
      return;
    }
  }

  // Clear cache endpoint
  if (req.url === '/api/ticket-analytics/clear-cache') {
    console.log('🗑️ Clear cache request');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'POST') {
      handleClearCacheRequest(req, res);
      return;
    }
  }

  if (req.url.startsWith('/api/gpt5-chat')) {
    console.log('🎯 Routing to chat handler');
    handleChatRequest(req, res);
    return;
  }

  // Default to index.html if requesting root
  let filePath = req.url === '/' ? '/web/index.html' : req.url;
  
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

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit, just log the error
});
