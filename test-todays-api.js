require('dotenv').config();
const ZendeskClient = require('./src/ZendeskClient');

async function testTodaysAPI() {
  try {
    const zendesk = new ZendeskClient();
    
    // Get today's start time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startTime = Math.floor(today.getTime() / 1000);
    
    console.log('📅 Today:', today.toISOString());
    console.log('⏰ Start time:', startTime);
    
    // Fetch calls from incremental API
    const response = await zendesk.makeRequest('GET', 
      `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`
    );
    
    const allCalls = response.calls || [];
    
    // Filter to only today's calls
    const todaysCalls = allCalls.filter(call => {
      const callTime = new Date(call.created_at);
      return callTime >= today;
    });
    
    console.log(`\n✅ Total calls today: ${todaysCalls.length}`);
    
    // Analyze completion statuses
    const statusCounts = {};
    const abandonedBreakdown = {
      ivr: 0,
      queue: 0,
      voicemail: 0
    };
    let answeredByAgent = 0;
    let voicemailsLeft = 0;
    
    todaysCalls.forEach(call => {
      const status = call.completion_status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      if (call.agent_id && call.talk_time > 0) {
        answeredByAgent++;
      }
      
      if (status === 'abandoned_in_ivr') {
        abandonedBreakdown.ivr++;
      } else if (status === 'abandoned_in_queue') {
        abandonedBreakdown.queue++;
      } else if (status === 'abandoned_in_voicemail') {
        abandonedBreakdown.voicemail++;
      }
      
      if (call.recording_url || call.voicemail) {
        voicemailsLeft++;
      }
    });
    
    console.log('\n📊 Completion Status Breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    console.log('\n📞 Call Type Breakdown:');
    console.log(`  Answered by Agent: ${answeredByAgent}`);
    console.log(`  Abandoned in IVR: ${abandonedBreakdown.ivr}`);
    console.log(`  Abandoned in Queue: ${abandonedBreakdown.queue}`);
    console.log(`  Abandoned in Voicemail: ${abandonedBreakdown.voicemail}`);
    console.log(`  Total Abandoned: ${abandonedBreakdown.ivr + abandonedBreakdown.queue + abandonedBreakdown.voicemail}`);
    console.log(`  Voicemails Left: ${voicemailsLeft}`);
    
    // Show first 3 calls for debugging
    console.log('\n🔍 First 3 calls (for debugging):');
    todaysCalls.slice(0, 3).forEach((call, i) => {
      console.log(`\nCall ${i + 1}:`);
      console.log(`  Status: ${call.completion_status}`);
      console.log(`  Agent ID: ${call.agent_id || 'none'}`);
      console.log(`  Talk Time: ${call.talk_time || 0}s`);
      console.log(`  Has Recording: ${!!call.recording_url}`);
      console.log(`  Has Voicemail: ${!!call.voicemail}`);
      console.log(`  Created: ${call.created_at}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testTodaysAPI();
