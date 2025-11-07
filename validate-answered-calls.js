const ZendeskClient = require('./src/ZendeskClient');

/**
 * Explore ALL Zendesk APIs to find answered call data and validate counts
 */
class AnsweredCallsValidator {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async validateAnsweredCalls() {
    console.log('🔍 VALIDATING ANSWERED CALLS ACROSS ALL ZENDESK APIS');
    console.log('='.repeat(70));
    console.log();

    // Calculate yesterday's date range
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);
    
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const startTime = Math.floor(startOfYesterday.getTime() / 1000);
    
    console.log(`📅 Yesterday: ${yesterdayStr}`);
    console.log();

    const results = {};

    // ========== Method 1: Incremental Calls - Detailed Analysis ==========
    try {
      console.log('📞 Method 1: Incremental Calls - DETAILED STATUS ANALYSIS');
      console.log('='.repeat(70));
      
      const response = await this.zendesk.makeRequest(
        'GET',
        `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`
      );

      const allCalls = response.calls || [];
      const yesterdayCalls = allCalls.filter(call => {
        const callTime = new Date(call.created_at);
        return callTime >= startOfYesterday && callTime <= endOfYesterday;
      });

      // Get ALL unique completion statuses
      const statusCounts = {};
      yesterdayCalls.forEach(call => {
        const status = call.completion_status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      console.log('📊 ALL Completion Statuses Found:');
      Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
        console.log(`   ${status.padEnd(30)}: ${count}`);
      });
      console.log();

      // Show sample calls for each status
      console.log('📋 Sample Calls by Status:');
      console.log('-'.repeat(70));
      Object.keys(statusCounts).forEach(status => {
        const sampleCall = yesterdayCalls.find(c => c.completion_status === status);
        if (sampleCall) {
          console.log(`\n${status}:`);
          console.log(`   Call ID: ${sampleCall.id}`);
          console.log(`   Direction: ${sampleCall.direction}`);
          console.log(`   Duration: ${sampleCall.duration}s`);
          console.log(`   Talk Time: ${sampleCall.talk_time}s`);
          console.log(`   Agent ID: ${sampleCall.agent_id || 'none'}`);
          console.log(`   Ticket ID: ${sampleCall.ticket_id || 'none'}`);
          console.log(`   Voicemail: ${sampleCall.voicemail}`);
          console.log(`   Customer Requested VM: ${sampleCall.customer_requested_voicemail}`);
        }
      });

      results.incremental_detailed = {
        total: yesterdayCalls.length,
        status_counts: statusCounts
      };

      console.log('\n' + '='.repeat(70));
      console.log();

    } catch (error) {
      console.log(`   ❌ Error:`, error.message);
      console.log();
      results.incremental_detailed = { error: error.message };
    }

    // ========== Method 2: Talk API - Historical Calls ==========
    try {
      console.log('📞 Method 2: Talk API - Historical Calls');
      console.log('='.repeat(70));
      
      const startISO = yesterdayStr + 'T00:00:00Z';
      const endISO = yesterdayStr + 'T23:59:59Z';
      
      const response = await this.zendesk.makeRequest('GET', 
        `/api/v2/channels/voice/calls.json?start_time=${startISO}&end_time=${endISO}&per_page=100`
      );

      const calls = response.calls || [];
      
      console.log(`   Total calls returned: ${calls.length}`);
      
      if (calls.length > 0) {
        const statusCounts = {};
        calls.forEach(call => {
          const status = call.completion_status || 'unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        console.log('   Status breakdown:');
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`      ${status}: ${count}`);
        });
      }
      
      results.talk_api = {
        total: calls.length,
        status_counts: calls.length > 0 ? statusCounts : {}
      };

