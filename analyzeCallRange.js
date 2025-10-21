const ZendeskClient = require('./src/ZendeskClient');

class CallRangeAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async analyzeCallRange(startDate, endDate) {
    console.log('📞 CALL RANGE ANALYSIS');
    console.log('='.repeat(60));
    console.log(`📅 Period: ${startDate.toLocaleString()} to ${endDate.toLocaleString()}`);
    console.log('='.repeat(60));
    console.log();

    try {
      // Format dates for Zendesk search
      const startStr = startDate.toISOString().split('.')[0] + 'Z';
      const endStr = endDate.toISOString().split('.')[0] + 'Z';

      console.log('🔍 Fetching all voice tickets in date range...');
      
      // Get all voice tickets in the range
      let allTickets = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.zendesk.search(
          `type:ticket channel:voice created>=${startStr} created<=${endStr}`,
          {
            per_page: 100,
            page: page,
            sort_by: 'created_at',
            sort_order: 'asc'
          }
        );

        const tickets = response.results || [];
        allTickets = allTickets.concat(tickets);
        
        console.log(`   Page ${page}: Found ${tickets.length} tickets (Total so far: ${allTickets.length})`);

        // Check if there are more pages
        if (tickets.length < 100) {
          hasMore = false;
        } else {
          page++;
          // Respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Safety limit
        if (page > 50) {
          console.log('   ⚠️  Reached page limit, stopping pagination');
          break;
        }
      }

      console.log(`\n✅ Total tickets fetched: ${allTickets.length}\n`);

      if (allTickets.length === 0) {
        console.log('❌ No voice tickets found in this date range');
        return;
      }

      // Classify tickets
      let totalCalls = 0;
      let answeredCalls = 0;
      let abandonedCalls = 0;
      let voicemails = 0;
      let outboundCalls = 0;
      let unknownCalls = 0;

      const callDetails = {
        answered: [],
        abandoned: [],
        voicemails: [],
        outbound: [],
        unknown: []
      };

      allTickets.forEach(ticket => {
        const desc = (ticket.description || '').toLowerCase();
        const subject = (ticket.subject || '').toLowerCase();
        const via = ticket.via?.channel?.name?.toLowerCase() || '';

        totalCalls++;

        // Determine call type
        if (subject.includes('voice mail') || desc.includes('voicemail')) {
          voicemails++;
          callDetails.voicemails.push({
            id: ticket.id,
            created: ticket.created_at,
            subject: ticket.subject
          });
        } else if (desc.includes('abandoned') || subject.includes('abandoned')) {
          abandonedCalls++;
          callDetails.abandoned.push({
            id: ticket.id,
            created: ticket.created_at,
            subject: ticket.subject,
            duration: this.extractDuration(desc)
          });
        } else if (desc.includes('outbound') || subject.includes('outbound')) {
          outboundCalls++;
          callDetails.outbound.push({
            id: ticket.id,
            created: ticket.created_at,
            subject: ticket.subject
          });
        } else if (ticket.assignee_id) {
          // Has assignee - likely answered
          const duration = this.extractDuration(desc);
          
          // If duration > 30 seconds, definitely answered
          if (duration && duration > 30) {
            answeredCalls++;
            callDetails.answered.push({
              id: ticket.id,
              created: ticket.created_at,
              subject: ticket.subject,
              duration: duration,
              assignee: ticket.assignee_id
            });
          } else if (duration && duration <= 30) {
            // Short call with assignee - might be abandoned
            abandonedCalls++;
            callDetails.abandoned.push({
              id: ticket.id,
              created: ticket.created_at,
              subject: ticket.subject,
              duration: duration
            });
          } else {
            // Has assignee but no duration data - assume answered
            answeredCalls++;
            callDetails.answered.push({
              id: ticket.id,
              created: ticket.created_at,
              subject: ticket.subject,
              duration: null,
              assignee: ticket.assignee_id
            });
          }
        } else {
          // No assignee, no clear indicators
          unknownCalls++;
          callDetails.unknown.push({
            id: ticket.id,
            created: ticket.created_at,
            subject: ticket.subject
          });
        }
      });

      // Display results
      console.log('📊 CALL STATISTICS');
      console.log('='.repeat(60));
      console.log(`\n📞 TOTAL CALLS: ${totalCalls}`);
      console.log(`✅ ANSWERED CALLS: ${answeredCalls} (${(answeredCalls/totalCalls*100).toFixed(1)}%)`);
      console.log(`❌ Abandoned Calls: ${abandonedCalls} (${(abandonedCalls/totalCalls*100).toFixed(1)}%)`);
      console.log(`📧 Voicemails: ${voicemails} (${(voicemails/totalCalls*100).toFixed(1)}%)`);
      console.log(`📤 Outbound Calls: ${outboundCalls} (${(outboundCalls/totalCalls*100).toFixed(1)}%)`);
      console.log(`❓ Unknown: ${unknownCalls} (${(unknownCalls/totalCalls*100).toFixed(1)}%)`);

      // Breakdown by day
      console.log('\n📅 BREAKDOWN BY DAY:');
      console.log('-'.repeat(60));
      
      const dayStats = this.groupByDay(allTickets);
      Object.keys(dayStats).sort().forEach(day => {
        const stats = dayStats[day];
        console.log(`${day}:`);
        console.log(`   Total: ${stats.total}, Answered: ${stats.answered}, Abandoned: ${stats.abandoned}`);
      });

      // Sample answered calls
      console.log('\n📋 SAMPLE ANSWERED CALLS:');
      console.log('-'.repeat(60));
      callDetails.answered.slice(0, 5).forEach(call => {
        const time = new Date(call.created).toLocaleString();
        const dur = call.duration ? `${Math.round(call.duration)}s` : 'N/A';
        console.log(`   #${call.id} at ${time} - Duration: ${dur}`);
      });

      if (callDetails.answered.length > 5) {
        console.log(`   ... and ${callDetails.answered.length - 5} more answered calls`);
      }

      // Sample abandoned calls
      if (abandonedCalls > 0) {
        console.log('\n❌ SAMPLE ABANDONED CALLS:');
        console.log('-'.repeat(60));
        callDetails.abandoned.slice(0, 5).forEach(call => {
          const time = new Date(call.created).toLocaleString();
          const dur = call.duration ? `${Math.round(call.duration)}s` : 'N/A';
          console.log(`   #${call.id} at ${time} - Duration: ${dur}`);
        });

        if (callDetails.abandoned.length > 5) {
          console.log(`   ... and ${callDetails.abandoned.length - 5} more abandoned calls`);
        }
      }

      // Summary
      console.log('\n' + '='.repeat(60));
      console.log('📈 SUMMARY');
      console.log('='.repeat(60));
      console.log(`Period: Monday Oct 6, 8am - Friday Oct 10, 7pm`);
      console.log(`Total Calls: ${totalCalls}`);
      console.log(`Answered: ${answeredCalls} (${(answeredCalls/totalCalls*100).toFixed(1)}%)`);
      console.log(`Service Level: ${((answeredCalls/(answeredCalls+abandonedCalls))*100).toFixed(1)}% (answered / answered+abandoned)`);
      console.log(`Abandonment Rate: ${(abandonedCalls/totalCalls*100).toFixed(1)}%`);
      console.log('='.repeat(60));

    } catch (error) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }

  extractDuration(text) {
    // Try to extract duration in seconds from text
    const patterns = [
      /duration[:\s]*(\d+(?:\.\d+)?)\s*(sec|second|s)/i,
      /duration[:\s]*(\d+(?:\.\d+)?)\s*(min|minute|m)/i,
      /lasted[:\s]*(\d+(?:\.\d+)?)\s*(sec|second|s)/i,
      /(\d+)\s*seconds?\s*call/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2]?.toLowerCase() || 's';
        
        if (unit.includes('min') || unit === 'm') {
          return value * 60;
        }
        return value;
      }
    }

    return null;
  }

  groupByDay(tickets) {
    const dayStats = {};

    tickets.forEach(ticket => {
      const date = new Date(ticket.created_at);
      const dayKey = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      if (!dayStats[dayKey]) {
        dayStats[dayKey] = {
          total: 0,
          answered: 0,
          abandoned: 0,
          voicemail: 0
        };
      }

      const desc = (ticket.description || '').toLowerCase();
      const subject = (ticket.subject || '').toLowerCase();

      dayStats[dayKey].total++;

      if (subject.includes('voice mail')) {
        dayStats[dayKey].voicemail++;
      } else if (desc.includes('abandoned') || subject.includes('abandoned')) {
        dayStats[dayKey].abandoned++;
      } else if (ticket.assignee_id) {
        dayStats[dayKey].answered++;
      }
    });

    return dayStats;
  }
}

async function main() {
  const analyzer = new CallRangeAnalyzer();

  // Monday October 6, 2025 8:00 AM
  const startDate = new Date('2025-10-06T08:00:00');
  
  // Friday October 10, 2025 7:00 PM
  const endDate = new Date('2025-10-10T19:00:00');

  await analyzer.analyzeCallRange(startDate, endDate);
}

module.exports = CallRangeAnalyzer;

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exitCode = 1;
  });
}
