const ZendeskClient = require('./src/ZendeskClient');

class CallCategorizer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async categorizeAllCalls() {
    console.log('📞 CALL CATEGORIZATION REPORT');
    console.log('   Today: October 15, 2025');
    console.log('='.repeat(80));
    console.log();

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startTime = Math.floor(today.getTime() / 1000);

      console.log('🔍 Fetching all calls from Voice API...\n');

      // Fetch Voice API incremental calls
      const response = await this.zendesk.makeRequest(
        'GET',
        `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`
      );

      const allCalls = response.calls || [];
      
      // Filter for today's calls
      const todayCalls = allCalls.filter(call => {
        const callTime = new Date(call.created_at);
        return callTime >= today && callTime <= new Date();
      });

      console.log(`✅ Retrieved ${todayCalls.length} calls from today\n`);

      if (todayCalls.length === 0) {
        console.log('⚠️  No calls found for today');
        return;
      }

      // Categorize calls
      const categories = {
        answered: [],
        abandoned: [],
        voicemail: [],
        outbound: [],
        callback: [],
        completed_no_agent: [],
        other: []
      };

      todayCalls.forEach(call => {
        const callTime = new Date(call.created_at);
        
        const callInfo = {
          id: call.id,
          time: callTime.toLocaleTimeString(),
          fullTime: callTime.toLocaleString(),
          phone: call.phone_number,
          direction: call.direction,
          duration: call.duration,
          talkTime: call.talk_time,
          waitTime: call.wait_time,
          completionStatus: call.completion_status,
          agentId: call.agent_id,
          ticketId: call.ticket_id,
          callCharge: call.call_charge,
          timeToAnswer: call.time_to_answer
        };

        // Categorize the call
        if (call.direction === 'outbound') {
          categories.outbound.push(callInfo);
        } else if (call.completion_status === 'abandoned' || 
                   call.completion_status === 'abandoned_in_voicemail') {
          categories.abandoned.push(callInfo);
        } else if (call.completion_status === 'voicemail' || call.voicemail) {
          categories.voicemail.push(callInfo);
        } else if (call.callback) {
          categories.callback.push(callInfo);
        } else if (call.agent_id && call.talk_time > 0) {
          categories.answered.push(callInfo);
        } else if (call.completion_status === 'completed') {
          categories.completed_no_agent.push(callInfo);
        } else {
          categories.other.push(callInfo);
        }
      });

