const ZendeskClient = require('./ZendeskClient');

class VoiceChannelKPIAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
    this.todayStart = new Date();
    this.todayStart.setHours(0, 0, 0, 0);
    this.now = new Date();
    this.voiceTickets = [];
    this.kpis = {};
  }

  async fetchTodaysVoiceTickets() {
    console.log('📞 Fetching today\'s voice channel tickets...');
    
    try {
      let allVoiceTickets = [];
      let page = 1;
      let hasMore = true;
      const maxTickets = 2000; // Reasonable limit for voice tickets

      while (hasMore && allVoiceTickets.length < maxTickets) {
        console.log(`Fetching page ${page} of tickets...`);
        
        const response = await this.zendesk.getTickets({
          page: page,
          per_page: 100,
          sort_by: 'created_at',
          sort_order: 'desc'
        });

        if (response.tickets && response.tickets.length > 0) {
          // Filter for voice tickets created today
          const todaysVoiceTickets = response.tickets.filter(ticket => {
            const createdAt = new Date(ticket.created_at);
            const isToday = createdAt >= this.todayStart && createdAt <= this.now;
            const isVoice = ticket.via?.channel === 'voice';
            return isToday && isVoice;
          });

          allVoiceTickets.push(...todaysVoiceTickets);
          console.log(`Found ${todaysVoiceTickets.length} voice tickets from today (Total: ${allVoiceTickets.length})`);

          // If no tickets in this batch are from today, we might be done
          const hasRecentTickets = response.tickets.some(ticket => {
            const createdAt = new Date(ticket.created_at);
            return createdAt >= this.todayStart;
          });

          if (!hasRecentTickets) {
            hasMore = false;
          } else {
            hasMore = response.next_page !== null;
            page++;
          }

          await new Promise(resolve => setTimeout(resolve, 200));
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Found ${allVoiceTickets.length} voice tickets for today`);
      this.voiceTickets = allVoiceTickets;
      return allVoiceTickets;
    } catch (error) {
      console.error('Error fetching voice tickets:', error.message);
      return [];
    }
  }

  async fetchVoiceCallData() {
    console.log('📊 Fetching detailed call data for voice tickets...');
    
    const callData = [];
    const batchSize = 10; // Process in smaller batches for call data

    for (let i = 0; i < this.voiceTickets.length; i += batchSize) {
      const batch = this.voiceTickets.slice(i, i + batchSize);
      
      console.log(`Processing voice tickets ${i + 1}-${Math.min(i + batchSize, this.voiceTickets.length)} of ${this.voiceTickets.length}...`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (ticket) => {
        try {
          // Get ticket details which might include call information
          const ticketDetails = await this.zendesk.getTicket(ticket.id);
          
          // Extract call data from ticket
          const callInfo = this.extractCallDataFromTicket(ticketDetails.ticket);
          
          return {
            ticketId: ticket.id,
            createdAt: ticket.created_at,
            updatedAt: ticket.updated_at,
            status: ticket.status,
            priority: ticket.priority,
            subject: ticket.subject,
            ...callInfo
          };
        } catch (error) {
          console.error(`Error fetching details for ticket ${ticket.id}:`, error.message);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      callData.push(...batchResults.filter(result => result !== null));
      
      // Add delay between batches
      if (i + batchSize < this.voiceTickets.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Processed ${callData.length} voice tickets with call data`);
    return callData;
  }

  extractCallDataFromTicket(ticket) {
    const callInfo = {
      callDurationSeconds: null,
      callType: 'unknown', // inbound, outbound
      callStatus: 'unknown', // answered, missed, dropped, callback_requested
      phoneNumber: null,
      agentId: ticket.assignee_id,
      groupId: ticket.group_id
    };

    // Extract call information from via source
    if (ticket.via && ticket.via.source) {
      const source = ticket.via.source;
      
      // Phone number from source
      if (source.from && source.from.phone_number) {
        callInfo.phoneNumber = source.from.phone_number;
        callInfo.callType = 'inbound';
      } else if (source.to && source.to.phone_number) {
        callInfo.phoneNumber = source.to.phone_number;
        callInfo.callType = 'outbound';
      }
      
      // Call duration (if available in source)
      if (source.rel && source.rel.includes('call_duration')) {
        // Try to extract duration from source data
        try {
          if (source.call_duration) {
            callInfo.callDurationSeconds = parseInt(source.call_duration);
          }
        } catch (e) {
          // Duration not available in expected format
        }
      }
    }

    // Determine call status from ticket data
    if (ticket.status === 'new' && !ticket.assignee_id) {
      callInfo.callStatus = 'not_answered';
    } else if (ticket.subject && ticket.subject.toLowerCase().includes('callback')) {
      callInfo.callStatus = 'callback_requested';
    } else if (ticket.subject && ticket.subject.toLowerCase().includes('dropped')) {
      callInfo.callStatus = 'dropped';
    } else if (ticket.assignee_id && ticket.status !== 'new') {
      callInfo.callStatus = 'answered';
    }

    // Try to extract duration from custom fields
    if (ticket.custom_fields && Array.isArray(ticket.custom_fields)) {
      ticket.custom_fields.forEach(field => {
        // Look for duration-related custom fields
        if (field.id && field.value) {
          const fieldStr = String(field.value).toLowerCase();
          if (fieldStr.includes('duration') || fieldStr.includes('length')) {
            // Try to extract numeric duration
            const durationMatch = fieldStr.match(/(\d+)/);
            if (durationMatch) {
              callInfo.callDurationSeconds = parseInt(durationMatch[1]);
            }
          }
        }
      });
    }

    // Estimate duration based on ticket timeline if not available
    if (!callInfo.callDurationSeconds && ticket.created_at && ticket.updated_at) {
      const created = new Date(ticket.created_at);
      const updated = new Date(ticket.updated_at);
      const diffMinutes = (updated - created) / (1000 * 60);
      
      // If ticket was updated within reasonable call duration, use as estimate
      if (diffMinutes > 0 && diffMinutes < 120) { // Less than 2 hours
        callInfo.callDurationSeconds = Math.round(diffMinutes * 60);
      }
    }

    return callInfo;
  }

  async fetchVoiceMetrics() {
    console.log('📈 Fetching additional voice metrics...');
    
    try {
      // Try to get Talk (voice) specific metrics if available
      const today = this.todayStart.toISOString().split('T')[0];
      
      // Note: This endpoint might not be available in all Zendesk plans
      // We'll handle it gracefully if it fails
      try {
        const response = await this.zendesk.makeRequest('GET', '/channels/voice/stats.json', {
          start_date: today,
          end_date: today
        });
        
        return response.stats || {};
      } catch (error) {
        console.log('Voice stats API not available, using ticket-based analysis');
        return {};
      }
    } catch (error) {
      console.error('Error fetching voice metrics:', error.message);
      return {};
    }
  }

  calculateVoiceKPIs(callData) {
    console.log('📊 Calculating voice channel KPIs...');
    
    const kpis = {
      // Basic counts
      totalCalls: callData.length,
      inboundCalls: 0,
      outboundCalls: 0,
      
      // Call outcomes
      answeredCalls: 0,
      notAnsweredCalls: 0,
      droppedCalls: 0,
      callbackRequested: 0,
      
      // Duration metrics
      totalCallDurationSeconds: 0,
      longestCallSeconds: 0,
      shortestCallSeconds: null,
      averageCallDurationSeconds: 0,
      validDurations: 0,
      
      // Time-based analysis
      callsByHour: {},
      peakHour: null,
      quietestHour: null,
      
      // Agent performance
      callsByAgent: {},
      topAgent: null,
      
      // Priority breakdown
      callsByPriority: {},
      
      // Status breakdown
      callsByStatus: {},
      
      // Additional metrics
      callsWithDuration: 0,
      estimatedDurations: 0,
      uniquePhoneNumbers: new Set(),
      
      // Time period
      analysisDate: new Date().toISOString(),
      periodStart: this.todayStart.toISOString(),
      periodEnd: this.now.toISOString()
    };
    
    const durations = [];
    
    callData.forEach(call => {
      // Count call types
      if (call.callType === 'inbound') {
        kpis.inboundCalls++;
      } else if (call.callType === 'outbound') {
        kpis.outboundCalls++;
      }
      
      // Count call outcomes
      switch (call.callStatus) {
        case 'answered':
          kpis.answeredCalls++;
          break;
        case 'not_answered':
          kpis.notAnsweredCalls++;
          break;
        case 'dropped':
          kpis.droppedCalls++;
          break;
        case 'callback_requested':
          kpis.callbackRequested++;
          break;
      }
      
      // Process duration
      if (call.callDurationSeconds && call.callDurationSeconds > 0) {
        const duration = call.callDurationSeconds;
        durations.push(duration);
        kpis.totalCallDurationSeconds += duration;
        kpis.validDurations++;
        kpis.callsWithDuration++;
        
        // Track longest and shortest
        if (duration > kpis.longestCallSeconds) {
          kpis.longestCallSeconds = duration;
        }
        if (kpis.shortestCallSeconds === null || duration < kpis.shortestCallSeconds) {
          kpis.shortestCallSeconds = duration;
        }
      }
      
      // Track calls by hour
      const hour = new Date(call.createdAt).getHours();
      kpis.callsByHour[hour] = (kpis.callsByHour[hour] || 0) + 1;
      
      // Track by agent
      if (call.agentId) {
        kpis.callsByAgent[call.agentId] = (kpis.callsByAgent[call.agentId] || 0) + 1;
      }
      
      // Track by priority
      const priority = call.priority || 'normal';
      kpis.callsByPriority[priority] = (kpis.callsByPriority[priority] || 0) + 1;
      
      // Track by status
      kpis.callsByStatus[call.status] = (kpis.callsByStatus[call.status] || 0) + 1;
      
      // Track unique phone numbers
      if (call.phoneNumber) {
        kpis.uniquePhoneNumbers.add(call.phoneNumber);
      }
    });
    
    // Calculate averages
    if (kpis.validDurations > 0) {
      kpis.averageCallDurationSeconds = Math.round(kpis.totalCallDurationSeconds / kpis.validDurations);
    }
    
    // Find peak and quietest hours
    const hourEntries = Object.entries(kpis.callsByHour);
    if (hourEntries.length > 0) {
      const sortedHours = hourEntries.sort(([,a], [,b]) => b - a);
      kpis.peakHour = {
        hour: parseInt(sortedHours[0][0]),
        calls: sortedHours[0][1]
      };
      kpis.quietestHour = {
        hour: parseInt(sortedHours[sortedHours.length - 1][0]),
        calls: sortedHours[sortedHours.length - 1][1]
      };
    }
    
    // Find top agent
    const agentEntries = Object.entries(kpis.callsByAgent);
    if (agentEntries.length > 0) {
      const topAgentEntry = agentEntries.sort(([,a], [,b]) => b - a)[0];
      kpis.topAgent = {
        agentId: topAgentEntry[0],
        calls: topAgentEntry[1]
      };
    }
    
    // Convert Set to count
    kpis.uniqueCallers = kpis.uniquePhoneNumbers.size;
    delete kpis.uniquePhoneNumbers; // Remove Set for JSON serialization
    
    // Calculate additional metrics
    kpis.answerRate = kpis.totalCalls > 0 ? 
      ((kpis.answeredCalls / kpis.totalCalls) * 100).toFixed(2) : 0;
    
    kpis.callbackRate = kpis.totalCalls > 0 ? 
      ((kpis.callbackRequested / kpis.totalCalls) * 100).toFixed(2) : 0;
    
    kpis.dropRate = kpis.totalCalls > 0 ? 
      ((kpis.droppedCalls / kpis.totalCalls) * 100).toFixed(2) : 0;
    
    // Convert durations to human readable
    kpis.longestCallFormatted = this.formatDuration(kpis.longestCallSeconds);
    kpis.shortestCallFormatted = this.formatDuration(kpis.shortestCallSeconds);
    kpis.averageCallFormatted = this.formatDuration(kpis.averageCallDurationSeconds);
    kpis.totalCallTimeFormatted = this.formatDuration(kpis.totalCallDurationSeconds);
    
    return kpis;
  }

  formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  async analyzeVoiceChannelKPIs() {
    try {
      console.log('🚀 Starting Voice Channel KPI Analysis...');
      console.log(`📅 Analyzing period: ${this.todayStart.toLocaleString()} to ${this.now.toLocaleString()}`);
      
      // Fetch voice tickets for today
      await this.fetchTodaysVoiceTickets();
      
      if (this.voiceTickets.length === 0) {
        console.log('⚠️ No voice tickets found for today');
        this.kpis = {
          totalCalls: 0,
          message: 'No voice channel activity found for today',
          analysisDate: new Date().toISOString(),
          periodStart: this.todayStart.toISOString(),
          periodEnd: this.now.toISOString()
        };
        return this.kpis;
      }

      // Get detailed call data
      const callData = await this.fetchVoiceCallData();
      
      // Fetch additional voice metrics
      const voiceMetrics = await this.fetchVoiceMetrics();
      
      // Calculate KPIs
      this.kpis = {
        ...this.calculateVoiceKPIs(callData),
        ...voiceMetrics,
        rawCallData: callData // Include for detailed analysis
      };
      
      console.log(`✅ Voice KPI analysis complete! Processed ${this.kpis.totalCalls} calls`);
      return this.kpis;
      
    } catch (error) {
      console.error('❌ Error in voice KPI analysis:', error.message);
      throw error;
    }
  }

  printVoiceKPIReport() {
    if (!this.kpis || this.kpis.totalCalls === 0) {
      console.log('⚠️ No voice channel data available for today.');
      return;
    }

    console.log('\n' + '='.repeat(70));
    console.log('📞 VOICE CHANNEL KPI REPORT - TODAY');
    console.log('='.repeat(70));
    console.log(`📅 Period: ${new Date(this.kpis.periodStart).toLocaleString()} to ${new Date(this.kpis.periodEnd).toLocaleString()}`);
    
    console.log(`\n📊 CALL VOLUME METRICS:`);
    console.log(`   Total Calls: ${this.kpis.totalCalls}`);
    console.log(`   Inbound Calls: ${this.kpis.inboundCalls}`);
    console.log(`   Outbound Calls: ${this.kpis.outboundCalls}`);
    console.log(`   Unique Callers: ${this.kpis.uniqueCallers}`);

    console.log(`\n📈 CALL OUTCOME METRICS:`);
    console.log(`   Answered Calls: ${this.kpis.answeredCalls} (${this.kpis.answerRate}%)`);
    console.log(`   Not Answered: ${this.kpis.notAnsweredCalls}`);
    console.log(`   Dropped Calls: ${this.kpis.droppedCalls} (${this.kpis.dropRate}%)`);
    console.log(`   Callbacks Requested: ${this.kpis.callbackRequested} (${this.kpis.callbackRate}%)`);

    console.log(`\n⏱️ CALL DURATION METRICS:`);
    console.log(`   Longest Call: ${this.kpis.longestCallFormatted}`);
    console.log(`   Shortest Call: ${this.kpis.shortestCallFormatted}`);
    console.log(`   Average Call: ${this.kpis.averageCallFormatted}`);
    console.log(`   Total Talk Time: ${this.kpis.totalCallTimeFormatted}`);
    console.log(`   Calls with Duration Data: ${this.kpis.callsWithDuration}/${this.kpis.totalCalls}`);

    if (this.kpis.peakHour) {
      console.log(`\n🕐 PEAK ACTIVITY:`);
      console.log(`   Busiest Hour: ${this.kpis.peakHour.hour}:00 (${this.kpis.peakHour.calls} calls)`);
      console.log(`   Quietest Hour: ${this.kpis.quietestHour.hour}:00 (${this.kpis.quietestHour.calls} calls)`);
    }

    console.log(`\n📋 CALLS BY HOUR:`);
    Object.entries(this.kpis.callsByHour)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([hour, count]) => {
        const hourFormatted = `${hour.padStart(2, '0')}:00`;
        const bar = '█'.repeat(Math.max(1, Math.round((count / this.kpis.peakHour?.calls || 1) * 20)));
        console.log(`   ${hourFormatted} │${bar} ${count}`);
      });

    if (Object.keys(this.kpis.callsByPriority).length > 0) {
      console.log(`\n⚡ PRIORITY BREAKDOWN:`);
      Object.entries(this.kpis.callsByPriority)
        .sort(([,a], [,b]) => b - a)
        .forEach(([priority, count]) => {
          const percentage = ((count / this.kpis.totalCalls) * 100).toFixed(1);
          console.log(`   ${priority.toUpperCase().padEnd(10)}: ${count} (${percentage}%)`);
        });
    }

    console.log('\n' + '='.repeat(70));
  }

  async exportVoiceKPIsToJSON(filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      filename = `voice-kpis-${timestamp}.json`;
    }

    const fs = require('fs');
    const path = require('path');
    
    const filePath = path.join(__dirname, '..', 'data', filename);
    
    try {
      // Create a clean version for export (remove raw data for cleaner JSON)
      const exportKPIs = { ...this.kpis };
      delete exportKPIs.rawCallData; // Remove raw data for cleaner export
      
      fs.writeFileSync(filePath, JSON.stringify(exportKPIs, null, 2));
      console.log(`✅ Voice KPI data exported to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('❌ Error exporting voice KPI data:', error.message);
      throw error;
    }
  }
}

module.exports = VoiceChannelKPIAnalyzer;