const ZendeskClient = require('./src/ZendeskClient');

class CallDisconnectAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async analyzeDisconnect(ticketId) {
    console.log(`\n🔍 Analyzing Call Disconnect for Ticket #${ticketId}`);
    console.log('='.repeat(80));

    try {
      // Get ticket and audit data
      const ticketResponse = await this.zendesk.makeRequest('GET', `/tickets/${ticketId}.json`);
      const ticket = ticketResponse.ticket;
      
      const auditsResponse = await this.zendesk.makeRequest('GET', `/tickets/${ticketId}/audits.json`);
      const audits = auditsResponse.audits;

      // Find voice event
      let voiceCallData = null;
      let twilioCallSid = null;
      
      for (const audit of audits) {
        const voiceEvent = audit.events.find(e => e.type === 'VoiceComment');
        if (voiceEvent && voiceEvent.data) {
          voiceCallData = voiceEvent.data;
          const recordingUrl = voiceCallData.recording_url || '';
          const match = recordingUrl.match(/calls\/(CA[a-f0-9]+)\//);
          if (match) {
            twilioCallSid = match[1];
          }
          break;
        }
      }

      if (!voiceCallData) {
        console.log('❌ No voice call data found');
        return;
      }

      // Analyze timeline
      console.log('\n⏱️  TIMELINE ANALYSIS:');
      console.log('─'.repeat(80));
      
      const callStart = new Date(voiceCallData.started_at);
      const ticketCreated = new Date(ticket.created_at);
      
      console.log(`Call Started:     ${callStart.toLocaleString('en-US', { timeZone: 'America/Chicago' })} (CDT)`);
      console.log(`                  ${callStart.toISOString()} (UTC)`);
      console.log(`Ticket Created:   ${ticketCreated.toLocaleString('en-US', { timeZone: 'America/Chicago' })} (CDT)`);
      console.log(`                  ${ticketCreated.toISOString()} (UTC)`);
      console.log(`Gap:              ${Math.round((ticketCreated - callStart) / 1000)} seconds`);
      
      // Find when voice comment was added (indicates when call ended)
      const voiceCommentAudit = audits.find(a => a.events.find(e => e.type === 'VoiceComment'));
      if (voiceCommentAudit) {
        const callEnd = new Date(voiceCommentAudit.created_at);
        const actualDuration = Math.round((callEnd - callStart) / 1000);
        
        console.log(`\nCall Ended:       ${callEnd.toLocaleString('en-US', { timeZone: 'America/Chicago' })} (CDT)`);
        console.log(`                  ${callEnd.toISOString()} (UTC)`);
        console.log(`\nReported Duration: ${voiceCallData.call_duration} seconds (${Math.floor(voiceCallData.call_duration/60)}m ${voiceCallData.call_duration%60}s)`);
        console.log(`Actual Duration:   ${actualDuration} seconds (${Math.floor(actualDuration/60)}m ${actualDuration%60}s)`);
        console.log(`Difference:        ${actualDuration - voiceCallData.call_duration} seconds`);
      }

      // Analyze call characteristics
      console.log('\n📊 CALL CHARACTERISTICS:');
      console.log('─'.repeat(80));
      console.log(`From:              ${voiceCallData.from}`);
      console.log(`To:                ${voiceCallData.to}`);
      console.log(`Location:          ${voiceCallData.location}`);
      console.log(`Line Type:         ${voiceCallData.line_type}`);
      console.log(`Answered By:       ${voiceCallData.answered_by_name} (ID: ${voiceCallData.answered_by_id})`);
      console.log(`Recording:         ${voiceCallData.recorded ? 'Yes' : 'No'}`);
      console.log(`Transcription:     ${voiceCallData.transcription_status}`);

      // Check for agent assignment timing
      console.log('\n👤 AGENT ASSIGNMENT TIMELINE:');
      console.log('─'.repeat(80));
      
      const assignmentAudit = audits.find(a => 
        a.events.find(e => e.type === 'Change' && e.field_name === 'assignee_id')
      );
      
      if (assignmentAudit) {
        const assignmentTime = new Date(assignmentAudit.created_at);
        const assignmentDelay = Math.round((assignmentTime - callStart) / 1000);
        
        console.log(`Agent Assigned:    ${assignmentTime.toLocaleString('en-US', { timeZone: 'America/Chicago' })} (CDT)`);
        console.log(`                   ${assignmentTime.toISOString()} (UTC)`);
        console.log(`Time to Assign:    ${assignmentDelay} seconds (${Math.floor(assignmentDelay/60)}m ${assignmentDelay%60}s)`);
        
        if (assignmentDelay > 30) {
          console.log(`\n⚠️  SIGNIFICANT DELAY: Agent assignment took ${assignmentDelay}s`);
          console.log(`   This could explain a beep at ~30s if call was in queue/IVR`);
        }
      }

      // Analysis and recommendations
      console.log('\n' + '='.repeat(80));
      console.log('🔍 ROOT CAUSE ANALYSIS');
      console.log('='.repeat(80));

      console.log('\n📌 FACTS:');
      console.log(`  • Call duration reported: ${voiceCallData.call_duration}s (15+ minutes)`);
      console.log(`  • Agent was assigned ~14 minutes after call started`);
      console.log(`  • Recording shows drop at ~30 seconds with beep`);

      console.log('\n💡 MOST LIKELY EXPLANATION:');
      console.log('  The 30-second beep and disconnect suggests:');
      console.log('  1. Customer was placed in IVR/queue when calling');
      console.log('  2. At ~30 seconds, something triggered (possibly):');
      console.log('     - IVR timeout or menu option');
      console.log('     - Call routing/transfer attempt');
      console.log('     - Network hiccup causing brief disconnect');
      console.log('  3. Call was recovered/reconnected or customer called back immediately');
      console.log('  4. Agent eventually picked up ~14-15 minutes into the "call session"');
      console.log('  5. Zendesk recorded total session time, not actual agent talk time');

      console.log('\n🔧 TO CONFIRM, CHECK:');
      console.log(`  1. Twilio Console for this call: ${twilioCallSid}`);
      console.log(`     URL: https://console.twilio.com/us1/monitor/logs/calls/${twilioCallSid}`);
      console.log(`     Look for: "disconnect_reason", "call_status", "call_events"`);
      console.log(`  `);
      console.log(`  2. Check if there's a second call from this number around the same time`);
      console.log(`  `);
      console.log(`  3. Ask agent David Shaver:`);
      console.log(`     - Did he speak with customer for full 15 minutes?`);
      console.log(`     - Was customer already on the line when he picked up?`);
      console.log(`     - Did customer mention calling back or being disconnected?`);

      console.log('\n📋 COMMON TWILIO DISCONNECT REASONS:');
      console.log('  • "busy" - Called party hung up');
      console.log('  • "no-answer" - No one picked up');
      console.log('  • "canceled" - Caller hung up before answer');
      console.log('  • "completed" - Call ended normally');
      console.log('  • "failed" - Call failed (network/system error)');
      console.log('  • "congestion" - Network congestion');

      console.log('\n' + '='.repeat(80));
      console.log(`🔗 TWILIO CALL SID: ${twilioCallSid}`);
      console.log('   Copy this and check in Twilio Console for exact disconnect reason');
      console.log('='.repeat(80));

      // Search for other calls around this time
      console.log('\n🔎 Checking for other calls from this number...');
      const searchResponse = await this.zendesk.makeRequest('GET', 
        `/search.json?query=type:ticket+via:voice+created>2025-10-08T15:00:00Z+created<2025-10-08T16:00:00Z`
      );
      
      const relatedCalls = searchResponse.results.filter(t => 
        t.description && t.description.includes('763-5780')
      );
      
      if (relatedCalls.length > 1) {
        console.log(`\n⚠️  Found ${relatedCalls.length} calls from this number in the same hour!`);
        relatedCalls.forEach(t => {
          console.log(`  • Ticket ${t.id}: ${t.subject} - ${t.status}`);
        });
      } else {
        console.log(`\n✓ Only one call found from this number during this time period`);
      }

    } catch (error) {
      console.error('\n❌ Error:', error.message);
    }
  }
}

// Run analysis
const ticketId = process.argv[2] || '292878';
const analyzer = new CallDisconnectAnalyzer();
analyzer.analyzeDisconnect(ticketId);
