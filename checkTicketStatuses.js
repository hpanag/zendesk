const ZendeskClient = require('./src/ZendeskClient');

class TicketStatusChecker {
  constructor() {
    this.client = new ZendeskClient();
  }

  async checkAllStatuses() {
    console.log('Checking all ticket statuses in Zendesk...\n');
    
    try {
      // Get a large sample of tickets to find all possible statuses
      let allStatuses = new Set();
      let url = '/incremental/tickets.json?start_time=0';
      let ticketCount = 0;
      let pageCount = 0;
      const maxPages = 10; // Limit to avoid too many API calls
      
      while (url && pageCount < maxPages) {
        console.log(`Fetching page ${pageCount + 1}...`);
        const response = await this.client.makeRequest('GET', url);
        
        // Collect all unique statuses
        response.tickets.forEach(ticket => {
          allStatuses.add(ticket.status);
          ticketCount++;
        });
        
        url = response.next_page;
        pageCount++;
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`\n=== TICKET STATUS SUMMARY ===`);
      console.log(`Total tickets checked: ${ticketCount}`);
      console.log(`\nAll unique statuses found:`);
      
      const statusArray = Array.from(allStatuses).sort();
      statusArray.forEach(status => {
        console.log(`  - ${status}`);
      });
      
      // Also check the Zendesk API documentation for ticket fields
      console.log('\n=== CHECKING TICKET FIELD DEFINITIONS ===');
      const fieldsResponse = await this.client.getTicketFields();
      const statusField = fieldsResponse.ticket_fields.find(field => field.type === 'status');
      
      if (statusField && statusField.system_field_options) {
        console.log('\nOfficial status options from Zendesk:');
        statusField.system_field_options.forEach(option => {
          console.log(`  - ${option.name} (value: ${option.value})`);
        });
      }
      
      // Count tickets by status
      console.log('\n=== COUNTING TICKETS BY STATUS ===');
      const statusCounts = {};
      
      url = '/incremental/tickets.json?start_time=0';
      pageCount = 0;
      
      while (url && pageCount < maxPages) {
        const response = await this.client.makeRequest('GET', url);
        
        response.tickets.forEach(ticket => {
          statusCounts[ticket.status] = (statusCounts[ticket.status] || 0) + 1;
        });
        
        url = response.next_page;
        pageCount++;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('\nTicket counts by status:');
      Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([status, count]) => {
          console.log(`  ${status}: ${count} tickets`);
        });
      
    } catch (error) {
      console.error('Error checking ticket statuses:', error.message);
      throw error;
    }
  }
}

// Run the checker
const checker = new TicketStatusChecker();
checker.checkAllStatuses()
  .then(() => {
    console.log('\n✓ Status check complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Failed:', error.message);
    process.exit(1);
  });
