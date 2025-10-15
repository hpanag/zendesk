const ZendeskClient = require('./src/ZendeskClient');

async function analyzeCallSequence() {
  const client = new ZendeskClient();
  
  console.log('\n📞 ANALYZING CALL SEQUENCE FROM +1 (920) 763-5780');
  console.log('='.repeat(80));
  
  try {
    const tickets = await Promise.all([
      client.makeRequest('GET', '/tickets/292862.json'),
      client.makeRequest('GET', '/tickets/292878.json'),
      client.makeRequest('GET', '/tickets/292885.json')
    ]);
    
    const calls = tickets.map(r => r.ticket).sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    );
    
    console.log('\nCALLS IN CHRONOLOGICAL ORDER:\n');
    
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const isAbandoned = call.subject.includes('Abandoned');
      
      console.log(`${i + 1}. Ticket #${call.id} - ${isAbandoned ? '⚠️ ABANDONED' : '✅ COMPLETED'}`);
      console.log(`   Subject: ${call.subject}`);
      console.log(`   Created: ${new Date(call.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CDT`);
      console.log(`   Status: ${call.status}`);
      console.log(`   Description: ${call.description.substring(0, 120)}...`);
      
      if (i < calls.length - 1) {
        const gap = (new Date(calls[i+1].created_at) - new Date(call.created_at)) / 1000;
        console.log(`   ⏱️  Gap to next call: ${Math.round(gap)} seconds`);
      }
      console.log('');
    }
    
    // Get detailed audit for the abandoned call
    console.log('\n🔍 INVESTIGATING ABANDONED CALL (Ticket #292862):');
    console.log('─'.repeat(80));
    
    const abandonedAudit = await client.makeRequest('GET', '/tickets/292862/audits.json');
    const voiceEvent = abandonedAudit.audits
      .flatMap(a => a.events)
      .find(e => e.type === 'VoiceComment');
    
    if (voiceEvent && voiceEvent.data) {
      console.log('Voice Call Data:');
      console.log(`  Call Duration: ${voiceEvent.data.call_duration || 'N/A'} seconds`);
      console.log(`  Started: ${voiceEvent.data.started_at || 'N/A'}`);
      console.log(`  Answered By: ${voiceEvent.data.answered_by_name || 'No one (abandoned)'}`);
      console.log(`  Recording: ${voiceEvent.data.recorded ? 'Yes' : 'No'}`);
      
      if (voiceEvent.data.recording_url) {
        const match = voiceEvent.data.recording_url.match(/calls\/(CA[a-f0-9]+)\//);
        if (match) {
          console.log(`  Twilio SID: ${match[1]}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('💡 ROOT CAUSE DETERMINATION');
    console.log('='.repeat(80));
    
    console.log('\nBased on the call sequence, here is what happened:\n');
    console.log('1️⃣  FIRST CALL (Ticket #292862) - ABANDONED');
    console.log('   • Customer called and was put in queue/IVR');
    console.log('   • After ~30 seconds, call was abandoned/dropped');
    console.log('   • The BEEP you heard is likely the disconnect tone');
    console.log('   • Possible causes:');
    console.log('     - Customer hung up out of frustration');
    console.log('     - System timeout in IVR');
    console.log('     - Network dropped the call');
    console.log('     - Call routing failure');
    
    const timeBetweenCalls = (new Date(calls[1].created_at) - new Date(calls[0].created_at)) / 1000;
    
    console.log(`\\n2️⃣  SECOND CALL (Ticket #292878) - SUCCESSFUL`);
    console.log(`   • Customer called back after ${Math.round(timeBetweenCalls)} seconds`);
    console.log('   • This time agent David Shaver answered');
    console.log('   • Call lasted 15+ minutes');
    console.log('   • Customer issue was resolved');
    
    console.log('\\n📊 CONCLUSION:');
    console.log('   The recording you\'re listening to is likely from the FIRST call (#292862)');
    console.log('   which dropped at 30 seconds. The customer then called back immediately');
    console.log('   and that second call (#292878) was successful.');
    
    console.log('\\n🔧 TO FIX THIS ISSUE GOING FORWARD:');
    console.log('   1. Review IVR timeout settings (currently dropping at ~30s)');
    console.log('   2. Check call queue capacity and agent availability');
    console.log('   3. Implement callback option before timeout');
    console.log('   4. Monitor abandoned call rate for patterns');
    console.log('   5. Consider increasing timeout before disconnect');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeCallSequence();
