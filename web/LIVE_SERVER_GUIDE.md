# Zendesk GPT-5 Chat Interface

## 🚀 Quick Start Guide

### Option 1: Use VS Code Live Server (Recommended for Development)

1. **Start the Node.js API Server:**
   ```bash
   node server.js
   ```
   ✅ Server will run at `http://localhost:3000`

2. **Open in VS Code Live Server:**
   - Right-click on `index.html` in VS Code
   - Select "Open with Live Server"
   - ✅ Browser opens at `http://127.0.0.1:5501/web/`
   - ✅ Chat interface automatically connects to the API server on port 3000

### Option 2: Use Node.js Server Directly

1. **Start the Node.js Server:**
   ```bash
   node server.js
   ```

2. **Open in Browser:**
   - Navigate to `http://localhost:3000`
   - ✅ Both web interface and API run on the same server

## 🔧 How It Works

- **Live Server (Port 5501):** Serves the web interface with hot reload
- **Node.js Server (Port 3000):** Handles GPT-5 API requests and Zendesk data
- **Smart Connection:** The interface automatically detects which port it's running on and connects to the correct API endpoint

## 🟢 Connection Status

The interface shows a connection status indicator:
- ✅ **Green:** Connected to GPT-5 server
- ⚠️ **Yellow:** Server needs to be started (`node server.js`)
- ❌ **Red:** Server offline

## 🐛 Troubleshooting

### "ERR_CONNECTION_REFUSED" Error

**Problem:** VS Code Live Server can't connect to the API

**Solution:**
1. Make sure Node.js server is running: `node server.js`
2. Check the terminal for any errors
3. Verify server is listening on port 3000

### API Endpoint Issues

The interface automatically detects:
- **Port 5501:** Uses `http://localhost:3000/api/gpt5-chat`
- **Port 3000:** Uses `/api/gpt5-chat` (relative path)
- **Other ports:** Falls back to `http://localhost:3000/api/gpt5-chat`

## 📊 Features

- Real-time Zendesk reporting
- Voice/call analytics
- Ticket metrics
- Agent performance
- Customer satisfaction tracking
- System configuration insights
- **61 different Zendesk API endpoints** integrated

## 🛠️ Development

- Edit files and see changes instantly with Live Server
- Check browser console for debugging information
- Server logs show all API requests and responses