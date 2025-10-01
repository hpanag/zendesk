const ZendeskClient = require('./src/ZendeskClient');

class AbandonedCallsDebugger {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async debugAbandonedCalls() {
    console.log('🔍 DEBUGGING ABANDONED CALLS DETECTION');
    console.log('='.repeat(60));
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      console.log(`📅 Analyzing abandoned calls for: ${today.toDateString()}`);
      
      // Method 1: Check Agent Activity API for missed calls
      console.log('\n📊 Method 1: Agent Activity API - Missed Calls');
      try {
        const agentResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/agents_activity.json');
        const agentActivityData = agentResponse.agents_activity || [];
        
        let totalMissed = 0;
        let totalDenied = 0;
        let agentsWithMissedCalls = [];
        
        agentActivityData.forEach(agent => {
          const missed = agent.calls_missed || 0;
          const denied = agent.calls_denied || 0;
          
          totalMissed += missed;
          totalDenied += denied;
          
          if (missed > 0 || denied > 0) {
            agentsWithMissedCalls.push({
              name: agent.name,
              agentId: agent.agent_id,
              missed: missed,
              denied: denied,
              accepted: agent.calls_accepted || 0
            });
          }
        });
        
        console.log(`✅ Agent Activity Analysis:`);
        console.log(`   Total calls missed: ${totalMissed}`);
        console.log(`   Total calls denied: ${totalDenied}`);
        console.log(`   Total abandoned: ${totalMissed + totalDenied}`);
        
        if (agentsWithMissedCalls.length > 0) {
          console.log(`\n📋 Agents with missed/denied calls:`);
          agentsWithMissedCalls.forEach(agent => {
            console.log(`   ${agent.name}: ${agent.missed} missed, ${agent.denied} denied, ${agent.accepted} accepted`);
          });
        }
        
      } catch (error) {
        console.log(`❌ Agent Activity API error: ${error.message}`);
      }
      
      // Method 2: Check voice tickets for abandoned indicators
      console.log('\n📊 Method 2: Voice Tickets Analysis');
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
      
      console.log(`📞 Found ${todaysVoiceTickets.length} voice tickets today`);
      
      let abandonedFromTickets = 0;
      let abandonedTickets = [];
      
      todaysVoiceTickets.forEach(ticket => {
        const subject = (ticket.subject || '').toLowerCase();
        const description = (ticket.description || '').toLowerCase();
        const status = ticket.status;
        
        // Check for abandoned indicators
        const abandonedIndicators = [];
        
        if (subject.includes('abandoned')) abandonedIndicators.push('subject:abandoned');
        if (subject.includes('missed')) abandonedIndicators.push('subject:missed');
        if (subject.includes('no answer')) abandonedIndicators.push('subject:no_answer');
        if (subject.includes('unanswered')) abandonedIndicators.push('subject:unanswered');
        
        if (description.includes('abandoned')) abandonedIndicators.push('description:abandoned');
        if (description.includes('missed')) abandonedIndicators.push('description:missed');
        if (description.includes('no answer')) abandonedIndicators.push('description:no_answer');
        if (description.includes('unanswered')) abandonedIndicators.push('description:unanswered');
        if (description.includes('caller hung up')) abandonedIndicators.push('description:hung_up');
        if (description.includes('disconnected')) abandonedIndicators.push('description:disconnected');
        
        // Check ticket duration (very short tickets might be abandoned)
        const createdAt = new Date(ticket.created_at);
        const updatedAt = new Date(ticket.updated_at);
        const ticketDuration = updatedAt - createdAt;
        
        if (ticketDuration < 30000) { // Less than 30 seconds
          abandonedIndicators.push('duration:very_short');
        }
        
        // Check status patterns that might indicate abandonment
        if (status === 'solved' && ticketDuration < 60000) {
          abandonedIndicators.push('status:quick_solved');
        }
        
        if (status === 'closed' && ticketDuration < 60000) {
          abandonedIndicators.push('status:quick_closed');
        }
        
        // Check if assignee is null (never assigned)
        if (!ticket.assignee_id) {
          abandonedIndicators.push('unassigned');
        }
        
        if (abandonedIndicators.length > 0) {
          abandonedFromTickets++;
          abandonedTickets.push({
            id: ticket.id,
            subject: ticket.subject,
            status: status,
            duration: Math.round(ticketDuration / 1000),
            indicators: abandonedIndicators,
            assigneeId: ticket.assignee_id
          });
        }
      });
      
