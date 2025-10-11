const ZendeskClient = require('./src/ZendeskClient');
const fs = require('fs');
const path = require('path');

class TranscriptCollector {
  constructor() {
    this.zendesk = new ZendeskClient();
    this.transcripts = {
      web: [],
      voice: [],
      email: []
    };
    this.dataFilePath = path.join(__dirname, 'data', 'transcripts.json');
  }

  async collectTranscripts() {
    console.log('📝 Collecting transcripts for last 100 tickets...');
    
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

      // Fetch last 100 tickets with comments
      console.log('📥 Fetching tickets...');
      let allTickets = [];
      let page = 1;
      const perPage = 100;

      while (allTickets.length < 100) {
        const response = await this.zendesk.getTickets({
          page: page,
          per_page: perPage,
          sort_by: 'created_at',
          sort_order: 'desc'
        });

        if (response.tickets && response.tickets.length > 0) {
          allTickets.push(...response.tickets);
          console.log(`  Fetched ${allTickets.length} tickets so far...`);
          
          if (allTickets.length >= 100 || !response.next_page) {
            break;
          }
          page++;
          await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
        } else {
          break;
        }
      }

      // Limit to exactly 100 tickets
      const tickets = allTickets.slice(0, 100);
      console.log(`✅ Collected ${tickets.length} tickets`);

      // Process each ticket to get its transcript
      console.log('💬 Fetching ticket comments and building transcripts...');
      let processedCount = 0;

      for (const ticket of tickets) {
        try {
          // Get all comments for this ticket
          const commentsResponse = await this.zendesk.makeRequest('GET', `/tickets/${ticket.id}/comments.json`);
          const comments = commentsResponse.comments || [];

          // Build transcript from comments
          const transcript = {
            ticketId: ticket.id,
            subject: ticket.subject || 'No Subject',
            createdAt: ticket.created_at,
            updatedAt: ticket.updated_at,
            status: ticket.status,
            priority: ticket.priority,
            channel: ticket.via?.channel || 'unknown',
            requesterName: ticket.requester_id ? `User ${ticket.requester_id}` : 'Unknown',
            messages: comments.map(comment => ({
              id: comment.id,
              authorId: comment.author_id,
              body: comment.body || '',
              htmlBody: comment.html_body || '',
              plainBody: comment.plain_body || comment.body || '',
              public: comment.public,
              createdAt: comment.created_at,
              attachments: comment.attachments?.map(att => ({
                id: att.id,
                fileName: att.file_name,
                contentType: att.content_type,
                size: att.size
              })) || []
            }))
          };

          // Categorize by channel
          const channel = ticket.via?.channel || 'unknown';
          
          if (channel === 'web' || channel === 'api' || channel === 'chat') {
            this.transcripts.web.push(transcript);
          } else if (channel === 'voice') {
            this.transcripts.voice.push(transcript);
          } else if (channel === 'email') {
            this.transcripts.email.push(transcript);
          } else {
            // Default to web for unknown channels
            this.transcripts.web.push(transcript);
          }

          processedCount++;
          if (processedCount % 10 === 0) {
            console.log(`  Processed ${processedCount}/${tickets.length} tickets...`);
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`  ⚠️ Error processing ticket ${ticket.id}:`, error.message);
        }
      }

      console.log('✅ All transcripts collected');
      console.log(`   📊 Web: ${this.transcripts.web.length} tickets`);
      console.log(`   📞 Voice: ${this.transcripts.voice.length} tickets`);
      console.log(`   📧 Email: ${this.transcripts.email.length} tickets`);

      // Save to file
      await this.saveTranscripts();

      return this.transcripts;

    } catch (error) {
      console.error('❌ Error collecting transcripts:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      throw error;
    }
  }

  async saveTranscripts() {
    try {
      console.log(`💾 Saving transcripts to ${this.dataFilePath}...`);

      // Ensure directory exists
      const dir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dir)) {
        console.log(`📁 Creating directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      const data = {
        metadata: {
          version: "1.0.0",
          generatedAt: new Date().toISOString(),
          description: "Transcripts from last 100 Zendesk tickets",
          totalTickets: this.transcripts.web.length + this.transcripts.voice.length + this.transcripts.email.length,
          breakdown: {
            web: this.transcripts.web.length,
            voice: this.transcripts.voice.length,
            email: this.transcripts.email.length
          }
        },
        transcripts: this.transcripts
      };

      fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2));

      // Verify file was written
      if (!fs.existsSync(this.dataFilePath)) {
        throw new Error('File was not created successfully');
      }

      const stats = fs.statSync(this.dataFilePath);
      console.log(`✅ Transcripts saved successfully (${Math.round(stats.size / 1024)} KB)`);
    } catch (error) {
      console.error('❌ Error saving transcripts:', error.message);
      if (error.code) {
        console.error('File system error code:', error.code);
      }
      throw error;
    }
  }
}

// Export the class
module.exports = TranscriptCollector;

// If running directly (not imported as a module), collect transcripts
if (require.main === module) {
  const collector = new TranscriptCollector();
  collector.collectTranscripts().catch(console.error);
}
