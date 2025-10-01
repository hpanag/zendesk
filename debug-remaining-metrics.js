const ZendeskClient = require('./src/ZendeskClient');

class RemainingMetricsDebugger {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async debugRemainingMetrics() {
    console.log('🔍 DEBUGGING REMAINING ZERO METRICS');
    console.log('='.repeat(60));
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      console.log(`📅 Analyzing for: ${today.toDateString()}`);
      console.log(`🎯 Focus: totalOutboundCalls, totalCallbackCalls, averageTimeToAnswer, averageCallbackWaitTime\n`);

      // Get today's voice tickets for analysis
      const todayTickets = await this.zendesk.getTickets({
        per_page: 100,
        sort_by: 'created_at',
        sort_order: 'desc'
      });
      
      const allTickets = todayTickets.tickets || [];
      const todaysVoiceTickets = allTickets.filter(ticket => {
        const createdDate = new Date(ticket.created_at);
        const isToday = createdDate >= today;
        const isVoice = ticket.via?.channel === 'voice';
        return isToday && isVoice;
      });
      
      console.log(`📞 Analyzing ${todaysVoiceTickets.length} voice tickets...\n`);

      // DEBUG 1: Total Outbound Calls
      await this.debugOutboundCalls(todaysVoiceTickets);

      // DEBUG 2: Total Callback Calls  
      await this.debugCallbackCalls(todaysVoiceTickets);

      // DEBUG 3: Average Time to Answer
      await this.debugTimeToAnswer(todaysVoiceTickets);

      // DEBUG 4: Average Callback Wait Time
      await this.debugCallbackWaitTime(todaysVoiceTickets);

      // DEBUG 5: Check Agent Activity API for additional outbound/callback data
      await this.debugAgentActivityForMissingMetrics();

