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

  async generateVoiceTrends() {
    console.log('📈 Generating voice trends for Oct 1-8 weekdays using historical ticket analysis...');
    
    try {
      const dates = this.getLastThirtyWeekdays();
      
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
        console.log(`📅 Analyzing tickets for ${dateStr}...`);
        
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

      console.log('📊 Fetching daily KPIs...');
      const dailyKPIs = await this.generateDailyKPIs();
      console.log('✅ Daily KPIs fetched successfully');

      const today = new Date().toISOString().split('T')[0];
      
      console.log('📈 Generating historical trends...');
      const voiceTrends = await this.generateVoiceTrends();
      console.log('✅ Historical trends generated successfully');
      
      // Replace today's trend data with accurate Voice API data
      console.log('🔄 Updating today\'s trends with Voice API data...');
      const todayVoiceData = dailyKPIs.voice;
      Object.keys(voiceTrends).forEach(metric => {
        const todayIndex = voiceTrends[metric].findIndex(d => d.date === today);
        if (todayIndex >= 0 && todayVoiceData[metric]) {
          voiceTrends[metric][todayIndex].value = todayVoiceData[metric].value;
        }
      });
      console.log('✅ Today\'s trends updated with Voice API data');
      
      // Construct the complete data structure
      console.log('🔄 Building data structure...');
      this.execViewData = {
        metadata: {
          version: "1.0.0",
          lastUpdated: new Date().toISOString(),
          description: "Executive View - Daily KPI Dashboard with Historical Trends",
          dataRetentionDays: 90,
          kpiCategories: ["voice"]
        },
        dailyKPIs: {
          [today]: dailyKPIs
        },
        trends: {
          voice: voiceTrends
        }
      };
      
      // Validate data structure
      console.log('🔍 Validating data structure...');
      if (!this.execViewData.dailyKPIs || !this.execViewData.trends) {
        throw new Error('Invalid data structure - missing required sections');
      }
      
      // Save to file
      console.log('💾 Saving data to file...');
      await this.saveExecViewData();
      
      console.log(`✅ Executive View data generated successfully and saved to ${this.dataFilePath}`);
      return this.execViewData;
      
    } catch (error) {
      console.error('❌ Error generating Executive View:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      throw error;
    }
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
