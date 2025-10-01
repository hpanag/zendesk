const VoiceChannelKPIAnalyzer = require('./src/VoiceChannelKPIAnalyzer');

async function analyzeVoiceChannelKPIs() {
  console.log('🚀 Starting Voice Channel KPI Analysis...');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  
  const today = new Date();
  console.log(`📅 Analyzing voice calls for: ${today.toDateString()}`);
  console.log(`🕐 From 12:00 AM to ${today.toLocaleTimeString()}`);
  
  try {
    const analyzer = new VoiceChannelKPIAnalyzer();
    
    // Analyze voice channel KPIs for today
    console.log('\n📞 Analyzing voice channel performance...');
    await analyzer.analyzeVoiceChannelKPIs();
    
    // Print the comprehensive report
    analyzer.printVoiceKPIReport();
    
    // Export to JSON file (perfect for graphs and dashboards)
    console.log('\n💾 Exporting voice KPI data to JSON...');
    const jsonPath = await analyzer.exportVoiceKPIsToJSON();
    
    console.log('\n🎉 Voice Channel KPI Analysis completed successfully!');
    console.log(`📂 JSON data saved at: ${jsonPath}`);
    
    // Show key metrics for quick reference
    const kpis = analyzer.kpis;
    
    if (kpis.totalCalls > 0) {
      console.log('\n📈 KEY METRICS FOR GRAPHS:');
      console.log(`   📞 Total Calls: ${kpis.totalCalls}`);
      console.log(`   📥 Inbound: ${kpis.inboundCalls} | 📤 Outbound: ${kpis.outboundCalls}`);
      console.log(`   ✅ Answered: ${kpis.answeredCalls} (${kpis.answerRate}%)`);
      console.log(`   ❌ Not Answered: ${kpis.notAnsweredCalls}`);
      console.log(`   📞 Callback Requests: ${kpis.callbackRequested}`);
      console.log(`   ⬇️ Dropped Calls: ${kpis.droppedCalls}`);
      console.log(`   ⏱️ Avg Call Duration: ${kpis.averageCallFormatted}`);
      console.log(`   📊 Peak Hour: ${kpis.peakHour?.hour || 'N/A'}:00 (${kpis.peakHour?.calls || 0} calls)`);
      
      console.log('\n📊 GRAPH-READY DATA STRUCTURE:');
      console.log('   ├── Call Volume by Hour: callsByHour{}');
      console.log('   ├── Call Outcomes: answeredCalls, notAnsweredCalls, droppedCalls, callbackRequested');
      console.log('   ├── Duration Metrics: longestCallSeconds, shortestCallSeconds, averageCallDurationSeconds');
      console.log('   ├── Performance Rates: answerRate%, dropRate%, callbackRate%');
      console.log('   └── Priority Distribution: callsByPriority{}');
    }
    
  } catch (error) {
    console.error('❌ Voice Channel KPI Analysis failed:', error.message);
    
    if (error.response?.status === 401) {
      console.error('🔐 Authentication failed. Please check your credentials in the .env file.');
    } else if (error.response?.status === 403) {
      console.error('🚫 Access forbidden. Please check your API permissions.');
    } else if (error.response?.status === 404) {
      console.error('🔍 Resource not found. Please check your subdomain.');
    }
  }
}

// Run the analysis
analyzeVoiceChannelKPIs();