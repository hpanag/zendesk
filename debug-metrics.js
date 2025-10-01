const ZendeskClient = require('./src/ZendeskClient');

class MetricsDebugger {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async debugZeroMetrics() {
    console.log('🔍 DEBUGGING ZERO METRICS vs DASHBOARD');
    console.log('='.repeat(60));
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString().split('T')[0];
      
      console.log(`📅 Analyzing data for: ${todayISO}`);
      console.log(`🕐 Current time: ${new Date().toLocaleString()}\n`);

      // Get all today's tickets for comprehensive analysis
      console.log('📋 Step 1: Getting all today\'s tickets...');
      const todayTickets = await this.zendesk.getTickets({
        per_page: 100,
        sort_by: 'created_at',
        sort_order: 'desc'
      });
      
      const allTickets = todayTickets.tickets || [];
      const todaysTickets = allTickets.filter(ticket => {
        const createdDate = new Date(ticket.created_at);
        return createdDate >= today;
      });
      
      console.log(`✅ Found ${todaysTickets.length} total tickets created today`);

      // Analyze by channel
      const channelBreakdown = {};
      todaysTickets.forEach(ticket => {
        const channel = ticket.via?.channel || 'unknown';
        channelBreakdown[channel] = (channelBreakdown[channel] || 0) + 1;
      });

      console.log('\n📊 Today\'s Tickets by Channel:');
      Object.entries(channelBreakdown).forEach(([channel, count]) => {
        console.log(`   ${channel}: ${count} tickets`);
      });

      const voiceTickets = todaysTickets.filter(t => t.via?.channel === 'voice');
      console.log(`\n🎯 Voice tickets found: ${voiceTickets.length}`);

      // DEBUG 1: Total Callback Calls (showing 0)
      await this.debugCallbacks(voiceTickets);

      // DEBUG 2: Average Duration (showing 0)
      await this.debugAverageDuration(voiceTickets);

      // DEBUG 3: Average Wait Time (showing 0)
      await this.debugAverageWaitTime(voiceTickets);

      // DEBUG 4: Average Time to Answer (showing 0)
      await this.debugTimeToAnswer(voiceTickets);

      // DEBUG 5: Average Hold Time (showing 0)
      await this.debugHoldTime(voiceTickets);

      // DEBUG 6: Exceeded Queue Wait Time (showing 0)
      await this.debugExceededWaitTime(voiceTickets);

      // DEBUG 7: Check for different ticket statuses that might indicate real data
      await this.debugTicketStatuses(voiceTickets);

      // DEBUG 8: Check custom fields for timing data
      await this.debugCustomFields(voiceTickets);

