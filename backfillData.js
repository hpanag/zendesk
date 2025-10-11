const ZendeskClient = require('./src/ZendeskClient');
const fs = require('fs');
const path = require('path');

/**
 * Backfill Historical Data Script
 * 
 * This script fills in missing historical data for a date range.
 * Run this only when you need to populate historical data.
 * 
 * Usage: node backfillData.js [startDate] [endDate]
 * Example: node backfillData.js 2025-09-25 2025-10-05
 */

class BackfillDataGenerator {
  constructor() {
    this.zendesk = new ZendeskClient();
    this.dataFilePath = path.join(__dirname, 'data', 'execView.json');
  }

  getWeekdaysInRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      
      // Only include weekdays (Mon-Fri)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        dates.push(new Date(current));
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  async fetchVoiceDataForDate(date) {
    const dateStr = date.toISOString().split('T')[0];
    console.log(`📅 Fetching voice data for ${dateStr} (${date.toLocaleDateString('en-US', { weekday: 'short' })})...`);
    
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
      
      const response = await this.zendesk.makeRequest('GET', 
        `/incremental/tickets.json?start_time=${startTimestamp}`
      );
      
      const dayTickets = response.tickets ? response.tickets.filter(ticket => {
        const createdAt = new Date(ticket.created_at);
        const isThisDay = createdAt >= startOfDay && createdAt <= endOfDay;
        const isVoice = ticket.via?.channel === 'voice';
        return isThisDay && isVoice;
      }) : [];
      
      console.log(`  Found ${dayTickets.length} voice tickets`);
      
      let metrics = {
        inbound: 0,
        abandoned: 0,
        outbound: 0
      };
      
      for (const ticket of dayTickets) {
        const subject = (ticket.subject || '').toLowerCase();
        const description = (ticket.description || '').toLowerCase();
        const via = ticket.via || {};
        
        if (via.source?.rel === 'outbound' || subject.includes('outbound')) {
          metrics.outbound++;
        } else {
          metrics.inbound++;
        }
        
        if (subject.includes('abandoned') || subject.includes('missed') || 
            subject.includes('unanswered') || description.includes('abandoned') || 
            description.includes('no answer') || description.includes('missed call')) {
          metrics.abandoned++;
        }
      }
      
      console.log(`  Summary: ${metrics.inbound} inbound, ${metrics.outbound} outbound, ${metrics.abandoned} abandoned`);
      
      return {
        totalInboundCalls: metrics.inbound,
        notAnsweredCalls: metrics.abandoned,
        outboundCalls: metrics.outbound
      };
      
    } catch (error) {
      console.error(`  Error fetching voice data for ${dateStr}:`, error.message);
      return {
        totalInboundCalls: 0,
        notAnsweredCalls: 0,
        outboundCalls: 0
      };
    }
  }

  async fetchTicketDataForDate(date) {
    const dateStr = date.toISOString().split('T')[0];
    console.log(`📊 Fetching ticket data for ${dateStr}...`);
    
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const statusCounts = {
      date: dateStr,
      new: 0,
      open: 0,
      pending: 0,
      hold: 0,
      solved: 0,
      closed: 0
    };

    try {
      const startTime = new Date(dateStr + 'T00:00:00Z').getTime() / 1000;
      const endTime = new Date(nextDay.toISOString().split('T')[0] + 'T00:00:00Z').getTime() / 1000;
      
      let url = `/incremental/tickets.json?start_time=${startTime}`;
      let hasMore = true;
      
      while (hasMore && url) {
        const response = await this.zendesk.makeRequest('GET', url);
        
        for (const ticket of response.tickets) {
          const ticketDate = new Date(ticket.updated_at);
          
          if (ticketDate >= date && ticketDate < nextDay) {
            const status = ticket.status;
            if (statusCounts.hasOwnProperty(status)) {
              statusCounts[status]++;
            }
          }
        }
        
        if (response.end_time >= endTime) {
          hasMore = false;
        } else {
          url = response.next_page;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`  ${dateStr}: new:${statusCounts.new} open:${statusCounts.open} pending:${statusCounts.pending} hold:${statusCounts.hold} solved:${statusCounts.solved} closed:${statusCounts.closed}`);
    } catch (error) {
      console.error(`  Error fetching tickets for ${dateStr}:`, error.message);
    }

    return statusCounts;
  }

  async backfill(startDate, endDate) {
    console.log('🔄 Starting historical data backfill...');
    console.log(`📅 Date range: ${startDate} to ${endDate}`);
    
    // Load existing data
    let existingData = {
      metadata: {
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        description: "Executive View - Daily KPI Dashboard with Historical Trends",
        dataRetentionDays: 90,
        kpiCategories: ["voice", "tickets"]
      },
      dailyKPIs: {},
      trends: {
        voice: {
          totalInboundCalls: [],
          notAnsweredCalls: [],
          outboundCalls: []
        },
        tickets: {
          byStatus: []
        }
      }
    };

    if (fs.existsSync(this.dataFilePath)) {
      console.log('📂 Loading existing data...');
      const fileContent = fs.readFileSync(this.dataFilePath, 'utf8');
      existingData = JSON.parse(fileContent);
      console.log(`✅ Loaded existing data with ${existingData.trends.voice.totalInboundCalls.length} voice entries and ${existingData.trends.tickets.byStatus.length} ticket entries`);
    }

    // Get weekdays in range
    const dates = this.getWeekdaysInRange(startDate, endDate);
    console.log(`📊 Will backfill ${dates.length} weekdays`);
    
    for (const date of dates) {
      const dateStr = date.toISOString().split('T')[0];
      
      // Check if data already exists
      const voiceExists = existingData.trends.voice.totalInboundCalls.some(d => d.date === dateStr);
      const ticketExists = existingData.trends.tickets.byStatus.some(d => d.date === dateStr);
      
      if (voiceExists && ticketExists) {
        console.log(`⏭️  Skipping ${dateStr} - data already exists`);
        continue;
      }
      
      // Fetch voice data if needed
      if (!voiceExists) {
        const voiceData = await this.fetchVoiceDataForDate(date);
        
        existingData.trends.voice.totalInboundCalls.push({
          date: dateStr,
          value: voiceData.totalInboundCalls
        });
        existingData.trends.voice.notAnsweredCalls.push({
          date: dateStr,
          value: voiceData.notAnsweredCalls
        });
        existingData.trends.voice.outboundCalls.push({
          date: dateStr,
          value: voiceData.outboundCalls
        });
        
        console.log(`  ✅ Added voice data for ${dateStr}`);
      }
      
      // Fetch ticket data if needed
      if (!ticketExists) {
        const ticketData = await this.fetchTicketDataForDate(date);
        existingData.trends.tickets.byStatus.push(ticketData);
        console.log(`  ✅ Added ticket data for ${dateStr}`);
      }
      
      // Rate limiting between dates
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Sort all data by date
    existingData.trends.voice.totalInboundCalls.sort((a, b) => new Date(a.date) - new Date(b.date));
    existingData.trends.voice.notAnsweredCalls.sort((a, b) => new Date(a.date) - new Date(b.date));
    existingData.trends.voice.outboundCalls.sort((a, b) => new Date(a.date) - new Date(b.date));
    existingData.trends.tickets.byStatus.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Update metadata
    existingData.metadata.lastUpdated = new Date().toISOString();
    
    // Save data
    console.log('💾 Saving backfilled data...');
    fs.writeFileSync(this.dataFilePath, JSON.stringify(existingData, null, 2));
    
    const stats = fs.statSync(this.dataFilePath);
    console.log(`✅ Backfill complete! Data saved (${Math.round(stats.size / 1024)} KB)`);
    console.log(`📊 Total entries:`);
    console.log(`   Voice: ${existingData.trends.voice.totalInboundCalls.length} days`);
    console.log(`   Tickets: ${existingData.trends.tickets.byStatus.length} days`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('❌ Usage: node backfillData.js [startDate] [endDate]');
  console.error('   Example: node backfillData.js 2025-09-25 2025-10-05');
  console.error('');
  console.error('   This will backfill weekdays only (Mon-Fri) in the specified range.');
  process.exit(1);
}

const startDate = args[0];
const endDate = args[1];

// Validate dates
if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
  console.error('❌ Invalid date format. Use YYYY-MM-DD');
  process.exit(1);
}

// Run backfill
const backfill = new BackfillDataGenerator();
backfill.backfill(startDate, endDate).catch(console.error);
