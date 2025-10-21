console.log('📊 Testing enhanced Call Analytics with real Talk API endpoints...');
const CallAnalyticsService = require('./src/services/CallAnalyticsService');

async function testEnhancedCallAnalytics() {
  try {
    console.log('🚀 Initializing Call Analytics Service...');
    const service = new CallAnalyticsService();
    
    console.log('📈 Fetching 5-day call analytics with real data...');
    const result = await service.get5DayCallAnalytics();
    
    console.log('\n📋 RESULTS:');
    console.log('Success:', result.success);
    
    if (result.success && result.data) {
      console.log('\n📊 Summary:');
      const summary = result.data.summary;
      console.log(`  Total Calls (5 days): ${summary.total_calls}`);
      console.log(`  Answered Calls: ${summary.answered_calls}`);
      console.log(`  Unanswered Calls: ${summary.unanswered_calls}`);
      console.log(`  Overall Answer Rate: ${summary.answer_rate}%`);
      
      console.log('\n📅 Daily Breakdown:');
      result.data.daily_breakdown.forEach((day, index) => {
        console.log(`  ${index + 1}. ${day.date} (${day.day_name}):`);
        console.log(`     📞 Total: ${day.total_calls} | ✅ Answered: ${day.answered_calls} | ❌ Missed: ${day.unanswered_calls} | 📊 Rate: ${day.answer_rate}%`);
        if (day.source) {
          console.log(`     🔗 Data source: ${day.source}`);
        }
      });
      
      console.log('\n📈 Chart Data Ready:');
      console.log(`  Categories: ${result.data.chart_data.categories.length} days`);
      console.log(`  Series: ${result.data.chart_data.series.length} data series`);
      
    } else {
      console.log('❌ Failed to get analytics data');
      if (result.error) {
        console.log('Error:', result.error);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

testEnhancedCallAnalytics().then(() => {
  console.log('\n✅ Enhanced call analytics test complete');
});