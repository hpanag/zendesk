# Deployment Guide

This guide explains how to deploy the Zendesk Dashboard to any server.

## Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn
- Access to your Zendesk account (subdomain, email, API token)
- OpenAI API key (for chat functionality)

## Deployment Steps

### 1. Clone or Upload the Project

Upload all project files to your server, or clone from your repository:

```bash
git clone <your-repo-url>
cd zendesk
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and update it with your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
ZENDESK_SUBDOMAIN=your-subdomain
ZENDESK_EMAIL=your-email@example.com
ZENDESK_API_TOKEN=your-api-token-here
NODE_ENV=production
OPENAI_API_KEY=your-openai-api-key-here
PORT=3000
```

**Important Notes:**
- Most cloud providers (Azure, AWS, Heroku) automatically set the `PORT` environment variable
- The server will use `process.env.PORT` if available, otherwise defaults to 3000
- Never commit your `.env` file to version control

### 4. Start the Server

For production:

```bash
npm start
```

For development (with auto-restart):

```bash
npm run server
```

### 5. Access Your Dashboards

Once the server is running, you can access:

- **Main Navigation**: `http://your-server:PORT/web/cx.html`
- **Calls Dashboard**: `http://your-server:PORT/web/dash.html`
- **Tickets Dashboard**: `http://your-server:PORT/web/tickets-today.html`
- **Agent Dashboard**: `http://your-server:PORT/web/agent.html`

## Cloud Platform Specific Instructions

### Azure Web App

1. Create a new Web App in Azure Portal
2. Set up deployment from your Git repository
3. Configure Application Settings (environment variables) in the Azure Portal:
   - `ZENDESK_SUBDOMAIN`
   - `ZENDESK_EMAIL`
   - `ZENDESK_API_TOKEN`
   - `OPENAI_API_KEY`
   - `NODE_ENV=production`
4. Azure will automatically set the `PORT` variable
5. Deploy your code

### AWS Elastic Beanstalk

1. Install EB CLI: `pip install awsebcli`
2. Initialize: `eb init`
3. Create environment: `eb create production`
4. Set environment variables:
   ```bash
   eb setenv ZENDESK_SUBDOMAIN=your-subdomain \
            ZENDESK_EMAIL=your-email \
            ZENDESK_API_TOKEN=your-token \
            OPENAI_API_KEY=your-key \
            NODE_ENV=production
   ```
5. Deploy: `eb deploy`

### Heroku

1. Install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Set environment variables:
   ```bash
   heroku config:set ZENDESK_SUBDOMAIN=your-subdomain
   heroku config:set ZENDESK_EMAIL=your-email
   heroku config:set ZENDESK_API_TOKEN=your-token
   heroku config:set OPENAI_API_KEY=your-key
   heroku config:set NODE_ENV=production
   ```
5. Deploy: `git push heroku main`

### Docker

Create a `Dockerfile`:

```dockerfile
FROM node:16
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t zendesk-dashboard .
docker run -p 3000:3000 \
  -e ZENDESK_SUBDOMAIN=your-subdomain \
  -e ZENDESK_EMAIL=your-email \
  -e ZENDESK_API_TOKEN=your-token \
  -e OPENAI_API_KEY=your-key \
  -e NODE_ENV=production \
  zendesk-dashboard
```

### VPS or Dedicated Server

1. Install Node.js and npm
2. Upload your project files
3. Install PM2 for process management:
   ```bash
   npm install -g pm2
   ```
4. Create `.env` file with your credentials
5. Start with PM2:
   ```bash
   pm2 start server.js --name zendesk-dashboard
   pm2 save
   pm2 startup
   ```

## Architecture Changes for Deployment

### What Changed?

The following changes were made to ensure the application works on any server:

1. **Dynamic API Base URL**: Changed all frontend files from hardcoded `http://localhost:3000` to `window.location.origin`
   - `web/dash.html`
   - `web/tickets-today.html`
   - `web/agent.html`
   - `web/tickets.html`

2. **Flexible Port Configuration**: Updated `server.js` to use `process.env.PORT || 3000`

3. **Updated Start Script**: Changed `package.json` start script to run `server.js` instead of `src/index.js`

### How It Works

- **Frontend**: Uses `window.location.origin` to automatically detect the server URL
  - If deployed at `https://example.com`, frontend calls `https://example.com/api/...`
  - If running locally at `http://localhost:3000`, frontend calls `http://localhost:3000/api/...`

- **Backend**: Listens on whatever port is provided by the hosting environment
  - Cloud providers set `process.env.PORT` automatically
  - Falls back to port 3000 for local development

## Troubleshooting

### "Cannot connect to server" error

1. Check if server is running: `ps aux | grep node`
2. Check server logs for errors
3. Verify environment variables are set correctly
4. Ensure firewall allows traffic on the port

### "404 Not Found" on API calls

1. Verify the server started successfully
2. Check browser console for exact URL being called
3. Ensure all files were uploaded correctly
4. Check server logs for incoming requests

### "API authentication failed"

1. Verify your Zendesk credentials in `.env`
2. Test API token directly: `curl -u email/token:token https://your-subdomain.zendesk.com/api/v2/users/me.json`
3. Check that `.env` file is in the root directory

### Server starts but dashboards don't load

1. Check that `web/` folder was uploaded with all HTML files
2. Verify MIME types are being served correctly
3. Check browser console for JavaScript errors

## Security Notes

1. **Never commit `.env` to version control**
2. Use HTTPS in production (most cloud providers offer this automatically)
3. Consider adding rate limiting for API endpoints
4. Restrict CORS origins if needed (currently set to `*` for development)
5. Keep dependencies updated: `npm audit fix`

## Performance Tips

1. Enable gzip compression (handled by most cloud providers)
2. Use a CDN for static assets if needed
3. Consider implementing Redis caching for frequently accessed data
4. Monitor memory usage with PM2 or cloud provider tools

## Support

For issues or questions:
1. Check server logs
2. Review environment variables
3. Verify Zendesk API credentials
4. Test API endpoints directly with curl/Postman
