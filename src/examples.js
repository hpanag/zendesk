const ZendeskClient = require('./ZendeskClient');

// Example functions demonstrating various Zendesk API operations

async function createTicketExample() {
  const zendesk = new ZendeskClient();
  
  const ticketData = {
    subject: 'Test ticket from Node.js API',
    comment: {
      body: 'This is a test ticket created via the Zendesk API using Node.js'
    },
    priority: 'normal',
    type: 'question',
    status: 'new'
  };
  
  try {
    const result = await zendesk.createTicket(ticketData);
    console.log('✅ Ticket created successfully:', result.ticket.id);
    return result.ticket;
  } catch (error) {
    console.error('❌ Failed to create ticket:', error.message);
    throw error;
  }
}

async function updateTicketExample(ticketId) {
  const zendesk = new ZendeskClient();
  
  const updateData = {
    status: 'solved',
    comment: {
      body: 'This ticket has been resolved via API',
      public: true
    }
  };
  
  try {
    const result = await zendesk.updateTicket(ticketId, updateData);
    console.log('✅ Ticket updated successfully:', result.ticket.id);
    return result.ticket;
  } catch (error) {
    console.error('❌ Failed to update ticket:', error.message);
    throw error;
  }
}

async function createUserExample() {
  const zendesk = new ZendeskClient();
  
  const userData = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'end-user'
  };
  
  try {
    const result = await zendesk.createUser(userData);
    console.log('✅ User created successfully:', result.user.id);
    return result.user;
  } catch (error) {
    console.error('❌ Failed to create user:', error.message);
    throw error;
  }
}

async function searchTicketsExample() {
  const zendesk = new ZendeskClient();
  
  // Search for tickets created in the last 7 days
  const query = 'type:ticket created>7days_ago';
  
  try {
    const results = await zendesk.search(query, { sort_by: 'created_at', sort_order: 'desc' });
    console.log(`🔍 Found ${results.count} tickets created in the last 7 days`);
    
    results.results.forEach((ticket, index) => {
      console.log(`${index + 1}. [${ticket.id}] ${ticket.subject} (${ticket.created_at})`);
    });
    
    return results;
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    throw error;
  }
}

async function getOrganizationsExample() {
  const zendesk = new ZendeskClient();
  
  try {
    const result = await zendesk.getOrganizations();
    console.log(`🏢 Found ${result.count} organizations`);
    
    result.organizations.forEach((org, index) => {
      console.log(`${index + 1}. [${org.id}] ${org.name}`);
    });
    
    return result;
  } catch (error) {
    console.error('❌ Failed to get organizations:', error.message);
    throw error;
  }
}

async function getTicketFieldsExample() {
  const zendesk = new ZendeskClient();
  
  try {
    const result = await zendesk.getTicketFields();
    console.log(`📝 Found ${result.ticket_fields.length} ticket fields`);
    
    result.ticket_fields.forEach((field, index) => {
      console.log(`${index + 1}. [${field.id}] ${field.title} (${field.type})`);
    });
    
    return result;
  } catch (error) {
    console.error('❌ Failed to get ticket fields:', error.message);
    throw error;
  }
}

module.exports = {
  createTicketExample,
  updateTicketExample,
  createUserExample,
  searchTicketsExample,
  getOrganizationsExample,
  getTicketFieldsExample
};