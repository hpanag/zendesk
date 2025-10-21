const ZendeskClient = require('./src/ZendeskClient');

class SurveyReportCorrected {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async getLastWeekSurveys() {
    console.log('📊 SATISFACTION SURVEYS REPORT - CORRECTED');
    console.log('   Last Week: October 8-14, 2025');
    console.log('='.repeat(80));
    console.log();

    try {
      // Define last week's date range
      const lastWeekEnd = new Date('2025-10-14T23:59:59');
      const lastWeekStart = new Date('2025-10-08T00:00:00');
      
      const startStr = lastWeekStart.toISOString().split('T')[0];
      const endStr = lastWeekEnd.toISOString().split('T')[0];

      console.log(`📅 Date Range: ${lastWeekStart.toDateString()} - ${lastWeekEnd.toDateString()}\n`);

      // Get satisfaction ratings from API
      const satisfactionResponse = await this.zendesk.makeRequest(
        'GET',
        `/satisfaction_ratings.json?start_time=${Math.floor(lastWeekStart.getTime() / 1000)}&end_time=${Math.floor(lastWeekEnd.getTime() / 1000)}`
      );
      
      const ratings = satisfactionResponse.satisfaction_ratings || [];
      
      if (ratings.length === 0) {
        console.log('⚠️  No satisfaction surveys found for this period.\n');
        return;
      }
      
      console.log(`✅ Found ${ratings.length} satisfaction surveys\n`);
      
      // Categorize ratings correctly
      const answered = ratings.filter(r => r.score === 'good' || r.score === 'bad');
      const sentNotAnswered = ratings.filter(r => r.score === 'offered');
      const unoffered = ratings.filter(r => r.score === 'unoffered');
      
      const goodRatings = ratings.filter(r => r.score === 'good');
      const badRatings = ratings.filter(r => r.score === 'bad');
      
      // Calculate satisfaction score (only from answered surveys)
      const totalAnswered = answered.length;
      const satisfactionScore = totalAnswered > 0 ? 
        ((goodRatings.length / totalAnswered) * 100).toFixed(1) : 'N/A';
      
      console.log('═'.repeat(80));
      console.log('📊 SURVEY SUMMARY');
      console.log('═'.repeat(80));
      console.log();
      console.log(`Total Surveys Sent:      ${ratings.filter(r => r.score !== 'unoffered').length}`);
      console.log(`  ✅ Answered:            ${answered.length}`);
      console.log(`  📤 Sent (No Response):  ${sentNotAnswered.length}`);
      console.log();
      console.log(`Answered Breakdown:`);
      console.log(`  😊 Good (Satisfied):    ${goodRatings.length}`);
      console.log(`  😞 Bad (Unsatisfied):   ${badRatings.length}`);
      console.log();
      console.log(`📈 Satisfaction Score:   ${satisfactionScore}%`);
      console.log(`   (Based on ${totalAnswered} answered surveys)`);
      console.log();
      
      // Ratings with comments
      const withComments = answered.filter(r => r.comment && r.comment.trim().length > 0);
      console.log(`💬 Surveys with Comments: ${withComments.length}`);
      console.log();
      
      // SECTION 1: ANSWERED SURVEYS - GOOD
      if (goodRatings.length > 0) {
        console.log('═'.repeat(80));
        console.log(`😊 ANSWERED - GOOD/SATISFIED (${goodRatings.length})`);
        console.log('═'.repeat(80));
        console.log();
        
        goodRatings.forEach(rating => {
          const date = new Date(rating.created_at);
          console.log(`Ticket #${rating.ticket_id}`);
          console.log(`  Rating ID:    ${rating.id}`);
          console.log(`  Score:        😊 GOOD (Satisfied)`);
          console.log(`  Date:         ${date.toLocaleString()}`);
          console.log(`  Assignee ID:  ${rating.assignee_id || 'Unassigned'}`);
          console.log(`  Group ID:     ${rating.group_id}`);
          
          if (rating.comment && rating.comment.trim().length > 0) {
            console.log(`  Comment:      "${rating.comment}"`);
          } else {
            console.log(`  Comment:      (No comment provided)`);
          }
          
          if (rating.reason) {
            console.log(`  Reason:       ${rating.reason}`);
          }
          
          console.log();
        });
      }
      
      // SECTION 2: ANSWERED SURVEYS - BAD
      if (badRatings.length > 0) {
        console.log('═'.repeat(80));
        console.log(`😞 ANSWERED - BAD/UNSATISFIED (${badRatings.length})`);
        console.log('═'.repeat(80));
        console.log();
        
        badRatings.forEach(rating => {
          const date = new Date(rating.created_at);
          console.log(`Ticket #${rating.ticket_id}`);
          console.log(`  Rating ID:    ${rating.id}`);
          console.log(`  Score:        😞 BAD (Unsatisfied)`);
          console.log(`  Date:         ${date.toLocaleString()}`);
          console.log(`  Assignee ID:  ${rating.assignee_id || 'Unassigned'}`);
          console.log(`  Group ID:     ${rating.group_id}`);
          
          if (rating.comment && rating.comment.trim().length > 0) {
            console.log(`  Comment:`);
            console.log(`  ┌${'─'.repeat(76)}┐`);
            console.log(`  │ ${rating.comment.split('\n').join('\n  │ ').substring(0, 500)}`);
            console.log(`  └${'─'.repeat(76)}┘`);
          } else {
            console.log(`  Comment:      (No comment provided)`);
          }
          
          if (rating.reason) {
            console.log(`  Reason:       ${rating.reason}`);
          }
          
          console.log();
        });
      }
      
      // SECTION 3: SENT BUT NOT ANSWERED
      if (sentNotAnswered.length > 0) {
        console.log('═'.repeat(80));
        console.log(`📤 SENT BUT NOT ANSWERED (${sentNotAnswered.length})`);
        console.log('═'.repeat(80));
        console.log();
        console.log('These surveys were sent to customers but have not been responded to yet.\n');
        
        sentNotAnswered.forEach(rating => {
          const sentDate = new Date(rating.created_at);
          const hoursSince = Math.floor((Date.now() - sentDate.getTime()) / 1000 / 60 / 60);
          
          console.log(`Ticket #${rating.ticket_id}`);
          console.log(`  Rating ID:    ${rating.id}`);
          console.log(`  Status:       📤 OFFERED (Pending Response)`);
          console.log(`  Sent:         ${sentDate.toLocaleString()}`);
          console.log(`  Time Elapsed: ${hoursSince} hours ago`);
          console.log(`  Assignee ID:  ${rating.assignee_id || 'Unassigned'}`);
          console.log(`  Group ID:     ${rating.group_id}`);
          console.log();
        });
      }
      
      // SECTION 4: DAILY BREAKDOWN
      console.log('═'.repeat(80));
      console.log('📅 DAILY BREAKDOWN');
      console.log('═'.repeat(80));
      console.log();
      
      const dailyStats = {};
      
      ratings.forEach(rating => {
        const date = new Date(rating.created_at);
        const dayKey = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        
        if (!dailyStats[dayKey]) {
          dailyStats[dayKey] = {
            date: date,
            good: 0,
            bad: 0,
            answered: 0,
            offered: 0,
            total: 0
          };
        }
        
        if (rating.score === 'good') {
          dailyStats[dayKey].good++;
          dailyStats[dayKey].answered++;
        } else if (rating.score === 'bad') {
          dailyStats[dayKey].bad++;
          dailyStats[dayKey].answered++;
        } else if (rating.score === 'offered') {
          dailyStats[dayKey].offered++;
        }
        
        dailyStats[dayKey].total++;
      });
      
      console.log('Day                        Sent  Answered  Good  Bad  Pending  Satisfaction');
      console.log('-'.repeat(80));
      
      Object.keys(dailyStats).sort((a, b) => dailyStats[a].date - dailyStats[b].date).forEach(day => {
        const stats = dailyStats[day];
        const satScore = stats.answered > 0 ? 
          `${((stats.good / stats.answered) * 100).toFixed(0)}%` : 
          'N/A';
        
        console.log(
          `${day.padEnd(26)} ${String(stats.total).padStart(4)}  ` +
          `${String(stats.answered).padStart(8)}  ` +
          `${String(stats.good).padStart(4)}  ` +
          `${String(stats.bad).padStart(3)}  ` +
          `${String(stats.offered).padStart(7)}  ` +
          `${satScore.padStart(12)}`
        );
      });
      console.log();
      
      // Export to JSON
      const fs = require('fs');
      const path = require('path');
      
      const reportDir = path.join(__dirname, 'reports');
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      const exportData = {
        period: `${startStr} to ${endStr}`,
        generatedAt: new Date().toISOString(),
        summary: {
          totalSent: ratings.filter(r => r.score !== 'unoffered').length,
          totalAnswered: answered.length,
          totalPending: sentNotAnswered.length,
          goodRatings: goodRatings.length,
          badRatings: badRatings.length,
          satisfactionScore: parseFloat(satisfactionScore) || null,
          ratingsWithComments: withComments.length
        },
        answered: {
          good: goodRatings.map(r => ({
            ticketId: r.ticket_id,
            ratingId: r.id,
            score: r.score,
            comment: r.comment,
            createdAt: r.created_at,
            assigneeId: r.assignee_id,
            groupId: r.group_id,
            requesterId: r.requester_id
          })),
          bad: badRatings.map(r => ({
            ticketId: r.ticket_id,
            ratingId: r.id,
            score: r.score,
            comment: r.comment,
            createdAt: r.created_at,
            assigneeId: r.assignee_id,
            groupId: r.group_id,
            requesterId: r.requester_id
          }))
        },
        pending: sentNotAnswered.map(r => ({
          ticketId: r.ticket_id,
          ratingId: r.id,
          status: 'offered',
          sentAt: r.created_at,
          assigneeId: r.assignee_id,
          groupId: r.group_id,
          requesterId: r.requester_id
        })),
        dailyBreakdown: dailyStats
      };
      
      const filename = `surveys_corrected_${startStr}_to_${endStr}.json`;
      const filepath = path.join(reportDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
      
      console.log('═'.repeat(80));
      console.log('💾 EXPORT COMPLETE');
      console.log('═'.repeat(80));
      console.log();
      console.log(`✅ Survey data exported to: ${filepath}`);
      console.log(`   File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
      console.log();
      
      // Final summary
      console.log('═'.repeat(80));
      console.log('🎯 FINAL SUMMARY - LAST WEEK (OCT 8-14, 2025)');
      console.log('═'.repeat(80));
      console.log();
      console.log(`📤 Total Surveys Sent:     ${ratings.filter(r => r.score !== 'unoffered').length}`);
      console.log(`✅ Total Answered:         ${answered.length}`);
      console.log(`📭 Pending Response:       ${sentNotAnswered.length}`);
      console.log();
      console.log(`Response Rate:            ${totalAnswered > 0 ? ((answered.length / ratings.filter(r => r.score !== 'unoffered').length) * 100).toFixed(1) : 0}%`);
      console.log();
      console.log(`😊 Satisfied (Good):       ${goodRatings.length} (${totalAnswered > 0 ? ((goodRatings.length / totalAnswered) * 100).toFixed(1) : 0}% of answered)`);
      console.log(`😞 Unsatisfied (Bad):      ${badRatings.length} (${totalAnswered > 0 ? ((badRatings.length / totalAnswered) * 100).toFixed(1) : 0}% of answered)`);
      console.log();
      console.log(`📈 Satisfaction Score:     ${satisfactionScore}%`);
      console.log(`💬 Feedback Comments:      ${withComments.length}`);
      console.log();
      console.log('═'.repeat(80));
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
    }
  }
}

async function main() {
  const reporter = new SurveyReportCorrected();
  await reporter.getLastWeekSurveys();
}

module.exports = SurveyReportCorrected;

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exitCode = 1;
  });
}
