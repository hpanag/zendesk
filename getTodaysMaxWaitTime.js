const ZendeskClient = require('./src/ZendeskClient');

class TodayMaxWaitTime {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async getMaxWaitTime() {
    console.log('🔍 FINDING TODAY\'S MAX WAIT TIME BEFORE ANSWER');
    console.log('='.repeat(60));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    console.log(`📅 Date: ${today.toDateString()}`);
    console.log(`🎯 Goal: Find maximum wait time for answered calls\n`);

    try {
      // Get today's voice tickets that were answered (not abandoned)
      console.log('📞 Fetching today\'s answered voice tickets...');
      const response = await this.zendesk.search(
        `type:ticket channel:voice created>${todayStr}`,
        {
          per_page: 100,
          sort_by: 'created_at',
          sort_order: 'desc'
        }
      );

      const tickets = response.results || [];
      console.log(`✅ Found ${tickets.length} voice tickets created today\n`);

      if (tickets.length === 0) {
        console.log('⚠️  No voice tickets found for today yet');
        return;
      }

      // Filter for answered calls (exclude abandoned)
      const answeredCalls = tickets.filter(ticket => {
        const desc = (ticket.description || '').toLowerCase();
        const subject = (ticket.subject || '').toLowerCase();
        const via = ticket.via?.channel?.name?.toLowerCase() || '';
        
        // Exclude abandoned calls
        if (desc.includes('abandoned') || subject.includes('abandoned')) {
          return false;
        }
        
        // Must have assignee (was answered by agent)
        if (!ticket.assignee_id) {
          return false;
        }
        
        // Try to determine if it was answered
        // Check for duration > 30s (abandoned calls are usually < 30s)
        const durationMatch = desc.match(/duration[:\s]*(\d+(?:\.\d+)?)\s*(sec|second|min|minute)?/i);
        if (durationMatch) {
          const duration = parseFloat(durationMatch[1]);
          const unit = durationMatch[2]?.toLowerCase() || 'sec';
          const durationInSeconds = unit.includes('min') ? duration * 60 : duration;
          
          // If call was > 30 seconds, likely answered
          if (durationInSeconds > 30) {
            return true;
          }
        }
        
        // If has status update/assignee, likely answered
        if (ticket.assignee_id && ticket.status !== 'new') {
          return true;
        }
        
        return true; // Include by default
      });

      console.log(`📊 Answered calls (excluding abandoned): ${answeredCalls.length}\n`);

      if (answeredCalls.length === 0) {
        console.log('⚠️  No answered calls found for today yet');
        return;
      }

      // Extract wait times from tickets
      let waitTimes = [];
      let maxWaitTime = 0;
      let maxWaitTicket = null;

      answeredCalls.forEach(ticket => {
        const desc = ticket.description || '';
        const customFields = ticket.custom_fields || [];
        
        // Method 1: Check custom fields for wait time
        customFields.forEach(field => {
          if (field.value) {
            const fieldName = field.id.toString().toLowerCase();
            const value = parseFloat(field.value);
            
            if ((fieldName.includes('wait') || fieldName.includes('queue')) && 
                !isNaN(value) && value > 0 && value < 7200) { // Max 2 hours
              waitTimes.push({
                ticketId: ticket.id,
                waitTime: value,
                source: `custom_field_${field.id}`,
                subject: ticket.subject
              });
            }
          }
        });

        // Method 2: Parse wait time from description
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
                source: 'description_pattern',
                subject: ticket.subject
              });
            }
          }
        });

        // Method 3: Calculate from timestamps (created to first update by agent)
        if (ticket.assignee_id && ticket.updated_at) {
          const created = new Date(ticket.created_at);
          const updated = new Date(ticket.updated_at);
          const waitTimeSeconds = (updated - created) / 1000;
          
          // Only use if reasonable (between 5 seconds and 30 minutes)
          if (waitTimeSeconds >= 5 && waitTimeSeconds <= 1800) {
            waitTimes.push({
              ticketId: ticket.id,
              waitTime: waitTimeSeconds,
              source: 'timestamp_calculation',
              subject: ticket.subject
            });
          }
        }
      });

      console.log(`⏱️  Wait times extracted: ${waitTimes.length}\n`);

      if (waitTimes.length === 0) {
        console.log('⚠️  No wait time data available in tickets');
        console.log('💡 Checking real-time queue for current wait times...\n');
        
        // Fallback: Check current queue stats
        try {
          const queueResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
          const queueStats = queueResponse.current_queue_activity;
          
          if (queueStats && queueStats.longest_wait_time > 0) {
            console.log('📊 CURRENT QUEUE WAIT TIMES (Real-time):');
            console.log(`   Calls waiting: ${queueStats.calls_waiting}`);
            console.log(`   Average wait: ${Math.round(queueStats.average_wait_time / 60 * 100) / 100} minutes`);
            console.log(`   Longest wait RIGHT NOW: ${Math.round(queueStats.longest_wait_time / 60 * 100) / 100} minutes`);
            console.log('\n⚠️  Note: This is current queue data, not historical max for today');
          }
        } catch (queueError) {
          console.log('❌ Could not fetch current queue stats');
        }
        
        return;
      }

      // Find maximum wait time
      waitTimes.forEach(wt => {
        if (wt.waitTime > maxWaitTime) {
          maxWaitTime = wt.waitTime;
          maxWaitTicket = wt;
        }
      });

      // Calculate statistics
      const avgWaitTime = waitTimes.reduce((sum, wt) => sum + wt.waitTime, 0) / waitTimes.length;
      const sortedWaitTimes = waitTimes.sort((a, b) => b.waitTime - a.waitTime);

      // Display results
      console.log('📈 TODAY\'S WAIT TIME STATISTICS');
      console.log('='.repeat(60));
      console.log(`\n🔴 MAXIMUM WAIT TIME: ${Math.round(maxWaitTime / 60 * 100) / 100} minutes (${Math.round(maxWaitTime)} seconds)`);
      console.log(`   Ticket: #${maxWaitTicket.ticketId}`);
      console.log(`   Subject: ${maxWaitTicket.subject}`);
      console.log(`   Source: ${maxWaitTicket.source}`);
      
      console.log(`\n📊 Average wait time: ${Math.round(avgWaitTime / 60 * 100) / 100} minutes`);
      console.log(`📋 Total answered calls analyzed: ${answeredCalls.length}`);
      console.log(`⏱️  Wait times captured: ${waitTimes.length}`);
      
      // Show top 5 longest wait times
      console.log('\n🔝 TOP 5 LONGEST WAIT TIMES:');
      sortedWaitTimes.slice(0, 5).forEach((wt, index) => {
        console.log(`   ${index + 1}. Ticket #${wt.ticketId}: ${Math.round(wt.waitTime / 60 * 100) / 100} minutes`);
        console.log(`      Subject: ${wt.subject.substring(0, 60)}...`);
      });

      // Check current queue as well
      console.log('\n📊 CURRENT QUEUE STATUS:');
      try {
        const queueResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
        const queueStats = queueResponse.current_queue_activity;
        
        console.log(`   Calls currently waiting: ${queueStats.calls_waiting}`);
        console.log(`   Current average wait: ${Math.round(queueStats.average_wait_time / 60 * 100) / 100} minutes`);
        console.log(`   Current longest wait: ${Math.round(queueStats.longest_wait_time / 60 * 100) / 100} minutes`);
        
        if (queueStats.longest_wait_time > maxWaitTime) {
          console.log(`\n⚠️  WARNING: Current queue has longer wait (${Math.round(queueStats.longest_wait_time / 60 * 100) / 100} min) than today's max answered call!`);
        }
      } catch (queueError) {
        console.log('   ⚠️  Could not fetch current queue stats');
      }

      console.log('\n' + '='.repeat(60));
      console.log('✅ Analysis complete');

    } catch (error) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }
}

async function main() {
  const analyzer = new TodayMaxWaitTime();
  await analyzer.getMaxWaitTime();
}

module.exports = TodayMaxWaitTime;

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exitCode = 1;
  });
}
