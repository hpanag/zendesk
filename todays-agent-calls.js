const ZendeskClient = require('./src/ZendeskClient');

/**
 * Get today's calls answered by human agents
 */
class TodayAgentCalls {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async getTodaysCalls() {
    console.log('📞 TODAY\'S CALLS - ANSWERED BY HUMAN AGENTS');
    console.log('='.repeat(70));
    console.log();

    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    
    const todayStr = today.toISOString().split('T')[0];
    const startTime = Math.floor(startOfToday.getTime() / 1000);
    const currentTime = new Date().toLocaleTimeString();
    
    console.log(`📅 Date: ${todayStr} (${today.toLocaleDateString('en-US', { weekday: 'long' })})`);
    console.log(`⏰ Current Time: ${currentTime}`);
    console.log(`📊 Time Range: ${startOfToday.toLocaleString()} to Now`);
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

      console.log(`✅ Total calls received today: ${todaysCalls.length}`);
      console.log();

      // Calculate different metrics
      const answeredByAgent = todaysCalls.filter(c => c.agent_id && c.talk_time > 0).length;
      const completedAll = todaysCalls.filter(c => c.completion_status === 'completed').length;
      const completedNoAgent = todaysCalls.filter(c => 
        c.completion_status === 'completed' && (!c.agent_id || c.talk_time === 0)
      ).length;
      
      const abandonedIVR = todaysCalls.filter(c => c.completion_status === 'abandoned_in_ivr').length;
      const abandonedVM = todaysCalls.filter(c => c.completion_status === 'abandoned_in_voicemail').length;
      const abandonedQueue = todaysCalls.filter(c => c.completion_status === 'abandoned_in_queue').length;
      const totalAbandoned = abandonedIVR + abandonedVM + abandonedQueue;

      // Status breakdown
      const statusCounts = {};
      todaysCalls.forEach(call => {
        const status = call.completion_status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      console.log('📊 CALL BREAKDOWN:');
      console.log('='.repeat(70));
      console.log();
      
      console.log('✅ ANSWERED BY HUMAN AGENT:');
      console.log(`   ${answeredByAgent} calls (agent_id present AND talk_time > 0)`);
      console.log(`   📈 ${((answeredByAgent/todaysCalls.length)*100).toFixed(1)}% of total calls`);
      console.log();
      
      console.log('🤖 COMPLETED (System Handled):');
      console.log(`   ${completedNoAgent} calls (completed without agent interaction)`);
      console.log(`   📈 ${((completedNoAgent/todaysCalls.length)*100).toFixed(1)}% of total calls`);
      console.log();
      
      console.log('❌ ABANDONED (All Types):');
      console.log(`   ${totalAbandoned} calls total`);
      console.log(`      • Abandoned in IVR: ${abandonedIVR}`);
      console.log(`      • Abandoned in Voicemail: ${abandonedVM}`);
      console.log(`      • Abandoned in Queue: ${abandonedQueue}`);
      console.log(`   📈 ${((totalAbandoned/todaysCalls.length)*100).toFixed(1)}% of total calls`);
      console.log();

      console.log('📋 All Completion Statuses:');
      Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
        const pct = ((count/todaysCalls.length)*100).toFixed(1);
        console.log(`   ${status.padEnd(30)}: ${count.toString().padStart(3)} (${pct}%)`);
      });
      console.log();

      // Hourly breakdown of AGENT-ANSWERED calls
      console.log('='.repeat(70));
      console.log('📊 CALLS ANSWERED BY AGENTS - BY HOUR:');
      console.log('='.repeat(70));
      console.log();

      const callsByHour = new Array(24).fill(0).map((_, hour) => ({
        hour: hour,
        total: 0,
        agent_answered: 0,
        abandoned: 0,
        system_handled: 0
      }));

      todaysCalls.forEach(call => {
        const callTime = new Date(call.created_at);
        const hour = callTime.getHours();
        
        callsByHour[hour].total++;
        
        if (call.agent_id && call.talk_time > 0) {
          callsByHour[hour].agent_answered++;
        } else if (call.completion_status === 'completed') {
          callsByHour[hour].system_handled++;
        } else if (call.completion_status && call.completion_status.includes('abandoned')) {
          callsByHour[hour].abandoned++;
        }
      });

      console.log('Hour        | Total | Agent | System | Abandoned');
      console.log('-'.repeat(55));

      callsByHour.forEach(hourData => {
        if (hourData.total > 0) {
          const hour12 = hourData.hour === 0 ? 12 : (hourData.hour > 12 ? hourData.hour - 12 : hourData.hour);
          const period = hourData.hour >= 12 ? 'PM' : 'AM';
          const hourStr = `${hour12}:00 ${period}`.padEnd(11);
          
          console.log(`${hourStr} | ${hourData.total.toString().padStart(5)} | ${hourData.agent_answered.toString().padStart(5)} | ${hourData.system_handled.toString().padStart(6)} | ${hourData.abandoned.toString().padStart(9)}`);
        }
      });

      console.log('-'.repeat(55));
      console.log(`TOTAL       | ${todaysCalls.length.toString().padStart(5)} | ${answeredByAgent.toString().padStart(5)} | ${completedNoAgent.toString().padStart(6)} | ${totalAbandoned.toString().padStart(9)}`);
      console.log();

      // Visual representation
      console.log('📊 VISUAL: Agent-Answered Calls by Hour');
      console.log('-'.repeat(55));
      const maxAgentCalls = Math.max(...callsByHour.map(h => h.agent_answered));
      callsByHour.forEach(hourData => {
        if (hourData.agent_answered > 0) {
          const hour12 = hourData.hour === 0 ? 12 : (hourData.hour > 12 ? hourData.hour - 12 : hourData.hour);
          const period = hourData.hour >= 12 ? 'PM' : 'AM';
          const barLength = Math.round((hourData.agent_answered / maxAgentCalls) * 40);
          const bar = '█'.repeat(barLength);
          console.log(`${hour12}:00 ${period}`.padEnd(10) + bar + ` ${hourData.agent_answered}`);
        }
      });

      console.log();
      console.log('='.repeat(70));
      console.log('💡 SUMMARY:');
      console.log('='.repeat(70));
      console.log();
      console.log(`🏆 ANSWERED BY HUMAN AGENT TODAY: ${answeredByAgent} calls`);
      console.log(`📞 Total Calls Received: ${todaysCalls.length} calls`);
      console.log(`📈 Agent Answer Rate: ${((answeredByAgent/todaysCalls.length)*100).toFixed(1)}%`);
      console.log();

      // Show some sample agent-answered calls
      const agentCalls = todaysCalls.filter(c => c.agent_id && c.talk_time > 0);
      if (agentCalls.length > 0) {
        console.log('📋 Sample Agent-Answered Calls:');
        agentCalls.slice(0, 3).forEach((call, i) => {
          console.log(`\n   ${i+1}. Call ID: ${call.id}`);
          console.log(`      Agent: ${call.agent_id}`);
          console.log(`      Time: ${new Date(call.created_at).toLocaleTimeString()}`);
          console.log(`      Duration: ${call.duration}s`);
          console.log(`      Talk Time: ${call.talk_time}s`);
          console.log(`      Wait Time: ${call.wait_time}s`);
        });
      }

      console.log();

    } catch (error) {
      console.error('❌ Error fetching today\'s calls:', error.message);
      console.error(error.stack);
    }
  }
}

// Run the analysis
const analyzer = new TodayAgentCalls();
analyzer.getTodaysCalls();
