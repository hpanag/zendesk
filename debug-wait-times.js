const ZendeskClient = require('./src/ZendeskClient');

class WaitTimeDebugger {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async debugWaitTimes() {
    console.log('🔍 DEBUGGING WAIT TIME METRICS');
    console.log('='.repeat(60));
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      console.log(`📅 Analyzing wait times for: ${today.toDateString()}`);
      console.log(`🕐 Current queue wait: ~24-44 minutes (from live queue data)\n`);
      
      // Method 1: Check current queue activity for wait time patterns
      console.log('📊 Method 1: Current Queue Activity - Real-time Wait Times');
      try {
        const queueResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
        const queueStats = queueResponse.current_queue_activity;
        
        console.log(`✅ Current Queue Wait Times:`);
        console.log(`   Average wait time: ${queueStats.average_wait_time} seconds (${Math.round(queueStats.average_wait_time / 60 * 100) / 100} minutes)`);
        console.log(`   Longest wait time: ${queueStats.longest_wait_time} seconds (${Math.round(queueStats.longest_wait_time / 60 * 100) / 100} minutes)`);
        console.log(`   Calls waiting: ${queueStats.calls_waiting}`);
        
        // Check if current wait times exceed threshold (5+ minutes = 300 seconds)
        const exceededThreshold = queueStats.average_wait_time > 300 || queueStats.longest_wait_time > 300;
        console.log(`   Exceeded 5-minute threshold: ${exceededThreshold}`);
        
        if (queueStats.calls_waiting > 0 && queueStats.average_wait_time > 0) {
          console.log(`   💡 Real-time wait data is available - can be used for averages`);
        }
        
      } catch (error) {
        console.log(`❌ Queue activity API error: ${error.message}`);
      }
      
      // Method 2: Check Agent Activity API for wait-related metrics
      console.log('\n📊 Method 2: Agent Activity API - Wait Time Data');
      try {
        const agentResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/agents_activity.json');
        const agentActivityData = agentResponse.agents_activity || [];
        
        console.log(`✅ Agent Activity Analysis (${agentActivityData.length} agents):`);
        
        let agentsWithWaitData = [];
        agentActivityData.forEach(agent => {
          // Check if agent has any wait-time related metrics
          const waitMetrics = {};
          
          if (agent.average_wait_time !== undefined) waitMetrics.avgWait = agent.average_wait_time;
          if (agent.total_wait_time !== undefined) waitMetrics.totalWait = agent.total_wait_time;
          if (agent.queue_wait_time !== undefined) waitMetrics.queueWait = agent.queue_wait_time;
          
          if (Object.keys(waitMetrics).length > 0) {
            agentsWithWaitData.push({
              name: agent.name,
              metrics: waitMetrics,
              callsAccepted: agent.calls_accepted || 0
            });
          }
        });
        
        if (agentsWithWaitData.length > 0) {
          console.log(`   Found wait data for ${agentsWithWaitData.length} agents:`);
          agentsWithWaitData.slice(0, 3).forEach(agent => {
            console.log(`   ${agent.name}: ${JSON.stringify(agent.metrics)}`);
          });
        } else {
          console.log(`   ⚠️  No wait time metrics found in agent activity data`);
          
          // Show sample agent structure to see what fields are available
          console.log(`\n   📋 Sample agent fields:`);
          if (agentActivityData.length > 0) {
            const sampleAgent = agentActivityData[0];
            const fields = Object.keys(sampleAgent).filter(key => 
              key.toLowerCase().includes('wait') || 
              key.toLowerCase().includes('queue') ||
              key.toLowerCase().includes('time')
            );
            console.log(`   Wait/Time related fields: ${fields.join(', ')}`);
          }
        }
        
      } catch (error) {
        console.log(`❌ Agent activity API error: ${error.message}`);
      }
      
      // Method 3: Analyze voice tickets for wait time indicators
      console.log('\n📊 Method 3: Voice Tickets - Wait Time Analysis');
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
      
