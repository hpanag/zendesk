const ZendeskClient = require('./src/ZendeskClient');

class TodayCallReport {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async generateReport() {
    console.log('📞 TODAY\'S CALL REPORT');
    console.log('   Tuesday, October 15, 2025');
    console.log('='.repeat(70));
    console.log();

    try {
      // Today - October 15, 2025 (midnight to now)
      const today = new Date();
      const startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(today);
      // Get current time
      
      const startTime = Math.floor(startDate.getTime() / 1000);
      const endTime = Math.floor(endDate.getTime() / 1000);

      console.log(`📅 Start: ${startDate.toLocaleString()}`);
      console.log(`📅 Now:   ${endDate.toLocaleString()}`);
      console.log(`🕐 Unix timestamps: ${startTime} to ${endTime}\n`);

      console.log('🔍 Fetching today\'s call records from Voice API...\n');

      // Fetch incremental calls
      const response = await this.zendesk.makeRequest(
        'GET',
        `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`
      );

      let allCalls = response.calls || [];
      
      console.log(`✅ Retrieved ${allCalls.length} total calls from API\n`);

      // Filter calls for today only
      const todayCalls = allCalls.filter(call => {
        const callTime = new Date(call.created_at);
        return callTime >= startDate && callTime <= endDate;
      });

      console.log(`🎯 Calls today (Oct 15): ${todayCalls.length}\n`);

      if (todayCalls.length === 0) {
        console.log('⚠️  No calls found for today yet');
        
        // Check current queue
        console.log('\n📊 Checking current queue status...\n');
        try {
          const queueResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
          const queueStats = queueResponse.current_queue_activity;
          
          console.log('📞 CURRENT QUEUE:');
          console.log(`   Calls waiting: ${queueStats.calls_waiting}`);
          console.log(`   Average wait: ${Math.round(queueStats.average_wait_time / 60 * 100) / 100} minutes`);
          console.log(`   Longest wait: ${Math.round(queueStats.longest_wait_time / 60 * 100) / 100} minutes`);
          console.log(`   Callbacks waiting: ${queueStats.callbacks_waiting}`);
        } catch (error) {
          console.log('   ⚠️  Could not fetch current queue stats');
        }
        
        return;
      }

      // Analyze calls
      let totalCalls = 0;
      let answeredCalls = 0;
      let abandonedCalls = 0;
      let voicemails = 0;
      let outboundCalls = 0;
      let inboundCalls = 0;
      let otherCalls = 0;

      let totalTalkTime = 0;
      let totalWaitTime = 0;
      let totalDuration = 0;
      let callsWithAgent = 0;
      let callsWithWaitTime = 0;

      const callsByHour = {};
      const abandonedDetails = [];
      const answeredDetails = [];

      todayCalls.forEach(call => {
        totalCalls++;
        
        const callTime = new Date(call.created_at);
        const hourKey = callTime.getHours();

        // Initialize hour counter
        if (!callsByHour[hourKey]) {
          callsByHour[hourKey] = { total: 0, answered: 0, abandoned: 0, outbound: 0 };
        }

        callsByHour[hourKey].total++;

        // Track direction
        if (call.direction === 'inbound') {
          inboundCalls++;
        } else if (call.direction === 'outbound') {
          outboundCalls++;
          callsByHour[hourKey].outbound++;
        }

        // Classify call status
        if (call.completion_status === 'abandoned' || 
            call.completion_status === 'abandoned_in_voicemail') {
          abandonedCalls++;
          callsByHour[hourKey].abandoned++;
          
          abandonedDetails.push({
            id: call.id,
            time: callTime.toLocaleTimeString(),
            duration: call.duration,
            waitTime: call.wait_time,
            phone: call.phone_number,
            ticketId: call.ticket_id
          });
        } else if (call.completion_status === 'voicemail') {
          voicemails++;
        } else if (call.agent_id || call.talk_time > 0) {
          // Has agent or talk time = answered
          answeredCalls++;
          callsWithAgent++;
          callsByHour[hourKey].answered++;
          
          if (call.talk_time) totalTalkTime += call.talk_time;
          
          answeredDetails.push({
            id: call.id,
            time: callTime.toLocaleTimeString(),
            duration: call.duration,
            talkTime: call.talk_time,
            waitTime: call.wait_time,
            agentId: call.agent_id,
            ticketId: call.ticket_id
          });
        } else if (call.completion_status === 'completed') {
          // Completed but no agent data
          answeredCalls++;
          callsByHour[hourKey].answered++;
        } else {
          otherCalls++;
        }

        if (call.duration) totalDuration += call.duration;
        if (call.wait_time) {
          totalWaitTime += call.wait_time;
          callsWithWaitTime++;
        }
      });

      // Calculate statistics
      const avgTalkTime = callsWithAgent > 0 ? Math.round(totalTalkTime / callsWithAgent) : 0;
      const avgWaitTime = callsWithWaitTime > 0 ? Math.round(totalWaitTime / callsWithWaitTime) : 0;
      const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
      const serviceLevel = answeredCalls + abandonedCalls > 0 ? 
        ((answeredCalls / (answeredCalls + abandonedCalls)) * 100).toFixed(1) : '0.0';
      const abandonmentRate = ((abandonedCalls / totalCalls) * 100).toFixed(1);

      // Display results
      console.log('═'.repeat(70));
      console.log('📊 TODAY\'S SUMMARY - TUESDAY, OCTOBER 15, 2025');
      console.log('═'.repeat(70));
      console.log();
      console.log(`📞 TOTAL CALLS:          ${totalCalls}`);
      console.log(`   ↳ Inbound:            ${inboundCalls}`);
      console.log(`   ↳ Outbound:           ${outboundCalls}`);
      console.log();
      console.log(`✅ ANSWERED CALLS:       ${answeredCalls}  (${(answeredCalls/totalCalls*100).toFixed(1)}%)`);
      console.log(`❌ ABANDONED CALLS:      ${abandonedCalls}  (${abandonmentRate}%)`);
      console.log(`📧 Voicemails:           ${voicemails}`);
      console.log(`❓ Other:                ${otherCalls}`);
      console.log();
      console.log(`📈 Service Level:        ${serviceLevel}% (answered / answered+abandoned)`);
      console.log(`⏱️  Avg Talk Time:        ${Math.floor(avgTalkTime / 60)}:${String(avgTalkTime % 60).padStart(2, '0')} min`);
      console.log(`⏰ Avg Wait Time:        ${Math.floor(avgWaitTime / 60)}:${String(avgWaitTime % 60).padStart(2, '0')} min`);
      console.log(`⏲️  Avg Call Duration:    ${Math.floor(avgDuration / 60)}:${String(avgDuration % 60).padStart(2, '0')} min`);
      
      // Hourly breakdown (only show hours with calls)
      const hoursWithCalls = Object.keys(callsByHour).map(h => parseInt(h)).sort((a, b) => a - b);
      
      if (hoursWithCalls.length > 0) {
        console.log();
        console.log('═'.repeat(70));
        console.log('🕐 BREAKDOWN BY HOUR');
        console.log('═'.repeat(70));
        console.log();
        console.log('Hour        Total  Answered  Abandoned  Outbound  Answer %');
        console.log('-'.repeat(70));
        
        hoursWithCalls.forEach(hour => {
          const stats = callsByHour[hour];
          const hourAnswerRate = (stats.answered + stats.abandoned) > 0 ?
            ((stats.answered / (stats.answered + stats.abandoned)) * 100).toFixed(0) : '0';
          const hourDisplay = `${String(hour).padStart(2, '0')}:00`;
          console.log(
            `${hourDisplay.padEnd(11)} ${String(stats.total).padStart(5)} ` +
            `${String(stats.answered).padStart(9)} ` +
            `${String(stats.abandoned).padStart(10)} ` +
            `${String(stats.outbound).padStart(9)}   ${String(hourAnswerRate).padStart(6)}%`
          );
        });
      }

      // Abandoned calls details
      if (abandonedCalls > 0) {
        console.log();
        console.log('═'.repeat(70));
        console.log(`❌ ABANDONED CALLS DETAILS (${abandonedCalls} total)`);
        console.log('═'.repeat(70));
        console.log();
        console.log('Time        Duration  Ticket #    Call ID');
        console.log('-'.repeat(70));
        
        abandonedDetails.forEach(call => {
          const dur = call.duration ? `${call.duration}s` : 'N/A';
          const ticket = call.ticketId ? `#${call.ticketId}` : 'None';
          console.log(
            `${call.time.padEnd(11)} ${dur.padStart(8)}  ${ticket.padEnd(11)} ${call.id}`
          );
        });
      }

      // Current queue status
      console.log();
      console.log('═'.repeat(70));
      console.log('📊 CURRENT QUEUE STATUS');
      console.log('═'.repeat(70));
      console.log();
      
      try {
        const queueResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
        const queueStats = queueResponse.current_queue_activity;
        
        console.log(`   Calls waiting RIGHT NOW: ${queueStats.calls_waiting}`);
        console.log(`   Current average wait: ${Math.round(queueStats.average_wait_time / 60 * 100) / 100} minutes`);
        console.log(`   Current longest wait: ${Math.round(queueStats.longest_wait_time / 60 * 100) / 100} minutes`);
        console.log(`   Callbacks waiting: ${queueStats.callbacks_waiting}`);
        
        if (queueStats.longest_wait_time > 1800) {
          console.log(`\n   ⚠️  WARNING: Someone has been waiting ${Math.round(queueStats.longest_wait_time / 60)} minutes!`);
        }
      } catch (error) {
        console.log('   ⚠️  Could not fetch current queue stats');
      }

      // Final summary box
      console.log();
      console.log('═'.repeat(70));
      console.log('🎯 FINAL SUMMARY - TODAY (OCTOBER 15, 2025)');
      console.log('═'.repeat(70));
      console.log();
      console.log(`  📞 Total Calls:        ${totalCalls}`);
      console.log(`  ✅ Answered Calls:     ${answeredCalls} (${(answeredCalls/totalCalls*100).toFixed(1)}%)`);
      console.log(`  ❌ Abandoned Calls:    ${abandonedCalls} (${abandonmentRate}%)`);
      console.log();
      console.log(`  📈 Service Level:      ${serviceLevel}%`);
      console.log(`  ⏱️  Avg Talk Time:      ${Math.floor(avgTalkTime / 60)}:${String(avgTalkTime % 60).padStart(2, '0')} minutes`);
      console.log();
      console.log('═'.repeat(70));

    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
    }
  }
}

async function main() {
  const reporter = new TodayCallReport();
  await reporter.generateReport();
}

main();
