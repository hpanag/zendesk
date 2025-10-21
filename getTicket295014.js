const ZendeskClient = require('./src/ZendeskClient');

async function getTicketWithRating(ticketId) {
  console.log('🎫 TICKET #295014 - COMPLETE DETAILS WITH RATING');
  console.log('='.repeat(80));
  console.log();
  
  const zendesk = new ZendeskClient();
  
  try {
    // Get ticket details
    console.log('📥 Step 1: Fetching ticket information...\n');
    const ticketResponse = await zendesk.makeRequest('GET', `/tickets/${ticketId}.json`);
    const ticket = ticketResponse.ticket;
    
    console.log('═'.repeat(80));
    console.log('📋 TICKET INFORMATION');
    console.log('═'.repeat(80));
    console.log();
    console.log(`Ticket ID:       #${ticket.id}`);
    console.log(`Subject:         ${ticket.subject}`);
    console.log(`Status:          ${ticket.status}`);
    console.log(`Priority:        ${ticket.priority || 'N/A'}`);
    console.log(`Type:            ${ticket.type || 'N/A'}`);
    console.log(`Channel:         ${ticket.via?.channel || 'N/A'}`);
    console.log();
    console.log(`Created:         ${new Date(ticket.created_at).toLocaleString()}`);
    console.log(`Updated:         ${new Date(ticket.updated_at).toLocaleString()}`);
    console.log();
    console.log(`Requester:       ${ticket.requester_id}`);
    console.log(`Assignee:        ${ticket.assignee_id || 'Unassigned'}`);
    console.log(`Group:           ${ticket.group_id || 'N/A'}`);
    console.log();
    console.log(`Tags:            ${ticket.tags.length > 0 ? ticket.tags.join(', ') : 'None'}`);
    console.log();
    
    console.log('Description:');
    console.log('-'.repeat(80));
    console.log(ticket.description || 'No description');
    console.log('-'.repeat(80));
    console.log();
    
    // Get requester info
    console.log('📥 Step 2: Fetching requester information...\n');
    const userResponse = await zendesk.makeRequest('GET', `/users/${ticket.requester_id}.json`);
    const user = userResponse.user;
    
    console.log('═'.repeat(80));
    console.log('👤 REQUESTER INFORMATION');
    console.log('═'.repeat(80));
    console.log();
    console.log(`Name:            ${user.name}`);
    console.log(`Email:           ${user.email}`);
    console.log(`Phone:           ${user.phone || 'N/A'}`);
    console.log(`Role:            ${user.role}`);
    console.log(`Time Zone:       ${user.time_zone || 'N/A'}`);
    console.log(`Locale:          ${user.locale || 'N/A'}`);
    console.log();
    
    // Get satisfaction rating from the ratings API
    console.log('📥 Step 3: Searching for satisfaction rating...\n');
    
    // Search in last 30 days to find the rating
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startTime = Math.floor(thirtyDaysAgo.getTime() / 1000);
    
    const ratingsResponse = await zendesk.makeRequest(
      'GET',
      `/satisfaction_ratings.json?start_time=${startTime}`
    );
    
    const allRatings = ratingsResponse.satisfaction_ratings || [];
    const ticketRating = allRatings.find(r => r.ticket_id.toString() === ticketId.toString());
    
    console.log('═'.repeat(80));
    console.log('⭐ SATISFACTION RATING & SURVEY');
    console.log('═'.repeat(80));
    console.log();
    
    if (ticketRating) {
      console.log('✅ SATISFACTION RATING FOUND!\n');
      
      const scoreEmoji = ticketRating.score === 'good' ? '😊' : 
                         ticketRating.score === 'bad' ? '😞' : 
                         ticketRating.score === 'offered' ? '📤' : '❓';
      
      const scoreText = ticketRating.score === 'good' ? 'GOOD (Satisfied)' :
                       ticketRating.score === 'bad' ? 'BAD (Unsatisfied)' :
                       ticketRating.score === 'offered' ? 'OFFERED (Pending Response)' :
                       ticketRating.score.toUpperCase();
      
      console.log(`Rating ID:       ${ticketRating.id}`);
      console.log(`Score:           ${scoreEmoji} ${scoreText}`);
      console.log();
      console.log(`Ticket ID:       #${ticketRating.ticket_id}`);
      console.log(`Assignee ID:     ${ticketRating.assignee_id || 'N/A'}`);
      console.log(`Group ID:        ${ticketRating.group_id || 'N/A'}`);
      console.log(`Requester ID:    ${ticketRating.requester_id}`);
      console.log();
      console.log(`Created:         ${new Date(ticketRating.created_at).toLocaleString()}`);
      console.log(`Updated:         ${new Date(ticketRating.updated_at).toLocaleString()}`);
      console.log();
      
      if (ticketRating.comment && ticketRating.comment.trim().length > 0) {
        console.log('💬 CUSTOMER SURVEY COMMENT:');
        console.log('═'.repeat(80));
        console.log(ticketRating.comment);
        console.log('═'.repeat(80));
        console.log();
      } else {
        console.log('💬 Customer Survey Comment: (No comment provided)\n');
      }
      
      if (ticketRating.reason) {
        console.log(`📝 Reason Code:   ${ticketRating.reason}`);
        console.log();
      }
      
      console.log(`🔗 Rating URL:    ${ticketRating.url}`);
      console.log();
      
      // Calculate time between ticket closure and rating
      const ticketClosed = new Date(ticket.updated_at);
      const ratingCreated = new Date(ticketRating.created_at);
      const timeDiff = Math.abs(ratingCreated - ticketClosed) / 1000 / 60; // minutes
      
      console.log('⏱️  TIMING ANALYSIS:');
      console.log(`  Ticket Closed:  ${ticketClosed.toLocaleString()}`);
      console.log(`  Rating Created: ${ratingCreated.toLocaleString()}`);
      console.log(`  Time Difference: ${Math.floor(timeDiff)} minutes`);
      console.log();
      
      // Full rating data
      console.log('═'.repeat(80));
      console.log('📄 COMPLETE SATISFACTION RATING DATA (JSON)');
      console.log('═'.repeat(80));
      console.log();
      console.log(JSON.stringify(ticketRating, null, 2));
      console.log();
      
    } else {
      console.log('⚠️  NO SATISFACTION RATING FOUND\n');
      console.log('This ticket either:');
      console.log('  1. Has not been rated by the customer yet');
      console.log('  2. Was not configured to request satisfaction feedback');
      console.log('  3. The rating may be older than 30 days');
      console.log();
      
      console.log(`Searched ${allRatings.length} recent ratings, none matched ticket #${ticketId}`);
      console.log();
    }
    
    // Get ticket comments
    console.log('═'.repeat(80));
    console.log('💬 TICKET CONVERSATION HISTORY');
    console.log('═'.repeat(80));
    console.log();
    
    const commentsResponse = await zendesk.makeRequest('GET', `/tickets/${ticketId}/comments.json`);
    const comments = commentsResponse.comments;
    
    console.log(`Total Comments/Updates: ${comments.length}\n`);
    
    comments.forEach((comment, index) => {
      const commentDate = new Date(comment.created_at);
      console.log(`─── Comment #${index + 1} ───`);
      console.log(`Date:    ${commentDate.toLocaleString()}`);
      console.log(`Author:  User ID ${comment.author_id}`);
      console.log(`Type:    ${comment.public ? 'Public Comment' : 'Internal Note'}`);
      console.log();
      console.log('Message:');
      console.log(comment.body);
      console.log();
      
      if (comment.attachments && comment.attachments.length > 0) {
        console.log(`Attachments (${comment.attachments.length}):`);
        comment.attachments.forEach(att => {
          console.log(`  📎 ${att.file_name} (${(att.size / 1024).toFixed(2)} KB)`);
        });
        console.log();
      }
    });
    
    // Export everything
    const fs = require('fs');
    const path = require('path');
    
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const exportData = {
      ticket: ticket,
      requester: user,
      comments: comments,
      satisfactionRating: ticketRating || null,
      generatedAt: new Date().toISOString()
    };
    
    const filename = `ticket_${ticketId}_complete.json`;
    const filepath = path.join(reportDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
    
    console.log('═'.repeat(80));
    console.log('💾 EXPORT COMPLETE');
    console.log('═'.repeat(80));
    console.log();
    console.log(`✅ Complete data exported to: ${filepath}`);
    console.log(`   File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    console.log();
    
    // Summary
    console.log('═'.repeat(80));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(80));
    console.log();
    console.log(`Ticket:          #${ticket.id} - ${ticket.subject}`);
    console.log(`Customer:        ${user.name} (${user.email})`);
    console.log(`Status:          ${ticket.status}`);
    console.log(`Channel:         ${ticket.via?.channel || 'N/A'}`);
    console.log(`Comments:        ${comments.length}`);
    
    if (ticketRating) {
      const scoreEmoji = ticketRating.score === 'good' ? '😊' : 
                         ticketRating.score === 'bad' ? '😞' : '📤';
      console.log(`Rating:          ${scoreEmoji} ${ticketRating.score.toUpperCase()}`);
      if (ticketRating.comment) {
        console.log(`Has Comment:     YES`);
      }
    } else {
      console.log(`Rating:          No rating found`);
    }
    console.log();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

module.exports = getTicketWithRating;

if (require.main === module) {
  const ticketId = process.argv[2] || '295014';
  getTicketWithRating(ticketId).catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exitCode = 1;
  });
}