      console.log(`📊 Ticket Analysis Results:`);
      console.log(`   Tickets with abandoned indicators: ${abandonedFromTickets}`);
      
      if (abandonedTickets.length > 0) {
        console.log(`\n📋 Sample abandoned tickets:`);
        abandonedTickets.slice(0, 5).forEach(ticket => {
          console.log(`   Ticket ${ticket.id} (${ticket.duration}s): "${ticket.subject}"`);
          console.log(`   Status: ${ticket.status}, Indicators: ${ticket.indicators.join(', ')}`);
        });
      }
      
      // Method 3: Check current queue activity for real-time abandonment patterns
      console.log('\n📊 Method 3: Current Queue Activity Analysis');
      try {
        const queueResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
        const queueStats = queueResponse.current_queue_activity;
        
        console.log(`📞 Current queue stats:`);
        console.log(`   Calls waiting: ${queueStats.calls_waiting}`);
        console.log(`   Average wait time: ${Math.round(queueStats.average_wait_time / 60)} minutes`);
        console.log(`   Longest wait time: ${Math.round(queueStats.longest_wait_time / 60)} minutes`);
        console.log(`   Callbacks waiting: ${queueStats.callbacks_waiting}`);
        
        // High wait times might indicate potential abandonment
        if (queueStats.longest_wait_time > 1800) { // 30+ minutes
          console.log(`⚠️  Long wait times detected - high abandonment risk`);
        }
        
      } catch (error) {
        console.log(`❌ Queue activity API error: ${error.message}`);
      }
      
      // Method 4: Try to find additional Voice API endpoints that might have abandonment data
      console.log('\n📊 Method 4: Exploring Additional Voice APIs');
      
      const additionalEndpoints = [
        '/channels/voice/stats/incremental/calls.json',
        '/channels/voice/overview.json',
        '/channels/voice/call_logs.json',
        '/channels/voice/stats/calls.json'
      ];
      
      for (const endpoint of additionalEndpoints) {
        try {
          console.log(`\n📡 Trying: ${endpoint}`);
          const response = await this.zendesk.makeRequest('GET', endpoint);
          
          if (response) {
            console.log(`✅ Success! Keys: ${Object.keys(response).join(', ')}`);
            
            // Look for abandonment-related data
            const responseStr = JSON.stringify(response).toLowerCase();
            if (responseStr.includes('abandon') || responseStr.includes('missed') || responseStr.includes('dropped')) {
              console.log(`🎯 This endpoint might contain abandonment data!`);
            }
          }
          
        } catch (error) {
          console.log(`❌ Failed: ${error.message}`);
        }
      }
      
      // Summary and recommendations
      console.log('\n' + '='.repeat(60));
      console.log('📊 ABANDONED CALLS SUMMARY');
      console.log('='.repeat(60));
      
      console.log(`\n🔍 Detection Results:`);
      
      let agentAbandonedCount = 0;
      try {
        const agentResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/agents_activity.json');
        const agentActivityData = agentResponse.agents_activity || [];
        
        agentActivityData.forEach(agent => {
          agentAbandonedCount += (agent.calls_missed || 0) + (agent.calls_denied || 0);
        });
      } catch (error) {
        console.log('Could not get agent activity data for summary');
      }
      
      console.log(`   Agent Activity API: ${agentAbandonedCount} abandoned calls`);
      console.log(`   Ticket Analysis: ${abandonedFromTickets} potential abandoned tickets`);
      
      console.log(`\n💡 Recommendations:`);
      if (totalMissed + totalDenied > 0) {
        console.log(`   ✅ Use Agent Activity API: calls_missed (${totalMissed}) + calls_denied (${totalDenied})`);
      } else {
        console.log(`   ⚠️  Agent Activity shows no missed/denied calls - might be daily reset or different tracking`);
      }
      
      if (abandonedFromTickets > 0) {
        console.log(`   📋 Consider ticket indicators for additional abandoned call detection`);
      }
      
      console.log(`   🔄 Dashboard might use real-time call logs or CDR data not accessible via these APIs`);
      
    } catch (error) {
      console.error('❌ Error debugging abandoned calls:', error.message);
    }
  }
}

async function debugAbandonedCalls() {
  console.log('🔍 ABANDONED CALLS DEBUGGER');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  console.log(`🎯 Goal: Find why abandoned calls show 0 when should be more\n`);
  
  const abandonedDebugger = new AbandonedCallsDebugger();
  await abandonedDebugger.debugAbandonedCalls();
  
  console.log('\n✅ Abandoned calls debugging complete');
}

debugAbandonedCalls();