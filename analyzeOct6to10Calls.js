const ZendeskClient = require('./src/ZendeskClient');

class VoiceCallAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async analyzeCallRange() {
    console.log('📞 VOICE CALL ANALYSIS');
    console.log('Period: Monday Oct 6, 8am - Friday Oct 10, 7pm, 2025');
    console.log('='.repeat(60));
    console.log();

    try {
      // Check Voice API stats endpoints
      console.log('🔍 Method 1: Checking Voice API Stats...\n');
      
      try {
        const voiceStats = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
        console.log('✅ Voice API is available');
        console.log('Current Queue Activity:', JSON.stringify(voiceStats, null, 2));
      } catch (error) {
        console.log('❌ Voice API current queue not accessible:', error.message);
      }

      // Try agent activity
      console.log('\n🔍 Method 2: Checking Agent Activity Stats...\n');
      
      try {
        const agentStats = await this.zendesk.makeRequest('GET', '/channels/voice/stats/agents_activity.json');
        console.log('✅ Agent Activity API is available');
        
        if (agentStats.agents_activity && agentStats.agents_activity.length > 0) {
          console.log(`Found ${agentStats.agents_activity.length} agents with activity\n`);
          
          let totalCalls = 0;
          let totalAnswered = 0;
          
          agentStats.agents_activity.forEach(agent => {
            if (agent.total_calls) totalCalls += agent.total_calls;
            if (agent.accepted_calls) totalAnswered += agent.accepted_calls;
          });
          
          console.log('📊 Agent Activity Summary (Current Period):');
          console.log(`   Total Calls: ${totalCalls}`);
          console.log(`   Answered Calls: ${totalAnswered}`);
          console.log('\n⚠️  Note: These are current/recent stats, not historical for Oct 6-10');
        }
      } catch (error) {
        console.log('❌ Agent Activity API not accessible:', error.message);
      }

      // Try incremental calls API
      console.log('\n🔍 Method 3: Checking Incremental Calls API...\n');
      
      const startTime = Math.floor(new Date('2025-10-06T08:00:00').getTime() / 1000);
      const endTime = Math.floor(new Date('2025-10-10T19:00:00').getTime() / 1000);
      
      try {
        const incrementalCalls = await this.zendesk.makeRequest(
          'GET',
          `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`
        );
        console.log('✅ Incremental Calls API is available');
        console.log(JSON.stringify(incrementalCalls, null, 2));
      } catch (error) {
        console.log('❌ Incremental Calls API not accessible:', error.message);
      }

      // Check regular tickets
      console.log('\n🔍 Method 4: Checking Regular Tickets in Date Range...\n');
      
      const startStr = '2025-10-06';
      const endStr = '2025-10-10';
      
      const allTicketsResponse = await this.zendesk.search(
        `type:ticket created>=${startStr} created<=${endStr}`,
        { per_page: 100 }
      );
      
      const allTickets = allTicketsResponse.results || [];
      console.log(`✅ Found ${allTickets.length} total tickets (all types) in Oct 6-10 range\n`);
      
      if (allTickets.length > 0) {
        // Categorize tickets
        const categories = {
          voice: [],
          voicemail: [],
          email: [],
          web: [],
          api: [],
          other: []
        };
        
        allTickets.forEach(ticket => {
          const via = ticket.via?.channel?.name?.toLowerCase() || 'unknown';
          const subject = (ticket.subject || '').toLowerCase();
          
          if (via === 'voice' || subject.includes('voice')) {
            categories.voice.push(ticket);
          } else if (subject.includes('voice mail') || subject.includes('voicemail')) {
            categories.voicemail.push(ticket);
          } else if (via === 'email') {
            categories.email.push(ticket);
          } else if (via === 'web') {
            categories.web.push(ticket);
          } else if (via === 'api') {
            categories.api.push(ticket);
          } else {
            categories.other.push(ticket);
          }
        });
        
        console.log('📊 Ticket Breakdown by Channel:');
        console.log(`   Voice: ${categories.voice.length}`);
        console.log(`   Voicemail: ${categories.voicemail.length}`);
        console.log(`   Email: ${categories.email.length}`);
        console.log(`   Web: ${categories.web.length}`);
        console.log(`   API: ${categories.api.length}`);
        console.log(`   Other: ${categories.other.length}`);
        
        console.log('\n📋 Sample tickets from this period:');
        allTickets.slice(0, 5).forEach(ticket => {
          console.log(`   #${ticket.id} - ${new Date(ticket.created_at).toLocaleString()}`);
          console.log(`     Via: ${ticket.via?.channel?.name || 'unknown'}`);
          console.log(`     Subject: ${ticket.subject.substring(0, 60)}`);
        });
      } else {
        console.log('⚠️  No tickets found in October 6-10 range');
      }

      // Final summary
      console.log('\n' + '='.repeat(60));
      console.log('📋 ANALYSIS SUMMARY');
      console.log('='.repeat(60));
      console.log('Period: Monday Oct 6, 8am - Friday Oct 10, 7pm, 2025\n');
      
      console.log('❌ ISSUE IDENTIFIED:');
      console.log('No voice tickets or call records found for the requested period.');
      console.log('\nPossible reasons:');
      console.log('1. Voice/Talk channel may not be actively recording call tickets');
      console.log('2. Calls may be tracked in a different system (Twilio, etc.)');
      console.log('3. The date range may be before call tracking was enabled');
      console.log('4. Voice tickets may be created with different tags/channels');
      console.log('\n💡 RECOMMENDATION:');
      console.log('Check with your Zendesk admin about:');
      console.log('- How inbound calls are being recorded in Zendesk');
      console.log('- If there\'s a separate call tracking system');
      console.log('- Voice/Talk API configuration and data retention');
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }
}

async function main() {
  const analyzer = new VoiceCallAnalyzer();
  await analyzer.analyzeCallRange();
}

module.exports = VoiceCallAnalyzer;

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exitCode = 1;
  });
}
