# Call Center Web Dashboard

A modern, responsive web dashboard for visualizing real-time call center metrics and analytics.

## 🌟 Features

- **Real-time Data**: Displays live call center metrics with auto-refresh every 30 seconds
- **Interactive Charts**: Beautiful visualizations using Chart.js
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Agent Status**: Live agent status breakdown (online, away, offline, on call)
- **Call Analytics**: Comprehensive call metrics including volume, wait times, and performance
- **Export Functionality**: Download data as JSON for further analysis

## 📊 Dashboard Components

### Main Status Cards
- Calls in Queue (real-time)
- Agents Online/Total
- Total Calls Today
- Average Wait Time

### Charts & Visualizations
- **Agent Status Pie Chart**: Visual breakdown of agent availability
- **Call Volume Trends**: Hourly call volume throughout the day
- **Queue Performance**: Answered vs abandoned vs exceeded wait time
- **Wait Time Distribution**: Analysis of call wait time patterns

### Detailed Metrics
- Call volume breakdown (inbound/outbound/callbacks)
- Queue performance metrics (abandoned, exceeded wait time)
- Timing analytics (duration, answer time, hold time)

## 🚀 Quick Start

### 1. Sync Latest Data
```bash
npm run web-sync
```

### 2. Start Web Server
```bash
npm run web-serve
```

### 3. Open Dashboard
Navigate to: http://localhost:8080

### 4. Auto-sync & Serve (Combined)
```bash
npm run dashboard
```

## 📁 File Structure

```
web/
├── index.html              # Main dashboard page
├── assets/
│   ├── css/
│   │   └── dashboard.css   # Styling and themes
│   ├── js/
│   │   └── dashboard.js    # Dashboard logic and charts
│   └── data/
│       └── live-feed-latest.json  # Synced data file
├── sync-data.js            # Data synchronization script
└── README.md               # This file
```

## 🔄 Data Synchronization

The dashboard automatically syncs with your live call center data:

### Manual Sync
```bash
npm run web-sync
```

### Continuous Sync (Watch Mode)
```bash
npm run web-watch
```

This will:
1. Monitor the main `/data` directory for new live-feed files
2. Automatically copy the latest data to `web/assets/data/`
3. Update the dashboard in real-time

## 🎨 Customization

### Themes
The dashboard uses CSS custom properties for easy theming. Edit `assets/css/dashboard.css`:

```css
:root {
    --primary-color: #2563eb;    /* Main brand color */
    --success-color: #059669;    /* Success/positive metrics */
    --warning-color: #d97706;    /* Warning/attention needed */
    --danger-color: #dc2626;     /* Critical/negative metrics */
}
```

### Charts
Chart configurations are in `assets/js/dashboard.js`. Each chart can be customized:

```javascript
// Example: Change chart colors
backgroundColor: [
    '#059669', // Green
    '#d97706', // Orange  
    '#dc2626', // Red
    '#2563eb'  // Blue
]
```

## 📱 Mobile Responsive

The dashboard is fully responsive and adapts to different screen sizes:

- **Desktop**: Full grid layout with all charts visible
- **Tablet**: Stacked layout with optimized chart sizes  
- **Mobile**: Single column layout with touch-friendly interface

## 🔧 Technical Details

### Dependencies
- **Chart.js**: Modern charting library for data visualization
- **Font Awesome**: Icons and visual elements
- **Vanilla JavaScript**: No framework dependencies for fast loading

### Browser Support
- Chrome/Edge: Full support
- Firefox: Full support  
- Safari: Full support
- Mobile browsers: Optimized experience

### Performance
- Auto-pause refresh when tab is not active
- Efficient chart updates without full redraws
- Minimal HTTP requests with local data caching

## 🌐 Hosting Options

### Local Development
```bash
npm run dashboard
```
Access at: http://localhost:8080

### Static File Hosting
The entire `web/` directory can be deployed to any static hosting service:

- **GitHub Pages**: Push to gh-pages branch
- **Netlify**: Connect to repository and set build directory to `web/`
- **Vercel**: Deploy as static site
- **AWS S3**: Upload web directory to S3 bucket
- **Azure Static Web Apps**: Deploy directly from repository

### Server Setup
For production, ensure your web server:
1. Serves the `web/` directory as document root
2. Has a process to run `npm run web-sync` regularly (cron job)
3. Optionally runs `npm run web-watch` as a background service

## 🔒 Security Notes

- The dashboard loads data from local JSON files (no direct API calls)
- No sensitive credentials are exposed in the web interface
- Data is read-only - no ability to modify call center settings
- HTTPS recommended for production deployments

## 🐛 Troubleshooting

### No Data Displayed
1. Check if `web/assets/data/live-feed-latest.json` exists
2. Run `npm run web-sync` manually
3. Verify the source data directory has recent live-feed files

### Charts Not Loading
1. Check browser console for JavaScript errors
2. Ensure Chart.js CDN is accessible
3. Verify data format matches expected structure

### Auto-refresh Not Working
1. Check if tab is active (auto-pauses when hidden)
2. Look for network errors in browser dev tools
3. Verify data sync is working properly

## 📈 Future Enhancements

- Historical data trends and comparisons
- Alert notifications for critical metrics
- Custom dashboard layouts and widgets
- Real-time notifications via WebSocket
- Advanced filtering and date range selection
- Integration with additional data sources

## 🤝 Contributing

To add new features or modify the dashboard:

1. Edit HTML structure in `index.html`
2. Add styling in `assets/css/dashboard.css`
3. Implement functionality in `assets/js/dashboard.js`
4. Test with sample data before deploying
5. Update this README with any new features

---

**Last Updated**: October 2025  
**Version**: 1.0.0