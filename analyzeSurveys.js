const ZendeskClient = require('./src/ZendeskClient');

class SurveyAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async getLastWeekSurveys() {
    console.log('📊 SURVEY RESULTS ANALYSIS');
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

      console.log('🔍 Method 1: Checking Satisfaction Ratings API...\n');
      
      // Try to get satisfaction ratings
      try {
        const satisfactionResponse = await this.zendesk.makeRequest(
          'GET',
          `/satisfaction_ratings.json?start_time=${Math.floor(lastWeekStart.getTime() / 1000)}&end_time=${Math.floor(lastWeekEnd.getTime() / 1000)}`
        );
        
        if (satisfactionResponse.satisfaction_ratings && satisfactionResponse.satisfaction_ratings.length > 0) {
          const ratings = satisfactionResponse.satisfaction_ratings;
          
          console.log(`✅ Found ${ratings.length} satisfaction ratings\n`);
          
          // Analyze ratings
          const ratingCounts = {
            good: 0,
            bad: 0,
            offered: 0,
            unoffered: 0
          };
          
          const ratingDetails = [];
          
          ratings.forEach(rating => {
            if (rating.score === 'good') ratingCounts.good++;
            else if (rating.score === 'bad') ratingCounts.bad++;
            
            if (rating.score === 'offered') ratingCounts.offered++;
            else if (rating.score === 'unoffered') ratingCounts.unoffered++;
            
            ratingDetails.push({
              id: rating.id,
              ticketId: rating.ticket_id,
              score: rating.score,
              comment: rating.comment,
              createdAt: rating.created_at,
              updatedAt: rating.updated_at,
              assigneeId: rating.assignee_id,
              groupId: rating.group_id,
              requesterId: rating.requester_id,
              url: rating.url,
              reason: rating.reason
            });
          });
          
          // Calculate satisfaction score
          const totalResponses = ratingCounts.good + ratingCounts.bad;
          const satisfactionScore = totalResponses > 0 ? 
            ((ratingCounts.good / totalResponses) * 100).toFixed(1) : 0;
          
          console.log('═'.repeat(80));
          console.log('📊 SATISFACTION RATINGS SUMMARY');
          console.log('═'.repeat(80));
          console.log();
          console.log(`Total Ratings: ${ratings.length}`);
          console.log(`  😊 Good (Satisfied):   ${ratingCounts.good}`);
          console.log(`  😞 Bad (Unsatisfied):  ${ratingCounts.bad}`);
          console.log(`  📤 Offered:            ${ratingCounts.offered}`);
          console.log(`  ⏸️  Unoffered:          ${ratingCounts.unoffered}`);
          console.log();
          console.log(`📈 Satisfaction Score: ${satisfactionScore}% (${ratingCounts.good}/${totalResponses} satisfied)`);
          console.log();
          
          // Show ratings by day
          const ratingsByDay = {};
          ratings.forEach(rating => {
            const date = new Date(rating.created_at);
            const dayKey = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            if (!ratingsByDay[dayKey]) {
              ratingsByDay[dayKey] = { good: 0, bad: 0, total: 0 };
            }
            
            if (rating.score === 'good') ratingsByDay[dayKey].good++;
            else if (rating.score === 'bad') ratingsByDay[dayKey].bad++;
            
            if (rating.score === 'good' || rating.score === 'bad') {
              ratingsByDay[dayKey].total++;
            }
          });
          
          console.log('═'.repeat(80));
          console.log('📅 RATINGS BY DAY');
          console.log('═'.repeat(80));
          console.log();
          console.log('Day                Good  Bad   Total  Satisfaction %');
          console.log('-'.repeat(80));
          
          Object.keys(ratingsByDay).sort((a, b) => {
            return new Date(a) - new Date(b);
          }).forEach(day => {
            const stats = ratingsByDay[day];
            const dayScore = stats.total > 0 ? ((stats.good / stats.total) * 100).toFixed(0) : 0;
            console.log(
              `${day.padEnd(18)} ${String(stats.good).padStart(4)}  ${String(stats.bad).padStart(4)}  ` +
              `${String(stats.total).padStart(5)}  ${String(dayScore).padStart(13)}%`
            );
          });
          console.log();
          
          // Show comments if available
          const ratingsWithComments = ratingDetails.filter(r => r.comment && r.comment.trim().length > 0);
          
          if (ratingsWithComments.length > 0) {
            console.log('═'.repeat(80));
            console.log(`💬 CUSTOMER COMMENTS (${ratingsWithComments.length})`);
            console.log('═'.repeat(80));
            console.log();
            
            ratingsWithComments.forEach(rating => {
              const date = new Date(rating.createdAt);
              console.log(`${rating.score === 'good' ? '😊' : '😞'} ${rating.score.toUpperCase()} - Ticket #${rating.ticketId}`);
              console.log(`   Date: ${date.toLocaleString()}`);
              console.log(`   Comment: "${rating.comment}"`);
              if (rating.reason) {
                console.log(`   Reason: ${rating.reason}`);
              }
              console.log();
            });
          }
          
          // Show ratings without comments
          const ratingsWithoutComments = ratingDetails.filter(r => !r.comment || r.comment.trim().length === 0);
          
          if (ratingsWithoutComments.length > 0) {
            console.log('═'.repeat(80));
            console.log(`📋 RATINGS WITHOUT COMMENTS (${ratingsWithoutComments.length})`);
            console.log('═'.repeat(80));
            console.log();
            console.log('Score  | Ticket #   | Date');
            console.log('-'.repeat(80));
            
            ratingsWithoutComments.slice(0, 20).forEach(rating => {
              const date = new Date(rating.createdAt);
              const score = rating.score === 'good' ? '😊 Good' : '😞 Bad';
              console.log(
                `${score.padEnd(7)} | #${String(rating.ticketId).padEnd(9)} | ${date.toLocaleString()}`
              );
            });
            
            if (ratingsWithoutComments.length > 20) {
              console.log(`... and ${ratingsWithoutComments.length - 20} more ratings without comments`);
            }
            console.log();
          }
          
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
              totalRatings: ratings.length,
              goodRatings: ratingCounts.good,
              badRatings: ratingCounts.bad,
              satisfactionScore: parseFloat(satisfactionScore),
              ratingsWithComments: ratingsWithComments.length,
              ratingsWithoutComments: ratingsWithoutComments.length
            },
            ratingsByDay: ratingsByDay,
            allRatings: ratingDetails
          };
          
