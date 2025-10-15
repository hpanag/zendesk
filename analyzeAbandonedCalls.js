const ZendeskClient = require('./src/ZendeskClient');
const fs = require('fs');
const path = require('path');

class AbandonedCallAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async analyzeAbandonedCalls(startDate, endDate) {
    console.log('\n📊 ABANDONED CALL ANALYSIS REPORT');
    console.log('='.repeat(80));
    console.log(`Date Range: ${startDate} to ${endDate || 'now'}`);
    console.log('='.repeat(80));

    try {
      // Fetch all abandoned calls
      console.log('\n🔍 Fetching abandoned calls from Zendesk...');
      const query = `type:ticket via:voice created>${startDate}${endDate ? ` created<${endDate}` : ''} abandoned`;
      
      let allCalls = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore && page <= 10) { // Limit to 10 pages (1000 results)
        console.log(`  Fetching page ${page}...`);
        const response = await this.zendesk.makeRequest('GET', 
          `/search.json?query=${encodeURIComponent(query)}&page=${page}&per_page=100`);
        
        allCalls = allCalls.concat(response.results);
        hasMore = response.next_page !== null;
        page++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`\n✅ Fetched ${allCalls.length} abandoned calls`);
      
      if (allCalls.length === 0) {
        console.log('\n❌ No abandoned calls found in this date range.');
        return;
      }

      // Analyze patterns
      console.log('\n📈 Analyzing patterns...\n');
      
      const analysis = this.analyzePatterns(allCalls);
      
      // Generate report
      this.generateReport(analysis, allCalls);
      
      // Save detailed data
      this.saveDetailedData(allCalls, analysis);
      
