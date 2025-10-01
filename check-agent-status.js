const ZendeskClient = require('./src/ZendeskClient');

class AgentStatusChecker {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async checkAllAgentStatusEndpoints() {
    console.log('🔍 CHECKING AGENT STATUS ENDPOINTS');
    console.log('='.repeat(50));
    
    try {
      // Method 1: Voice API current queue activity (we know this works)
      console.log('\n📋 Method 1: Voice API Current Queue Activity');
      try {
        const voiceStats = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
        console.log('Voice Stats Response:', JSON.stringify(voiceStats, null, 2));
      } catch (error) {
        console.log('Voice API Error:', error.message);
      }

      // Method 2: Try to get agent availability 
      console.log('\n📋 Method 2: Agent Availability API');
      try {
        const agentAvailability = await this.zendesk.makeRequest('GET', '/channels/voice/availabilities.json');
        console.log('Agent Availability Response:', JSON.stringify(agentAvailability, null, 2));
      } catch (error) {
        console.log('Agent Availability API Error:', error.message);
      }

      // Method 3: Try to get agent status
      console.log('\n📋 Method 3: Voice Agents API');
      try {
        const voiceAgents = await this.zendesk.makeRequest('GET', '/channels/voice/agents.json');
        console.log('Voice Agents Response:', JSON.stringify(voiceAgents, null, 2));
      } catch (error) {
        console.log('Voice Agents API Error:', error.message);
      }

      // Method 4: Try to get Talk stats
      console.log('\n📋 Method 4: Talk Stats API');
      try {
        const talkStats = await this.zendesk.makeRequest('GET', '/channels/voice/stats.json');
        console.log('Talk Stats Response:', JSON.stringify(talkStats, null, 2));
      } catch (error) {
        console.log('Talk Stats API Error:', error.message);
      }

      // Method 5: Check for phone numbers/lines
      console.log('\n📋 Method 5: Phone Numbers API');
      try {
        const phoneNumbers = await this.zendesk.makeRequest('GET', '/channels/voice/phone_numbers.json');
        console.log('Phone Numbers Response:', JSON.stringify(phoneNumbers, null, 2));
      } catch (error) {
        console.log('Phone Numbers API Error:', error.message);
      }

      // Method 6: Check Talk settings
      console.log('\n📋 Method 6: Talk Settings API');
      try {
        const talkSettings = await this.zendesk.makeRequest('GET', '/channels/voice/settings.json');
        console.log('Talk Settings Response:', JSON.stringify(talkSettings, null, 2));
      } catch (error) {
        console.log('Talk Settings API Error:', error.message);
      }

      // Method 7: Get all users and check their properties
      console.log('\n📋 Method 7: User Properties for Agent Status');
      try {
        const users = await this.zendesk.getUsers({ role: 'agent', per_page: 5 });
        console.log('Sample Agent User Properties:');
        if (users.users && users.users.length > 0) {
          const sampleAgent = users.users[0];
          console.log(JSON.stringify(sampleAgent, null, 2));
        }
      } catch (error) {
        console.log('Users API Error:', error.message);
      }

      // Method 8: Check for presence/activity status
      console.log('\n📋 Method 8: Try Activity/Presence APIs');
      try {
        const presence = await this.zendesk.makeRequest('GET', '/users/me/presence.json');
        console.log('Presence Response:', JSON.stringify(presence, null, 2));
      } catch (error) {
        console.log('Presence API Error:', error.message);
      }

    } catch (error) {
      console.error('❌ Error checking agent status endpoints:', error.message);
    }
  }
}

async function checkAgentStatus() {
  console.log('🔍 AGENT STATUS ENDPOINT CHECKER');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  console.log(`🕐 Check Time: ${new Date().toLocaleString()}\n`);
  
  try {
    const checker = new AgentStatusChecker();
    await checker.checkAllAgentStatusEndpoints();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Agent Status Endpoint Check Complete');
    
  } catch (error) {
    console.error('❌ Agent status check failed:', error.message);
  }
}

// Run the agent status check
checkAgentStatus();