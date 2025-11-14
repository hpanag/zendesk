# SFTP Deployment Guide

This guide explains how to deploy your Zendesk Dashboard via SFTP to your server.

## Prerequisites

- SFTP access to your server (hostname, username, password/key)
- Node.js installed on the remote server
- Your Zendesk API credentials

## Option 1: Automated Deployment (Recommended)

### Method A: Using WinSCP (Windows)

1. **Update Configuration**:
   - Open `deploy-sftp.ps1` in a text editor
   - Update these values at the top:
     ```powershell
     $sftpHost = "your-server.com"
     $sftpUsername = "your-username"
     $sftpPassword = "your-password"
     $remoteDirectory = "/var/www/zendesk"  # or wherever you want files
     ```

2. **Install WinSCP** (if not already installed):
   - Download from: https://winscp.net/eng/download.php
   - Install to default location: `C:\Program Files (x86)\WinSCP\`

3. **Run Deployment**:
   ```powershell
   cd C:\Development\Zendesk
   .\deploy-sftp.ps1
   ```

### Method B: Using Posh-SSH Module

1. **Update Configuration**:
   - Open `deploy-sftp-poshssh.ps1`
   - Update the same configuration values as above

2. **Install Posh-SSH** (first time only):
   ```powershell
   Install-Module -Name Posh-SSH -Force -Scope CurrentUser
   ```

3. **Run Deployment**:
   ```powershell
   cd C:\Development\Zendesk
   .\deploy-sftp-poshssh.ps1
   ```

## Option 2: Manual SFTP Upload

### Using FileZilla

1. **Download FileZilla Client**:
   - https://filezilla-project.org/download.php?type=client

2. **Connect to Your Server**:
   - Host: `sftp://your-server.com`
   - Username: your username
   - Password: your password
   - Port: 22

3. **Upload These Files and Folders**:
   
   **Files** (upload to root of your remote directory):
   - `server.js`
   - `package.json`
   - `package-lock.json`
   - `.env.example` (will configure later)
   - `DEPLOYMENT.md`
   
   **Folders** (upload entire folders):
   - `src/` (all contents)
   - `web/` (all contents)
   - `data/` (all contents)

4. **DO NOT Upload**:
   - `.env` (contains your local credentials)
   - `.git/` folder
   - `node_modules/` folder
   - Any test files

### Using Command Line SFTP

```bash
# Connect to server
sftp username@your-server.com

# Create directory
mkdir /var/www/zendesk
cd /var/www/zendesk

# Upload files
put server.js
put package.json
put package-lock.json
put .env.example

# Upload directories
put -r src
put -r web
put -r data

# Exit
bye
```

## Option 3: Git Clone on Server (Easiest!)

If your server has git installed, this is the simplest method:

1. **SSH into your server**:
   ```bash
   ssh username@your-server.com
   ```

2. **Clone the repository**:
   ```bash
   cd /var/www  # or wherever you want to install
   git clone https://github.com/hpanag/zendesk.git
   cd zendesk
   ```

3. **Done!** Files are now on your server.

## After Upload: Server Configuration

Once files are on your server, SSH in and run these commands:

### 1. Navigate to Project Directory
```bash
ssh username@your-server.com
cd /var/www/zendesk  # or your deployment path
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
```bash
# Copy example file
cp .env.example .env

# Edit with your credentials
nano .env
```

Update these values in `.env`:
```env
ZENDESK_SUBDOMAIN=esolutionsfurniture
ZENDESK_EMAIL=hpanag@esolutionsfurniture.com
ZENDESK_API_TOKEN=your-actual-api-token
NODE_ENV=production
OPENAI_API_KEY=your-openai-key
PORT=3000
```

Save and exit (Ctrl+X, Y, Enter)

### 4. Start the Server

**Option A: Direct start** (for testing):
```bash
npm start
```

**Option B: Using PM2** (recommended for production):
```bash
# Install PM2 globally (first time only)
npm install -g pm2

# Start application
pm2 start server.js --name zendesk-dashboard

# Save PM2 configuration
pm2 save

# Setup PM2 to start on server boot
pm2 startup

# View logs
pm2 logs zendesk-dashboard

# Check status
pm2 status
```

**Option C: Using systemd** (advanced):
Create `/etc/systemd/system/zendesk-dashboard.service`:
```ini
[Unit]
Description=Zendesk Dashboard
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/var/www/zendesk
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable zendesk-dashboard
sudo systemctl start zendesk-dashboard
sudo systemctl status zendesk-dashboard
```

### 5. Configure Firewall (if needed)

```bash
# Allow port 3000
sudo ufw allow 3000

# Or if using different port
sudo ufw allow 8080
```

### 6. Setup Reverse Proxy with Nginx (Optional)

If you want to use port 80/443 instead of 3000:

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/zendesk-dashboard
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/zendesk-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Accessing Your Dashboard

Once the server is running, access your dashboards at:

- **Main Navigation**: `http://your-server:3000/web/cx.html`
- **Calls Dashboard**: `http://your-server:3000/web/dash.html`
- **Tickets Dashboard**: `http://your-server:3000/web/tickets-today.html`
- **Agent Dashboard**: `http://your-server:3000/web/agent.html`

If using Nginx reverse proxy on port 80:
- `http://your-domain.com/web/cx.html`

## Updating Your Deployment

### Using Git (if you used Option 3):
```bash
ssh username@your-server.com
cd /var/www/zendesk
git pull origin main
npm install  # if dependencies changed
pm2 restart zendesk-dashboard  # or npm start
```

### Using SFTP:
Re-run the deployment script or manually upload changed files via FileZilla.

## Troubleshooting

### Port 3000 already in use
```bash
# Find what's using the port
sudo lsof -i :3000
# Kill the process or change PORT in .env
```

### Permission denied
```bash
sudo chown -R your-username:your-username /var/www/zendesk
```

### Server not accessible from outside
- Check firewall rules
- Ensure server is binding to 0.0.0.0 not just localhost
- Check cloud provider security groups (AWS, Azure, etc.)

### Node.js not found
```bash
# Install Node.js 16+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Security Checklist

- ✅ Never commit `.env` file to git
- ✅ Use HTTPS in production (setup SSL certificate)
- ✅ Keep dependencies updated: `npm audit fix`
- ✅ Use strong passwords for SFTP/SSH access
- ✅ Consider using SSH keys instead of passwords
- ✅ Setup a firewall on your server
- ✅ Regular backups of your server

## Support

For issues:
1. Check server logs: `pm2 logs zendesk-dashboard` or `journalctl -u zendesk-dashboard`
2. Verify environment variables are set correctly
3. Test Zendesk API credentials
4. Check network connectivity from server to Zendesk API
