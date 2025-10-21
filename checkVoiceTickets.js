const ZendeskClient = require('./src/ZendeskClient');

async function checkVoiceTickets() {
  const zendesk = new ZendeskClient();
  
  console.log('🔍 Checking available voice tickets in system...\n');
  
  // Get most recent voice tickets
  const response = await zendesk.search('type:ticket channel:voice', {
    per_page: 20,
    sort_by: 'created_at',
    sort_order: 'desc'
  });

  console.log(`Total voice tickets found: ${response.count || 'unknown'}\n`);
  console.log('Most recent 20 voice tickets:');
  console.log('='.repeat(80));
  
  response.results.forEach((ticket, index) => {
    const date = new Date(ticket.created_at);
    console.log(`${index + 1}. Ticket #${ticket.id}`);
    console.log(`   Created: ${date.toLocaleString()}`);
    console.log(`   Subject: ${ticket.subject.substring(0, 70)}`);
    console.log(`   Status: ${ticket.status}`);
    console.log();
  });

  // Check date range
  if (response.results.length > 0) {
    const oldest = response.results[response.results.length - 1];
    const newest = response.results[0];
    console.log('='.repeat(80));
    console.log('Date Range of Recent Tickets:');
    console.log(`  Oldest: ${new Date(oldest.created_at).toLocaleString()}`);
    console.log(`  Newest: ${new Date(newest.created_at).toLocaleString()}`);
  }
}

module.exports = checkVoiceTickets;

if (require.main === module) {
  checkVoiceTickets().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exitCode = 1;
  });
}