      // DEBUG 9: Try different Voice API endpoints
      await this.debugVoiceAPIEndpoints();

    } catch (error) {
      console.error('❌ Error in metrics debugging:', error.message);
    }
  }

  async debugCallbacks(voiceTickets) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Total Callback Calls (currently showing 0)');
    console.log('='.repeat(50));

    let callbackCount = 0;
    let callbackIndicators = [];

    voiceTickets.forEach((ticket, index) => {
      const subject = (ticket.subject || '').toLowerCase();
      const description = (ticket.description || '').toLowerCase();
      
      // Multiple callback detection methods
      const indicators = [];
      
      if (subject.includes('callback')) indicators.push('subject:callback');
      if (description.includes('callback')) indicators.push('description:callback');
      if (subject.includes('call back')) indicators.push('subject:call_back');
      if (description.includes('call back')) indicators.push('description:call_back');
      if (ticket.via?.source?.from?.name?.toLowerCase().includes('callback')) indicators.push('via:callback');
      
      // Check for callback patterns in subject
      if (subject.match(/call.*back|return.*call|scheduled.*call/)) indicators.push('subject:pattern');
      
      if (indicators.length > 0) {
        callbackCount++;
        callbackIndicators.push({
          ticketId: ticket.id,
          subject: ticket.subject,
          indicators: indicators,
          viaSource: ticket.via?.source
        });
      }
    });

    console.log(`📞 Callback analysis results:`);
    console.log(`   Potential callbacks found: ${callbackCount}`);
    
    if (callbackIndicators.length > 0) {
      console.log(`\n📋 Sample callback tickets:`);
      callbackIndicators.slice(0, 3).forEach(cb => {
        console.log(`   Ticket ${cb.ticketId}: "${cb.subject}"`);
        console.log(`   Indicators: ${cb.indicators.join(', ')}`);
      });
    } else {
      console.log(`   ⚠️  No callback indicators found in ticket subjects/descriptions`);
      console.log(`   💡 Dashboard might be using different callback detection method`);
    }
  }

  async debugAverageDuration(voiceTickets) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Average Duration (currently showing 0)');
    console.log('='.repeat(50));

    let durationsFound = [];
    let durationSources = [];

    voiceTickets.forEach(ticket => {
      const customFields = ticket.custom_fields || [];
      const description = ticket.description || '';
      const subject = ticket.subject || '';

      // Check custom fields for duration
      customFields.forEach(field => {
        if (field.value) {
          const fieldName = field.id.toString().toLowerCase();
          const value = parseFloat(field.value);
          
          if (fieldName.includes('duration') || fieldName.includes('call_time') || fieldName.includes('talk_time')) {
            if (!isNaN(value) && value > 0) {
              durationsFound.push(value);
              durationSources.push({
                ticketId: ticket.id,
                field: fieldName,
                value: value,
                rawValue: field.value
              });
            }
          }
        }
      });

      // Check description for duration patterns
      const durationPatterns = [
        /duration:?\s*(\d+(?:\.\d+)?)\s*(min|sec|minute|second|m|s)/i,
        /call time:?\s*(\d+(?:\.\d+)?)\s*(min|sec|minute|second|m|s)/i,
        /talk time:?\s*(\d+(?:\.\d+)?)\s*(min|sec|minute|second|m|s)/i,
        /(\d+):(\d+):(\d+)/  // HH:MM:SS format
      ];

      durationPatterns.forEach((pattern, idx) => {
        const match = description.match(pattern);
        if (match) {
          let durationSeconds;
          if (idx === 3) { // HH:MM:SS format
            const hours = parseInt(match[1]) || 0;
            const minutes = parseInt(match[2]) || 0;
            const seconds = parseInt(match[3]) || 0;
            durationSeconds = (hours * 3600) + (minutes * 60) + seconds;
          } else {
            const value = parseFloat(match[1]);
            const unit = match[2]?.toLowerCase() || 'sec';
            durationSeconds = unit.startsWith('min') || unit === 'm' ? value * 60 : value;
          }
          
          if (durationSeconds > 0) {
            durationsFound.push(durationSeconds);
            durationSources.push({
              ticketId: ticket.id,
              source: 'description_pattern',
              value: durationSeconds,
              match: match[0]
            });
          }
        }
      });
    });

    console.log(`📊 Duration analysis results:`);
    console.log(`   Durations found: ${durationsFound.length}`);
    
    if (durationsFound.length > 0) {
      const avgDuration = durationsFound.reduce((a, b) => a + b, 0) / durationsFound.length;
      console.log(`   Average duration: ${Math.round(avgDuration / 60 * 100) / 100} minutes`);
      console.log(`\n📋 Sample duration sources:`);
      durationSources.slice(0, 3).forEach(source => {
        console.log(`   Ticket ${source.ticketId}: ${source.value}s (${source.source || source.field})`);
      });
    } else {
      console.log(`   ⚠️  No duration data found in custom fields or descriptions`);
      console.log(`   💡 Dashboard might be pulling from Voice system directly`);
    }
  }

  async debugAverageWaitTime(voiceTickets) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Average Wait Time (currently showing 0)');
    console.log('='.repeat(50));

    let waitTimesFound = [];
    let waitTimeSources = [];

    voiceTickets.forEach(ticket => {
      const customFields = ticket.custom_fields || [];
      const description = ticket.description || '';

      // Check custom fields for wait time
      customFields.forEach(field => {
        if (field.value) {
          const fieldName = field.id.toString().toLowerCase();
          const value = parseFloat(field.value);
          
          if (fieldName.includes('wait') || fieldName.includes('queue') || fieldName.includes('hold')) {
            if (!isNaN(value) && value > 0) {
              waitTimesFound.push(value);
              waitTimeSources.push({
                ticketId: ticket.id,
                field: fieldName,
                value: value
              });
            }
          }
        }
      });

      // Check description for wait time patterns
      const waitPatterns = [
        /wait(?:ed|ing)?:?\s*(\d+(?:\.\d+)?)\s*(min|sec|minute|second|m|s)/i,
        /queue time:?\s*(\d+(?:\.\d+)?)\s*(min|sec|minute|second|m|s)/i,
        /hold time:?\s*(\d+(?:\.\d+)?)\s*(min|sec|minute|second|m|s)/i
      ];

      waitPatterns.forEach(pattern => {
        const match = description.match(pattern);
        if (match) {
          const value = parseFloat(match[1]);
          const unit = match[2]?.toLowerCase() || 'sec';
          const waitTimeSeconds = unit.startsWith('min') || unit === 'm' ? value * 60 : value;
          
          if (waitTimeSeconds > 0) {
            waitTimesFound.push(waitTimeSeconds);
            waitTimeSources.push({
              ticketId: ticket.id,
              source: 'description_pattern',
              value: waitTimeSeconds,
              match: match[0]
            });
          }
        }
      });
    });

    console.log(`📊 Wait time analysis results:`);
    console.log(`   Wait times found: ${waitTimesFound.length}`);
    
    if (waitTimesFound.length > 0) {
      const avgWaitTime = waitTimesFound.reduce((a, b) => a + b, 0) / waitTimesFound.length;
      console.log(`   Average wait time: ${Math.round(avgWaitTime / 60 * 100) / 100} minutes`);
      console.log(`\n📋 Sample wait time sources:`);
      waitTimeSources.slice(0, 3).forEach(source => {
        console.log(`   Ticket ${source.ticketId}: ${source.value}s (${source.source || source.field})`);
      });
    } else {
      console.log(`   ⚠️  No wait time data found`);
    }
  }

  async debugTimeToAnswer(voiceTickets) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Average Time to Answer (currently showing 0)');
    console.log('='.repeat(50));

    let answerTimesFound = [];

    voiceTickets.forEach(ticket => {
      const customFields = ticket.custom_fields || [];
      
      customFields.forEach(field => {
        if (field.value) {
          const fieldName = field.id.toString().toLowerCase();
          const value = parseFloat(field.value);
          
          if (fieldName.includes('answer') || fieldName.includes('pickup') || fieldName.includes('connect')) {
            if (!isNaN(value) && value > 0) {
              answerTimesFound.push(value);
            }
          }
        }
      });
    });

    console.log(`📊 Answer time analysis results:`);
    console.log(`   Answer times found: ${answerTimesFound.length}`);
    
    if (answerTimesFound.length === 0) {
      console.log(`   ⚠️  No answer time data found in custom fields`);
      console.log(`   💡 This metric might be calculated from call logs in Voice system`);
    }
  }

  async debugHoldTime(voiceTickets) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Average Hold Time (currently showing 0)');
    console.log('='.repeat(50));

    let holdTimesFound = [];

    voiceTickets.forEach(ticket => {
      const customFields = ticket.custom_fields || [];
      
      customFields.forEach(field => {
        if (field.value) {
          const fieldName = field.id.toString().toLowerCase();
          const value = parseFloat(field.value);
          
          if (fieldName.includes('hold')) {
            if (!isNaN(value) && value > 0) {
              holdTimesFound.push(value);
            }
          }
        }
      });
    });

    console.log(`📊 Hold time analysis results:`);
    console.log(`   Hold times found: ${holdTimesFound.length}`);
    
    if (holdTimesFound.length === 0) {
      console.log(`   ⚠️  No hold time data found`);
    }
  }

  async debugExceededWaitTime(voiceTickets) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Exceeded Queue Wait Time (currently showing 0)');
    console.log('='.repeat(50));

    // This depends on having wait time data first
    console.log(`   This metric depends on having wait time data from previous analysis`);
    console.log(`   If wait times are not captured, this will always be 0`);
  }

  async debugTicketStatuses(voiceTickets) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Ticket Status Analysis');
    console.log('='.repeat(50));

    const statusCounts = {};
    voiceTickets.forEach(ticket => {
      statusCounts[ticket.status] = (statusCounts[ticket.status] || 0) + 1;
    });

    console.log(`📊 Voice ticket statuses:`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} tickets`);
    });
  }

  async debugCustomFields(voiceTickets) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Custom Fields Analysis');
    console.log('='.repeat(50));

    const fieldUsage = {};
    let sampleFields = [];

    voiceTickets.forEach(ticket => {
      const customFields = ticket.custom_fields || [];
      
      customFields.forEach(field => {
        if (field.value) {
          const fieldId = field.id.toString();
          fieldUsage[fieldId] = (fieldUsage[fieldId] || 0) + 1;
          
          if (sampleFields.length < 10) {
            sampleFields.push({
              ticketId: ticket.id,
              fieldId: fieldId,
              value: field.value
            });
          }
        }
      });
    });

    console.log(`📊 Custom fields with values:`);
    Object.entries(fieldUsage).forEach(([fieldId, count]) => {
      console.log(`   Field ${fieldId}: ${count} tickets have values`);
    });

    if (sampleFields.length > 0) {
      console.log(`\n📋 Sample custom field values:`);
      sampleFields.slice(0, 5).forEach(field => {
        console.log(`   Ticket ${field.ticketId} - Field ${field.fieldId}: "${field.value}"`);
      });
    }
  }

  async debugVoiceAPIEndpoints() {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Voice API Endpoints for Metrics');
    console.log('='.repeat(50));

    const endpoints = [
      '/channels/voice/stats/current_queue_activity.json',
      '/channels/voice/stats/agents_activity.json', 
      '/channels/voice/stats/historical_queue_activity.json',
      '/channels/voice/stats.json',
      '/channels/voice/calls.json',
      '/channels/voice/legs.json'
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`\n📡 Trying endpoint: ${endpoint}`);
        const response = await this.zendesk.makeRequest('GET', endpoint);
        
        if (response) {
          console.log(`✅ Success! Response keys: ${Object.keys(response).join(', ')}`);
          
          // Log interesting data
          if (endpoint.includes('historical')) {
            console.log('   This might contain the historical metrics we need!');
          }
          if (endpoint.includes('calls') || endpoint.includes('legs')) {
            console.log('   This might contain individual call data with durations!');
          }
        }
        
      } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
      }
    }
  }
}

async function runMetricsDebug() {
  console.log('🔍 ZENDESK METRICS ACCURACY DEBUGGER');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  console.log(`🎯 Goal: Find why metrics show 0 when dashboard shows data\n`);
  
  const metricsDebugger = new MetricsDebugger();
  await metricsDebugger.debugZeroMetrics();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Metrics debugging complete');
  console.log('📊 Review above analysis to identify data source gaps');
}

runMetricsDebug();