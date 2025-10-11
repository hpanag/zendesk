# 🌐 Zendesk Dashboard - Server Setup

## Problem: CORS Error

When opening HTML files directly in a browser using `file://` protocol, browsers block access to other local files (like JSON data) for security reasons. This causes the error:

```
Access to fetch at 'file:///C:/Development/Zendesk/data/execView.json' from origin 'null' 
has been blocked by CORS policy
```

## Solution: Local Web Server

We've created a simple Node.js web server (`server.js`) that serves the dashboard over HTTP instead of the file protocol.

---

## 🚀 Quick Start

### 1. Start the Server
```powershell
node server.js
```

### 2. Open the Dashboard
The server will display available URLs. Open in your browser:
- **Executive Dashboard:** http://localhost:3000/web/dash.html
- **Tickets Dashboard:** http://localhost:3000/web/tickets.html

### 3. Stop the Server
Press `Ctrl+C` in the terminal

---

## 📊 Available Dashboards

### Executive Dashboard (`dash.html`)
- Voice calls chart (answered vs not answered)
- Ticket activity chart (line + bars)
- Ticket status table (all 6 statuses)
- URL: http://localhost:3000/web/dash.html

### Tickets Dashboard (`tickets.html`)
- Ticket activity chart (line + bars)
- Ticket status table (all 6 statuses)
- URL: http://localhost:3000/web/tickets.html

---

## 🔄 Update Data Workflow

### Step 1: Update Data
```powershell
node execView.js
```
This fetches fresh data from Zendesk API (takes ~2-3 minutes)

### Step 2: Refresh Browser
Simply reload the dashboard page in your browser to see updated data.

**Note:** The server doesn't need to be restarted when data updates.

---

## 🔧 Server Features

✅ **No CORS issues** - Serves files over HTTP
✅ **Auto-routing** - Root URL redirects to main dashboard
✅ **MIME types** - Proper content types for all file types
✅ **Live reload** - Just refresh browser after data updates
✅ **Console logging** - See all requests in terminal
✅ **Graceful shutdown** - Ctrl+C cleanly stops server

---

## 📝 Server Details

- **Port:** 3000
- **Protocol:** HTTP
- **CORS:** Enabled (allows cross-origin requests)
- **File Types:** HTML, CSS, JS, JSON, images
- **Directory:** Serves all files from project root

---

## 🐛 Troubleshooting

### Port Already in Use
If you see "port 3000 already in use":
```powershell
# Find and kill the process using port 3000
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess | Get-Process | Stop-Process
```

Then restart the server:
```powershell
node server.js
```

### Dashboard Not Loading
1. Check that server is running (you should see the banner in terminal)
2. Verify URL is `http://localhost:3000/web/dash.html` (not `file://`)
3. Check browser console for errors (F12)
4. Ensure `data/execView.json` exists

### Data Not Updating
1. Run `node execView.js` to fetch fresh data
2. Wait for "Data saved successfully" message
3. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### Server Won't Stop
If `Ctrl+C` doesn't work:
```powershell
# Find the node process
Get-Process node

# Kill it
Stop-Process -Name node
```

---

## 🎯 Daily Workflow

### Morning Setup
```powershell
# 1. Start server (leave running all day)
node server.js

# 2. Open dashboard in browser
# Visit: http://localhost:3000/web/dash.html
```

### Update Data (as needed)
```powershell
# In a NEW terminal window (keep server running)
node execView.js

# Then refresh browser
```

### End of Day
```powershell
# Stop server
Ctrl+C
```

---

## 💡 Pro Tips

1. **Bookmark the URL:** Save http://localhost:3000/web/dash.html in your browser
2. **Keep server running:** No need to stop/start between data updates
3. **Multiple dashboards:** Can view both dash.html and tickets.html simultaneously
4. **Real-time data:** Today's voice metrics update throughout the day
5. **Auto-start option:** Can add server.js to Windows startup scripts

---

## 🔒 Security Note

This server is for **local development only**:
- Only accessible from your computer (localhost)
- Not exposed to the internet
- No authentication required
- Safe for internal dashboards

**Do not deploy this server to production without:**
- Authentication/authorization
- HTTPS/SSL encryption
- Input validation
- Rate limiting
- Proper error handling

---

## 📦 Alternative: Python Server

If you prefer Python, you can also use:
```powershell
# Python 3
cd C:\Development\Zendesk
python -m http.server 3000
```

Then open: http://localhost:3000/web/dash.html

**Note:** The Node.js server is recommended as it has better routing and error handling.

---

## 🔗 Related Files

- **`server.js`** - Web server code
- **`execView.js`** - Data collection script
- **`web/dash.html`** - Main executive dashboard
- **`web/tickets.html`** - Tickets-only dashboard
- **`data/execView.json`** - Data file (updated by execView.js)

---

## ✅ Server Status Check

When server is running correctly, you should see:
```
🌐 Zendesk Dashboard Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Server running at http://localhost:3000/

📊 Available dashboards:
   • Executive Dashboard: http://localhost:3000/web/dash.html
   • Tickets Dashboard:   http://localhost:3000/web/tickets.html

📂 Data file:
   • API Data: http://localhost:3000/data/execView.json

💡 Press Ctrl+C to stop the server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

And when you access the dashboard, terminal will show:
```
GET /web/dash.html
  ✓ 200 OK (text/html)
GET /data/execView.json
  ✓ 200 OK (application/json)
```

---

## End of Guide

**Quick Command:**
```powershell
node server.js
```

**Dashboard URL:**
```
http://localhost:3000/web/dash.html
```

That's it! Your dashboard is now accessible without CORS errors. 🎉
