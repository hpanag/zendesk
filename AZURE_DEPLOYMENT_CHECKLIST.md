# Azure Deployment Checklist

## 🔧 Required Files on Azure Server

### Core Server Files
- [x] `server.js` (main server file)
- [x] `package.json` (dependencies)
- [x] `.env` file with your environment variables

### Service Dependencies
- [x] `src/ZendeskClient.js`
- [x] `src/services/TicketAnalyticsService.js`
- [x] `src/services/TicketCacheService.js`
- [x] `src/services/CallAnalyticsService.js`
- [x] `src/services/ZendeskReportingService.js`
- [x] `src/services/gptResponder.js`

### Web Files
- [x] `web/` directory (all HTML/CSS/JS files)
- [x] `web/tickets.html` (the page showing the 404 error)

## 🔐 Environment Variables

Make sure your Azure server has a `.env` file with:

```
ZENDESK_SUBDOMAIN=your_subdomain
ZENDESK_EMAIL=your_email@domain.com
ZENDESK_API_TOKEN=your_api_token
OPENAI_API_KEY=your_openai_key
```

## 📦 Node.js Dependencies

Install dependencies on Azure server:

```bash
npm install
```

## 🚀 Starting the Server

Use this command to start the server on Azure:

```bash
# Start server (production)
node server.js

# Or with PM2 for production (recommended)
pm2 start server.js --name "zendesk-dashboard"
```

## 🌐 Port Configuration

Make sure your Azure server is configured to:
- Listen on the correct port (3000 or whatever your Azure app service expects)
- Allow HTTP traffic on that port
- Have proper firewall rules

## 🔍 Testing the API

Test these endpoints on your Azure server:

1. **Health Check**: `GET /health`
2. **Ticket Analytics**: `GET /api/ticket-analytics/5-day`
3. **Call Analytics**: `GET /api/call-analytics/5-day`

## 🐛 Common Issues

### 404 Error on `/api/ticket-analytics/5-day`

**Causes:**
1. Missing service files
2. Missing environment variables
3. Server not routing correctly
4. Missing dependencies

**Solutions:**
1. Verify all files from this checklist are present
2. Check server logs for errors
3. Test endpoints individually
4. Verify .env file has correct credentials

### Server Won't Start

**Check:**
1. Node.js version (needs >= 16.0.0)
2. All npm dependencies installed
3. Environment variables present
4. No port conflicts

## 📋 Quick Deployment Test

Run this command on your Azure server to test everything:

```bash
# Test server health
curl http://localhost:3000/health

# Test ticket analytics
curl http://localhost:3000/api/ticket-analytics/5-day

# Check if server is listening
netstat -tlnp | grep 3000
```

## 🔄 Updated Server Configuration

The server has been updated to properly handle query parameters. The main fix:

**Before:**
```javascript
if (req.url === '/api/ticket-analytics/5-day') {
```

**After:**
```javascript
if (req.url.startsWith('/api/ticket-analytics/5-day')) {
```

This allows URLs with query parameters like `/api/ticket-analytics/5-day?forceRefresh=true`.