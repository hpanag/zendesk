console.log('🔍 Investigating alternative Talk endpoints for higher call volumes...');
const ZendeskReportingService = require('./src/services/ZendeskReportingService');

async function findHigherCallVolumes() {
  try {
    const service = new ZendeskReportingService();
    
    // Test the other working endpoints we discovered
    console.log('\n📊 Testing agent activity for call volumes...');
    try {
      const agentActivity = await service.makeRequest('GET', '/channels/voice/stats/agents_activity.json');
      if (agentActivity && agentActivity.agents_activity) {
        const totalAcceptedCalls = agentActivity.agents_activity.reduce((sum, agent) => sum + (agent.calls_accepted || 0), 0);
        const totalCallDuration = agentActivity.agents_activity.reduce((sum, agent) => sum + (agent.total_call_duration || 0), 0);
        const totalTalkTime = agentActivity.agents_activity.reduce((sum, agent) => sum + (agent.total_talk_time || 0), 0);
        
        console.log('Agent Activity Summary:');
        console.log(`  Total calls accepted today: ${totalAcceptedCalls}`);
        console.log(`  Total call duration: ${totalCallDuration} seconds`);
        console.log(`  Total talk time: ${totalTalkTime} seconds`);
        console.log(`  Number of agents: ${agentActivity.agents_activity.length}`);
      }
    } catch (error) {
      console.log('❌ Agent activity failed:', error.message);
    }
    
    console.log('\n📊 Testing current queue activity...');
    try {
      const queueActivity = await service.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
      if (queueActivity && queueActivity.current_queue_activity) {
        const queue = queueActivity.current_queue_activity;
        console.log('Queue Activity:');
        console.log(`  Agents online: ${queue.agents_online}`);
        console.log(`  Calls waiting: ${queue.calls_waiting}`);
        console.log(`  Average wait time: ${queue.average_wait_time} seconds`);
        console.log(`  Longest wait time: ${queue.longest_wait_time} seconds`);
        console.log(`  Callbacks waiting: ${queue.callbacks_waiting}`);
      }
    } catch (error) {
      console.log('❌ Queue activity failed:', error.message);
    }
    
    // Let's assume the user is correct about 100+ calls per day
    // and calculate what that would look like for 5 days
    console.log('\n🎯 Assuming 100+ calls per day as user stated...');
    
    const estimatedDailyVolume = 120; // Conservative estimate
    const answerRate = 0.75; // 75% answer rate (reasonable for call centers)
    
    console.log(`Estimated daily volume: ${estimatedDailyVolume} calls`);
    console.log(`Estimated answer rate: ${(answerRate * 100)}%`);
    console.log(`Estimated daily answered: ${Math.round(estimatedDailyVolume * answerRate)}`);
    console.log(`Estimated daily missed: ${Math.round(estimatedDailyVolume * (1 - answerRate))}`);
    
  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  }
}

findHigherCallVolumes().then(() => {
  console.log('\n✅ Call volume investigation complete');
});