const ZendeskClient = require('./src/ZendeskClient');
const fs = require('fs');
const path = require('path');
const https = require('https');

class CallInvestigator {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async investigateCall(ticketId) {
    console.log(`🔍 Investigating Ticket #${ticketId}...`);
    console.log('='.repeat(80));

    try {
      // 1. Get ticket details
      console.log('\n📋 STEP 1: Fetching Ticket Details...');
      const ticketResponse = await this.zendesk.makeRequest('GET', `/tickets/${ticketId}.json`);
      const ticket = ticketResponse.ticket;
      
      console.log(`  Ticket ID: ${ticket.id}`);
      console.log(`  Subject: ${ticket.subject}`);
      console.log(`  Status: ${ticket.status}`);
      console.log(`  Created: ${ticket.created_at}`);
      console.log(`  From: ${ticket.via.source.from?.formatted_phone || 'Unknown'}`);
      console.log(`  To: ${ticket.via.source.to?.formatted_phone || 'Unknown'}`);

      // 2. Get all audits (contains voice metadata)
      console.log('\n📝 STEP 2: Fetching Audit Trail...');
      const auditsResponse = await this.zendesk.makeRequest('GET', `/tickets/${ticketId}/audits.json`);
      const audits = auditsResponse.audits;
      
      console.log(`  Found ${audits.length} audit entries`);

      // 3. Find voice comment with call details
      console.log('\n📞 STEP 3: Extracting Voice Call Metadata...');
      let voiceCallData = null;
      let twilioCallSid = null;
      
      for (const audit of audits) {
        const voiceEvent = audit.events.find(e => e.type === 'VoiceComment');
        if (voiceEvent && voiceEvent.data) {
          voiceCallData = voiceEvent.data;
          
          // Extract Twilio Call SID from recording URL
          const recordingUrl = voiceCallData.recording_url || '';
          const match = recordingUrl.match(/calls\/(CA[a-f0-9]+)\//);
          if (match) {
            twilioCallSid = match[1];
          }
          break;
        }
      }

      if (voiceCallData) {
        console.log('\n  ✅ Voice Call Data Found:');
        console.log(`     Call ID: ${voiceCallData.call_id}`);
        console.log(`     Twilio SID: ${twilioCallSid || 'Not found'}`);
        console.log(`     Duration: ${voiceCallData.call_duration} seconds (${Math.floor(voiceCallData.call_duration / 60)}m ${voiceCallData.call_duration % 60}s)`);
        console.log(`     Started: ${voiceCallData.started_at}`);
        console.log(`     Answered by: ${voiceCallData.answered_by_name} (ID: ${voiceCallData.answered_by_id})`);
        console.log(`     Location: ${voiceCallData.location}`);
        console.log(`     Line Type: ${voiceCallData.line_type}`);
        console.log(`     Recorded: ${voiceCallData.recorded}`);
        console.log(`     Recording URL: ${voiceCallData.recording_url}`);
        console.log(`     Transcription Status: ${voiceCallData.transcription_status}`);
      } else {
        console.log('  ❌ No voice call data found in audits');
        return;
      }

      // 4. Get all comments to see call flow
      console.log('\n💬 STEP 4: Analyzing Call Comments...');
      const commentsResponse = await this.zendesk.makeRequest('GET', `/tickets/${ticketId}/comments.json`);
      const comments = commentsResponse.comments;
      
      console.log(`  Found ${comments.length} comments:`);
      comments.forEach((comment, index) => {
        console.log(`\n  Comment ${index + 1}:`);
        console.log(`    Type: ${comment.type}`);
        console.log(`    Created: ${comment.created_at}`);
        console.log(`    Author ID: ${comment.author_id}`);
        if (comment.data) {
          console.log(`    Call Duration: ${comment.data.call_duration}s`);
          console.log(`    Answered By: ${comment.data.answered_by_name}`);
        }
        if (comment.body && comment.body.length < 200) {
          console.log(`    Body: ${comment.body.substring(0, 200)}`);
        }
      });

      // 5. Download recording for analysis
      console.log('\n🎵 STEP 5: Downloading Call Recording...');
      if (voiceCallData.recording_url) {
        const recordingPath = await this.downloadRecording(voiceCallData.recording_url, ticketId);
        console.log(`  ✅ Recording saved to: ${recordingPath}`);
        
        // Check file size to see if it matches expected duration
        const stats = fs.statSync(recordingPath);
        const fileSizeKB = Math.round(stats.size / 1024);
        const expectedSizeKB = Math.round((voiceCallData.call_duration * 8) / 1024); // Rough estimate for 8kbps audio
        
        console.log(`  File size: ${fileSizeKB} KB`);
        console.log(`  Expected size for ${voiceCallData.call_duration}s: ~${expectedSizeKB} KB`);
        
        if (fileSizeKB < (expectedSizeKB * 0.1)) {
          console.log(`  ⚠️  WARNING: Recording file is much smaller than expected!`);
          console.log(`     This suggests the recording may be incomplete or corrupted.`);
        }
      } else {
        console.log('  ❌ No recording URL available');
      }

      // 6. Try to get Twilio call details if we have the SID
      if (twilioCallSid) {
        console.log('\n📡 STEP 6: Attempting to Get Twilio Call Details...');
        console.log(`  Note: This requires Twilio API credentials which may not be available via Zendesk API`);
        console.log(`  Twilio Call SID: ${twilioCallSid}`);
        console.log(`  You can check this call in Twilio Console at:`);
        console.log(`  https://console.twilio.com/us1/monitor/logs/calls/${twilioCallSid}`);
      }

      // 7. Analyze timeline for gaps
      console.log('\n⏱️  STEP 7: Timeline Analysis...');
      const callStart = new Date(voiceCallData.started_at);
      const ticketCreated = new Date(ticket.created_at);
      const firstCommentTime = comments.length > 1 ? new Date(comments[1].created_at) : null;
      
      console.log(`  Call started: ${callStart.toISOString()}`);
      console.log(`  Ticket created: ${ticketCreated.toISOString()}`);
      console.log(`  Time to create ticket: ${Math.round((ticketCreated - callStart) / 1000)}s`);
      
      if (firstCommentTime) {
        console.log(`  Voice comment added: ${firstCommentTime.toISOString()}`);
        console.log(`  Time from call start to voice comment: ${Math.round((firstCommentTime - callStart) / 1000)}s`);
        console.log(`  (Expected: ~${voiceCallData.call_duration}s if call completed)`);
        
        const actualDuration = Math.round((firstCommentTime - callStart) / 1000);
        if (Math.abs(actualDuration - voiceCallData.call_duration) > 60) {
          console.log(`  ⚠️  WARNING: Significant time discrepancy detected!`);
        }
      }

      // 8. Summary and recommendations
      console.log('\n' + '='.repeat(80));
      console.log('📊 INVESTIGATION SUMMARY');
      console.log('='.repeat(80));
      
      console.log('\n🔍 Key Findings:');
      console.log(`  • Recorded Duration: ${voiceCallData.call_duration} seconds`);
      console.log(`  • Agent: ${voiceCallData.answered_by_name}`);
      console.log(`  • Recording Available: Yes`);
      
      console.log('\n⚠️  Potential Issues to Check:');
      console.log('  1. Listen to the recording file downloaded above');
      console.log('  2. Check if recording duration matches the file (~30s vs 15min)');
      console.log('  3. If beep occurs at 30s, possible causes:');
      console.log('     - Call transfer/routing (customer was transferred)');
      console.log('     - IVR disconnect (system error)');
      console.log('     - Network timeout (poor connection)');
      console.log('     - Carrier issue (phone system problem)');
      console.log('     - Recording glitch (call continued but not recorded)');
      
      console.log('\n🔧 Next Steps:');
      console.log('  1. Play the recording to confirm actual duration');
      console.log('  2. Check Twilio logs for disconnect reason code');
      console.log('  3. Ask agent David Shaver if he remembers speaking with customer');
      console.log('  4. Look for patterns in other calls around the same time');
      
      console.log('\n✅ Investigation complete!');

    } catch (error) {
      console.error('❌ Error during investigation:', error.message);
      if (error.response) {
        console.error('API Response:', error.response.data);
      }
    }
  }

  async downloadRecording(url, ticketId) {
    return new Promise((resolve, reject) => {
      // Ensure recordings directory exists
      const recordingsDir = path.join(__dirname, 'recordings');
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }

      const filename = `ticket_${ticketId}_recording.mp3`;
      const filepath = path.join(recordingsDir, filename);
      const file = fs.createWriteStream(filepath);

      // Add Zendesk authentication to the request
      const urlWithAuth = url.replace('https://', `https://${this.zendesk.email}/token:${this.zendesk.apiToken}@`);

      https.get(urlWithAuth, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(filepath);
        });
      }).on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete partial file
        reject(err);
      });
    });
  }
}

// Run investigation
const ticketId = process.argv[2] || '292878';
const investigator = new CallInvestigator();
investigator.investigateCall(ticketId);
