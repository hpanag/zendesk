const LiveFeedAnalyzer = require('./src/LiveFeedAnalyzer');

async function testDashboardFix() {
  console.log('🔍 TESTING DASHBOARD FIX');
  console.log('='.repeat(70));
  console.log();
  
  const analyzer = new LiveFeedAnalyzer();
  
  try {
    // Get live feed data with the new logic
    const data = await analyzer.getLiveFeedData();
    
    console.log();
    console.log('═'.repeat(70));
    console.log('📊 DASHBOARD DATA SUMMARY');
    console.log('═'.repeat(70));
    console.log();
    console.log(`📞 Total Calls: ${data.dailyMetrics.totalCalls}`);
    console.log(`❌ Abandoned Calls: ${data.dailyMetrics.abandonedInQueue}`);
    console.log(`📈 Data Source: ${data.dailyMetrics.dataSource}`);
    console.log();
    
    // Export to JSON for the dashboard
    const filePath = await analyzer.exportLiveFeedToJSON('live-feed-current.json');
    console.log(`✅ Dashboard data exported to: ${filePath}`);
    console.log();
    
    console.log('═'.repeat(70));
    console.log('✅ FIX VERIFICATION');
    console.log('═'.repeat(70));
    console.log();
    
    if (data.dailyMetrics.dataSource === 'voice_api_primary') {
      console.log('✅ SUCCESS! Dashboard is now using Voice API as primary source');
      console.log(`   Abandoned calls count: ${data.dailyMetrics.abandonedInQueue}`);
      console.log('   This should match the Voice API completion_status count (17)');
    } else {
      console.log('⚠️  Dashboard is using fallback method');
      console.log(`   Data source: ${data.dailyMetrics.dataSource}`);
      console.log(`   Abandoned calls count: ${data.dailyMetrics.abandonedInQueue}`);
    }
    
    console.log();
    console.log('📋 Additional Metrics:');
    console.log(`   Total Inbound: ${data.dailyMetrics.totalInboundCalls}`);
    console.log(`   Total Outbound: ${data.dailyMetrics.totalOutboundCalls}`);
    console.log(`   Avg Duration: ${data.dailyMetrics.averageDuration} min`);
    console.log(`   Avg Wait Time: ${data.dailyMetrics.averageWaitTime} min`);
    console.log();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

module.exports = testDashboardFix;

if (require.main === module) {
  testDashboardFix().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exitCode = 1;
  });
}
