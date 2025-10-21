console.log('🔍 Testing Talk API endpoints discovery...');
const ZendeskClient = require('./src/ZendeskClient');

async function discoverTalkEndpoints() {
  try {
    const client = new ZendeskClient();
    
    // Common Talk API endpoints to test based on Zendesk documentation
    const endpointsToTest = [
      '/channels/voice/stats.json',
      '/channels/voice/stats/overview.json', 
      '/channels/voice/stats/current_queue_activity.json',
      '/channels/voice/stats/agents_activity.json',
      '/channels/voice/stats/account_overview.json',
      '/channels/voice/phone_numbers.json',
      '/channels/voice/greeting_categories.json',
      '/channels/voice/agents.json',
      '/channels/voice/stats/historical.json',
      '/channels/voice/calls.json'
    ];
    
    console.log('\n📋 Testing available Talk endpoints:');
    let workingEndpoints = [];
    
    for (const endpoint of endpointsToTest) {
      try {
        console.log(`Testing: ${endpoint}`);
        const result = await client.makeRequest('GET', endpoint);
        console.log(`✅ WORKING: ${endpoint}`);
        workingEndpoints.push(endpoint);
        
        if (result && typeof result === 'object') {
          const keys = Object.keys(result).slice(0, 3);
          console.log(`   Data keys: ${keys.join(', ')}`);
          
          // If this is stats data, show some sample values
          if (endpoint.includes('stats') && result) {
            const sampleData = {};
            keys.forEach(key => {
              if (typeof result[key] === 'number' || typeof result[key] === 'string') {
                sampleData[key] = result[key];
              }
            });
            if (Object.keys(sampleData).length > 0) {
              console.log(`   Sample data:`, JSON.stringify(sampleData, null, 2));
            }
          }
        }
        console.log(''); // blank line for readability
      } catch (error) {
        console.log(`❌ FAILED: ${endpoint} - ${error.message.split('\n')[0]}`);
      }
    }
    
    console.log(`\n📊 Summary: ${workingEndpoints.length} working endpoints found`);
    workingEndpoints.forEach(ep => console.log(`  ✓ ${ep}`));
    
    if (workingEndpoints.length > 0) {
      console.log('\n🎯 Recommended endpoints for call analytics:');
      const recommendedEndpoints = workingEndpoints.filter(ep => 
        ep.includes('stats') || ep.includes('calls')
      );
      recommendedEndpoints.forEach(ep => console.log(`  📈 ${ep}`));
    }
    
  } catch (error) {
    console.error('❌ Discovery failed:', error.message);
  }
}

discoverTalkEndpoints().then(() => {
  console.log('\n✅ Talk API discovery complete');
});