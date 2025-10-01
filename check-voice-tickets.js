const ZendeskClient = require('./src/ZendeskClient');

class VoiceTicketChecker {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async checkVoiceTicketFormats() {
    console.log('🔍 CHECKING VOICE TICKET FORMATS');
    console.log('='.repeat(50));
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString().split('T')[0];
      
      console.log(`📅 Checking for tickets created on: ${todayISO}`);
      
      // Method 1: Search by channel:voice
      console.log('\n📋 Method 1: Search by channel:voice');
      const voiceChannel = await this.zendesk.search(`type:ticket channel:voice created:${todayISO}`, { per_page: 20 });
      console.log(`Found ${voiceChannel.results?.length || 0} tickets with channel:voice`);
      
      // Method 2: Search by via.channel
      console.log('\n📋 Method 2: Recent tickets to check via.channel');
      const recentTickets = await this.zendesk.getTickets({
        per_page: 50,
        sort_by: 'created_at',
        sort_order: 'desc'
      });
      
      const todayTickets = recentTickets.tickets?.filter(ticket => {
        const createdDate = new Date(ticket.created_at);
        return createdDate >= today;
      }) || [];
      
      console.log(`Found ${todayTickets.length} tickets created today (all channels)`);
      
      // Analyze channels used today
      const channelCounts = {};
      const viaCounts = {};
      
      todayTickets.forEach(ticket => {
        // Count via.channel
        if (ticket.via?.channel) {
          viaCounts[ticket.via.channel] = (viaCounts[ticket.via.channel] || 0) + 1;
        }
        
        // Count main channel (if different)
        if (ticket.channel) {
          channelCounts[ticket.channel] = (channelCounts[ticket.channel] || 0) + 1;
        }
      });
      
      console.log('\n📊 Today\'s Tickets by Via Channel:');
      Object.entries(viaCounts).forEach(([channel, count]) => {
        console.log(`   ${channel}: ${count} tickets`);
      });
      
      if (Object.keys(channelCounts).length > 0) {
        console.log('\n📊 Today\'s Tickets by Channel Property:');
        Object.entries(channelCounts).forEach(([channel, count]) => {
          console.log(`   ${channel}: ${count} tickets`);
        });
      }
      
      // Show sample voice tickets if any exist
      const voiceTicketsViaProperty = todayTickets.filter(ticket => 
        ticket.via?.channel === 'voice' || 
        ticket.channel === 'voice' ||
        (ticket.via?.source?.from?.phone) ||
        (ticket.subject && ticket.subject.toLowerCase().includes('call'))
      );
      
      console.log(`\n📞 Found ${voiceTicketsViaProperty.length} potential voice tickets today`);
      
      if (voiceTicketsViaProperty.length > 0) {
        console.log('\n📝 Sample Voice Ticket:');
        const sample = voiceTicketsViaProperty[0];
        console.log(`   ID: ${sample.id}`);
        console.log(`   Subject: ${sample.subject}`);
        console.log(`   Via Channel: ${sample.via?.channel}`);
        console.log(`   Channel: ${sample.channel || 'N/A'}`);
        console.log(`   Via Source:`, JSON.stringify(sample.via?.source, null, 2));
        
        // Check custom fields for call data
        if (sample.custom_fields && sample.custom_fields.length > 0) {
          console.log('   Custom Fields:');
          sample.custom_fields.slice(0, 5).forEach(field => {
            if (field.value) {
              console.log(`     ${field.id}: ${field.value}`);
            }
          });
        }
      }
      
      // Method 3: Try searching for phone-related tickets
      console.log('\n📋 Method 3: Search for phone/call related tickets');
      const phoneTickets = await this.zendesk.search(`type:ticket (subject:call OR subject:phone) created:${todayISO}`, { per_page: 20 });
      console.log(`Found ${phoneTickets.results?.length || 0} tickets with call/phone in subject`);
      
    } catch (error) {
      console.error('❌ Error checking voice tickets:', error.message);
    }
  }
}

async function checkVoiceTickets() {
  console.log('🔍 VOICE TICKET FORMAT CHECKER');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  console.log(`🕐 Check Time: ${new Date().toLocaleString()}\n`);
  
  const checker = new VoiceTicketChecker();
  await checker.checkVoiceTicketFormats();
  
  console.log('\n✅ Voice ticket format check complete');
}

checkVoiceTickets();