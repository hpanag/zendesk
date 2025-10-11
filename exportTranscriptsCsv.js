const ZendeskClient = require('./src/ZendeskClient');
const fs = require('fs');
const path = require('path');

class TranscriptCsvExporter {
  constructor() {
    this.zendesk = new ZendeskClient();
    this.csvFilePath = path.join(__dirname, 'data', 'transcripts.csv');
  }

  // Escape CSV field (handle commas, quotes, newlines)
  escapeCsvField(field) {
    if (field === null || field === undefined) {
      return '';
    }
    const str = String(field);
    // If field contains comma, quote, or newline, wrap in quotes and escape existing quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  async exportTranscripts() {
    console.log('📝 Exporting last 5000 tickets to CSV...');
    
    try {
      // Verify Zendesk client is properly initialized
      if (!this.zendesk) {
        throw new Error('ZendeskClient not initialized');
      }

      // Test API connection
      try {
        await this.zendesk.makeRequest('GET', '/users/me.json');
        console.log('✅ Successfully connected to Zendesk API');
      } catch (apiError) {
        console.error('❌ Failed to connect to Zendesk API:', apiError.message);
        throw new Error('Zendesk API connection failed');
      }

      // Fetch tickets using incremental API for better performance
      console.log('📥 Fetching tickets...');
      let allTickets = [];
      
      // Start from 30 days ago to get recent tickets
      const startTime = Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60); // 90 days ago
      
      try {
        const response = await this.zendesk.makeRequest('GET', `/incremental/tickets.json?start_time=${startTime}`);
        
        if (response.tickets && response.tickets.length > 0) {
          allTickets = response.tickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          console.log(`  Found ${allTickets.length} tickets in last 90 days`);
        }
      } catch (error) {
        console.log('  Incremental API failed, trying regular API...');
        
        // Fallback to regular pagination
        let page = 1;
        const perPage = 100;

        while (allTickets.length < 5000) {
          const response = await this.zendesk.getTickets({
            page: page,
            per_page: perPage,
            sort_by: 'created_at',
            sort_order: 'desc'
          });

          if (response.tickets && response.tickets.length > 0) {
            allTickets.push(...response.tickets);
            console.log(`  Fetched ${allTickets.length} tickets so far...`);
            
            if (!response.next_page) {
              break;
            }
            page++;
            await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
          } else {
            break;
          }
        }
      }

      // Limit to exactly 5000 tickets
      const tickets = allTickets.slice(0, 5000);
      console.log(`✅ Processing ${tickets.length} tickets`);

      // Create CSV header
      const csvHeaders = [
        'Ticket ID',
        'Subject',
        'Status',
        'Priority',
        'Channel',
        'Created At',
        'Updated At',
        'Requester ID',
        'Assignee ID',
        'Group ID',
        'Organization ID',
        'Number of Comments',
        'Full Transcript'
      ];

      // Open file stream for writing
      const dir = path.dirname(this.csvFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const writeStream = fs.createWriteStream(this.csvFilePath);
      
      // Write header
      writeStream.write(csvHeaders.map(h => this.escapeCsvField(h)).join(',') + '\n');

      // Process each ticket and write to CSV
      console.log('💬 Fetching ticket comments and building CSV...');
      let processedCount = 0;
      let commentsFetchedCount = 0;

      for (const ticket of tickets) {
        try {
          // Get all comments for this ticket
          let comments = [];
          try {
            const commentsResponse = await this.zendesk.makeRequest('GET', `/tickets/${ticket.id}/comments.json`);
            comments = commentsResponse.comments || [];
            commentsFetchedCount++;
          } catch (error) {
            console.error(`  ⚠️ Could not fetch comments for ticket ${ticket.id}:`, error.message);
          }

          // Build full transcript from comments
          const transcript = comments.map((comment, index) => {
            const author = comment.author_id ? `User ${comment.author_id}` : 'Unknown';
            const timestamp = new Date(comment.created_at).toISOString();
            const body = (comment.plain_body || comment.body || '').trim();
            return `[${timestamp}] ${author}: ${body}`;
          }).join('\n\n');

          // Create CSV row
          const row = [
            ticket.id,
            ticket.subject || 'No Subject',
            ticket.status || '',
            ticket.priority || '',
            ticket.via?.channel || 'unknown',
            ticket.created_at || '',
            ticket.updated_at || '',
            ticket.requester_id || '',
            ticket.assignee_id || '',
            ticket.group_id || '',
            ticket.organization_id || '',
            comments.length,
            transcript
          ];

          writeStream.write(row.map(field => this.escapeCsvField(field)).join(',') + '\n');

          processedCount++;
          if (processedCount % 100 === 0) {
            console.log(`  Processed ${processedCount}/${tickets.length} tickets (${commentsFetchedCount} with comments)...`);
          }

          // Rate limiting - only pause if we're fetching comments
          if (comments.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }

        } catch (error) {
          console.error(`  ⚠️ Error processing ticket ${ticket.id}:`, error.message);
        }
      }

      // Close the write stream
      writeStream.end();

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      console.log('✅ All transcripts exported');
      
      const stats = fs.statSync(this.csvFilePath);
      console.log(`💾 CSV saved successfully: ${this.csvFilePath}`);
      console.log(`📊 File size: ${Math.round(stats.size / 1024)} KB`);
      console.log(`📝 Total tickets: ${processedCount}`);
      console.log(`💬 Tickets with comments: ${commentsFetchedCount}`);

      return this.csvFilePath;

    } catch (error) {
      console.error('❌ Error exporting transcripts:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      throw error;
    }
  }
}

// Export the class
module.exports = TranscriptCsvExporter;

// If running directly (not imported as a module), export transcripts
if (require.main === module) {
  const exporter = new TranscriptCsvExporter();
  exporter.exportTranscripts().catch(console.error);
}
