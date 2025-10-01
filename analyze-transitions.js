const TicketStatusTransitionAnalyzer = require('./src/TicketStatusTransitionAnalyzer');

async function analyzeStatusTransitions() {
  console.log('🚀 Starting Zendesk Status Transition Analysis...');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  
  try {
    const analyzer = new TicketStatusTransitionAnalyzer();
    
    // Analyze status transitions in the last 24 hours
    console.log('\n🔄 Analyzing status transitions in the last 24 hours...');
    await analyzer.analyzeStatusTransitions(24);
    
    // Print the report to console
    analyzer.printTransitionReport();
    
    // Export to JSON file
    console.log('\n💾 Exporting transition data to JSON...');
    const jsonPath = await analyzer.exportTransitionsToJSON();
    
    // Show specific examples
    console.log('\n🔍 SPECIFIC TRANSITION EXAMPLES:');
    
    // Check for common transitions
    const commonTransitions = [
      ['new', 'open'],
      ['open', 'pending'],
      ['pending', 'solved'],
      ['open', 'solved'],
      ['solved', 'closed'],
      ['new', 'solved']
    ];
    
    commonTransitions.forEach(([from, to]) => {
      const result = analyzer.getSpecificTransition(from, to);
      if (result.count > 0) {
        console.log(`   ${from.toUpperCase()} → ${to.toUpperCase()}: ${result.count} transitions`);
        // Show first few examples
        result.transitions.slice(0, 3).forEach((t, i) => {
          const when = new Date(t.when).toLocaleString();
          console.log(`     - Ticket #${t.ticketId} at ${when}`);
        });
      }
    });
    
    console.log('\n🎉 Status Transition Analysis completed successfully!');
    console.log(`📂 JSON data saved at: ${jsonPath}`);
    
  } catch (error) {
    console.error('❌ Status Transition Analysis failed:', error.message);
    
    if (error.response?.status === 401) {
      console.error('🔐 Authentication failed. Please check your credentials in the .env file.');
    } else if (error.response?.status === 403) {
      console.error('🚫 Access forbidden. Please check your API permissions.');
    } else if (error.response?.status === 404) {
      console.error('🔍 Resource not found. Please check your subdomain.');
    }
  }
}

// Allow custom timeframe via command line argument
const timeframe = process.argv[2] ? parseInt(process.argv[2]) : 24;

if (timeframe !== 24) {
  console.log(`📅 Custom timeframe: ${timeframe} hours`);
}

// Run the analysis
analyzeStatusTransitions();