const ZendeskClient = require('./src/ZendeskClient');

/**
 * Explore all available Voice API endpoints to compare abandoned call data
 */
class VoiceAPIExplorer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async exploreAllVoiceAPIs() {
    console.log('🔍 EXPLORING VOICE API ENDPOINTS FOR ABANDONED CALLS');
    console.log('='.repeat(70));
    console.log();

    // Calculate yesterday's date range
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);
    
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const startTime = Math.floor(startOfYesterday.getTime() / 1000);
    const startISO = startOfYesterday.toISOString().split('.')[0] + 'Z';
    const endISO = endOfYesterday.toISOString().split('.')[0] + 'Z';
    
    console.log(`📅 Target Date: ${yesterdayStr}`);
    console.log(`⏰ Time Range: ${startOfYesterday.toLocaleString()} to ${endOfYesterday.toLocaleString()}`);
    console.log();

    const results = {};

    // ========== API 1: Incremental Calls (Current Method) ==========
    try {
      console.log('📞 API 1: /channels/voice/stats/incremental/calls.json');
      console.log('   Endpoint:', `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`);
      
      const response = await this.zendesk.makeRequest(
        'GET',
        `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`
      );

      const allCalls = response.calls || [];
      const yesterdayCalls = allCalls.filter(call => {
        const callTime = new Date(call.created_at);
        return callTime >= startOfYesterday && callTime <= endOfYesterday;
      });

      // Analyze completion statuses
      const statusBreakdown = {};
      yesterdayCalls.forEach(call => {
        const status = call.completion_status || 'unknown';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });

      const abandoned = yesterdayCalls.filter(call => 
        call.completion_status === 'abandoned' || 
        call.completion_status === 'abandoned_in_voicemail'
      ).length;

      results.incremental_calls = {
        total_calls: yesterdayCalls.length,
        abandoned_calls: abandoned,
        status_breakdown: statusBreakdown
      };

      console.log(`   ✅ Total calls: ${yesterdayCalls.length}`);
      console.log(`   ❌ Abandoned: ${abandoned}`);
      console.log(`   📊 Status breakdown:`, JSON.stringify(statusBreakdown, null, 6));
      
      // Show sample call structure
      if (yesterdayCalls.length > 0) {
        console.log('\n   📋 Sample call structure:');
        const sample = yesterdayCalls[0];
        console.log('      Available fields:', Object.keys(sample).join(', '));
        console.log('      completion_status:', sample.completion_status);
        console.log('      call_recording_consent:', sample.call_recording_consent);
      }
      console.log();

    } catch (error) {
      console.log(`   ❌ Error:`, error.message);
      console.log();
      results.incremental_calls = { error: error.message };
    }

    // ========== API 2: Account Overview Stats ==========
    try {
      console.log('📊 API 2: /channels/voice/stats/account_overview.json');
      
      const response = await this.zendesk.makeRequest('GET', 
        `/channels/voice/stats/account_overview.json`
      );

      const overview = response.account_overview || {};
      
      results.account_overview = {
        total_calls: overview.total_calls,
        abandoned_in_queue: overview.total_calls_abandoned_in_queue,
        abandoned_in_voicemail: overview.total_calls_abandoned_in_voicemail,
        voicemails: overview.total_voicemails,
        outside_business_hours: overview.total_calls_outside_business_hours
      };

      console.log(`   ✅ Total calls (all time): ${overview.total_calls}`);
      console.log(`   ❌ Abandoned in queue: ${overview.total_calls_abandoned_in_queue}`);
      console.log(`   ❌ Abandoned in voicemail: ${overview.total_calls_abandoned_in_voicemail}`);
      console.log(`   📧 Voicemails: ${overview.total_voicemails}`);
      console.log(`   🌙 Outside business hours: ${overview.total_calls_outside_business_hours}`);
      console.log(`   ⚠️  Note: This is ALL-TIME data, not date-specific`);
      console.log();

    } catch (error) {
      console.log(`   ❌ Error:`, error.message);
      console.log();
      results.account_overview = { error: error.message };
    }

    // ========== API 3: Call Records with Date Filter ==========
    try {
      console.log('📞 API 3: /channels/voice/calls.json (with date filter)');
      console.log(`   Endpoint: /channels/voice/calls.json?start_time=${startISO}&end_time=${endISO}`);
      
      const response = await this.zendesk.makeRequest('GET', 
        `/channels/voice/calls.json?start_time=${startISO}&end_time=${endISO}&per_page=100`
      );

      const calls = response.calls || [];
      
      // Analyze completion statuses
      const statusBreakdown = {};
      calls.forEach(call => {
        const status = call.completion_status || 'unknown';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });

      const abandoned = calls.filter(call => 
        call.completion_status === 'abandoned' || 
        call.completion_status === 'abandoned_in_voicemail'
      ).length;

      results.calls_with_filter = {
        total_calls: calls.length,
        abandoned_calls: abandoned,
        status_breakdown: statusBreakdown
      };

      console.log(`   ✅ Total calls: ${calls.length}`);
      console.log(`   ❌ Abandoned: ${abandoned}`);
      console.log(`   📊 Status breakdown:`, JSON.stringify(statusBreakdown, null, 6));
      console.log();

    } catch (error) {
      console.log(`   ❌ Error:`, error.message);
      console.log();
      results.calls_with_filter = { error: error.message };
    }

    // ========== API 4: Agents Activity ==========
    try {
      console.log('👥 API 4: /channels/voice/stats/agents_activity.json');
      
      const response = await this.zendesk.makeRequest('GET', 
        `/channels/voice/stats/agents_activity.json`
      );

      const agents = response.agents_activity || [];
      
      // Aggregate agent stats
      let totalCalls = 0;
      let totalAccepted = 0;
      let totalMissed = 0;
      
      agents.forEach(agent => {
        totalCalls += (agent.total_calls || 0);
        totalAccepted += (agent.accepted_calls || 0);
        totalMissed += (agent.missed_calls || 0);
      });

      results.agents_activity = {
        agents_count: agents.length,
        total_calls: totalCalls,
        accepted_calls: totalAccepted,
        missed_calls: totalMissed
      };

      console.log(`   👥 Active agents: ${agents.length}`);
      console.log(`   📞 Total calls (across all agents): ${totalCalls}`);
      console.log(`   ✅ Accepted: ${totalAccepted}`);
      console.log(`   ❌ Missed: ${totalMissed}`);
      console.log(`   ⚠️  Note: This is LIFETIME agent data, not date-specific`);
      console.log();

    } catch (error) {
      console.log(`   ❌ Error:`, error.message);
      console.log();
      results.agents_activity = { error: error.message };
    }

    // ========== API 5: Current Queue Activity ==========
    try {
      console.log('📋 API 5: /channels/voice/stats/current_queue_activity.json');
      
      const response = await this.zendesk.makeRequest('GET', 
        `/channels/voice/stats/current_queue_activity.json`
      );

      const activity = response.current_queue_activity || {};
      
      results.queue_activity = {
        calls_in_queue: activity.calls_in_queue,
        agents_online: activity.agents_online,
        agents_available: activity.agents_available,
        average_wait_time: activity.average_wait_time
      };

      console.log(`   📋 Calls in queue RIGHT NOW: ${activity.calls_in_queue || 0}`);
      console.log(`   👥 Agents online: ${activity.agents_online || 0}`);
      console.log(`   ✅ Agents available: ${activity.agents_available || 0}`);
      console.log(`   ⏱️  Average wait time: ${activity.average_wait_time || 0}s`);
      console.log(`   ⚠️  Note: This is CURRENT MOMENT data only`);
      console.log();

    } catch (error) {
      console.log(`   ❌ Error:`, error.message);
      console.log();
      results.queue_activity = { error: error.message };
    }

    // ========== API 6: Phone Numbers Stats ==========
    try {
      console.log('📱 API 6: /channels/voice/stats/phone_numbers.json');
      
      const response = await this.zendesk.makeRequest('GET', 
        `/channels/voice/stats/phone_numbers.json`
      );

      const phoneNumbers = response.phone_numbers || [];
      
      results.phone_numbers = {
        phone_numbers_count: phoneNumbers.length,
        numbers: phoneNumbers.map(pn => ({
          number: pn.number,
          total_calls: pn.total_calls,
          abandoned_calls: pn.total_calls_abandoned_in_queue
        }))
      };

      console.log(`   📱 Phone numbers: ${phoneNumbers.length}`);
      phoneNumbers.forEach(pn => {
        console.log(`      ${pn.number}: ${pn.total_calls} total, ${pn.total_calls_abandoned_in_queue || 0} abandoned`);
      });
      console.log(`   ⚠️  Note: This is ALL-TIME data per phone number`);
      console.log();

    } catch (error) {
      console.log(`   ❌ Error:`, error.message);
      console.log();
      results.phone_numbers = { error: error.message };
    }

    // ========== COMPARISON ==========
    console.log('='.repeat(70));
    console.log('📊 COMPARISON OF ABANDONED CALL COUNTS');
    console.log('='.repeat(70));
    console.log();
    
    console.log('Yesterday\'s Abandoned Calls by API:');
    console.log('----------------------------------');
    if (results.incremental_calls && !results.incremental_calls.error) {
      console.log(`API 1 (Incremental Calls): ${results.incremental_calls.abandoned_calls} abandoned`);
    }
    if (results.calls_with_filter && !results.calls_with_filter.error) {
      console.log(`API 3 (Calls w/ Filter):   ${results.calls_with_filter.abandoned_calls} abandoned`);
    }
    console.log();

    console.log('⚠️  Potential Issues:');
    console.log('   • "abandoned" status might not capture all types of abandonment');
    console.log('   • May need to also count: voicemail, missed, no_answer, etc.');
    console.log('   • Different APIs use different completion_status values');
    console.log();

    console.log('💡 Recommendation:');
    console.log('   Check ALL completion_status values to identify which ones');
    console.log('   should count as "abandoned" for your business logic.');
    console.log();

    // Save detailed results
    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(
      path.join(__dirname, 'voice-api-exploration.json'),
      JSON.stringify(results, null, 2),
      'utf-8'
    );
    console.log('📄 Detailed results saved to: voice-api-exploration.json');
    console.log();
  }
}

// Run the exploration
const explorer = new VoiceAPIExplorer();
explorer.exploreAllVoiceAPIs();
