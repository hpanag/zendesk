console.log('🔍 Investigating call records pagination and filtering...');
const ZendeskReportingService = require('./src/services/ZendeskReportingService');

async function investigateCallsAPI() {
  try {
    const service = new ZendeskReportingService();
    
    console.log('📞 Testing calls endpoint with different parameters...');
    
    // Test 1: Basic call without date filtering
    console.log('\n1️⃣ Basic calls endpoint:');
    const basicCalls = await service.getCallRecordsAlternative();
    console.log(`Basic calls: ${basicCalls.calls?.length || 0} records`);
    console.log('Has next_page:', !!basicCalls.next_page);
    console.log('Total count:', basicCalls.count);
    
    // Test 2: With higher per_page limit
    console.log('\n2️⃣ With higher per_page limit:');
    const moreCalls = await service.getCallRecordsAlternative({ per_page: 100 });
    console.log(`More calls: ${moreCalls.calls?.length || 0} records`);
    console.log('Has next_page:', !!moreCalls.next_page);
    console.log('Total count:', moreCalls.count);
    
    // Test 3: Check what date filtering options work
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n3️⃣ Testing date filtering for today (${today}):`);
    
    const dateFilterOptions = [
      { name: 'created_at', params: { 'created_at[gte]': `${today}T00:00:00Z` } },
      { name: 'updated_at', params: { 'updated_at[gte]': `${today}T00:00:00Z` } },
      { name: 'start_time', params: { start_time: `${today}T00:00:00Z` } },
      { name: 'since', params: { since: `${today}T00:00:00Z` } }
    ];
    
    for (const option of dateFilterOptions) {
      try {
        console.log(`\n   Testing ${option.name} filter...`);
        const result = await service.getCallRecordsAlternative({ ...option.params, per_page: 50 });
        console.log(`   ✅ ${option.name}: ${result.calls?.length || 0} calls`);
      } catch (error) {
        console.log(`   ❌ ${option.name}: ${error.message}`);
      }
    }
    
    // Test 4: Check account overview for real numbers
    console.log('\n4️⃣ Account overview for comparison:');
    const overview = await service.getTalkAccountOverview();
    console.log('Account overview data:');
    console.log(`  Total calls: ${overview.total_calls}`);
    console.log(`  Answered calls: ${overview.answered_calls}`);
    console.log(`  Missed calls: ${overview.missed_calls}`);
    console.log(`  Inbound calls: ${overview.inbound_calls}`);
    console.log(`  Outbound calls: ${overview.outbound_calls}`);
    
  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  }
}

investigateCallsAPI().then(() => {
  console.log('\n✅ Call API investigation complete');
});