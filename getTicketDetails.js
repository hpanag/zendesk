const ZendeskClient = require('./src/ZendeskClient');

async function getTicketDetails(ticketId) {
  console.log('🎫 TICKET DETAILS RETRIEVAL');
  console.log('='.repeat(80));
  console.log(`Ticket ID: #${ticketId}`);
  console.log('='.repeat(80));
  console.log();
  
  const zendesk = new ZendeskClient();
  
  try {
    // Get ticket details
    console.log('📥 Fetching ticket information...\n');
    const ticketResponse = await zendesk.makeRequest('GET', `/tickets/${ticketId}.json`);
    const ticket = ticketResponse.ticket;
    
    console.log('═'.repeat(80));
    console.log('📋 TICKET INFORMATION');
    console.log('═'.repeat(80));
    console.log();
    console.log(`ID:              #${ticket.id}`);
    console.log(`Subject:         ${ticket.subject}`);
    console.log(`Status:          ${ticket.status}`);
    console.log(`Priority:        ${ticket.priority || 'N/A'}`);
    console.log(`Type:            ${ticket.type || 'N/A'}`);
    console.log(`Channel:         ${ticket.via?.channel || 'N/A'}`);
    console.log();
    console.log(`Created:         ${new Date(ticket.created_at).toLocaleString()}`);
    console.log(`Updated:         ${new Date(ticket.updated_at).toLocaleString()}`);
    console.log();
    console.log(`Requester ID:    ${ticket.requester_id}`);
    console.log(`Assignee ID:     ${ticket.assignee_id || 'Unassigned'}`);
    console.log(`Group ID:        ${ticket.group_id || 'N/A'}`);
    console.log();
    console.log(`Tags:            ${ticket.tags.length > 0 ? ticket.tags.join(', ') : 'None'}`);
    console.log();
    
    if (ticket.description) {
      console.log('Description:');
      console.log('-'.repeat(80));
      console.log(ticket.description);
      console.log('-'.repeat(80));
      console.log();
    }
    
    // Get ticket comments/conversations
    console.log('═'.repeat(80));
    console.log('💬 TICKET COMMENTS');
    console.log('═'.repeat(80));
    console.log();
    
    const commentsResponse = await zendesk.makeRequest('GET', `/tickets/${ticketId}/comments.json`);
    const comments = commentsResponse.comments;
    
    console.log(`Total Comments: ${comments.length}\n`);
    
    comments.forEach((comment, index) => {
      console.log(`Comment #${index + 1}:`);
      console.log(`  Author ID:  ${comment.author_id}`);
      console.log(`  Created:    ${new Date(comment.created_at).toLocaleString()}`);
      console.log(`  Public:     ${comment.public ? 'Yes' : 'No (Internal Note)'}`);
      console.log(`  Body:`);
      console.log('-'.repeat(80));
      console.log(comment.body);
      console.log('-'.repeat(80));
      console.log();
      
      if (comment.attachments && comment.attachments.length > 0) {
        console.log(`  Attachments (${comment.attachments.length}):`);
        comment.attachments.forEach(att => {
          console.log(`    - ${att.file_name} (${att.content_type}, ${(att.size / 1024).toFixed(2)} KB)`);
        });
        console.log();
      }
    });
    
    // Get satisfaction rating
    console.log('═'.repeat(80));
    console.log('⭐ SATISFACTION RATING');
    console.log('═'.repeat(80));
    console.log();
    
    try {
      // Try to get the satisfaction rating for this ticket
      const satisfactionResponse = await zendesk.makeRequest(
        'GET', 
        `/tickets/${ticketId}/satisfaction_rating.json`
      );
      
      const rating = satisfactionResponse.satisfaction_rating;
      
      if (rating) {
        console.log('✅ SATISFACTION RATING FOUND\n');
        console.log(`Rating ID:       ${rating.id}`);
        console.log(`Score:           ${rating.score === 'good' ? '😊 GOOD (Satisfied)' : rating.score === 'bad' ? '😞 BAD (Unsatisfied)' : rating.score.toUpperCase()}`);
        console.log(`Ticket ID:       #${rating.ticket_id}`);
        console.log();
        console.log(`Assignee ID:     ${rating.assignee_id}`);
        console.log(`Group ID:        ${rating.group_id}`);
        console.log(`Requester ID:    ${rating.requester_id}`);
        console.log();
        console.log(`Created:         ${new Date(rating.created_at).toLocaleString()}`);
        console.log(`Updated:         ${new Date(rating.updated_at).toLocaleString()}`);
        console.log();
        
        if (rating.comment && rating.comment.trim().length > 0) {
          console.log('💬 CUSTOMER COMMENT:');
          console.log('-'.repeat(80));
          console.log(rating.comment);
          console.log('-'.repeat(80));
          console.log();
        } else {
          console.log('💬 Customer Comment: (No comment provided)\n');
        }
        
        if (rating.reason) {
          console.log(`📝 Reason:        ${rating.reason}`);
          console.log();
        }
        
        console.log(`🔗 Rating URL:    ${rating.url}`);
        console.log();
        
        // Full JSON for reference
        console.log('═'.repeat(80));
        console.log('📄 COMPLETE SATISFACTION RATING DATA (JSON)');
        console.log('═'.repeat(80));
        console.log();
        console.log(JSON.stringify(rating, null, 2));
        console.log();
        
      } else {
        console.log('⚠️  No satisfaction rating data found for this ticket.\n');
      }
      
    } catch (ratingError) {
      if (ratingError.response?.status === 404) {
        console.log('⚠️  NO SATISFACTION RATING FOUND\n');
        console.log('This ticket either:');
        console.log('  1. Has not been rated by the customer yet');
        console.log('  2. Was not configured to request satisfaction feedback');
        console.log('  3. The rating request is still pending');
        console.log();
      } else {
        console.log(`❌ Error fetching satisfaction rating: ${ratingError.message}\n`);
      }
    }
    
    // Get user details
    console.log('═'.repeat(80));
    console.log('👤 REQUESTER INFORMATION');
    console.log('═'.repeat(80));
    console.log();
    
    try {
      const userResponse = await zendesk.makeRequest('GET', `/users/${ticket.requester_id}.json`);
      const user = userResponse.user;
      
      console.log(`Name:            ${user.name}`);
      console.log(`Email:           ${user.email}`);
      console.log(`Phone:           ${user.phone || 'N/A'}`);
      console.log(`Role:            ${user.role}`);
      console.log(`Time Zone:       ${user.time_zone || 'N/A'}`);
      console.log(`Locale:          ${user.locale || 'N/A'}`);
      console.log(`Created:         ${new Date(user.created_at).toLocaleString()}`);
      console.log(`Last Login:      ${user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}`);
      console.log();
      
      if (user.user_fields && Object.keys(user.user_fields).length > 0) {
        console.log('Custom Fields:');
        Object.entries(user.user_fields).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
        console.log();
      }
      
    } catch (userError) {
      console.log(`❌ Error fetching user details: ${userError.message}\n`);
    }
    
    // Get assignee details if assigned
    if (ticket.assignee_id) {
      console.log('═'.repeat(80));
      console.log('👨‍💼 ASSIGNEE INFORMATION');
      console.log('═'.repeat(80));
      console.log();
      
      try {
        const assigneeResponse = await zendesk.makeRequest('GET', `/users/${ticket.assignee_id}.json`);
        const assignee = assigneeResponse.user;
        
        console.log(`Name:            ${assignee.name}`);
        console.log(`Email:           ${assignee.email}`);
        console.log(`Role:            ${assignee.role}`);
        console.log(`Time Zone:       ${assignee.time_zone || 'N/A'}`);
        console.log();
        
      } catch (assigneeError) {
        console.log(`❌ Error fetching assignee details: ${assigneeError.message}\n`);
      }
    }
    
    // Export complete data
    const fs = require('fs');
    const path = require('path');
    
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const exportData = {
      ticket: ticket,
      comments: comments,
      satisfactionRating: null,
      generatedAt: new Date().toISOString()
    };
    
    // Try to add satisfaction rating to export
    try {
      const satisfactionResponse = await zendesk.makeRequest(
        'GET', 
        `/tickets/${ticketId}/satisfaction_rating.json`
      );
      exportData.satisfactionRating = satisfactionResponse.satisfaction_rating;
    } catch (e) {
      // Rating not available
    }
    
    const filename = `ticket_${ticketId}_details.json`;
    const filepath = path.join(reportDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
    
    console.log('═'.repeat(80));
    console.log('💾 EXPORT COMPLETE');
    console.log('═'.repeat(80));
    console.log();
    console.log(`✅ Complete ticket data exported to: ${filepath}`);
    console.log(`   File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    console.log();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.status === 404) {
      console.error(`\n⚠️  Ticket #${ticketId} not found.`);
    }
    console.error(error.stack);
  }
}

// Get ticket ID from command line or use default
const ticketId = process.argv[2] || '295014';
getTicketDetails(ticketId);
