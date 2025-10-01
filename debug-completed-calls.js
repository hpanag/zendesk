const ZendeskClient = require('./src/ZendeskClient');

class CompletedCallsAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async analyzeCompletedCalls() {
    console.log('🔍 ANALYZING COMPLETED CALLS FOR MISSING METRICS');
    console.log('='.repeat(60));
    
    try {
      // Get calls with different parameters to find completed/historical calls
      const endpoints = [
        '/channels/voice/calls.json?per_page=100',
        '/channels/voice/calls.json?per_page=100&ended=true',
        '/channels/voice/calls.json?per_page=100&ended=false'
      ];

      let allCalls = [];
      
      for (const endpoint of endpoints) {
        try {
          console.log(`\n📡 Trying: ${endpoint}`);
          const response = await this.zendesk.makeRequest('GET', endpoint);
          const calls = response.calls || [];
          console.log(`   Found ${calls.length} calls`);
          
          // Add to collection (avoid duplicates)
          calls.forEach(call => {
            if (!allCalls.find(c => c.id === call.id)) {
              allCalls.push(call);
            }
          });
          
        } catch (error) {
          console.log(`   ❌ Failed: ${error.message}`);
        }
      }
      
      console.log(`\n📞 Total unique calls found: ${allCalls.length}`);
      
      // Filter for today's calls
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaysCalls = allCalls.filter(call => {
        if (!call.pick_up_time) return false;
        const callDate = new Date(call.pick_up_time);
        return callDate >= today;
      });
      
      console.log(`📅 Today's calls: ${todaysCalls.length}`);
      
      // Analyze call directions more thoroughly
      await this.analyzeCallDirections(todaysCalls, allCalls);
      
      // Check for timing data in completed calls
      await this.analyzeCallTimingData(todaysCalls);
      
      // Cross-reference with agent activity data
      await this.crossReferenceWithAgentActivity();
      
      // Try to reconcile with ticket data we found earlier
      await this.reconcileWithTicketData();
      
    } catch (error) {
      console.error('❌ Error analyzing completed calls:', error.message);
    }
  }

  async analyzeCallDirections(todaysCalls, allCalls) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 ANALYZING: Call Directions (Outbound Investigation)');
    console.log('='.repeat(50));

    // Check all calls for direction patterns
    const directionStats = {};
    allCalls.forEach(call => {
      const direction = call.direction || 'unknown';
      directionStats[direction] = (directionStats[direction] || 0) + 1;
    });

    console.log(`📊 All-time direction statistics:`);
    Object.entries(directionStats).forEach(([direction, count]) => {
      console.log(`   ${direction}: ${count} calls`);
    });

    // Check today specifically
    const todayDirections = {};
    todaysCalls.forEach(call => {
      const direction = call.direction || 'unknown';
      todayDirections[direction] = (todayDirections[direction] || 0) + 1;
    });

    console.log(`📊 Today's direction statistics:`);
    Object.entries(todayDirections).forEach(([direction, count]) => {
      console.log(`   ${direction}: ${count} calls`);
    });

    // Look for outbound calls in historical data
    const outboundCalls = allCalls.filter(call => call.direction === 'outbound');
    if (outboundCalls.length > 0) {
      console.log(`\n📋 Historical outbound calls found: ${outboundCalls.length}`);
      console.log(`   Latest outbound: ${outboundCalls[0]?.pick_up_time || 'Unknown time'}`);
      console.log(`   💡 Outbound calls do exist, but none today`);
    } else {
      console.log(`\n💡 No outbound calls found in historical data either`);
      console.log(`   This suggests outbound calling might not be used or tracked differently`);
    }
  }

  async analyzeCallTimingData(calls) {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 ANALYZING: Detailed Call Timing Data');
    console.log('='.repeat(50));

    let timingFieldsFound = new Set();
    let hasDetailedTiming = false;

    calls.forEach(call => {
      // Look for any timing-related fields
      Object.keys(call).forEach(key => {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('time') || 
            keyLower.includes('duration') || 
            keyLower.includes('answer') ||
            keyLower.includes('start') ||
            keyLower.includes('end') ||
            keyLower.includes('ring') ||
            keyLower.includes('wait')) {
          timingFieldsFound.add(key);
        }
      });

      // Check for nested timing data
      if (call.customer) {
        Object.keys(call.customer).forEach(key => {
          if (key.toLowerCase().includes('time')) {
            timingFieldsFound.add(`customer.${key}`);
          }
        });
      }
      
      if (call.agent) {
        Object.keys(call.agent).forEach(key => {
          if (key.toLowerCase().includes('time')) {
            timingFieldsFound.add(`agent.${key}`);
          }
        });
      }
    });

    console.log(`📊 Timing-related fields found: ${Array.from(timingFieldsFound).join(', ') || 'None'}`);

    if (timingFieldsFound.size === 0) {
      console.log(`   ⚠️  No detailed timing data available in calls API`);
      console.log(`   💡 Time to answer likely requires CDR access or different endpoint`);
    }

    // Check if we can derive answer time from available data
    calls.forEach(call => {
      console.log(`\n📋 Call ${call.id} timing analysis:`);
      console.log(`   Pick up time: ${call.pick_up_time}`);
      console.log(`   Ended: ${call.ended}`);
      console.log(`   On hold: ${call.on_hold}`);
      
      // If we had creation time, we could calculate answer time
      if (call.created_at && call.pick_up_time) {
        const createdAt = new Date(call.created_at);
        const pickedUpAt = new Date(call.pick_up_time);
        const answerTime = (pickedUpAt - createdAt) / 1000;
        console.log(`   Calculated answer time: ${Math.round(answerTime)} seconds`);
        hasDetailedTiming = true;
      }
    });

    if (!hasDetailedTiming) {
      console.log(`\n💡 Recommendation: Answer time tracking requires additional data not in current API`);
    }
  }

  async crossReferenceWithAgentActivity() {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 CROSS-REFERENCING: Agent Activity for Missing Metrics');
    console.log('='.repeat(50));

    try {
      const agentResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/agents_activity.json');
      const agentData = agentResponse.agents_activity || [];
      
      // Look for agents with actual call activity
      const activeAgents = agentData.filter(agent => 
        agent.calls_accepted > 0 || 
        agent.calls_denied > 0 || 
        agent.calls_missed > 0 ||
        agent.total_call_duration > 0
      );

      console.log(`📊 Agents with call activity: ${activeAgents.length}/${agentData.length}`);

      if (activeAgents.length > 0) {
        // Calculate totals from agent activity
        const totalAccepted = activeAgents.reduce((sum, agent) => sum + (agent.calls_accepted || 0), 0);
        const totalDenied = activeAgents.reduce((sum, agent) => sum + (agent.calls_denied || 0), 0);
        const totalMissed = activeAgents.reduce((sum, agent) => sum + (agent.calls_missed || 0), 0);
        const totalDuration = activeAgents.reduce((sum, agent) => sum + (agent.total_call_duration || 0), 0);
        const totalTalkTime = activeAgents.reduce((sum, agent) => sum + (agent.total_talk_time || 0), 0);

        console.log(`📊 Agent activity totals:`);
        console.log(`   Calls accepted: ${totalAccepted}`);
        console.log(`   Calls denied: ${totalDenied}`);
        console.log(`   Calls missed: ${totalMissed}`);
        console.log(`   Total duration: ${Math.round(totalDuration)} seconds`);
        console.log(`   Total talk time: ${Math.round(totalTalkTime)} seconds`);

        // Check for timing averages
        if (totalAccepted > 0 && totalTalkTime > 0) {
          const avgTalkTime = totalTalkTime / totalAccepted;
          console.log(`   Average talk time: ${Math.round(avgTalkTime)} seconds`);
        }

        // Look for outbound indicators in agent data
        console.log(`\n📋 Checking for outbound/callback indicators in agent data:`);
        activeAgents.forEach(agent => {
          const agentStr = JSON.stringify(agent).toLowerCase();
          if (agentStr.includes('outbound') || agentStr.includes('callback')) {
            console.log(`   Agent ${agent.name}: Contains outbound/callback data`);
          }
        });
      }
      
    } catch (error) {
      console.log(`❌ Agent activity error: ${error.message}`);
    }
  }

  async reconcileWithTicketData() {
    console.log('\n' + '='.repeat(50));
    console.log('🔍 RECONCILING: Ticket Data vs Call Data');
    console.log('='.repeat(50));

    try {
      // Get voice tickets from earlier analysis
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const ticketsResponse = await this.zendesk.getTickets({
        per_page: 100,
        sort_by: 'created_at',
        sort_order: 'desc'
      });
      
      const allTickets = ticketsResponse.tickets || [];
      const todaysVoiceTickets = allTickets.filter(ticket => {
        const createdDate = new Date(ticket.created_at);
        const isToday = createdDate >= today;
        const isVoice = ticket.via?.channel === 'voice';
        return isToday && isVoice;
      });

      console.log(`📞 Voice tickets today: ${todaysVoiceTickets.length}`);

      // Look for outbound ticket we found earlier
      const outboundTickets = todaysVoiceTickets.filter(ticket => 
        ticket.via?.source?.rel === 'outbound'
      );

      console.log(`📞 Outbound tickets: ${outboundTickets.length}`);

      if (outboundTickets.length > 0) {
        console.log(`\n📋 Outbound ticket details:`);
        outboundTickets.forEach(ticket => {
          console.log(`   Ticket ${ticket.id}: "${ticket.subject}"`);
          console.log(`   Via: ${JSON.stringify(ticket.via)}`);
          console.log(`   Created: ${ticket.created_at}`);
        });

        console.log(`\n💡 DISCREPANCY FOUND:`);
        console.log(`   Tickets show ${outboundTickets.length} outbound call(s)`);
        console.log(`   Calls API shows 0 outbound calls`);
        console.log(`   💡 Outbound calls might be tracked in tickets but not real-time calls API`);
      }

    } catch (error) {
      console.log(`❌ Ticket reconciliation error: ${error.message}`);
    }
  }
}

async function analyzeCompletedCalls() {
  console.log('🔍 COMPLETED CALLS ANALYZER');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  console.log(`🎯 Goal: Find missing metrics in completed calls and reconcile discrepancies\n`);
  
  const analyzer = new CompletedCallsAnalyzer();
  await analyzer.analyzeCompletedCalls();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Completed calls analysis finished');
  console.log('📊 Ready to update LiveFeed with accurate metric calculations');
}

analyzeCompletedCalls();