      // DEBUG 6: Explore additional Voice API endpoints
      await this.debugAdditionalVoiceEndpoints();

    } catch (error) {
      console.error('❌ Error debugging remaining metrics:', error.message);
    }
  }

  async debugOutboundCalls(tickets) {
    console.log('=' .repeat(50));
    console.log('🔍 DEBUGGING: Total Outbound Calls (showing 0)');
    console.log('='.repeat(50));

    let outboundCount = 0;
    let outboundIndicators = [];

    tickets.forEach(ticket => {
      const subject = (ticket.subject || '').toLowerCase();
      const description = (ticket.description || '').toLowerCase();
      const via = ticket.via;

      // Method 1: Check via.source.rel for outbound indication
      if (via && via.source && via.source.rel === 'outbound') {
        outboundCount++;
        outboundIndicators.push({
          ticketId: ticket.id,
          method: 'via.source.rel',
          value: via.source.rel,
          subject: ticket.subject
        });
      }

      // Method 2: Check subject for outbound keywords
      const outboundKeywords = ['outbound', 'outgoing', 'dialed', 'calling out', 'made call'];
      outboundKeywords.forEach(keyword => {
        if (subject.includes(keyword)) {
          outboundCount++;
          outboundIndicators.push({
            ticketId: ticket.id,
            method: 'subject_keyword',
            keyword: keyword,
            subject: ticket.subject
          });
        }
      });

      // Method 3: Check description for outbound indicators
      if (description.includes('outbound') || description.includes('outgoing call') || description.includes('dialed')) {
        outboundCount++;
        outboundIndicators.push({
          ticketId: ticket.id,
          method: 'description_keyword',
          subject: ticket.subject
        });
      }

      // Method 4: Check custom fields for outbound indicators
      const customFields = ticket.custom_fields || [];
      customFields.forEach(field => {
        if (field.value) {
          const fieldValue = field.value.toString().toLowerCase();
          if (fieldValue.includes('outbound') || fieldValue.includes('outgoing')) {
            outboundCount++;
            outboundIndicators.push({
              ticketId: ticket.id,
              method: `custom_field_${field.id}`,
              value: field.value,
              subject: ticket.subject
            });
          }
        }
      });
    });

    console.log(`📊 Outbound Call Analysis:`);
    console.log(`   Potential outbound calls found: ${outboundCount}`);
    
    if (outboundIndicators.length > 0) {
      console.log(`\n📋 Outbound call indicators found:`);
      outboundIndicators.slice(0, 5).forEach(indicator => {
        console.log(`   Ticket ${indicator.ticketId}: ${indicator.method} - "${indicator.subject}"`);
      });
    } else {
      console.log(`   ⚠️  No outbound call indicators found`);
      console.log(`   💡 All calls appear to be inbound - this might be accurate!`);
      
      // Show sample via.source structures
      console.log(`\n📋 Sample via.source structures:`);
      tickets.slice(0, 3).forEach(ticket => {
        console.log(`   Ticket ${ticket.id}: via.source = ${JSON.stringify(ticket.via?.source)}`);
      });
    }
  }

  async debugCallbackCalls(tickets) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Total Callback Calls (showing 0)');
    console.log('='.repeat(50));

    let callbackCount = 0;
    let callbackIndicators = [];

    tickets.forEach(ticket => {
      const subject = (ticket.subject || '').toLowerCase();
      const description = (ticket.description || '').toLowerCase();
      const via = ticket.via;

      // Method 1: Explicit callback in subject
      const callbackKeywords = ['callback', 'call back', 'return call', 'scheduled call', 'follow up call'];
      callbackKeywords.forEach(keyword => {
        if (subject.includes(keyword)) {
          callbackCount++;
          callbackIndicators.push({
            ticketId: ticket.id,
            method: 'subject_keyword',
            keyword: keyword,
            subject: ticket.subject
          });
        }
      });

      // Method 2: Callback in description
      if (description.includes('callback') || description.includes('call back') || description.includes('return call')) {
        callbackCount++;
        callbackIndicators.push({
          ticketId: ticket.id,
          method: 'description_keyword',
          subject: ticket.subject
        });
      }

      // Method 3: Check via.source for callback indicators
      if (via && via.source) {
        const sourceStr = JSON.stringify(via.source).toLowerCase();
        if (sourceStr.includes('callback') || sourceStr.includes('scheduled')) {
          callbackCount++;
          callbackIndicators.push({
            ticketId: ticket.id,
            method: 'via_source',
            source: via.source,
            subject: ticket.subject
          });
        }
      }

      // Method 4: Check custom fields for callback scheduling
      const customFields = ticket.custom_fields || [];
      customFields.forEach(field => {
        if (field.value) {
          const fieldValue = field.value.toString().toLowerCase();
          if (fieldValue.includes('callback') || fieldValue.includes('scheduled') || fieldValue.includes('follow up')) {
            callbackCount++;
            callbackIndicators.push({
              ticketId: ticket.id,
              method: `custom_field_${field.id}`,
              value: field.value,
              subject: ticket.subject
            });
          }
        }
      });

      // Method 5: Check if ticket has future scheduled activity (might indicate callback)
      if (ticket.due_at || ticket.updated_at !== ticket.created_at) {
        const hasScheduling = ticket.due_at && new Date(ticket.due_at) > new Date();
        if (hasScheduling && (subject.includes('call') || description.includes('call'))) {
          callbackCount++;
          callbackIndicators.push({
            ticketId: ticket.id,
            method: 'scheduled_activity',
            dueAt: ticket.due_at,
            subject: ticket.subject
          });
        }
      }
    });

    console.log(`📊 Callback Call Analysis:`);
    console.log(`   Potential callback calls found: ${callbackCount}`);
    
    if (callbackIndicators.length > 0) {
      console.log(`\n📋 Callback indicators found:`);
      callbackIndicators.slice(0, 5).forEach(indicator => {
        console.log(`   Ticket ${indicator.ticketId}: ${indicator.method} - "${indicator.subject}"`);
      });
    } else {
      console.log(`   ⚠️  No callback indicators found in tickets`);
      console.log(`   💡 Callbacks might be tracked in a separate system or not used today`);
    }
  }

  async debugTimeToAnswer(tickets) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Average Time to Answer (showing 0)');
    console.log('='.repeat(50));

    let answerTimesFound = [];
    let answerTimeSources = [];

    tickets.forEach(ticket => {
      const customFields = ticket.custom_fields || [];
      const description = ticket.description || '';
      const createdAt = new Date(ticket.created_at);
      const firstResponseAt = ticket.first_response_at ? new Date(ticket.first_response_at) : null;

      // Method 1: Check custom fields for answer time
      customFields.forEach(field => {
        if (field.value) {
          const fieldName = field.id.toString().toLowerCase();
          const fieldValue = field.value.toString().toLowerCase();
          
          if (fieldName.includes('answer') || fieldName.includes('pickup') || fieldName.includes('connect') ||
              fieldValue.includes('answer') || fieldValue.includes('pickup')) {
            
            const numericValue = parseFloat(field.value);
            if (!isNaN(numericValue) && numericValue > 0 && numericValue < 300) { // Reasonable answer time (under 5 minutes)
              answerTimesFound.push(numericValue);
              answerTimeSources.push({
                ticketId: ticket.id,
                method: `custom_field_${field.id}`,
                value: numericValue,
                rawValue: field.value
              });
            }
          }
        }
      });

      // Method 2: Parse answer time from description
      const answerPatterns = [
        /answer(?:ed)?.*?(\d+(?:\.\d+)?)\s*(sec|second|s)/i,
        /pickup.*?(\d+(?:\.\d+)?)\s*(sec|second|s)/i,
        /connect(?:ed)?.*?(\d+(?:\.\d+)?)\s*(sec|second|s)/i,
        /ring(?:s|ing)?.*?(\d+(?:\.\d+)?)\s*(sec|second|s)/i
      ];

      answerPatterns.forEach(pattern => {
        const match = description.match(pattern);
        if (match) {
          const answerTime = parseFloat(match[1]);
          if (answerTime > 0 && answerTime < 300) {
            answerTimesFound.push(answerTime);
            answerTimeSources.push({
              ticketId: ticket.id,
              method: 'description_pattern',
              value: answerTime,
              match: match[0]
            });
          }
        }
      });

      // Method 3: Calculate from ticket timestamps (created to first response)
      if (firstResponseAt && ticket.assignee_id) {
        const answerTimeSeconds = (firstResponseAt - createdAt) / 1000;
        // Only use if reasonable (under 10 minutes and over 1 second)
        if (answerTimeSeconds > 1 && answerTimeSeconds < 600) {
          answerTimesFound.push(answerTimeSeconds);
          answerTimeSources.push({
            ticketId: ticket.id,
            method: 'timestamp_calculation',
            value: answerTimeSeconds,
            createdAt: ticket.created_at,
            firstResponseAt: ticket.first_response_at
          });
        }
      }
    });

    console.log(`📊 Time to Answer Analysis:`);
    console.log(`   Answer times found: ${answerTimesFound.length}`);
    
    if (answerTimesFound.length > 0) {
      const avgAnswerTime = answerTimesFound.reduce((a, b) => a + b, 0) / answerTimesFound.length;
      console.log(`   Average time to answer: ${Math.round(avgAnswerTime)} seconds`);
      
      console.log(`\n📋 Answer time sources:`);
      answerTimeSources.slice(0, 5).forEach(source => {
        console.log(`   Ticket ${source.ticketId}: ${Math.round(source.value)}s via ${source.method}`);
      });
    } else {
      console.log(`   ⚠️  No answer time data found`);
      console.log(`   💡 Answer time likely tracked in call logs or CDR system not accessible via API`);
    }
  }

  async debugCallbackWaitTime(tickets) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Average Callback Wait Time (showing 0)');
    console.log('='.repeat(50));

    // First find callback tickets, then analyze their wait times
    const callbackTickets = tickets.filter(ticket => {
      const subject = (ticket.subject || '').toLowerCase();
      const description = (ticket.description || '').toLowerCase();
      
      return subject.includes('callback') || 
             subject.includes('call back') ||
             description.includes('callback') ||
             description.includes('call back');
    });

    console.log(`📞 Found ${callbackTickets.length} potential callback tickets`);

    if (callbackTickets.length === 0) {
      console.log(`   ⚠️  No callback tickets found - callback wait time will be 0`);
      console.log(`   💡 This might be accurate if no callbacks were scheduled today`);
      return;
    }

    let callbackWaitTimes = [];
    let waitTimeSources = [];

    callbackTickets.forEach(ticket => {
      const customFields = ticket.custom_fields || [];
      const description = ticket.description || '';
      const createdAt = new Date(ticket.created_at);
      const updatedAt = new Date(ticket.updated_at);

      // Method 1: Check custom fields for callback wait time
      customFields.forEach(field => {
        if (field.value) {
          const fieldName = field.id.toString().toLowerCase();
          if (fieldName.includes('wait') || fieldName.includes('callback') || fieldName.includes('delay')) {
            const numericValue = parseFloat(field.value);
            if (!isNaN(numericValue) && numericValue > 0 && numericValue < 7200) { // Under 2 hours
              callbackWaitTimes.push(numericValue);
              waitTimeSources.push({
                ticketId: ticket.id,
                method: `custom_field_${field.id}`,
                value: numericValue
              });
            }
          }
        }
      });

      // Method 2: Parse wait time from description
      const waitPatterns = [
        /callback.*?wait.*?(\d+(?:\.\d+)?)\s*(min|sec|hour|minute|second|h|m|s)/i,
        /wait.*?callback.*?(\d+(?:\.\d+)?)\s*(min|sec|hour|minute|second|h|m|s)/i,
        /scheduled.*?(\d+(?:\.\d+)?)\s*(min|sec|hour|minute|second|h|m|s).*?later/i
      ];

      waitPatterns.forEach(pattern => {
        const match = description.match(pattern);
        if (match) {
          const value = parseFloat(match[1]);
          const unit = match[2].toLowerCase();
          
          let waitTimeSeconds;
          if (unit.startsWith('h')) waitTimeSeconds = value * 3600;
          else if (unit.startsWith('min') || unit === 'm') waitTimeSeconds = value * 60;
          else waitTimeSeconds = value;

          if (waitTimeSeconds > 0 && waitTimeSeconds < 7200) {
            callbackWaitTimes.push(waitTimeSeconds);
            waitTimeSources.push({
              ticketId: ticket.id,
              method: 'description_pattern',
              value: waitTimeSeconds,
              match: match[0]
            });
          }
        }
      });

      // Method 3: Use ticket lifecycle as proxy (created to updated time)
      const lifecycleTime = (updatedAt - createdAt) / 1000;
      if (lifecycleTime > 60 && lifecycleTime < 7200) { // Between 1 minute and 2 hours
        callbackWaitTimes.push(lifecycleTime);
        waitTimeSources.push({
          ticketId: ticket.id,
          method: 'ticket_lifecycle',
          value: lifecycleTime
        });
      }
    });

    console.log(`📊 Callback Wait Time Analysis:`);
    console.log(`   Wait times found: ${callbackWaitTimes.length}`);
    
    if (callbackWaitTimes.length > 0) {
      const avgCallbackWait = callbackWaitTimes.reduce((a, b) => a + b, 0) / callbackWaitTimes.length;
      console.log(`   Average callback wait: ${Math.round(avgCallbackWait / 60 * 100) / 100} minutes`);
      
      console.log(`\n📋 Callback wait sources:`);
      waitTimeSources.slice(0, 3).forEach(source => {
        console.log(`   Ticket ${source.ticketId}: ${Math.round(source.value / 60)}min via ${source.method}`);
      });
    } else {
      console.log(`   ⚠️  No callback wait time data found`);
    }
  }

  async debugAgentActivityForMissingMetrics() {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Agent Activity API - Missing Metrics');
    console.log('='.repeat(50));

    try {
      const agentResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/agents_activity.json');
      const agentActivityData = agentResponse.agents_activity || [];
      
      console.log(`📊 Checking ${agentActivityData.length} agents for outbound/callback metrics...`);

      // Look for outbound-related fields
      let outboundRelatedFields = new Set();
      let callbackRelatedFields = new Set();
      let timeToAnswerFields = new Set();

      agentActivityData.forEach(agent => {
        Object.keys(agent).forEach(field => {
          const fieldLower = field.toLowerCase();
          if (fieldLower.includes('outbound') || fieldLower.includes('outgoing')) {
            outboundRelatedFields.add(field);
          }
          if (fieldLower.includes('callback') || fieldLower.includes('scheduled')) {
            callbackRelatedFields.add(field);
          }
          if (fieldLower.includes('answer') || fieldLower.includes('pickup') || fieldLower.includes('connect')) {
            timeToAnswerFields.add(field);
          }
        });
      });

      console.log(`📋 Agent Activity Field Analysis:`);
      console.log(`   Outbound-related fields: ${Array.from(outboundRelatedFields).join(', ') || 'None found'}`);
      console.log(`   Callback-related fields: ${Array.from(callbackRelatedFields).join(', ') || 'None found'}`);
      console.log(`   Answer time-related fields: ${Array.from(timeToAnswerFields).join(', ') || 'None found'}`);

      // Sample agent data
      if (agentActivityData.length > 0) {
        console.log(`\n📋 Sample agent activity (all fields):`);
        console.log(JSON.stringify(agentActivityData[0], null, 2));
      }

    } catch (error) {
      console.log(`❌ Agent Activity API error: ${error.message}`);
    }
  }

  async debugAdditionalVoiceEndpoints() {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 DEBUGGING: Additional Voice API Endpoints');
    console.log('='.repeat(50));

    const additionalEndpoints = [
      '/channels/voice/calls.json?direction=outbound',
      '/channels/voice/calls.json?type=callback', 
      '/channels/voice/stats/incremental/calls.json?start_time=' + encodeURIComponent(new Date().toISOString().split('T')[0]),
      '/channels/voice/phone_numbers.json'
    ];

    for (const endpoint of additionalEndpoints) {
      try {
        console.log(`\n📡 Trying: ${endpoint}`);
        const response = await this.zendesk.makeRequest('GET', endpoint);
        
        if (response) {
          console.log(`✅ Success! Keys: ${Object.keys(response).join(', ')}`);
          
          // Look for outbound/callback related data
          const responseStr = JSON.stringify(response).toLowerCase();
          if (responseStr.includes('outbound') || responseStr.includes('callback') || responseStr.includes('answer')) {
            console.log(`🎯 This endpoint contains relevant data for missing metrics!`);
          }
          
          // If calls data, show sample structure
          if (response.calls && response.calls.length > 0) {
            console.log(`📋 Sample call structure:`);
            console.log(JSON.stringify(response.calls[0], null, 2));
          }
        }
        
      } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
      }
    }
  }
}

async function debugRemainingMetrics() {
  console.log('🔍 REMAINING METRICS DEBUGGER');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  console.log(`🎯 Goal: Fix totalOutboundCalls, totalCallbackCalls, averageTimeToAnswer, averageCallbackWaitTime\n`);
  
  const metricsDebugger = new RemainingMetricsDebugger();
  await metricsDebugger.debugRemainingMetrics();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Remaining metrics debugging complete');
  console.log('📊 Use findings above to update LiveFeed calculations');
}

debugRemainingMetrics();