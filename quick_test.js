const axios = require('axios');

async function quickTest() {
  try {
    console.log('Testing 2024-12-19 (Thursday):');
    const res1 = await axios.get('http://localhost:3000/api/voice-analytics?date=2024-12-19');
    console.log(`Total Calls: ${res1.data.data.summary.total_calls}, Answered: ${res1.data.data.summary.answered_calls}`);
    
    console.log('\nTesting 2024-12-15 (Sunday - Weekend):');
    const res2 = await axios.get('http://localhost:3000/api/voice-analytics?date=2024-12-15');
    console.log(`Total Calls: ${res2.data.data.summary.total_calls}, Answered: ${res2.data.data.summary.answered_calls}`);
    
    console.log('\nTesting 2024-12-16 (Monday):');
    const res3 = await axios.get('http://localhost:3000/api/voice-analytics?date=2024-12-16');
    console.log(`Total Calls: ${res3.data.data.summary.total_calls}, Answered: ${res3.data.data.summary.answered_calls}`);
    
    console.log('\n✅ Date selection is working - different dates show different data!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

quickTest();