const ZendeskClient = require('./src/ZendeskClient');

/**
 * Get yesterday's calls broken down by hour of day
 */
class CallsByHourAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async analyzeYesterdayByHour() {
    console.log('📞 YESTERDAY\'S CALLS BY HOUR OF DAY');
    console.log('='.repeat(70));
    console.log();

    try {
      // Calculate yesterday's date range
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const startOfYesterday = new Date(yesterday);
      startOfYesterday.setHours(0, 0, 0, 0);
      
      const endOfYesterday = new Date(yesterday);
      endOfYesterday.setHours(23, 59, 59, 999);
      
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const dayName = yesterday.toLocaleDateString('en-US', { weekday: 'long' });
      
      console.log(`📅 Date: ${dayName}, ${yesterdayStr}`);
      console.log(`⏰ Time Range: ${startOfYesterday.toLocaleString()} to ${endOfYesterday.toLocaleString()}`);
      console.log();

      // Get yesterday's start time as Unix timestamp
      const startTime = Math.floor(startOfYesterday.getTime() / 1000);
      
      console.log('🔍 Fetching call records from Voice API...');
      console.log(`   Using start_time: ${startTime} (${startOfYesterday.toISOString()})`);
      console.log();

      // Fetch incremental calls from Voice API
      const response = await this.zendesk.makeRequest(
        'GET',
        `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`
      );

      const allCalls = response.calls || [];
      console.log(`✅ Retrieved ${allCalls.length} total calls from API`);
      console.log();

      // Filter calls to only include yesterday
      const yesterdayCalls = allCalls.filter(call => {
        const callTime = new Date(call.created_at);
        return callTime >= startOfYesterday && callTime <= endOfYesterday;
      });

      console.log(`🎯 Calls on ${yesterdayStr}: ${yesterdayCalls.length}`);
      console.log();

      if (yesterdayCalls.length === 0) {
        console.log('⚠️  No calls found for yesterday');
        console.log();
        console.log('📋 Recent calls sample (for debugging):');
        if (allCalls.length > 0) {
          allCalls.slice(0, 5).forEach(call => {
            console.log(`   ${new Date(call.created_at).toLocaleString()}`);
          });
        }
        return;
      }

      // Group calls by hour of day
      const callsByHour = new Array(24).fill(0).map((_, hour) => ({
        hour: hour,
        hour_display: this.formatHour(hour),
        total_calls: 0,
        answered: 0,
        abandoned: 0,
        voicemail: 0,
        outside_hours: 0,
        calls: []
      }));

      // Categorize each call
      yesterdayCalls.forEach(call => {
        const callTime = new Date(call.created_at);
        const hour = callTime.getHours();
        
        callsByHour[hour].total_calls++;
        callsByHour[hour].calls.push(call);
        
        // Categorize by completion status
        const status = call.completion_status || '';
        
        if (status === 'answered' || status === 'completed') {
          callsByHour[hour].answered++;
        } else if (status.includes('abandoned')) {
          // Count ALL types of abandonment:
          // - abandoned_in_voicemail
          // - abandoned_in_ivr
          // - abandoned_in_queue
          // - abandoned (general)
          callsByHour[hour].abandoned++;
        } else if (status === 'voicemail') {
          callsByHour[hour].voicemail++;
        }
        
        // Check if outside business hours
        if (call.outside_business_hours) {
          callsByHour[hour].outside_hours++;
        }
      });

      // Display results
      console.log('📊 CALLS BY HOUR OF DAY');
      console.log('='.repeat(70));
      console.log();
      
      // Header
      console.log('Hour        | Total | Answered | Abandoned | Voicemail | Outside Hrs');
      console.log('-'.repeat(70));
      
      // Summary stats
      let peakHour = 0;
      let peakCount = 0;
      
      callsByHour.forEach(hourData => {
        // Show ALL hours, not just hours with calls
        const row = [
          hourData.hour_display.padEnd(11),
          hourData.total_calls.toString().padStart(5),
          hourData.answered.toString().padStart(8),
          hourData.abandoned.toString().padStart(9),
          hourData.voicemail.toString().padStart(9),
          hourData.outside_hours.toString().padStart(12)
        ].join(' | ');
        
        console.log(row);
        
        // Track peak hour
        if (hourData.total_calls > peakCount) {
          peakCount = hourData.total_calls;
          peakHour = hourData.hour;
        }
      });
      
      console.log('-'.repeat(70));
      
      // Calculate totals
      const totalCalls = yesterdayCalls.length;
      const totalAnswered = callsByHour.reduce((sum, h) => sum + h.answered, 0);
      const totalAbandoned = callsByHour.reduce((sum, h) => sum + h.abandoned, 0);
      const totalVoicemail = callsByHour.reduce((sum, h) => sum + h.voicemail, 0);
      const totalOutside = callsByHour.reduce((sum, h) => sum + h.outside_hours, 0);
      
      const totalsRow = [
        'TOTAL'.padEnd(11),
        totalCalls.toString().padStart(5),
        totalAnswered.toString().padStart(8),
        totalAbandoned.toString().padStart(9),
        totalVoicemail.toString().padStart(9),
        totalOutside.toString().padStart(12)
      ].join(' | ');
      
      console.log(totalsRow);
      console.log();
      
      // Peak hour info
      console.log('📈 KEY INSIGHTS:');
      console.log('='.repeat(70));
      console.log();
      console.log(`🏆 Peak Hour: ${this.formatHour(peakHour)} (${peakCount} calls)`);
      console.log(`📞 Total Calls: ${totalCalls}`);
      console.log(`✅ Answered: ${totalAnswered} (${((totalAnswered/totalCalls)*100).toFixed(1)}%)`);
      console.log(`❌ Abandoned: ${totalAbandoned} (${((totalAbandoned/totalCalls)*100).toFixed(1)}%)`);
      console.log(`📧 Voicemail: ${totalVoicemail} (${((totalVoicemail/totalCalls)*100).toFixed(1)}%)`);
      console.log(`🌙 Outside Hours: ${totalOutside} (${((totalOutside/totalCalls)*100).toFixed(1)}%)`);
      console.log();
      
      // Hourly distribution visualization
      console.log('📊 VISUAL DISTRIBUTION:');
      console.log('='.repeat(70));
      console.log();
      
      const maxCalls = Math.max(...callsByHour.map(h => h.total_calls));
      const barWidth = 50;
      
      callsByHour.forEach(hourData => {
        // Show ALL hours, including zero-call hours
        const barLength = hourData.total_calls > 0 ? Math.round((hourData.total_calls / maxCalls) * barWidth) : 0;
        const bar = hourData.total_calls > 0 ? '█'.repeat(barLength) : '';
        console.log(`${hourData.hour_display} ${bar} ${hourData.total_calls}`);
      });
      
      console.log();
      console.log('✅ Analysis complete!');
      
      // Export to CSV
      this.exportToCSV(callsByHour, yesterdayStr);
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
    }
  }
  
  formatHour(hour) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    return `${displayHour}:00 ${period}`;
  }
  
  exportToCSV(callsByHour, dateStr) {
    const fs = require('fs');
    const path = require('path');
    
    // Create CSV content
    const headers = ['Hour', 'Total Calls', 'Answered', 'Abandoned', 'Voicemail', 'Outside Business Hours'];
    const rows = [headers.join(',')];
    
    callsByHour.forEach(hourData => {
      const row = [
        hourData.hour_display,
        hourData.total_calls,
        hourData.answered,
        hourData.abandoned,
        hourData.voicemail,
        hourData.outside_hours
      ];
      rows.push(row.join(','));
    });
    
    const csv = rows.join('\n');
    const filename = `calls-by-hour-${dateStr}.csv`;
    
    fs.writeFileSync(path.join(__dirname, filename), csv, 'utf-8');
    console.log(`📄 Exported to: ${filename}`);
    console.log();
  }
}

// Run the analysis
const analyzer = new CallsByHourAnalyzer();
analyzer.analyzeYesterdayByHour();
