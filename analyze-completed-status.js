const ZendeskClient = require('./src/ZendeskClient');

/**
 * Deep dive into what "completed" status means
 */
class CompletedStatusAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async analyzeCompletedStatus() {
    console.log('🔍 ANALYZING "COMPLETED" STATUS - WHAT DOES IT MEAN?');
    console.log('='.repeat(70));
    console.log();

    // Get yesterday's calls
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);
    
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const startTime = Math.floor(startOfYesterday.getTime() / 1000);
    
    console.log(`📅 Analyzing: ${yesterdayStr}`);
    console.log();

    try {
      const response = await this.zendesk.makeRequest(
        'GET',
        `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`
      );

      const allCalls = response.calls || [];
      const yesterdayCalls = allCalls.filter(call => {
        const callTime = new Date(call.created_at);
        return callTime >= startOfYesterday && callTime <= endOfYesterday;
      });

      // Get all "completed" calls
      const completedCalls = yesterdayCalls.filter(call => 
        call.completion_status === 'completed'
      );

      console.log(`✅ Total "completed" calls: ${completedCalls.length}`);
      console.log();

      // Analyze patterns in completed calls
      console.log('📊 ANALYZING COMPLETED CALLS:');
      console.log('='.repeat(70));
      console.log();

      // 1. Check if they have agents
      const withAgent = completedCalls.filter(c => c.agent_id).length;
      const withoutAgent = completedCalls.filter(c => !c.agent_id).length;
      
      console.log('1️⃣  Agent Assignment:');
      console.log(`   With agent_id: ${withAgent}`);
      console.log(`   Without agent_id: ${withoutAgent}`);
      console.log();

      // 2. Check talk time
      const withTalkTime = completedCalls.filter(c => c.talk_time > 0).length;
      const noTalkTime = completedCalls.filter(c => c.talk_time === 0).length;
      
      console.log('2️⃣  Talk Time:');
      console.log(`   With talk_time > 0: ${withTalkTime}`);
      console.log(`   With talk_time = 0: ${noTalkTime}`);
      console.log();

      // 3. Check both agent AND talk time
      const agentAndTalk = completedCalls.filter(c => c.agent_id && c.talk_time > 0).length;
      
      console.log('3️⃣  Agent AND Talk Time > 0:');
      console.log(`   Both present: ${agentAndTalk}`);
      console.log(`   ⭐ This is probably the TRUE "answered by agent" count`);
      console.log();

      // 4. Direction
      const inbound = completedCalls.filter(c => c.direction === 'inbound').length;
      const outbound = completedCalls.filter(c => c.direction === 'outbound').length;
      
      console.log('4️⃣  Call Direction:');
      console.log(`   Inbound: ${inbound}`);
      console.log(`   Outbound: ${outbound}`);
      console.log();

      // 5. Voicemail flag
      const hasVoicemail = completedCalls.filter(c => c.voicemail).length;
      const noVoicemail = completedCalls.filter(c => !c.voicemail).length;
      
      console.log('5️⃣  Voicemail Flag:');
      console.log(`   voicemail = true: ${hasVoicemail}`);
      console.log(`   voicemail = false: ${noVoicemail}`);
      console.log();

      // 6. Check tickets created
      const withTicket = completedCalls.filter(c => c.ticket_id).length;
      const noTicket = completedCalls.filter(c => !c.ticket_id).length;
      
      console.log('6️⃣  Ticket Creation:');
      console.log(`   With ticket_id: ${withTicket}`);
      console.log(`   Without ticket_id: ${noTicket}`);
      console.log();

      // Show detailed examples
      console.log('='.repeat(70));
      console.log('📋 SAMPLE "COMPLETED" CALLS:');
      console.log('='.repeat(70));
      console.log();

      // Sample 1: Completed WITH agent and talk time
      const sampleWithAgent = completedCalls.find(c => c.agent_id && c.talk_time > 0);
      if (sampleWithAgent) {
        console.log('✅ Sample 1: Completed WITH Agent & Talk Time (TRUE ANSWERED):');
        this.printCallDetails(sampleWithAgent);
      }

      // Sample 2: Completed WITHOUT agent
      const sampleNoAgent = completedCalls.find(c => !c.agent_id);
      if (sampleNoAgent) {
        console.log('❓ Sample 2: Completed WITHOUT Agent:');
        this.printCallDetails(sampleNoAgent);
      }

      // Sample 3: Completed with agent but NO talk time
      const sampleAgentNoTalk = completedCalls.find(c => c.agent_id && c.talk_time === 0);
      if (sampleAgentNoTalk) {
        console.log('⚠️  Sample 3: Completed WITH Agent but NO Talk Time:');
        this.printCallDetails(sampleAgentNoTalk);
      }

      // Sample 4: Completed with talk time but NO agent
      const sampleTalkNoAgent = completedCalls.find(c => !c.agent_id && c.talk_time > 0);
      if (sampleTalkNoAgent) {
        console.log('⚠️  Sample 4: Completed with Talk Time but NO Agent:');
        this.printCallDetails(sampleTalkNoAgent);
      }

      // Final analysis
      console.log('='.repeat(70));
      console.log('💡 CONCLUSION:');
      console.log('='.repeat(70));
      console.log();
      console.log('"COMPLETED" status appears to mean:');
      console.log('   • The call went through the entire call flow');
      console.log('   • It may or may not have been answered by an agent');
      console.log('   • It includes calls that reached voicemail, IVR, etc.');
      console.log();
      console.log('TRUE "Answered by Agent" calls should be:');
      console.log(`   ✅ agent_id is present AND talk_time > 0`);
      console.log(`   📊 Count: ${agentAndTalk} calls (not ${completedCalls.length})`);
      console.log();
      console.log('RECOMMENDED METRICS:');
      console.log(`   • Answered by Agent: ${agentAndTalk}`);
      console.log(`   • Completed (all): ${completedCalls.length}`);
      console.log(`   • Difference: ${completedCalls.length - agentAndTalk} (likely voicemail/IVR/automated)`);
      console.log();

      // Compare all statuses
      console.log('='.repeat(70));
      console.log('📊 ALL CALL STATUSES - FULL BREAKDOWN:');
      console.log('='.repeat(70));
      console.log();

      const allStatuses = {};
      yesterdayCalls.forEach(call => {
        const status = call.completion_status || 'unknown';
        const hasAgent = call.agent_id ? 'with_agent' : 'no_agent';
        const hasTalk = call.talk_time > 0 ? 'with_talk' : 'no_talk';
        
        const key = `${status}`;
        if (!allStatuses[key]) {
          allStatuses[key] = {
            count: 0,
            with_agent: 0,
            no_agent: 0,
            with_talk: 0,
            no_talk: 0,
            agent_and_talk: 0
          };
        }
        
        allStatuses[key].count++;
        if (call.agent_id) allStatuses[key].with_agent++;
        else allStatuses[key].no_agent++;
        if (call.talk_time > 0) allStatuses[key].with_talk++;
        else allStatuses[key].no_talk++;
        if (call.agent_id && call.talk_time > 0) allStatuses[key].agent_and_talk++;
      });

      Object.entries(allStatuses).sort((a, b) => b[1].count - a[1].count).forEach(([status, data]) => {
        console.log(`${status}:`);
        console.log(`   Total: ${data.count}`);
        console.log(`   With Agent: ${data.with_agent}, Without Agent: ${data.no_agent}`);
        console.log(`   With Talk Time: ${data.with_talk}, No Talk Time: ${data.no_talk}`);
        console.log(`   Agent AND Talk: ${data.agent_and_talk}`);
        console.log();
      });

    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
    }
  }

  printCallDetails(call) {
    console.log(`   Call ID: ${call.id}`);
    console.log(`   Direction: ${call.direction}`);
    console.log(`   Completion Status: ${call.completion_status}`);
    console.log(`   Agent ID: ${call.agent_id || 'NONE'}`);
    console.log(`   Duration: ${call.duration}s`);
    console.log(`   Talk Time: ${call.talk_time}s`);
    console.log(`   Wait Time: ${call.wait_time}s`);
    console.log(`   Hold Time: ${call.hold_time}s`);
    console.log(`   IVR Time: ${call.ivr_time_spent}s`);
    console.log(`   Time to Answer: ${call.time_to_answer}s`);
    console.log(`   Voicemail: ${call.voicemail}`);
    console.log(`   Customer Requested VM: ${call.customer_requested_voicemail}`);
    console.log(`   Ticket ID: ${call.ticket_id || 'none'}`);
    console.log(`   Outside Business Hours: ${call.outside_business_hours}`);
    console.log(`   Created: ${new Date(call.created_at).toLocaleString()}`);
    console.log();
  }
}

// Run the analysis
const analyzer = new CompletedStatusAnalyzer();
analyzer.analyzeCompletedStatus();
