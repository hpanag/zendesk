const ZendeskClient = require('./src/ZendeskClient');

class Oct6to10CallReport {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async generateReport() {
    console.log('📞 CALL REPORT: OCTOBER 6-10, 2025');
    console.log('   Monday Oct 6, 8:00 AM - Friday Oct 10, 7:00 PM');
    console.log('='.repeat(70));
    console.log();

    try {
      // October 6, 2025 8:00 AM
      const startDate = new Date('2025-10-06T08:00:00-07:00'); // Assuming Pacific time
      const startTime = Math.floor(startDate.getTime() / 1000);
      
      // October 10, 2025 7:00 PM
      const endDate = new Date('2025-10-10T19:00:00-07:00');
      const endTime = Math.floor(endDate.getTime() / 1000);

      console.log(`📅 Start: ${startDate.toLocaleString()}`);
      console.log(`📅 End:   ${endDate.toLocaleString()}`);
      console.log(`🕐 Unix timestamps: ${startTime} to ${endTime}\n`);

      console.log('🔍 Fetching call records from Voice API...\n');

      // Fetch incremental calls
      const response = await this.zendesk.makeRequest(
        'GET',
        `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`
      );

      let allCalls = response.calls || [];
      
      console.log(`✅ Retrieved ${allCalls.length} total calls from API\n`);

      // Filter calls within our date range
      const filteredCalls = allCalls.filter(call => {
        const callTime = new Date(call.created_at);
        return callTime >= startDate && callTime <= endDate;
      });

      console.log(`🎯 Calls within Oct 6-10 timeframe: ${filteredCalls.length}\n`);

      if (filteredCalls.length === 0) {
        console.log('❌ No calls found in the specified date range');
        return;
      }

      // Analyze calls
      let totalCalls = filteredCalls.length;
      let answeredCalls = 0;
      let abandonedCalls = 0;
      let voicemails = 0;
      let outboundCalls = 0;
      let otherCalls = 0;

      let totalTalkTime = 0;
      let totalWaitTime = 0;
      let callsWithAgent = 0;

      const callsByDay = {};
      const callsByHour = {};

      filteredCalls.forEach(call => {
        const callDate = new Date(call.created_at);
        const dayKey = callDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const hourKey = callDate.getHours();

        // Initialize counters
        if (!callsByDay[dayKey]) {
          callsByDay[dayKey] = { total: 0, answered: 0, abandoned: 0 };
        }
        if (!callsByHour[hourKey]) {
          callsByHour[hourKey] = { total: 0, answered: 0, abandoned: 0 };
        }

        callsByDay[dayKey].total++;
        callsByHour[hourKey].total++;

        // Classify call
        if (call.direction === 'outbound') {
          outboundCalls++;
        } else if (call.completion_status === 'abandoned' || 
                   call.completion_status === 'abandoned_in_voicemail') {
          abandonedCalls++;
          callsByDay[dayKey].abandoned++;
          callsByHour[hourKey].abandoned++;
        } else if (call.completion_status === 'voicemail') {
          voicemails++;
        } else if (call.agent_id || call.talk_time > 30) {
          // Has agent or talk time > 30s = answered
          answeredCalls++;
          callsWithAgent++;
          callsByDay[dayKey].answered++;
          callsByHour[hourKey].answered++;
          
          if (call.talk_time) totalTalkTime += call.talk_time;
        } else if (call.completion_status === 'completed') {
          // Completed but no agent - might be IVR completion
          answeredCalls++;
          callsByDay[dayKey].answered++;
          callsByHour[hourKey].answered++;
        } else {
          otherCalls++;
        }

        if (call.wait_time) totalWaitTime += call.wait_time;
      });

      // Calculate statistics
      const avgTalkTime = callsWithAgent > 0 ? Math.round(totalTalkTime / callsWithAgent) : 0;
      const avgWaitTime = answeredCalls > 0 ? Math.round(totalWaitTime / answeredCalls) : 0;
      const answerRate = ((answeredCalls / (answeredCalls + abandonedCalls)) * 100).toFixed(1);
      const abandonmentRate = ((abandonedCalls / totalCalls) * 100).toFixed(1);

      // Display results
      console.log('═'.repeat(70));
      console.log('📊 SUMMARY STATISTICS');
      console.log('═'.repeat(70));
      console.log();
      console.log(`📞 TOTAL CALLS:          ${totalCalls}`);
      console.log(`✅ ANSWERED CALLS:       ${answeredCalls}  (${(answeredCalls/totalCalls*100).toFixed(1)}%)`);
      console.log(`❌ Abandoned Calls:      ${abandonedCalls}  (${abandonmentRate}%)`);
      console.log(`📧 Voicemails:           ${voicemails}`);
      console.log(`📤 Outbound Calls:       ${outboundCalls}`);
      console.log(`❓ Other:                ${otherCalls}`);
      console.log();
      console.log(`📈 Service Level:        ${answerRate}% (answered / answered+abandoned)`);
      console.log(`⏱️  Avg Talk Time:        ${Math.floor(avgTalkTime / 60)}:${String(avgTalkTime % 60).padStart(2, '0')} min`);
      console.log(`⏰ Avg Wait Time:        ${avgWaitTime} seconds`);
      
      // Breakdown by day
      console.log();
      console.log('═'.repeat(70));
      console.log('📅 BREAKDOWN BY DAY');
      console.log('═'.repeat(70));
      console.log();
      console.log('Day                Total    Answered   Abandoned  Answer %');
      console.log('-'.repeat(70));
      
      Object.keys(callsByDay).sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateA - dateB;
      }).forEach(day => {
        const stats = callsByDay[day];
        const dayAnswerRate = stats.total > 0 ? 
          ((stats.answered / (stats.answered + stats.abandoned)) * 100).toFixed(1) : '0.0';
        console.log(
          `${day.padEnd(18)} ${String(stats.total).padStart(6)} ` +
          `${String(stats.answered).padStart(10)} ` +
          `${String(stats.abandoned).padStart(11)}   ${String(dayAnswerRate).padStart(6)}%`
        );
      });

