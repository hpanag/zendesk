const axios = require('axios');

async function testDateFunctionality() {
  console.log('🧪 Testing Voice Analytics Date Functionality\n');
  
  const dates = [
    '2024-12-19', // Today (Thursday)
    '2024-12-18', // Yesterday (Wednesday)
    '2024-12-17', // Tuesday
    '2024-12-16', // Monday
    '2024-12-15', // Sunday (weekend)
    '2024-12-14'  // Saturday (weekend)
  ];
  
  for (const date of dates) {
    try {
      console.log(`📅 Testing date: ${date}`);
      const response = await axios.get(`http://localhost:3000/api/voice-analytics?date=${date}`);
      
      if (response.data.success) {
        const data = response.data.data;
        console.log(`   ✅ Total Calls: ${data.summary.total_calls}`);
        console.log(`   ✅ Answered: ${data.summary.answered_calls}`);
        console.log(`   ✅ Abandoned: ${data.summary.abandoned_calls}`);
        console.log(`   ✅ Abandonment Rate: ${data.abandonment_rate}%`);
        console.log(`   ✅ Day: ${data.day_name}`);
      } else {
        console.log(`   ❌ Error: ${response.data.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
    console.log('');
  }
}

testDateFunctionality().catch(console.error);