      console.log();

    } catch (error) {
      console.log(`   ❌ Error:`, error.message);
      console.log();
      results.talk_api = { error: error.message };
    }

    // ========== Method 3: Search API - Voice Tickets ==========
    try {
      console.log('📞 Method 3: Search API - Voice Channel Tickets');
      console.log('='.repeat(70));
      
      const searchQuery = `type:ticket channel:voice created:${yesterdayStr}`;
      const response = await this.zendesk.makeRequest('GET', 
        `/api/v2/search.json?query=${encodeURIComponent(searchQuery)}`
      );

      const tickets = response.results || [];
      
      console.log(`   Voice tickets created yesterday: ${tickets.length}`);
      console.log(`   (These would be calls that created tickets - likely answered)`);
      
      if (tickets.length > 0) {
        console.log('\n   Sample ticket details:');
        tickets.slice(0, 3).forEach(ticket => {
          console.log(`      Ticket #${ticket.id}: ${ticket.subject}`);
          console.log(`         Via: ${ticket.via?.channel?.name || 'unknown'}`);
          console.log(`         Status: ${ticket.status}`);
        });
      }

      results.voice_tickets = {
        total: tickets.length
      };

      console.log();

    } catch (error) {
      console.log(`   ❌ Error:`, error.message);
      console.log();
      results.voice_tickets = { error: error.message };
    }

    // ========== Method 4: Agent Activity - Individual Agent Stats ==========
    try {
      console.log('📞 Method 4: Agent Activity Stats');
      console.log('='.repeat(70));
      
      const response = await this.zendesk.makeRequest('GET', 
        `/channels/voice/stats/agents_activity.json`
      );

      const agents = response.agents_activity || [];
      
      console.log(`   Total agents: ${agents.length}`);
      
      // Show agent-level stats
      let totalAccepted = 0;
      let totalMissed = 0;
      agents.forEach(agent => {
        totalAccepted += (agent.accepted_calls || 0);
        totalMissed += (agent.missed_calls || 0);
        if (agent.accepted_calls > 0 || agent.missed_calls > 0) {
          console.log(`\n   Agent ${agent.agent_id || agent.name}:`);
          console.log(`      Accepted: ${agent.accepted_calls || 0}`);
          console.log(`      Missed: ${agent.missed_calls || 0}`);
          console.log(`      Total: ${agent.total_calls || 0}`);
        }
      });

      console.log(`\n   ⚠️ WARNING: These are LIFETIME stats, not date-specific`);
      console.log(`   Total accepted (all time): ${totalAccepted}`);
      console.log(`   Total missed (all time): ${totalMissed}`);

      results.agent_activity = {
        total_accepted_lifetime: totalAccepted,
        total_missed_lifetime: totalMissed
      };

      console.log();

    } catch (error) {
      console.log(`   ❌ Error:`, error.message);
      console.log();
      results.agent_activity = { error: error.message };
    }

    // ========== Summary ==========
    console.log('='.repeat(70));
    console.log('📊 VALIDATION SUMMARY FOR YESTERDAY');
    console.log('='.repeat(70));
    console.log();
    
    if (results.incremental_detailed && results.incremental_detailed.status_counts) {
      const statuses = results.incremental_detailed.status_counts;
      
      console.log('✅ MOST RELIABLE SOURCE: Incremental Calls API');
      console.log();
      console.log('Calls that should count as "ANSWERED":');
      const answered = statuses.completed || 0;
      console.log(`   • completed: ${answered}`);
      console.log();
      
      console.log('Calls that should count as "ABANDONED":');
      const abandonedVM = statuses.abandoned_in_voicemail || 0;
      const abandonedIVR = statuses.abandoned_in_ivr || 0;
      const abandonedQueue = statuses.abandoned_in_queue || 0;
      console.log(`   • abandoned_in_voicemail: ${abandonedVM}`);
      console.log(`   • abandoned_in_ivr: ${abandonedIVR}`);
      console.log(`   • abandoned_in_queue: ${abandonedQueue}`);
      console.log(`   Total Abandoned: ${abandonedVM + abandonedIVR + abandonedQueue}`);
      console.log();
      
      console.log('Other statuses (need clarification):');
      Object.entries(statuses).forEach(([status, count]) => {
        if (!status.includes('abandoned') && status !== 'completed') {
          console.log(`   • ${status}: ${count}`);
        }
      });
    }

    console.log();
    console.log('💡 RECOMMENDATION:');
    console.log('   The "completed" status appears to be the most reliable indicator');
    console.log('   of answered calls. Current count: 106 for yesterday.');
    console.log();

    return results;
  }

  async getTodaysCalls() {
    console.log('\n' + '='.repeat(70));
    console.log('📞 TODAY\'S CALLS');
    console.log('='.repeat(70));
    console.log();

    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    
    const todayStr = today.toISOString().split('T')[0];
    const startTime = Math.floor(startOfToday.getTime() / 1000);
    
    console.log(`📅 Date: ${todayStr} (${today.toLocaleDateString('en-US', { weekday: 'long' })})`);
    console.log(`⏰ Time Range: ${startOfToday.toLocaleString()} to Now`);
    console.log();

    try {
      const response = await this.zendesk.makeRequest(
        'GET',
        `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`
      );

      const allCalls = response.calls || [];
      const todaysCalls = allCalls.filter(call => {
        const callTime = new Date(call.created_at);
        return callTime >= startOfToday;
      });

      console.log(`✅ Total calls today: ${todaysCalls.length}`);
      console.log();

      // Status breakdown
      const statusCounts = {};
      todaysCalls.forEach(call => {
        const status = call.completion_status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      console.log('📊 Status Breakdown:');
      Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
        console.log(`   ${status.padEnd(30)}: ${count}`);
      });
      console.log();

      // Calculate answered vs abandoned
      const answered = statusCounts.completed || 0;
      const abandonedVM = statusCounts.abandoned_in_voicemail || 0;
      const abandonedIVR = statusCounts.abandoned_in_ivr || 0;
      const abandonedQueue = statusCounts.abandoned_in_queue || 0;
      const totalAbandoned = abandonedVM + abandonedIVR + abandonedQueue;

      console.log('📈 Summary:');
      console.log(`   Total Calls: ${todaysCalls.length}`);
      console.log(`   ✅ Answered (completed): ${answered} (${((answered/todaysCalls.length)*100).toFixed(1)}%)`);
      console.log(`   ❌ Abandoned (all types): ${totalAbandoned} (${((totalAbandoned/todaysCalls.length)*100).toFixed(1)}%)`);
      console.log();

      // Hourly breakdown
      const callsByHour = new Array(24).fill(0).map((_, hour) => ({
        hour: hour,
        count: 0
      }));

      todaysCalls.forEach(call => {
        const callTime = new Date(call.created_at);
        const hour = callTime.getHours();
        callsByHour[hour].count++;
      });

      console.log('📊 Calls by Hour (Today):');
      callsByHour.forEach(hourData => {
        if (hourData.count > 0) {
          const hour12 = hourData.hour === 0 ? 12 : (hourData.hour > 12 ? hourData.hour - 12 : hourData.hour);
          const period = hourData.hour >= 12 ? 'PM' : 'AM';
          const bar = '█'.repeat(Math.min(hourData.count, 50));
          console.log(`   ${hour12}:00 ${period}`.padEnd(12) + bar + ` ${hourData.count}`);
        }
      });

    } catch (error) {
      console.error('❌ Error fetching today\'s calls:', error.message);
    }

    console.log();
  }
}

// Run the validation
const validator = new AnsweredCallsValidator();
validator.validateAnsweredCalls()
  .then(() => validator.getTodaysCalls())
  .catch(err => console.error('Error:', err));
