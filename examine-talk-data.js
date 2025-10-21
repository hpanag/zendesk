console.log('📊 Examining Talk API data structures...');
const ZendeskClient = require('./src/ZendeskClient');

async function examineWorkingEndpoints() {
  try {
    const client = new ZendeskClient();
    
    const workingEndpoints = [
      '/channels/voice/stats/current_queue_activity.json',
      '/channels/voice/stats/agents_activity.json', 
      '/channels/voice/stats/account_overview.json',
      '/channels/voice/calls.json'
    ];
    
    for (const endpoint of workingEndpoints) {
      try {
        console.log(`\n🔍 Examining: ${endpoint}`);
        console.log('─'.repeat(60));
        
        const result = await client.makeRequest('GET', endpoint);
        
        if (result) {
          // Pretty print the structure
          console.log('Data structure:');
          console.log(JSON.stringify(result, null, 2));
        }
        
      } catch (error) {
        console.log(`❌ Failed to examine ${endpoint}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Examination failed:', error.message);
  }
}

examineWorkingEndpoints().then(() => {
  console.log('\n✅ Data structure examination complete');
});