      console.log(`📞 Analyzing ${todaysVoiceTickets.length} voice tickets for wait time data...`);
      
      let waitTimesFromTickets = [];
      let waitTimeSourcesFound = [];
      
      todaysVoiceTickets.forEach(ticket => {
        const customFields = ticket.custom_fields || [];
        const description = ticket.description || '';
        const subject = ticket.subject || '';
        
        // Method 3A: Check custom fields for wait time data
        customFields.forEach(field => {
          if (field.value) {
            const fieldName = field.id.toString();
            const fieldValue = field.value.toString().toLowerCase();
            
            // Look for wait-time related field names or values
            if (fieldName.toLowerCase().includes('wait') || 
                fieldName.toLowerCase().includes('queue') ||
                fieldValue.includes('wait') ||
                fieldValue.includes('queue')) {
              
              const numericValue = parseFloat(field.value);
              if (!isNaN(numericValue) && numericValue > 0 && numericValue < 7200) { // Reasonable wait time (under 2 hours)
                waitTimesFromTickets.push(numericValue);
                waitTimeSourcesFound.push({
                  ticketId: ticket.id,
                  source: `custom_field_${fieldName}`,
                  value: numericValue,
                  rawValue: field.value
                });
              }
            }
          }
        });
        
        // Method 3B: Parse wait times from description using regex
        const waitPatterns = [
          /wait(?:ed|ing)?\s*(?:time)?:?\s*(\d+(?:\.\d+)?)\s*(min|sec|minute|second|m|s)/i,
          /queue\s*(?:time)?:?\s*(\d+(?:\.\d+)?)\s*(min|sec|minute|second|m|s)/i,
          /held\s*(?:for)?:?\s*(\d+(?:\.\d+)?)\s*(min|sec|minute|second|m|s)/i,
          /(\d+):(\d+)\s*(?:wait|queue)/i  // MM:SS format
        ];
        
        waitPatterns.forEach((pattern, idx) => {
          const match = description.match(pattern);
          if (match) {
            let waitTimeSeconds;
            if (idx === 3) { // MM:SS format
              const minutes = parseInt(match[1]) || 0;
              const seconds = parseInt(match[2]) || 0;
              waitTimeSeconds = (minutes * 60) + seconds;
            } else {
              const value = parseFloat(match[1]);
              const unit = match[2]?.toLowerCase() || 'sec';
              waitTimeSeconds = unit.startsWith('min') || unit === 'm' ? value * 60 : value;
            }
            
            if (waitTimeSeconds > 0 && waitTimeSeconds < 7200) { // Under 2 hours
              waitTimesFromTickets.push(waitTimeSeconds);
              waitTimeSourcesFound.push({
                ticketId: ticket.id,
                source: 'description_pattern',
                value: waitTimeSeconds,
                match: match[0]
              });
            }
          }
        });
        
        // Method 3C: Check for wait time in subject line
        const subjectWaitMatch = subject.match(/wait:?\s*(\d+(?:\.\d+)?)\s*(min|sec|m|s)/i);
        if (subjectWaitMatch) {
          const value = parseFloat(subjectWaitMatch[1]);
          const unit = subjectWaitMatch[2]?.toLowerCase() || 'sec';
          const waitTimeSeconds = unit.startsWith('min') || unit === 'm' ? value * 60 : value;
          
          if (waitTimeSeconds > 0 && waitTimeSeconds < 7200) {
            waitTimesFromTickets.push(waitTimeSeconds);
            waitTimeSourcesFound.push({
              ticketId: ticket.id,
              source: 'subject_pattern',
              value: waitTimeSeconds,
              match: subjectWaitMatch[0]
            });
          }
        }
      });
      
      console.log(`📊 Wait Time Extraction Results:`);
      console.log(`   Wait times found: ${waitTimesFromTickets.length}`);
      