      // Summary statistics
      console.log('═'.repeat(80));
      console.log('📊 CATEGORY SUMMARY');
      console.log('═'.repeat(80));
      console.log();
      console.log(`Total Calls: ${todayCalls.length}`);
      console.log();
      console.log(`✅ Answered (with agent):        ${categories.answered.length.toString().padStart(4)} (${(categories.answered.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log(`❌ Abandoned:                    ${categories.abandoned.length.toString().padStart(4)} (${(categories.abandoned.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log(`📧 Voicemail:                    ${categories.voicemail.length.toString().padStart(4)} (${(categories.voicemail.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log(`📤 Outbound:                     ${categories.outbound.length.toString().padStart(4)} (${(categories.outbound.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log(`📞 Callback:                     ${categories.callback.length.toString().padStart(4)} (${(categories.callback.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log(`✔️  Completed (no agent data):   ${categories.completed_no_agent.length.toString().padStart(4)} (${(categories.completed_no_agent.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log(`❓ Other:                        ${categories.other.length.toString().padStart(4)} (${(categories.other.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log();

      // Detailed listings for each category
      
      // ANSWERED CALLS
      if (categories.answered.length > 0) {
        console.log('═'.repeat(80));
        console.log(`✅ ANSWERED CALLS (${categories.answered.length})`);
        console.log('═'.repeat(80));
        console.log();
        console.log('Time        | Phone Number    | Duration | Talk Time | Agent ID       | Ticket #');
        console.log('-'.repeat(80));
        
        categories.answered.forEach(call => {
          const dur = call.duration ? `${Math.floor(call.duration/60)}:${String(call.duration%60).padStart(2,'0')}` : 'N/A';
          const talk = call.talkTime ? `${Math.floor(call.talkTime/60)}:${String(call.talkTime%60).padStart(2,'0')}` : 'N/A';
          const agent = call.agentId ? call.agentId.toString().substring(0,14) : 'N/A';
          const ticket = call.ticketId ? `#${call.ticketId}` : 'None';
          
          console.log(
            `${call.time.padEnd(11)} | ${call.phone.padEnd(15)} | ` +
            `${dur.padEnd(8)} | ${talk.padEnd(9)} | ${agent.padEnd(14)} | ${ticket}`
          );
        });
        console.log();
      }

      // ABANDONED CALLS
      if (categories.abandoned.length > 0) {
        console.log('═'.repeat(80));
        console.log(`❌ ABANDONED CALLS (${categories.abandoned.length})`);
        console.log('═'.repeat(80));
        console.log();
        console.log('Time        | Phone Number    | Duration | Status                      | Ticket #');
        console.log('-'.repeat(80));
        
        categories.abandoned.forEach(call => {
          const dur = call.duration ? `${call.duration}s` : 'N/A';
          const ticket = call.ticketId ? `#${call.ticketId}` : 'None';
          
          console.log(
            `${call.time.padEnd(11)} | ${call.phone.padEnd(15)} | ` +
            `${dur.padEnd(8)} | ${call.completionStatus.padEnd(27)} | ${ticket}`
          );
        });
        console.log();
      }

      // VOICEMAIL
      if (categories.voicemail.length > 0) {
        console.log('═'.repeat(80));
        console.log(`📧 VOICEMAIL (${categories.voicemail.length})`);
        console.log('═'.repeat(80));
        console.log();
        console.log('Time        | Phone Number    | Duration | Ticket #');
        console.log('-'.repeat(80));
        
        categories.voicemail.forEach(call => {
          const dur = call.duration ? `${call.duration}s` : 'N/A';
          const ticket = call.ticketId ? `#${call.ticketId}` : 'None';
          
          console.log(
            `${call.time.padEnd(11)} | ${call.phone.padEnd(15)} | ${dur.padEnd(8)} | ${ticket}`
          );
        });
        console.log();
      }

      // OUTBOUND CALLS
      if (categories.outbound.length > 0) {
        console.log('═'.repeat(80));
        console.log(`📤 OUTBOUND CALLS (${categories.outbound.length})`);
        console.log('═'.repeat(80));
        console.log();
        console.log('Time        | Phone Number    | Duration | Talk Time | Agent ID       | Ticket #');
        console.log('-'.repeat(80));
        
        categories.outbound.forEach(call => {
          const dur = call.duration ? `${Math.floor(call.duration/60)}:${String(call.duration%60).padStart(2,'0')}` : 'N/A';
          const talk = call.talkTime ? `${Math.floor(call.talkTime/60)}:${String(call.talkTime%60).padStart(2,'0')}` : 'N/A';
          const agent = call.agentId ? call.agentId.toString().substring(0,14) : 'N/A';
          const ticket = call.ticketId ? `#${call.ticketId}` : 'None';
          
          console.log(
            `${call.time.padEnd(11)} | ${call.phone.padEnd(15)} | ` +
            `${dur.padEnd(8)} | ${talk.padEnd(9)} | ${agent.padEnd(14)} | ${ticket}`
          );
        });
        console.log();
      }

      // CALLBACK CALLS
      if (categories.callback.length > 0) {
        console.log('═'.repeat(80));
        console.log(`📞 CALLBACK CALLS (${categories.callback.length})`);
        console.log('═'.repeat(80));
        console.log();
        console.log('Time        | Phone Number    | Duration | Talk Time | Agent ID       | Ticket #');
        console.log('-'.repeat(80));
        
        categories.callback.forEach(call => {
          const dur = call.duration ? `${Math.floor(call.duration/60)}:${String(call.duration%60).padStart(2,'0')}` : 'N/A';
          const talk = call.talkTime ? `${Math.floor(call.talkTime/60)}:${String(call.talkTime%60).padStart(2,'0')}` : 'N/A';
          const agent = call.agentId ? call.agentId.toString().substring(0,14) : 'N/A';
          const ticket = call.ticketId ? `#${call.ticketId}` : 'None';
          
          console.log(
            `${call.time.padEnd(11)} | ${call.phone.padEnd(15)} | ` +
            `${dur.padEnd(8)} | ${talk.padEnd(9)} | ${agent.padEnd(14)} | ${ticket}`
          );
        });
        console.log();
      }

      // COMPLETED (NO AGENT DATA)
      if (categories.completed_no_agent.length > 0) {
        console.log('═'.repeat(80));
        console.log(`✔️  COMPLETED - NO AGENT DATA (${categories.completed_no_agent.length})`);
        console.log('═'.repeat(80));
        console.log();
        console.log('Time        | Phone Number    | Duration | Completion Status | Ticket #');
        console.log('-'.repeat(80));
        
        categories.completed_no_agent.forEach(call => {
          const dur = call.duration ? `${call.duration}s` : 'N/A';
          const ticket = call.ticketId ? `#${call.ticketId}` : 'None';
          
          console.log(
            `${call.time.padEnd(11)} | ${call.phone.padEnd(15)} | ` +
            `${dur.padEnd(8)} | ${call.completionStatus.padEnd(17)} | ${ticket}`
          );
        });
        console.log();
      }

      // OTHER CALLS
      if (categories.other.length > 0) {
        console.log('═'.repeat(80));
        console.log(`❓ OTHER CALLS (${categories.other.length})`);
        console.log('═'.repeat(80));
        console.log();
        console.log('Time        | Phone Number    | Duration | Completion Status    | Ticket #');
        console.log('-'.repeat(80));
        
        categories.other.forEach(call => {
          const dur = call.duration ? `${call.duration}s` : 'N/A';
          const status = call.completionStatus || 'unknown';
          const ticket = call.ticketId ? `#${call.ticketId}` : 'None';
          
          console.log(
            `${call.time.padEnd(11)} | ${call.phone.padEnd(15)} | ` +
            `${dur.padEnd(8)} | ${status.padEnd(20)} | ${ticket}`
          );
        });
        console.log();
      }

      // Export to JSON
      console.log('═'.repeat(80));
      console.log('💾 EXPORTING DATA');
      console.log('═'.repeat(80));
      console.log();

      const fs = require('fs');
      const path = require('path');
      
      const exportData = {
        date: today.toISOString().split('T')[0],
        generatedAt: new Date().toISOString(),
        totalCalls: todayCalls.length,
        summary: {
          answered: categories.answered.length,
          abandoned: categories.abandoned.length,
          voicemail: categories.voicemail.length,
          outbound: categories.outbound.length,
          callback: categories.callback.length,
          completed_no_agent: categories.completed_no_agent.length,
          other: categories.other.length
        },
        categories: categories
      };

      const reportDir = path.join(__dirname, 'reports');
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      const filename = `call_categorization_${today.toISOString().split('T')[0]}.json`;
      const filepath = path.join(reportDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
      
      console.log(`✅ Full call list exported to: ${filepath}`);
      console.log(`   File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
      console.log();

      // Final summary
      console.log('═'.repeat(80));
      console.log('🎯 FINAL SUMMARY');
      console.log('═'.repeat(80));
      console.log();
      console.log(`Total Calls Today: ${todayCalls.length}`);
      console.log();
      console.log('Category Breakdown:');
      console.log(`  ✅ Answered:             ${categories.answered.length} (${(categories.answered.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log(`  ❌ Abandoned:            ${categories.abandoned.length} (${(categories.abandoned.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log(`  📧 Voicemail:            ${categories.voicemail.length} (${(categories.voicemail.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log(`  📤 Outbound:             ${categories.outbound.length} (${(categories.outbound.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log(`  📞 Callback:             ${categories.callback.length} (${(categories.callback.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log(`  ✔️  Completed (no agent): ${categories.completed_no_agent.length} (${(categories.completed_no_agent.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log(`  ❓ Other:                ${categories.other.length} (${(categories.other.length/todayCalls.length*100).toFixed(1)}%)`);
      console.log();
      console.log('═'.repeat(80));

    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
    }
  }
}

async function main() {
  const categorizer = new CallCategorizer();
  await categorizer.categorizeAllCalls();
}

module.exports = CallCategorizer;

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exitCode = 1;
  });
}
