const ZendeskClient = require('./src/ZendeskClient');
const fs = require('fs');
const path = require('path');

class ExecViewGenerator {
  constructor() {
    this.zendesk = new ZendeskClient();
    this.execViewData = {};
    this.dataFilePath = path.join(__dirname, 'data', 'execView.json');
  }

  async generateDailyKPIs() {
    console.log('📊 Generating daily KPIs...');
    
    try {
      // Verify Zendesk client is properly initialized
      if (!this.zendesk) {
        throw new Error('ZendeskClient not initialized');
      }

      // Test API connection
      try {
        await this.zendesk.makeRequest('GET', '/users/me.json');
        console.log('✅ Successfully connected to Zendesk API');
      } catch (apiError) {
        console.error('❌ Failed to connect to Zendesk API:', apiError.message);
        throw new Error('Zendesk API connection failed');
      }

      const today = new Date();
      const todayISO = today.toISOString();
      
      // Get today's voice metrics
      console.log('📞 Fetching voice metrics...');
      const voiceMetrics = await this.getTodaysVoiceMetrics();
      console.log('✅ Successfully fetched voice metrics');
      
      return {
        date: today.toISOString().split('T')[0],
        timestamp: todayISO,
        voice: voiceMetrics
      };
    } catch (error) {
      console.error('❌ Error generating daily KPIs:', error.message);
      if (error.response) {
        console.error('API Response:', error.response.data);
      }
      throw error;
    }
  }

