const LiveFeedAnalyzer = require('./src/LiveFeedAnalyzer');

async function getLiveFeed() {
  console.log('🔴 Starting Live Call Center Feed...');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  
  try {
    const liveFeed = new LiveFeedAnalyzer();
    
    // Get current live data
    console.log('\n📡 Fetching live call center status...');
    await liveFeed.getLiveFeedData();
    
    // Display the live feed
    liveFeed.printLiveFeed();
    
    // Export to JSON
    console.log('💾 Exporting live feed data...');
    const jsonPath = await liveFeed.exportLiveFeedToJSON();
    
    console.log('\n✅ Live Feed Update Complete!');
    console.log(`📂 JSON data saved at: ${jsonPath}`);
    
    // Show the key metrics again for quick reference
    const data = liveFeed.liveFeedData;
    console.log('\n🚀 QUICK STATUS:');
    console.log(`📞 Calls in Queue: ${data.callsInQueue}`);
    
    if (data.agents) {
      console.log(`👥 Total Agents: ${data.agents.totalAgents}`);
      console.log(`🟢 Online: ${data.agents.agentsOnline}`);
      console.log(`📞 On Call: ${data.agents.agentsOnCall}`);
    } else {
      console.log(`👥 Agents Online: ${data.onlineAgents || 0}`);
    }
    
    console.log(`🕐 Last Updated: ${data.lastUpdated}`);
    
  } catch (error) {
    console.error('❌ Live Feed failed:', error.message);
    
    if (error.response?.status === 401) {
      console.error('🔐 Authentication failed. Please check your credentials in the .env file.');
    } else if (error.response?.status === 403) {
      console.error('🚫 Access forbidden. Please check your API permissions.');
    } else if (error.response?.status === 404) {
      console.error('🔍 Resource not found. Please check your subdomain.');
    }
  }
}

// Check if continuous monitoring is requested
const args = process.argv.slice(2);
const isContinuous = args.includes('--continuous') || args.includes('-c');
const intervalArg = args.find(arg => arg.startsWith('--interval='));
const interval = intervalArg ? parseInt(intervalArg.split('=')[1]) : 30;

if (isContinuous) {
  console.log('🔄 Continuous monitoring mode enabled');
  const liveFeed = new LiveFeedAnalyzer();
  liveFeed.startLiveFeed(interval);
} else {
  // Single update
  getLiveFeed();
}