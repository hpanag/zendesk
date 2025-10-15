const ZendeskClient = require('./src/ZendeskClient');

async function checkRating295014() {
  console.log('🔍 DETAILED INVESTIGATION - Ticket #295014 Rating');
  console.log('='.repeat(80));
  console.log();
  
  const zendesk = new ZendeskClient();
  
  try {
    // Check 1: Get rating directly by ID from the saved data
    console.log('CHECK 1: Looking at saved survey data...\n');
    
    const fs = require('fs');
    const path = require('path');
    const savedData = fs.readFileSync(
      path.join(__dirname, 'reports/survey_results_2025-10-08_to_2025-10-15.json'),
      'utf8'
    );
    const surveyData = JSON.parse(savedData);
    
    const rating295014 = surveyData.allRatings.find(r => r.ticketId === 295014);
    
    if (rating295014) {
      console.log('✅ FOUND in saved data:');
      console.log(JSON.stringify(rating295014, null, 2));
      console.log();
    }
    
    // Check 2: Get LIVE data from API right now
    console.log('CHECK 2: Fetching LIVE data from Zendesk API...\n');
    
    const ratingId = 42183024042260; // From the saved data
    
    try {
      const liveRating = await zendesk.makeRequest(
        'GET',
        `/satisfaction_ratings/${ratingId}.json`
      );
      
      console.log('✅ LIVE API DATA:');
      console.log(JSON.stringify(liveRating.satisfaction_rating, null, 2));
      console.log();
      
      // Compare
      console.log('='.repeat(80));
      console.log('📊 COMPARISON');
      console.log('='.repeat(80));
      console.log();
      console.log(`Saved Score:  ${rating295014?.score || 'N/A'}`);
      console.log(`Live Score:   ${liveRating.satisfaction_rating.score}`);
      console.log();
      console.log(`Saved Updated: ${rating295014?.updatedAt || 'N/A'}`);
      console.log(`Live Updated:  ${liveRating.satisfaction_rating.updated_at}`);
      console.log();
      
      if (rating295014?.score !== liveRating.satisfaction_rating.score) {
        console.log('⚠️  RATING HAS CHANGED!');
        console.log(`   Was: ${rating295014?.score}`);
        console.log(`   Now: ${liveRating.satisfaction_rating.score}`);
        console.log();
      }
      
      if (liveRating.satisfaction_rating.comment) {
        console.log('💬 CUSTOMER COMMENT:');
        console.log('-'.repeat(80));
        console.log(liveRating.satisfaction_rating.comment);
        console.log('-'.repeat(80));
        console.log();
      }
      
    } catch (error) {
      console.log(`❌ Error fetching live rating: ${error.message}\n`);
    }
    
    // Check 3: Get all recent ratings to see the full picture
    console.log('CHECK 3: Getting all recent ratings from API...\n');
    
    const startTime = Math.floor(new Date('2025-10-14').getTime() / 1000);
    const allRatingsResponse = await zendesk.makeRequest(
      'GET',
      `/satisfaction_ratings.json?start_time=${startTime}`
    );
    
    const all295014Ratings = allRatingsResponse.satisfaction_ratings.filter(
      r => r.ticket_id === 295014
    );
    
    console.log(`Found ${all295014Ratings.length} rating(s) for ticket #295014:\n`);
    
    all295014Ratings.forEach((rating, index) => {
      console.log(`Rating #${index + 1}:`);
      console.log(JSON.stringify(rating, null, 2));
      console.log();
    });
    
    // Check 4: Look at the original analyzeSurveys output
    console.log('='.repeat(80));
    console.log('🎯 EXPLANATION');
    console.log('='.repeat(80));
    console.log();
    
    if (rating295014?.score === 'offered' && all295014Ratings.length > 0) {
      const liveScore = all295014Ratings[0].score;
      
      if (liveScore === 'offered') {
        console.log('The rating is still "offered" (pending customer response).');
        console.log('The earlier report may have shown it differently due to:');
        console.log('  1. Date/time filtering differences');
        console.log('  2. Display formatting in the table');
        console.log('  3. Grouping logic (offered ratings shown separately)');
      } else {
        console.log('⚠️  The rating status has CHANGED since the report was generated!');
        console.log(`Originally: "offered" (pending)`);
        console.log(`Now: "${liveScore}"`);
        console.log();
        console.log('This means the customer responded to the survey after the report was generated.');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

checkRating295014();
