const ZendeskClient = require('./src/ZendeskClient');

class VoiceCallsAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async analyzeVoiceCalls() {
    console.log('🔍 ANALYZING VOICE CALLS API FOR ACCURATE METRICS');
    console.log('='.repeat(60));
    
    try {
      // Get today's calls from Voice API
      console.log('📞 Fetching calls from Voice API...');
      const callsResponse = await this.zendesk.makeRequest('GET', '/channels/voice/calls.json?per_page=100');
      
      console.log(`✅ Found ${callsResponse.calls?.length || 0} calls in Voice API`);
      console.log(`📊 Total count: ${callsResponse.count}`);
      
      if (callsResponse.calls && callsResponse.calls.length > 0) {
        
        // Filter for today's calls
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaysCalls = callsResponse.calls.filter(call => {
          const callDate = new Date(call.created_at || call.start_time || call.started_at);
          return callDate >= today;
        });
        
        console.log(`🎯 Today's calls: ${todaysCalls.length}`);
        
        if (todaysCalls.length > 0) {
          console.log('\n📋 Sample call structure:');
          const sampleCall = todaysCalls[0];
          console.log(JSON.stringify(sampleCall, null, 2));
          
          // Analyze call metrics
          await this.analyzeCallMetrics(todaysCalls);
        } else {
          console.log('⚠️  No calls found for today in Voice API');
          
          // Show recent calls for comparison
          console.log('\n📋 Recent call sample (any date):');
          const recentCall = callsResponse.calls[0];
          console.log(JSON.stringify(recentCall, null, 2));
        }
      }
      
      // Also check agents activity API
      console.log('\n📊 Checking agents activity API...');
      const agentsResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/agents_activity.json');
      
      if (agentsResponse.agents_activity) {
        console.log(`✅ Found ${agentsResponse.agents_activity.length} agent activity records`);
        console.log('📋 Sample agent activity:');
        console.log(JSON.stringify(agentsResponse.agents_activity[0], null, 2));
      }
      
    } catch (error) {
      console.error('❌ Error analyzing voice calls:', error.message);
    }
  }

  async analyzeCallMetrics(calls) {
    console.log('\n🔍 ANALYZING CALL METRICS FROM VOICE API');
    console.log('='.repeat(50));
    
    let totalCalls = calls.length;
    let inboundCalls = 0;
    let outboundCalls = 0;
    let callbackCalls = 0;
    let abandonedCalls = 0;
    
    let durations = [];
    let waitTimes = [];
    let answerTimes = [];
    let holdTimes = [];
    
    calls.forEach(call => {
      console.log(`\nCall ${call.id}:`);
      console.log(`  Direction: ${call.direction || 'unknown'}`);
      console.log(`  State: ${call.state || 'unknown'}`);
      console.log(`  Duration: ${call.duration || 'unknown'}`);
      console.log(`  Wait time: ${call.wait_time || 'unknown'}`);
      console.log(`  Talk time: ${call.talk_time || 'unknown'}`);
      
      // Count by direction
      if (call.direction === 'inbound') inboundCalls++;
      else if (call.direction === 'outbound') outboundCalls++;
      
      // Check for callbacks (might be in call metadata)
      if (call.callback || call.is_callback || (call.tags && call.tags.includes('callback'))) {
        callbackCalls++;
      }
      
      // Check for abandoned calls
      if (call.state === 'abandoned' || call.state === 'missed' || call.state === 'no_answer') {
        abandonedCalls++;
      }
      
      // Collect timing metrics
      if (call.duration && !isNaN(call.duration)) durations.push(call.duration);
      if (call.wait_time && !isNaN(call.wait_time)) waitTimes.push(call.wait_time);
      if (call.talk_time && !isNaN(call.talk_time)) durations.push(call.talk_time);
      if (call.answer_time && !isNaN(call.answer_time)) answerTimes.push(call.answer_time);
      if (call.hold_time && !isNaN(call.hold_time)) holdTimes.push(call.hold_time);
    });
    
    console.log('\n📊 VOICE API METRICS SUMMARY:');
    console.log(`📞 Total calls: ${totalCalls}`);
    console.log(`📞 Inbound: ${inboundCalls}`);
    console.log(`📞 Outbound: ${outboundCalls}`);
    console.log(`📞 Callbacks: ${callbackCalls}`);
    console.log(`❌ Abandoned: ${abandonedCalls}`);
    
    if (durations.length > 0) {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`⏱️  Average duration: ${Math.round(avgDuration / 60 * 100) / 100} minutes`);
    }
    
    if (waitTimes.length > 0) {
      const avgWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
      console.log(`⏱️  Average wait time: ${Math.round(avgWaitTime / 60 * 100) / 100} minutes`);
      const exceededWait = waitTimes.filter(w => w > 300).length; // 5+ minutes
      console.log(`⏰ Exceeded wait time (5+ min): ${exceededWait}`);
    }
    
    if (answerTimes.length > 0) {
      const avgAnswerTime = answerTimes.reduce((a, b) => a + b, 0) / answerTimes.length;
      console.log(`⏱️  Average answer time: ${Math.round(avgAnswerTime)} seconds`);
    }
    
    if (holdTimes.length > 0) {
      const avgHoldTime = holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length;
      console.log(`⏱️  Average hold time: ${Math.round(avgHoldTime / 60 * 100) / 100} minutes`);
    }
  }
}

async function analyzeVoiceCalls() {
  console.log('🔍 VOICE CALLS API ANALYZER');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  console.log(`🎯 Goal: Get accurate call metrics from Voice API\n`);
  
  const analyzer = new VoiceCallsAnalyzer();
  await analyzer.analyzeVoiceCalls();
  
  console.log('\n✅ Voice calls analysis complete');
}

analyzeVoiceCalls();