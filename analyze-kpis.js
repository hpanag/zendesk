const TicketKPIAnalyzer = require('./src/TicketKPIAnalyzer');

async function analyzeTicketKPIs() {
  console.log('🚀 Starting Zendesk KPI Analysis...');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  
  try {
    const analyzer = new TicketKPIAnalyzer();
    
    // Generate comprehensive KPI report
    console.log('\n📊 Generating KPI report...');
    await analyzer.generateKPIReport();
    
    // Print the report to console
    analyzer.printKPIReport();
    
    // Export to JSON file
    console.log('\n💾 Exporting KPI data to JSON...');
    const jsonPath = await analyzer.exportKPIsToJSON();
    
    console.log('\n🎉 KPI Analysis completed successfully!');
    console.log(`📂 JSON data saved at: ${jsonPath}`);
    
  } catch (error) {
    console.error('❌ KPI Analysis failed:', error.message);
    
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
analyzeTicketKPIs();