          const filename = `survey_results_${startStr}_to_${endStr}.json`;
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
          console.log('🎯 FINAL SUMMARY - LAST WEEK');
          console.log('═'.repeat(80));
          console.log();
          console.log(`Period: October 8-14, 2025`);
          console.log();
          console.log(`📊 Total Ratings:        ${ratings.length}`);
          console.log(`😊 Satisfied (Good):     ${ratingCounts.good} (${((ratingCounts.good/totalResponses)*100).toFixed(1)}%)`);
          console.log(`😞 Unsatisfied (Bad):    ${ratingCounts.bad} (${((ratingCounts.bad/totalResponses)*100).toFixed(1)}%)`);
          console.log();
          console.log(`📈 Satisfaction Score:   ${satisfactionScore}%`);
          console.log(`💬 Ratings with Comments: ${ratingsWithComments.length}`);
          console.log();
          console.log('═'.repeat(80));
          
          return;
        }
      } catch (error) {
        console.log(`❌ Satisfaction Ratings API error: ${error.message}\n`);
      }
      
      // Fallback: Try searching for survey tickets
      console.log('🔍 Method 2: Searching for survey-related tickets...\n');
      
      try {
        const surveyTickets = await this.zendesk.search(
          `type:ticket created>=${startStr} created<=${endStr} (subject:survey OR subject:feedback OR subject:satisfaction)`,
          { per_page: 100 }
        );
        
        if (surveyTickets.results && surveyTickets.results.length > 0) {
          console.log(`✅ Found ${surveyTickets.results.length} survey-related tickets\n`);
          
          surveyTickets.results.slice(0, 10).forEach(ticket => {
            console.log(`Ticket #${ticket.id}: ${ticket.subject}`);
            console.log(`  Status: ${ticket.status} | Created: ${new Date(ticket.created_at).toLocaleString()}`);
            console.log();
          });
        } else {
          console.log('⚠️  No survey-related tickets found\n');
        }
      } catch (error) {
        console.log(`❌ Survey ticket search error: ${error.message}\n`);
      }
      
      // Try to get ticket metrics as alternative
      console.log('🔍 Method 3: Checking Ticket Metrics API...\n');
      
      try {
        const metricsResponse = await this.zendesk.makeRequest(
          'GET',
          '/ticket_metrics.json'
        );
        
        if (metricsResponse.ticket_metrics) {
          console.log(`✅ Ticket Metrics API available (${metricsResponse.ticket_metrics.length} metrics found)`);
          console.log('   Note: This shows ticket performance metrics, not satisfaction surveys\n');
        }
      } catch (error) {
        console.log(`❌ Ticket Metrics API error: ${error.message}\n`);
      }
      
      console.log('═'.repeat(80));
      console.log('⚠️  NO SURVEY DATA FOUND');
      console.log('═'.repeat(80));
      console.log();
      console.log('Possible reasons:');
      console.log('  1. No satisfaction surveys were sent last week');
      console.log('  2. Satisfaction ratings feature may not be enabled');
      console.log('  3. API access to satisfaction ratings may be restricted');
      console.log('  4. Surveys may be tracked in a different system');
      console.log();
      console.log('💡 To enable satisfaction ratings in Zendesk:');
      console.log('   Admin Center > Objects and rules > Tickets > Settings > Customer satisfaction');
      console.log();
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
    }
  }
}

async function main() {
  const analyzer = new SurveyAnalyzer();
  await analyzer.getLastWeekSurveys();
}

module.exports = SurveyAnalyzer;

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exitCode = 1;
  });
}