      if (waitTimesFromTickets.length > 0) {
        const avgWaitTime = waitTimesFromTickets.reduce((a, b) => a + b, 0) / waitTimesFromTickets.length;
        const maxWaitTime = Math.max(...waitTimesFromTickets);
        const exceededCount = waitTimesFromTickets.filter(w => w > 300).length; // 5+ minutes
        
        console.log(`   Average wait time: ${Math.round(avgWaitTime / 60 * 100) / 100} minutes`);
        console.log(`   Maximum wait time: ${Math.round(maxWaitTime / 60 * 100) / 100} minutes`);
        console.log(`   Calls exceeded 5-min wait: ${exceededCount}`);
        
        console.log(`\n📋 Sample wait time sources:`);
        waitTimeSourcesFound.slice(0, 5).forEach(source => {
          console.log(`   Ticket ${source.ticketId}: ${Math.round(source.value / 60 * 100) / 100}min from ${source.source}`);
        });
      } else {
        console.log(`   ⚠️  No wait time data found in tickets`);
      }
      
      // Method 4: Try to use current queue data as a proxy for historical wait times
      console.log('\n📊 Method 4: Using Current Queue as Historical Proxy');
      try {
        const queueResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
        const queueStats = queueResponse.current_queue_activity;
        
        console.log(`💡 Proxy Method Analysis:`);
        console.log(`   If current avg wait (${Math.round(queueStats.average_wait_time / 60)}min) represents today's pattern:`);
        
        // Estimate today's metrics based on current patterns and call volume
        const totalCallsToday = 26; // From previous agent activity analysis
        const estimatedTotalWaitTime = queueStats.average_wait_time * totalCallsToday;
        const exceededEstimate = queueStats.average_wait_time > 300 ? Math.floor(totalCallsToday * 0.7) : 0; // Estimate 70% exceeded if avg > 5min
        
        console.log(`   Estimated total wait time today: ${Math.round(estimatedTotalWaitTime / 60)} minutes`);
        console.log(`   Estimated calls exceeding wait threshold: ${exceededEstimate}`);
        console.log(`   This could be used as fallback if no historical data available`);
        
      } catch (error) {
        console.log(`❌ Could not get current queue data for proxy analysis`);
      }
      
      // Summary and recommendations
      console.log('\n' + '='.repeat(60));
      console.log('📊 WAIT TIME ANALYSIS SUMMARY');
      console.log('='.repeat(60));
      
      console.log(`\n🔍 Data Sources Found:`);
      if (waitTimesFromTickets.length > 0) {
        console.log(`   ✅ Ticket Analysis: ${waitTimesFromTickets.length} wait times extracted`);
        const avgFromTickets = waitTimesFromTickets.reduce((a, b) => a + b, 0) / waitTimesFromTickets.length / 60;
        console.log(`   📊 Average: ${Math.round(avgFromTickets * 100) / 100} minutes`);
      } else {
        console.log(`   ❌ No historical wait times found in tickets`);
      }
      
      console.log(`\n💡 Recommendations for LiveFeed:`);
      if (waitTimesFromTickets.length > 0) {
        console.log(`   1. ✅ Use ticket-extracted wait times for historical averages`);
        console.log(`   2. ✅ Use current queue data for real-time wait metrics`);
      } else {
        console.log(`   1. 🔄 Use current queue average as proxy for daily average`);
        console.log(`   2. 📊 Use current queue data to estimate exceeded wait times`);
        console.log(`   3. 🎯 Dashboard likely uses CDR/call logs not accessible via these APIs`);
      }
      
    } catch (error) {
      console.error('❌ Error debugging wait times:', error.message);
    }
  }
}

async function debugWaitTimes() {
  console.log('🔍 WAIT TIME DEBUGGER');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  console.log(`🎯 Goal: Find why wait time metrics show 0\n`);
  
  const waitDebugger = new WaitTimeDebugger();
  await waitDebugger.debugWaitTimes();
  
  console.log('\n✅ Wait time debugging complete');
}

debugWaitTimes();