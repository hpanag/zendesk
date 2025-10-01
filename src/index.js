const ZendeskClient = require('./ZendeskClient');

async function main() {
  try {
    // Initialize the Zendesk client
    const zendesk = new ZendeskClient();
    
    console.log('🚀 Zendesk API Client initialized successfully!');
    console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
    
    // Example: Get all tickets
    console.log('\n📋 Fetching recent tickets...');
    const tickets = await zendesk.getTickets({ per_page: 5 });
    console.log(`Found ${tickets.count} total tickets. Showing first 5:`);
    
    if (tickets.tickets && tickets.tickets.length > 0) {
      tickets.tickets.forEach((ticket, index) => {
        console.log(`${index + 1}. [${ticket.id}] ${ticket.subject} (Status: ${ticket.status})`);
      });
    } else {
      console.log('No tickets found.');
    }

    // Example: Get last 10 tickets using the new method
    console.log('\n🎫 Getting last 10 tickets...');
    const lastTenTickets = await zendesk.getLastTenTickets();
    
    if (lastTenTickets.tickets && lastTenTickets.tickets.length > 0) {
      lastTenTickets.tickets.forEach((ticket, index) => {
        console.log(`${index + 1}. [ID: ${ticket.id}] ${ticket.subject}`);
        console.log(`   Status: ${ticket.status} | Priority: ${ticket.priority || 'normal'}`);
        console.log(`   Created: ${new Date(ticket.created_at).toLocaleString()}`);
        console.log('   ---');
      });
    } else {
      console.log('No tickets found.');
    }

    // Example: Get current user info
    console.log('\n👤 Getting current user info...');
    const currentUser = await zendesk.makeRequest('GET', '/users/me.json');
    console.log(`Logged in as: ${currentUser.user.name} (${currentUser.user.email})`);
    
    // Example: Search for tickets
    console.log('\n🔍 Searching for open tickets...');
    const searchResults = await zendesk.search('type:ticket status:open', { per_page: 3 });
    console.log(`Found ${searchResults.count} open tickets. Showing first 3:`);
    
    if (searchResults.results && searchResults.results.length > 0) {
      searchResults.results.forEach((ticket, index) => {
        console.log(`${index + 1}. [${ticket.id}] ${ticket.subject}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.response?.status === 401) {
      console.error('🔐 Authentication failed. Please check your credentials in the .env file.');
    } else if (error.response?.status === 403) {
      console.error('🚫 Access forbidden. Please check your API permissions.');
    } else if (error.response?.status === 404) {
      console.error('🔍 Resource not found. Please check your subdomain.');
    }
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { main };