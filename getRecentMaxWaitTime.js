const ZendeskClient = require('./src/ZendeskClient');

class RecentMaxWaitTime {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async getMaxWaitTime(daysBack = 1) {
    console.log('🔍 FINDING MAXIMUM WAIT TIME BEFORE ANSWER');
    console.log('='.repeat(60));
    
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysBack);
    targetDate.setHours(0, 0, 0, 0);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    console.log(`📅 Analyzing: ${targetDate.toDateString()}`);
    console.log(`🎯 Goal: Find maximum wait time for answered calls\n`);

    try {
      // Get voice tickets from the target date
      console.log(`📞 Fetching voice tickets from ${dateStr}...`);
      const response = await this.zendesk.search(
        `type:ticket channel:voice created>${dateStr}`,
        {
          per_page: 100,
          sort_by: 'created_at',
          sort_order: 'desc'
        }
      );

      const tickets = response.results || [];
      console.log(`✅ Found ${tickets.length} voice tickets\n`);

      if (tickets.length === 0) {
        console.log('⚠️  No voice tickets found for this period');
        // Try current queue
        await this.checkCurrentQueue();
        return;
      }

      // Filter for answered calls (exclude abandoned)
      const answeredCalls = tickets.filter(ticket => {
        const desc = (ticket.description || '').toLowerCase();
        const subject = (ticket.subject || '').toLowerCase();
        
        // Exclude abandoned calls
        if (desc.includes('abandoned') || subject.includes('abandoned')) {
          return false;
        }
        
        // Must have assignee (was answered by agent)
        if (!ticket.assignee_id) {
          return false;
        }
        
        // Check for duration > 30s (abandoned calls are usually < 30s)
        const durationMatch = desc.match(/duration[:\s]*(\d+(?:\.\d+)?)\s*(sec|second|min|minute)?/i);
        if (durationMatch) {
          const duration = parseFloat(durationMatch[1]);
          const unit = durationMatch[2]?.toLowerCase() || 'sec';
          const durationInSeconds = unit.includes('min') ? duration * 60 : duration;
          
          if (durationInSeconds <= 30) {
            return false; // Likely abandoned
          }
        }
        
        return true;
      });

      console.log(`📊 Answered calls (excluding abandoned): ${answeredCalls.length}\n`);

      if (answeredCalls.length === 0) {
        console.log('⚠️  No answered calls found');
        await this.checkCurrentQueue();
        return;
      }

      // Extract wait times
      let waitTimes = [];

      answeredCalls.forEach(ticket => {
        const desc = ticket.description || '';
        const customFields = ticket.custom_fields || [];
        
        // Check custom fields
        customFields.forEach(field => {
          if (field.value) {
            const fieldName = field.id.toString().toLowerCase();
            const value = parseFloat(field.value);
            
            if ((fieldName.includes('wait') || fieldName.includes('queue')) && 
                !isNaN(value) && value > 0 && value < 7200) {
              waitTimes.push({
                ticketId: ticket.id,
                waitTime: value,
                source: `field_${field.id}`,
                subject: ticket.subject,
                createdAt: ticket.created_at
              });
            }
          }
        });

        // Parse from description
        const waitPatterns = [
          /wait(?:ed|ing)?\s*(?:time)?[:\s]*(\d+(?:\.\d+)?)\s*(sec|second|min|minute|s|m)/i,
          /queue(?:d)?\s*(?:time)?[:\s]*(\d+(?:\.\d+)?)\s*(sec|second|min|minute|s|m)/i,
          /time\s*(?:in|to)\s*(?:queue|answer)[:\s]*(\d+(?:\.\d+)?)\s*(sec|second|min|minute|s|m)/i
        ];

        waitPatterns.forEach(pattern => {
          const match = desc.match(pattern);
          if (match) {
            const value = parseFloat(match[1]);
            const unit = match[2]?.toLowerCase() || 'sec';
            const waitTimeSeconds = unit.includes('min') ? value * 60 : value;
            
            if (waitTimeSeconds > 0 && waitTimeSeconds < 7200) {
              waitTimes.push({
                ticketId: ticket.id,
                waitTime: waitTimeSeconds,
                source: 'description',
                subject: ticket.subject,
                createdAt: ticket.created_at
              });
            }
          }
        });

        // Calculate from timestamps
        if (ticket.assignee_id && ticket.updated_at && ticket.created_at) {
          const created = new Date(ticket.created_at);
          const updated = new Date(ticket.updated_at);
          const waitTimeSeconds = (updated - created) / 1000;
          
          if (waitTimeSeconds >= 5 && waitTimeSeconds <= 1800) {
            waitTimes.push({
              ticketId: ticket.id,
              waitTime: waitTimeSeconds,
              source: 'timestamp',
              subject: ticket.subject,
              createdAt: ticket.created_at
            });
          }
        }
      });

      // Deduplicate by ticket ID (keep longest wait per ticket)
      const waitByTicket = {};
      waitTimes.forEach(wt => {
        if (!waitByTicket[wt.ticketId] || wt.waitTime > waitByTicket[wt.ticketId].waitTime) {
          waitByTicket[wt.ticketId] = wt;
        }
      });
      
      waitTimes = Object.values(waitByTicket);

      console.log(`⏱️  Wait times captured: ${waitTimes.length}\n`);

      if (waitTimes.length === 0) {
        console.log('⚠️  No wait time data available in tickets');
        await this.checkCurrentQueue();
        return;
      }

      // Find maximum
      const maxWait = waitTimes.reduce((max, wt) => wt.waitTime > max.waitTime ? wt : max);
      const avgWaitTime = waitTimes.reduce((sum, wt) => sum + wt.waitTime, 0) / waitTimes.length;
      const sortedWaitTimes = waitTimes.sort((a, b) => b.waitTime - a.waitTime);

      // Display results
      console.log('📈 WAIT TIME STATISTICS');
      console.log('='.repeat(60));
      console.log(`\n🔴 MAXIMUM WAIT TIME: ${Math.round(maxWait.waitTime / 60 * 100) / 100} minutes (${Math.round(maxWait.waitTime)} seconds)`);
      console.log(`   Ticket: #${maxWait.ticketId}`);
      console.log(`   Subject: ${maxWait.subject}`);
      console.log(`   Created: ${new Date(maxWait.createdAt).toLocaleString()}`);
      console.log(`   Source: ${maxWait.source}`);
      
      console.log(`\n📊 Average wait time: ${Math.round(avgWaitTime / 60 * 100) / 100} minutes`);
      console.log(`📋 Answered calls analyzed: ${answeredCalls.length}`);
      console.log(`⏱️  Calls with wait data: ${waitTimes.length}`);
      
      console.log('\n🔝 TOP 10 LONGEST WAIT TIMES:');
      sortedWaitTimes.slice(0, 10).forEach((wt, index) => {
        const waitMins = Math.round(wt.waitTime / 60 * 100) / 100;
        const time = new Date(wt.createdAt).toLocaleTimeString();
        console.log(`   ${index + 1}. ${waitMins} min - Ticket #${wt.ticketId} at ${time}`);
      });

      // Check current queue
      await this.checkCurrentQueue();

    } catch (error) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }

  async checkCurrentQueue() {
    console.log('\n📊 CURRENT QUEUE STATUS:');
    console.log('-'.repeat(60));
    try {
      const queueResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
      const queueStats = queueResponse.current_queue_activity;
      
      console.log(`   Calls currently waiting: ${queueStats.calls_waiting}`);
      console.log(`   Current average wait: ${Math.round(queueStats.average_wait_time / 60 * 100) / 100} minutes`);
      console.log(`   Current longest wait: ${Math.round(queueStats.longest_wait_time / 60 * 100) / 100} minutes`);
      console.log(`   Callbacks waiting: ${queueStats.callbacks_waiting}`);
      
      if (queueStats.longest_wait_time > 300) {
        console.log(`\n⚠️  WARNING: Someone has been waiting ${Math.round(queueStats.longest_wait_time / 60)} minutes!`);
      }
    } catch (error) {
      console.log('   ⚠️  Could not fetch current queue stats');
    }
  }
}

async function main() {
  const analyzer = new RecentMaxWaitTime();
  
  // Check today first
  console.log('Checking today (October 15, 2025)...\n');
  await analyzer.getMaxWaitTime(0);
  
  // If no data today, check yesterday
  console.log('\n\n' + '='.repeat(60));
  console.log('If no data above, checking yesterday (October 14, 2025)...\n');
  await analyzer.getMaxWaitTime(1);
}

main();
