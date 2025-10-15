const ZendeskClient = require('./src/ZendeskClient');

class CompareAbandonedSources {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async compare() {
    console.log('🔍 COMPARING ABANDONED CALL SOURCES');
    console.log('='.repeat(70));
    console.log();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().split('T')[0];
    const startTime = Math.floor(today.getTime() / 1000);
    const endTime = Math.floor(new Date().getTime() / 1000);

    console.log(`📅 Analyzing today: ${today.toDateString()}\n`);

    try {
      // METHOD 1: Voice API Incremental Calls
      console.log('📊 METHOD 1: Voice API Incremental Calls');
      console.log('-'.repeat(70));
      
      const voiceResponse = await this.zendesk.makeRequest(
        'GET',
        `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`
      );

      const allCalls = voiceResponse.calls || [];
      const todayCalls = allCalls.filter(call => {
        const callTime = new Date(call.created_at);
        return callTime >= today && callTime <= new Date();
      });

      const voiceAbandoned = todayCalls.filter(call => 
        call.completion_status === 'abandoned' || 
        call.completion_status === 'abandoned_in_voicemail'
      );

      console.log(`Total calls from Voice API: ${todayCalls.length}`);
      console.log(`Abandoned calls (by completion_status): ${voiceAbandoned.length}`);
      console.log();

      // METHOD 2: Ticket Analysis (what the dashboard does)
      console.log('📊 METHOD 2: Ticket Analysis (Dashboard Method)');
      console.log('-'.repeat(70));

      const todayTickets = await this.zendesk.getTickets({
        per_page: 100,
        sort_by: 'created_at',
        sort_order: 'desc'
      });

      const allTickets = todayTickets.tickets || [];
      const tickets = allTickets.filter(ticket => {
        const createdDate = new Date(ticket.created_at);
        const isToday = createdDate >= today;
        const isVoice = ticket.via?.channel === 'voice';
        return isToday && isVoice;
      });

      let ticketAbandoned = 0;
      const abandonedTicketDetails = [];

      tickets.forEach(ticket => {
        const subject = (ticket.subject || '').toLowerCase();
        const description = (ticket.description || '').toLowerCase();
        const createdAt = new Date(ticket.created_at);
        const updatedAt = new Date(ticket.updated_at);
        const ticketDuration = updatedAt - createdAt;

        const isAbandoned = (
          // Explicit abandonment indicators in subject/description
          subject.includes('abandoned') ||
          subject.includes('missed') ||
          subject.includes('no answer') ||
          subject.includes('unanswered') ||
          description.includes('abandoned') ||
          description.includes('missed') ||
          description.includes('no answer') ||
          description.includes('caller hung up') ||
          description.includes('disconnected')
        ) || (
          // Very short tickets that were never assigned (likely abandoned)
          ticketDuration < 30000 && !ticket.assignee_id // Less than 30 seconds and unassigned
        ) || (
          // Quick closed/solved tickets (potential abandonment)
          (ticket.status === 'closed' || ticket.status === 'solved') && 
          ticketDuration < 60000 && !ticket.assignee_id // Less than 1 minute, unassigned
        );

        if (isAbandoned) {
          ticketAbandoned++;
          abandonedTicketDetails.push({
            id: ticket.id,
            subject: ticket.subject.substring(0, 50),
            status: ticket.status,
            assignee: ticket.assignee_id ? 'Yes' : 'No',
            duration: Math.round(ticketDuration / 1000) + 's',
            reason: subject.includes('abandoned') || description.includes('abandoned') ? 'Keyword' : 
                    ticketDuration < 30000 && !ticket.assignee_id ? 'Short+Unassigned' :
                    'Quick close'
          });
        }
      });

      console.log(`Total voice tickets: ${tickets.length}`);
      console.log(`Abandoned calls (by dashboard logic): ${ticketAbandoned}`);
      console.log();

      // METHOD 3: Agent Activity API
      console.log('📊 METHOD 3: Agent Activity API');
      console.log('-'.repeat(70));

      let agentAbandoned = 0;
      try {
        const agentResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/agents_activity.json');
        const agentActivityData = agentResponse.agents_activity || [];
        
        agentActivityData.forEach(agent => {
          agentAbandoned += agent.calls_missed || 0;
        });

        console.log(`Agent activity data: ${agentActivityData.length} agents`);
        console.log(`Abandoned calls (calls_missed): ${agentAbandoned}`);
      } catch (error) {
        console.log(`Agent Activity API not available: ${error.message}`);
      }
      console.log();

      // COMPARISON
      console.log('═'.repeat(70));
      console.log('📈 COMPARISON SUMMARY');
      console.log('═'.repeat(70));
      console.log();
      console.log('Source                          | Abandoned Calls');
      console.log('-'.repeat(70));
      console.log(`Voice API (completion_status)   | ${voiceAbandoned.length}`);
      console.log(`Ticket Analysis (dashboard)     | ${ticketAbandoned}`);
      console.log(`Agent Activity API              | ${agentAbandoned}`);
      console.log();

      console.log('🔍 DIFFERENCE ANALYSIS:');
      console.log('-'.repeat(70));
      
      const diff = ticketAbandoned - voiceAbandoned.length;
      if (diff > 0) {
        console.log(`✅ Dashboard shows ${diff} MORE abandoned calls than Voice API`);
        console.log();
        console.log('WHY? Dashboard ticket analysis catches:');
        console.log('  1. Tickets with "abandoned" keywords in subject/description');
        console.log('  2. Very short tickets (<30s) with no assignee');
        console.log('  3. Quick closed tickets (<60s) with no assignee');
        console.log();
        console.log('These may not have completion_status="abandoned" in Voice API');
      } else if (diff < 0) {
        console.log(`⚠️  Dashboard shows ${Math.abs(diff)} FEWER abandoned calls than Voice API`);
      } else {
        console.log(`✅ Both sources match!`);
      }

      // Show abandoned ticket details
      if (abandonedTicketDetails.length > 0) {
        console.log();
        console.log('📋 ABANDONED TICKETS FROM DASHBOARD ANALYSIS:');
        console.log('-'.repeat(70));
        console.log('Ticket ID  | Status  | Assignee | Duration | Detection Reason');
        console.log('-'.repeat(70));
        
        abandonedTicketDetails.forEach(ticket => {
          console.log(
            `#${ticket.id.toString().padEnd(8)} | ` +
            `${ticket.status.padEnd(7)} | ` +
            `${ticket.assignee.padEnd(8)} | ` +
            `${ticket.duration.padEnd(8)} | ` +
            `${ticket.reason}`
          );
        });
      }

      // Show Voice API abandoned calls
      if (voiceAbandoned.length > 0) {
        console.log();
        console.log('📋 ABANDONED CALLS FROM VOICE API:');
        console.log('-'.repeat(70));
        console.log('Call ID            | Duration | Completion Status');
        console.log('-'.repeat(70));
        
        voiceAbandoned.slice(0, 20).forEach(call => {
          console.log(
            `${call.id.toString().padEnd(18)} | ` +
            `${(call.duration + 's').padEnd(8)} | ` +
            `${call.completion_status}`
          );
        });
        
        if (voiceAbandoned.length > 20) {
          console.log(`... and ${voiceAbandoned.length - 20} more`);
        }
      }

      console.log();
      console.log('═'.repeat(70));
      console.log('💡 RECOMMENDATION');
      console.log('═'.repeat(70));
      console.log();
      console.log('The dashboard uses ticket analysis which includes multiple detection');
      console.log('methods. For the most accurate count, use Voice API completion_status.');
      console.log();
      console.log('To fix the dashboard, modify LiveFeedAnalyzer.js to:');
      console.log('  - Use Voice API completion_status as primary source');
      console.log('  - Only use ticket analysis as fallback when Voice API unavailable');
      console.log();

    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
    }
  }
}

async function main() {
  const comparer = new CompareAbandonedSources();
  await comparer.compare();
}

main();