  async getTodaysVoiceMetrics() {
    console.log('📞 Fetching today\'s voice metrics from Voice API...');
    
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      // Use Zendesk Voice API to get accurate metrics
      const response = await this.zendesk.makeRequest('GET', 
        `/channels/voice/stats/account_overview.json?start_time=${dateStr}T00:00:00Z&end_time=${dateStr}T23:59:59Z`
      );
      
      const overview = response.account_overview;
      console.log(`  Total calls today: ${overview.total_calls}`);
      
      // Get longest call duration from individual calls if needed
      let longestCallDuration = 0;
      if (overview.total_call_duration > 0 && overview.total_calls > 0) {
        // The API doesn't provide longest call directly, so we estimate it as 3x average
        // Or we could query individual calls, but that's rate-limited
        const avgDuration = overview.average_call_duration || 0;
        longestCallDuration = Math.round(avgDuration * 2); // Conservative estimate
      }
      
      return {
        totalInboundCalls: {
          value: overview.total_inbound_calls || 0,
          displayName: "Total Inbound Calls",
          description: "Total number of inbound calls received today"
        },
        notAnsweredCalls: {
          value: overview.total_calls_abandoned_in_queue || 0,
          displayName: "Not Answered Calls",
          description: "Number of calls that were not answered by any agent today"
        },
        outboundCalls: {
          value: overview.total_outbound_calls || 0,
          displayName: "Outbound Calls",
          description: "Total outbound calls placed today"
        }
      };
    } catch (error) {
      console.error('Error fetching voice metrics:', error.message);
      throw error;
    }
  }

  async generateTicketTrends() {
    console.log('📈 Generating ticket status trends for last 5 weekdays...');
    
    try {
      const dates = this.getLastFiveWeekdays();
      const trendMetrics = {
        byStatus: [] // Array of { date, new, open, pending, hold, solved, closed }
      };
      
      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0];
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];
        
        console.log(`  Processing ${dateStr} (${date.toLocaleDateString('en-US', { weekday: 'short' })})...`);
        
        try {
          const statusCounts = {
            date: dateStr,
            new: 0,
            open: 0,
            pending: 0,
            hold: 0,
            solved: 0,
            closed: 0
          };
          
          // Query tickets created/updated on this date
          const startTime = new Date(dateStr + 'T00:00:00Z').getTime() / 1000;
          const endTime = new Date(nextDayStr + 'T00:00:00Z').getTime() / 1000;
          
          let url = `/incremental/tickets.json?start_time=${startTime}`;
          let hasMore = true;
          
          while (hasMore && url) {
            const response = await this.zendesk.makeRequest('GET', url);
            
            for (const ticket of response.tickets) {
              const ticketDate = new Date(ticket.updated_at);
              
              // Only count if updated on this specific date
              if (ticketDate >= date && ticketDate < nextDay) {
                const status = ticket.status;
                if (statusCounts.hasOwnProperty(status)) {
                  statusCounts[status]++;
                }
              }
            }
            
            // Check if we've passed our end time
            if (response.end_time >= endTime) {
              hasMore = false;
            } else {
              url = response.next_page;
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          console.log(`    ${dateStr}: new:${statusCounts.new} open:${statusCounts.open} pending:${statusCounts.pending} hold:${statusCounts.hold} solved:${statusCounts.solved} closed:${statusCounts.closed}`);
          
          trendMetrics.byStatus.push(statusCounts);
          
        } catch (error) {
          console.error(`  Error for ${dateStr}:`, error.message);
          trendMetrics.byStatus.push({
            date: dateStr,
            new: 0,
            open: 0,
            pending: 0,
            hold: 0,
            solved: 0,
            closed: 0
          });
        }
      }
      
      console.log('✅ Ticket trends generated successfully');
      return trendMetrics;
    } catch (error) {
      console.error('Error generating ticket trends:', error.message);
      throw error;
    }
  }

  async generateVoiceTrends() {
    console.log('📈 Generating voice trends for last 5 weekdays using historical ticket analysis...');
    
    try {
      const dates = this.getLastFiveWeekdays();
      
      // Initialize trend data structure
      const trendMetrics = {
        totalInboundCalls: [],
        notAnsweredCalls: [],
        outboundCalls: []
      };
      
      // Fetch historical data for each date by analyzing tickets
      // Note: Voice API doesn't support per-day historical data, so we analyze tickets
      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0];
        console.log(`📅 Analyzing tickets for ${dateStr} (${date.toLocaleDateString('en-US', { weekday: 'short' })})...`);
        
        try {
          const startOfDay = new Date(date);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(date);
          endOfDay.setHours(23, 59, 59, 999);
          
          // Use incremental tickets API for better historical data retrieval
          let dayTickets = [];
          
          try {
            const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
            const endTimestamp = Math.floor(endOfDay.getTime() / 1000);
            
            // Fetch tickets using incremental API
            const response = await this.zendesk.makeRequest('GET', 
              `/incremental/tickets.json?start_time=${startTimestamp}`
            );
            
            if (response.tickets && response.tickets.length > 0) {
              dayTickets = response.tickets.filter(ticket => {
                const createdAt = new Date(ticket.created_at);
                const isThisDay = createdAt >= startOfDay && createdAt <= endOfDay;
                const isVoice = ticket.via?.channel === 'voice';
                return isThisDay && isVoice;
              });
            }
          } catch (error) {
            console.error(`  Error fetching tickets: ${error.message}`);
          }
          
          console.log(`  Found ${dayTickets.length} voice tickets`);
          
          // Analyze tickets to extract metrics
          let metrics = {
            inbound: 0,
            abandoned: 0,
            notAnswered: 0,
            callback: 0,
            dropped: 0,
            outbound: 0,
            totalDuration: 0,
            longestDuration: 0,
            callCount: 0,
            exceededWait: 0,
            totalWaitTime: 0
          };
          
          for (const ticket of dayTickets) {
            const subject = (ticket.subject || '').toLowerCase();
            const description = (ticket.description || '').toLowerCase();
            const via = ticket.via || {};
            
            // Determine call direction
            if (via.source?.rel === 'outbound' || subject.includes('outbound')) {
              metrics.outbound++;
            } else {
              metrics.inbound++;
            }
            
            // Log first few tickets for debugging
            if (dayTickets.length > 0 && dayTickets.indexOf(ticket) < 3) {
              console.log(`    Ticket ${ticket.id}: ${via.source?.rel || 'unknown'} - "${subject.substring(0, 50)}"`);
            }
            
            // Check for abandoned/missed/not answered calls
            if (subject.includes('abandoned') || subject.includes('missed') || 
                subject.includes('unanswered') || description.includes('abandoned') || 
                description.includes('no answer') || description.includes('missed call')) {
              metrics.abandoned++;
              metrics.notAnswered++;
            }
            
            // Check for callbacks
            if (subject.includes('callback') || subject.includes('call back') || 
                description.includes('callback') || description.includes('call back')) {
              metrics.callback++;
            }
            
            // Check for dropped calls
            if (subject.includes('dropped') || description.includes('dropped')) {
              metrics.dropped++;
            }
            
            // Try to extract call duration from description
            const durationMatch = description.match(/duration[:\s]*(\d+(?:\.\d+)?)\s*(min|sec|minute|second)/i);
            if (durationMatch) {
              const val = parseFloat(durationMatch[1]);
              const unit = durationMatch[2].toLowerCase();
              const durationSec = unit.startsWith('min') ? val * 60 : val;
              
              if (durationSec > 0) {
                metrics.totalDuration += durationSec;
                metrics.callCount++;
                if (durationSec > metrics.longestDuration) {
                  metrics.longestDuration = durationSec;
                }
              }
            }
            
            // Check for exceeded wait time
            const waitMatch = description.match(/wait(?:ed|ing)?[:\s]*(\d+(?:\.\d+)?)\s*(min|sec|minute|second)/i);
            if (waitMatch) {
              const val = parseFloat(waitMatch[1]);
              const unit = waitMatch[2].toLowerCase();
              const waitSec = unit.startsWith('min') ? val * 60 : val;
              
              if (waitSec > 300) { // 5 minutes threshold
                metrics.exceededWait++;
                metrics.totalWaitTime += waitSec;
              }
            }
          }
          
          // Calculate averages
          const avgDuration = metrics.callCount > 0 ? 
            Math.round(metrics.totalDuration / metrics.callCount) : 0;
          
          // Log summary for this date
          console.log(`    Summary: ${metrics.inbound} inbound, ${metrics.outbound} outbound, ${metrics.abandoned} abandoned`);
          
          // Add metrics to trends
          trendMetrics.totalInboundCalls.push({ date: dateStr, value: metrics.inbound });
          trendMetrics.notAnsweredCalls.push({ date: dateStr, value: metrics.notAnswered });
          trendMetrics.outboundCalls.push({ date: dateStr, value: metrics.outbound });
          
        } catch (error) {
          console.error(`  Error for ${dateStr}:`, error.message);
          // Add zeros for this date
          trendMetrics.totalInboundCalls.push({ date: dateStr, value: 0 });
          trendMetrics.notAnsweredCalls.push({ date: dateStr, value: 0 });
          trendMetrics.outboundCalls.push({ date: dateStr, value: 0 });
        }
      }
      
      console.log('✅ Historical voice trends generated successfully from ticket analysis');
      return trendMetrics;
    } catch (error) {
      console.error('Error generating voice trends:', error.message);
      throw error;
    }
  }

  getLastSevenDays() {
    // Return last 7 days from today
    const dates = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(date);
    }
    
    return dates;
  }

  getLastFiveWeekdays() {
    // Return last 5 weekdays (Mon-Fri only, excluding weekends)
    const dates = [];
    const today = new Date();
    let daysAdded = 0;
    let daysBack = 1; // Start from yesterday
    
    while (daysAdded < 5) {
      const date = new Date(today);
      date.setDate(today.getDate() - daysBack);
      
      const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
      
      // Only add weekdays (Mon-Fri)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        dates.unshift(date); // Add to beginning to keep chronological order
        daysAdded++;
      }
      
      daysBack++;
    }
    
    return dates;
  }

  getLastThirtyWeekdays() {
    // Return weekdays from Oct 1-8, 2025 (excluding weekends)
    const dates = [
      new Date('2025-10-01'), // Tuesday
      new Date('2025-10-02'), // Wednesday
      new Date('2025-10-03'), // Thursday
      new Date('2025-10-04'), // Friday
      new Date('2025-10-07'), // Monday (Oct 5-6 are weekend)
      new Date('2025-10-08')  // Tuesday
    ];
    
    return dates;
  }

  async generateExecView() {
    console.log('🏢 Generating Executive View data...');
    
    try {
      // Ensure data directory exists
      if (!fs.existsSync(path.dirname(this.dataFilePath))) {
        console.log('📁 Creating data directory...');
        fs.mkdirSync(path.dirname(this.dataFilePath), { recursive: true });
      }

      const today = new Date().toISOString().split('T')[0];
      
      // Load existing data if available
      let existingData = null;
      if (fs.existsSync(this.dataFilePath)) {
        console.log('📂 Loading existing data...');
        const fileContent = fs.readFileSync(this.dataFilePath, 'utf8');
        existingData = JSON.parse(fileContent);
        console.log(`✅ Found existing data (last updated: ${existingData.metadata?.lastUpdated || 'unknown'})`);
      }

      // Check if we need to fetch new data
      const needsFetch = this.shouldFetchData(existingData, today);
      
      if (!needsFetch) {
        console.log('✅ Data is already up-to-date for today. Using cached data.');
        console.log('💡 Tip: To force refresh, delete data/execView.json and run again.');
        this.execViewData = existingData;
        return existingData;
      }

      console.log('📊 Fetching today\'s data from Zendesk...');
      const dailyKPIs = await this.generateDailyKPIs();
      console.log('✅ Today\'s data fetched successfully');

      // Check if today is a weekday (skip data collection on weekends unless forced)
      const todayDate = new Date();
      const dayOfWeek = todayDate.getDay();
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      
      if (!isWeekday) {
        console.log('� Today is a weekend - only updating today\'s KPIs, not historical trends');
      }

      // Merge with existing data
      console.log('🔄 Merging with historical data...');
      this.execViewData = await this.mergeData(existingData, dailyKPIs, today, isWeekday);
      
      // Save to file
      console.log('💾 Saving updated data to file...');
      await this.saveExecViewData();
      
      console.log(`✅ Executive View data updated successfully and saved to ${this.dataFilePath}`);
      return this.execViewData;
      
    } catch (error) {
      console.error('❌ Error generating Executive View:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      throw error;
    }
  }

  shouldFetchData(existingData, today) {
    if (!existingData) {
      console.log('🆕 No existing data found - will fetch all data');
      return true;
    }

    const lastUpdated = existingData.metadata?.lastUpdated;
    if (!lastUpdated) {
      console.log('⚠️ No lastUpdated timestamp - will fetch data');
      return true;
    }

    const lastUpdateDate = new Date(lastUpdated).toISOString().split('T')[0];
    
    if (lastUpdateDate === today) {
      console.log(`✓ Data already fetched today (${today})`);
      
      // Check if today's KPI exists
      if (!existingData.dailyKPIs?.[today]) {
        console.log('⚠️ Today\'s KPI missing - will fetch');
        return true;
      }
      
      return false;
    }

    console.log(`📅 Last update was ${lastUpdateDate}, today is ${today} - will fetch new data`);
    return true;
  }

  async mergeData(existingData, todayKPIs, today, isWeekday) {
    const merged = existingData ? JSON.parse(JSON.stringify(existingData)) : {
      metadata: {
        version: "1.0.0",
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

    // Update metadata
    merged.metadata.lastUpdated = new Date().toISOString();
    merged.metadata.lastFetchDate = today;

    // Update today's KPIs
    merged.dailyKPIs[today] = todayKPIs;

    // If it's a weekday, add to trends (only if not already present)
    if (isWeekday) {
      const todayVoiceData = todayKPIs.voice;
      
      // Add to voice trends if not already present
      Object.keys(merged.trends.voice).forEach(metric => {
        const existingIndex = merged.trends.voice[metric].findIndex(d => d.date === today);
        
        if (existingIndex === -1 && todayVoiceData[metric]) {
          // Add new entry
          merged.trends.voice[metric].push({
            date: today,
            value: todayVoiceData[metric].value
          });
          console.log(`  ➕ Added ${metric} for ${today}: ${todayVoiceData[metric].value}`);
        } else if (existingIndex >= 0 && todayVoiceData[metric]) {
          // Update existing entry
          merged.trends.voice[metric][existingIndex].value = todayVoiceData[metric].value;
          console.log(`  🔄 Updated ${metric} for ${today}: ${todayVoiceData[metric].value}`);
        }
      });

      // Sort voice trends by date
      Object.keys(merged.trends.voice).forEach(metric => {
        merged.trends.voice[metric].sort((a, b) => new Date(a.date) - new Date(b.date));
      });

      // Fetch today's ticket data if not present
      const ticketIndex = merged.trends.tickets.byStatus.findIndex(d => d.date === today);
      if (ticketIndex === -1) {
        console.log('� Fetching today\'s ticket status...');
        const todayTicketData = await this.fetchSingleDayTickets(today);
        merged.trends.tickets.byStatus.push(todayTicketData);
        console.log(`  ➕ Added ticket status for ${today}`);
      } else {
        console.log(`  ✓ Ticket status for ${today} already exists`);
      }

      // Sort ticket trends by date
      merged.trends.tickets.byStatus.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    return merged;
  }

  async fetchSingleDayTickets(dateStr) {
    const date = new Date(dateStr);
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
      
      console.log(`    ${dateStr}: new:${statusCounts.new} open:${statusCounts.open} pending:${statusCounts.pending} hold:${statusCounts.hold} solved:${statusCounts.solved} closed:${statusCounts.closed}`);
    } catch (error) {
      console.error(`  Error fetching tickets for ${dateStr}:`, error.message);
    }

    return statusCounts;
  }

  async saveExecViewData() {
    try {
      console.log(`📝 Attempting to save data to ${this.dataFilePath}...`);
      
      // Ensure we have data to save
      if (!this.execViewData) {
        throw new Error('No data to save - execViewData is empty');
      }

      // Validate JSON before saving
      try {
        JSON.parse(JSON.stringify(this.execViewData));
      } catch (jsonError) {
        throw new Error(`Invalid JSON data: ${jsonError.message}`);
      }

      // Ensure directory exists
      const dir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dir)) {
        console.log(`📁 Creating directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.execViewData, null, 2));
      
      // Verify file was written
      if (!fs.existsSync(this.dataFilePath)) {
        throw new Error('File was not created successfully');
      }

      const stats = fs.statSync(this.dataFilePath);
      console.log(`✅ Data saved successfully (${Math.round(stats.size / 1024)} KB)`);
    } catch (error) {
      console.error('❌ Error saving data:', error.message);
      if (error.code) {
        console.error('File system error code:', error.code);
      }
      throw error;
    }
  }
}

// Export the class
module.exports = ExecViewGenerator;

// If running directly (not imported as a module), generate the exec view
if (require.main === module) {
  const generator = new ExecViewGenerator();
  generator.generateExecView().catch(console.error);
}
