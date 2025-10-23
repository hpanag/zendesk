# 🚀 Azure Deployment Instructions

## The Problem
Your Azure server is returning a **404 error** for `/api/ticket-analytics/5-day` because either:
1. Missing files
2. Missing environment variables 
3. Server not routing correctly (FIXED)
4. Missing dependencies

## ✅ The Solution

### 1. Fixed Server Routing
The main issue has been fixed in `server.js`. The URL matching now properly handles query parameters:

**Before (broken):**
```javascript
if (req.url === '/api/ticket-analytics/5-day') {
```

**After (fixed):**
```javascript
if (req.url.startsWith('/api/ticket-analytics/5-day')) {
```

### 2. Upload All Required Files to Azure

Make sure your Azure server has these files:

#### Core Files:
- `server.js` (updated with the fix)
- `package.json`
- `.env` (with your Zendesk credentials)

#### Source Code:
- `src/ZendeskClient.js`
- `src/services/TicketAnalyticsService.js`
- `src/services/TicketCacheService.js`
- `src/services/CallAnalyticsService.js`
- `src/services/ZendeskReportingService.js`
- `src/services/gptResponder.js`

#### Web Files:
- Entire `web/` directory
- `web/tickets.html` (where you're seeing the error)

### 3. Environment Variables

Create `.env` file on Azure server:
```
ZENDESK_SUBDOMAIN=your_subdomain
ZENDESK_EMAIL=your_email@domain.com
ZENDESK_API_TOKEN=your_api_token
OPENAI_API_KEY=your_openai_key
```

### 4. Install Dependencies

On your Azure server, run:
```bash
npm install
```

### 5. Run Diagnostic Script

Upload and run the diagnostic script to check everything:
```bash
node azure-diagnostic.js
```

### 6. Start the Server

```bash
# Start server
node server.js

# Or with PM2 for production (recommended)
npm install -g pm2
pm2 start server.js --name "zendesk-dashboard"
pm2 save
pm2 startup
```

## 🧪 Testing

After deployment, test these URLs on your Azure server:

1. **Health Check**: `https://your-azure-app.azurewebsites.net/health`
2. **Ticket Analytics**: `https://your-azure-app.azurewebsites.net/api/ticket-analytics/5-day`
3. **Dashboard**: `https://your-azure-app.azurewebsites.net/web/tickets.html`

## 🔍 Troubleshooting

### Still Getting 404?

1. **Check server logs** on Azure for errors
2. **Verify all files uploaded** using the diagnostic script
3. **Check environment variables** are set correctly
4. **Ensure dependencies installed** with `npm install`

### Port Issues?

If Azure uses a different port, update your server to listen on `process.env.PORT`:

```javascript
const PORT = process.env.PORT || 3000;
```

### Missing Cache Directory?

The `TicketCacheService` creates a cache directory. Ensure Azure has write permissions:
- Check if `cache/` directory can be created
- Verify file system permissions

## 📞 Quick Test Commands

Run these on your Azure server:

```bash
# Test server health
curl http://localhost:3000/health

# Test ticket analytics
curl http://localhost:3000/api/ticket-analytics/5-day

# Check server process
ps aux | grep node

# Check port usage
netstat -tlnp | grep 3000
```

## ✨ What Changed

The key fix was updating the URL routing in `server.js` to handle query parameters properly. This ensures that requests like:
- `/api/ticket-analytics/5-day`
- `/api/ticket-analytics/5-day?forceRefresh=true` 
- `/api/ticket-analytics/5-day?timestamp=123`

All get routed correctly to the ticket analytics handler.

---

After following these steps, your Azure server should properly serve the ticket analytics API and resolve the 404 error!