      console.log('\n✅ Analysis complete!');
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      if (error.response) {
        console.error('API Response:', error.response.data);
      }
    }
  }

  analyzePatterns(calls) {
    const analysis = {
      byHour: {},
      byDayOfWeek: {},
      byDate: {},
      repeatCallers: {},
      totalCalls: calls.length,
      dateRange: {
        start: calls[0]?.created_at,
        end: calls[calls.length - 1]?.created_at
      }
    };

    calls.forEach(call => {
      const date = new Date(call.created_at);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const dateStr = date.toISOString().split('T')[0];
      
      // By hour (0-23)
      analysis.byHour[hour] = (analysis.byHour[hour] || 0) + 1;
      
      // By day of week (0=Sunday, 6=Saturday)
      analysis.byDayOfWeek[dayOfWeek] = (analysis.byDayOfWeek[dayOfWeek] || 0) + 1;
      
      // By date
      analysis.byDate[dateStr] = (analysis.byDate[dateStr] || 0) + 1;
      
      // Extract phone number from description
      const phoneMatch = call.description?.match(/Call from: \+1 \((\d{3})\) (\d{3})-(\d{4})/);
      if (phoneMatch) {
        const phone = `${phoneMatch[1]}${phoneMatch[2]}${phoneMatch[3]}`;
        if (!analysis.repeatCallers[phone]) {
          analysis.repeatCallers[phone] = {
            count: 0,
            tickets: [],
            formattedPhone: `+1 (${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}`
          };
        }
        analysis.repeatCallers[phone].count++;
        analysis.repeatCallers[phone].tickets.push(call.id);
      }
    });

    return analysis;
  }

  generateReport(analysis, calls) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY STATISTICS');
    console.log('='.repeat(80));
    
    console.log(`\nTotal Abandoned Calls: ${analysis.totalCalls}`);
    console.log(`Date Range: ${new Date(analysis.dateRange.start).toLocaleDateString()} - ${new Date(analysis.dateRange.end).toLocaleDateString()}`);
    
    // Peak hours
    console.log('\n⏰ ABANDONED CALLS BY HOUR OF DAY:');
    console.log('─'.repeat(80));
    const hours = Object.entries(analysis.byHour)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log('\nTop 10 Problem Hours:');
    hours.forEach(([hour, count]) => {
      const hour12 = hour % 12 || 12;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const bar = '█'.repeat(Math.ceil(count / 5));
      console.log(`  ${hour12}:00 ${ampm.padEnd(2)} │ ${bar} ${count} calls`);
    });
    
    const peakHour = hours[0];
    const peakHour12 = peakHour[0] % 12 || 12;
    const peakAmpm = peakHour[0] < 12 ? 'AM' : 'PM';
    console.log(`\n⚠️  PEAK HOUR: ${peakHour12}:00 ${peakAmpm} with ${peakHour[1]} abandoned calls`);
    
    // Day of week
    console.log('\n📅 ABANDONED CALLS BY DAY OF WEEK:');
    console.log('─'.repeat(80));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const days = Object.entries(analysis.byDayOfWeek)
      .sort((a, b) => b[1] - a[1]);
    
    days.forEach(([day, count]) => {
      const bar = '█'.repeat(Math.ceil(count / 10));
      console.log(`  ${dayNames[day].padEnd(10)} │ ${bar} ${count} calls`);
    });
    
    const problemDay = days[0];
    console.log(`\n⚠️  WORST DAY: ${dayNames[problemDay[0]]} with ${problemDay[1]} abandoned calls`);
    
    // Daily trend
    console.log('\n📈 ABANDONED CALLS BY DATE (Last 15 days):');
    console.log('─'.repeat(80));
    const recentDates = Object.entries(analysis.byDate)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 15)
      .reverse();
    
    recentDates.forEach(([date, count]) => {
      const bar = '█'.repeat(Math.ceil(count / 3));
      const dateObj = new Date(date);
      const dayName = dayNames[dateObj.getDay()].substring(0, 3);
      console.log(`  ${date} (${dayName}) │ ${bar} ${count} calls`);
    });
    
    // Calculate trend
    if (recentDates.length >= 2) {
      const oldAvg = recentDates.slice(0, 7).reduce((sum, [, count]) => sum + count, 0) / 7;
      const newAvg = recentDates.slice(-7).reduce((sum, [, count]) => sum + count, 0) / 7;
      const trend = ((newAvg - oldAvg) / oldAvg * 100).toFixed(1);
      
      if (trend > 0) {
        console.log(`\n⚠️  TREND: Abandoned calls INCREASING by ${trend}% (${oldAvg.toFixed(1)} → ${newAvg.toFixed(1)} avg/day)`);
      } else {
        console.log(`\n✅ TREND: Abandoned calls DECREASING by ${Math.abs(trend)}% (${oldAvg.toFixed(1)} → ${newAvg.toFixed(1)} avg/day)`);
      }
    }
    
    // Repeat callers
    console.log('\n📞 REPEAT CALLERS (Multiple Abandoned Calls):');
    console.log('─'.repeat(80));
    const repeatCallers = Object.values(analysis.repeatCallers)
      .filter(caller => caller.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    
    if (repeatCallers.length > 0) {
      console.log(`\nFound ${repeatCallers.length} repeat callers:\n`);
      repeatCallers.slice(0, 10).forEach((caller, i) => {
        console.log(`  ${i + 1}. ${caller.formattedPhone}`);
        console.log(`     Abandoned ${caller.count} times`);
        console.log(`     Tickets: ${caller.tickets.join(', ')}`);
        console.log('');
      });
      
      console.log(`⚠️  ${repeatCallers.length} customers abandoned multiple calls - HIGH PRIORITY!`);
    } else {
      console.log('\n✅ No repeat callers - each abandoned call is from a different customer');
    }
    
    // Recommendations
    console.log('\n' + '='.repeat(80));
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(80));
    
    console.log('\n🔧 IMMEDIATE ACTIONS:');
    console.log(`  1. Increase staffing during peak hour (${peakHour12}:00 ${peakAmpm})`);
    console.log(`  2. Focus on ${dayNames[problemDay[0]]}s - worst day for abandoned calls`);
    console.log('  3. Contact repeat callers directly to resolve their issues');
    console.log('  4. Review IVR timeout settings (many calls drop at ~30 seconds)');
    
    console.log('\n📊 MONITORING:');
    console.log('  1. Set up alerts when abandoned calls exceed 20 per hour');
    console.log('  2. Daily abandoned call rate reporting');
    console.log('  3. Track trend - currently ' + (recentDates.length >= 2 ? 
      (((recentDates[recentDates.length-1][1] - recentDates[0][1]) > 0) ? 'increasing ⚠️' : 'stable ✅') : 'N/A'));
    
    console.log('\n⚙️ SYSTEM IMPROVEMENTS:');
    console.log('  1. Implement callback queue system');
    console.log('  2. Add IVR option: "Press 1 to receive a callback"');
    console.log('  3. Increase hold time from 30s to 3 minutes');
    console.log('  4. Add queue position announcements');
    console.log('  5. Review agent schedules to match call volume patterns');
    
    console.log('\n📈 TARGET METRICS:');
    const currentRate = (analysis.totalCalls / Object.keys(analysis.byDate).length).toFixed(1);
    const targetRate = (currentRate * 0.5).toFixed(1);
    console.log(`  Current: ${currentRate} abandoned calls per day`);
    console.log(`  Target:  ${targetRate} abandoned calls per day (50% reduction)`);
    console.log(`  Goal:    <5% abandonment rate (industry standard)`);
  }

  saveDetailedData(calls, analysis) {
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    const reportPath = path.join(reportDir, `abandoned_calls_${timestamp}.json`);
    
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalCalls: calls.length,
        dateRange: analysis.dateRange
      },
      summary: {
        byHour: analysis.byHour,
        byDayOfWeek: analysis.byDayOfWeek,
        byDate: analysis.byDate,
        repeatCallersCount: Object.values(analysis.repeatCallers).filter(c => c.count > 1).length
      },
      repeatCallers: Object.values(analysis.repeatCallers)
        .filter(c => c.count > 1)
        .sort((a, b) => b.count - a.count),
      allCalls: calls.map(c => ({
        id: c.id,
        created_at: c.created_at,
        subject: c.subject,
        description: c.description,
        status: c.status
      }))
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📄 DETAILED REPORT SAVED:');
    console.log(`  Location: ${reportPath}`);
    console.log(`  Size: ${Math.round(fs.statSync(reportPath).size / 1024)} KB`);
  }
}

// Run analysis
const startDate = process.argv[2] || '2025-10-01';
const endDate = process.argv[3] || null;

console.log('\n🚀 Starting abandoned call analysis...\n');
console.log('This may take a few minutes to fetch and analyze all data...\n');

const analyzer = new AbandonedCallAnalyzer();
analyzer.analyzeAbandonedCalls(startDate, endDate);
