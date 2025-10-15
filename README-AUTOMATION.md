# Zendesk Executive Dashboard - Automated Daily Data Collection

## Overview

This system automatically collects Zendesk metrics daily at **11:30 PM** to provide executive-level insights into call center operations and ticket management. The data collection captures end-of-day snapshots to ensure accurate reporting.

## What Gets Collected

### 1. Voice Metrics (Weekdays Only)
- Total Inbound Calls
- Not Answered Calls (Abandoned)
- Outbound Calls

*Note: Voice metrics are only collected on weekdays (Monday-Friday) when the call center is operating.*

### 2. Ticket Status Snapshots (Daily)
The system takes a **point-in-time snapshot** of ticket counts in each status:
- **New**: Tickets just created
- **Open**: Tickets being actively worked
- **Pending**: Tickets waiting for customer response
- **Hold**: Tickets temporarily paused
- **Solved**: Tickets marked as resolved
- **Closed**: Tickets permanently closed

**Important**: These are **current status counts** (e.g., "there are 145 open tickets right now"), not activity counts. This gives you an accurate view of your workload at the end of each day.

## Scheduled Task

### Setup

The automated collection is configured via Windows Task Scheduler:

```powershell
# To set up the scheduled task (if not already done):
.\setup-scheduled-task-simple.ps1
```

### Schedule Details
- **Task Name**: `Zendesk-ExecView-Daily`
- **Run Time**: 11:30 PM (23:30) daily
- **Script**: `execView.js`
- **Purpose**: Captures end-of-day ticket status and daily voice metrics

### Manual Operations

```powershell
# Test the task immediately (doesn't wait for 11:30 PM)
Start-ScheduledTask -TaskName 'Zendesk-ExecView-Daily'

# View task in Task Scheduler GUI
taskschd.msc

# Remove the scheduled task
Unregister-ScheduledTask -TaskName 'Zendesk-ExecView-Daily' -Confirm:$false

# Run the script manually (for testing/debugging)
node execView.js
```

### Running While Logged Out

By default, the task runs only when you're logged in. To run it 24/7 (even when logged out):

1. Open Task Scheduler (`taskschd.msc`)
2. Find `Zendesk-ExecView-Daily` in Task Scheduler Library
3. Right-click → Properties
4. Check **"Run whether user is logged on or not"**
5. Click OK (you'll need to enter your Windows password)

## How It Works

### Smart Caching
The script fetches data **once per day**. If you run it multiple times on the same day, it uses cached data to avoid unnecessary API calls:

```
First run today:  Fetches fresh data from Zendesk
Second run today: Uses cached data (instant)
Next day:         Fetches fresh data again
```

To force a refresh, delete the cache file:
```powershell
Remove-Item data\execView.json
node execView.js
```

### Data Storage

All data is stored in `data/execView.json`:
- **Retention**: Unlimited (data is never deleted)
- **Format**: JSON with metadata and daily trends
- **Size**: ~1-6 KB (grows slowly over time)

### API Rate Limiting

The script includes built-in rate limiting to respect Zendesk API quotas:
- **500ms delay** between status queries (6 queries per day)
- **Maximum**: 6 API calls for tickets + 1 for voice = 7 API calls/day
- **Well below** Zendesk's rate limit of 2500 requests/minute

## Dashboard

View the collected data in your browser:

```
http://localhost:3000/web/dash.html
```

**Prerequisites**: The server must be running:
```powershell
node server.js  # Starts on port 3000
```

The dashboard displays:
- **Last 10 weekdays** of voice call metrics (bar chart)
- **Last 10 weekdays** of ticket status (line + bar chart)
- **Current ticket counts** by status (table)

## Files

```
Zendesk/
├── execView.js                         # Main data collection script
├── backfillData.js                     # Historical data backfill (one-time use)
├── server.js                           # HTTP server for dashboard
├── setup-scheduled-task-simple.ps1     # Automated task setup
├── data/
│   └── execView.json                   # Collected metrics (persistent)
├── web/
│   └── dash.html                       # Executive dashboard
└── README-AUTOMATION.md                # This file
```

## Troubleshooting

### Task Not Running

```powershell
# Check task status
Get-ScheduledTask -TaskName 'Zendesk-ExecView-Daily'

# View last run result (0 = success)
(Get-ScheduledTaskInfo -TaskName 'Zendesk-ExecView-Daily').LastTaskResult

# Check task history in Event Viewer
eventvwr.msc → Task Scheduler → History
```

### No Data Being Collected

```powershell
# Run manually to see error messages
node execView.js

# Check if .env file exists with credentials
Get-Content .env
```

### API Authentication Errors

Verify your `.env` file contains:
```
ZENDESK_SUBDOMAIN=your-subdomain
ZENDESK_EMAIL=your-email@company.com
ZENDESK_API_TOKEN=your-api-token
```

### Weekend Data

The system works slightly differently on weekends:
- **Ticket snapshots**: ✅ Collected (shows workload even when closed)
- **Voice metrics**: ⏭️ Skipped (call center closed)

This is intentional - you'll see ticket counts grow on weekends as customers submit requests, even though no one is working them.

## Historical Data

If you need to backfill historical data (already done through Oct 10):

```powershell
node backfillData.js 2025-10-11 2025-10-15
```

**Note**: Historical backfill will show **current** ticket status counts, not what they were on those dates (this is a Zendesk API limitation).

## Maintenance

### Update Schedule Time

Edit `setup-scheduled-task-simple.ps1`, change the `$runTime` variable, then rerun:

```powershell
# Change from 23:30 to 22:00 (10 PM)
$runTime = "22:00"

# Apply change
.\setup-scheduled-task-simple.ps1
```

### Monitor Data File Growth

```powershell
# Check current file size
Get-Item data\execView.json | Select-Object Name, Length, LastWriteTime

# View how many days of data
(Get-Content data\execView.json | ConvertFrom-Json).trends.tickets.byStatus.Count
```

## Support

For issues or questions about:
- **Zendesk API**: https://developer.zendesk.com/api-reference/
- **Task Scheduler**: https://docs.microsoft.com/en-us/windows/desktop/taskschd/
- **This script**: Check `execView.js` comments or run with error logging

---

**Last Updated**: October 12, 2025
**Version**: 1.0.0