      // Breakdown by hour
      console.log();
      console.log('═'.repeat(70));
      console.log('🕐 BREAKDOWN BY HOUR');
      console.log('═'.repeat(70));
      console.log();
      console.log('Hour        Total    Answered   Abandoned');
      console.log('-'.repeat(70));
      
      Object.keys(callsByHour).sort((a, b) => parseInt(a) - parseInt(b)).forEach(hour => {
        const stats = callsByHour[hour];
        const hourDisplay = `${String(hour).padStart(2, '0')}:00`;
        console.log(
          `${hourDisplay.padEnd(11)} ${String(stats.total).padStart(6)} ` +
          `${String(stats.answered).padStart(10)} ` +
          `${String(stats.abandoned).padStart(11)}`
        );
      });

      // Sample calls
      console.log();
      console.log('═'.repeat(70));
      console.log('📋 SAMPLE ANSWERED CALLS');
      console.log('═'.repeat(70));
      console.log();
      
      const answeredSample = filteredCalls
        .filter(c => c.agent_id || (c.completion_status === 'completed' && c.talk_time > 30))
        .slice(0, 5);
      
      answeredSample.forEach(call => {
        const callTime = new Date(call.created_at);
        const talkMins = call.talk_time ? Math.floor(call.talk_time / 60) : 0;
        const talkSecs = call.talk_time ? call.talk_time % 60 : 0;
        console.log(`${callTime.toLocaleString()}`);
        console.log(`  ID: ${call.id} | Duration: ${talkMins}:${String(talkSecs).padStart(2, '0')} | Agent: ${call.agent_id || 'N/A'}`);
        if (call.ticket_id) console.log(`  Ticket: #${call.ticket_id}`);
        console.log();
      });

      // Final summary box
      console.log('═'.repeat(70));
      console.log('🎯 FINAL SUMMARY');
      console.log('═'.repeat(70));
      console.log();
      console.log(`  Period:  Monday October 6, 8:00 AM - Friday October 10, 7:00 PM`);
      console.log();
      console.log(`  📞 Total Calls:      ${totalCalls}`);
      console.log(`  ✅ Answered Calls:   ${answeredCalls} (${(answeredCalls/totalCalls*100).toFixed(1)}%)`);
      console.log();
      console.log(`  📈 Service Level:    ${answerRate}%`);
      console.log(`  ❌ Abandonment Rate: ${abandonmentRate}%`);
      console.log();
      console.log('═'.repeat(70));

    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
    }
  }
}

async function main() {
  const reporter = new Oct6to10CallReport();
  await reporter.generateReport();
}

module.exports = Oct6to10CallReport;

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exitCode = 1;
  });
}
