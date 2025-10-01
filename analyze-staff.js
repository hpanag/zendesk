const StaffPerformanceAnalyzer = require('./src/StaffPerformanceAnalyzer');

async function analyzeStaffPerformance() {
  console.log('🚀 Starting Staff Performance Analysis...');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  
  const today = new Date();
  console.log(`📅 Analyzing staff performance for: ${today.toDateString()}`);
  console.log(`🕐 From 12:00 AM to ${today.toLocaleTimeString()}`);
  
  try {
    const analyzer = new StaffPerformanceAnalyzer();
    
    // Analyze staff performance for today
    console.log('\n👥 Analyzing staff performance...');
    await analyzer.analyzeStaffPerformance();
    
    // Print the comprehensive report
    analyzer.printStaffReport();
    
    // Export to JSON file
    console.log('\n💾 Exporting staff performance data to JSON...');
    const jsonPath = await analyzer.exportStaffDataToJSON();
    
    console.log('\n🎉 Staff Performance Analysis completed successfully!');
    console.log(`📂 JSON data saved at: ${jsonPath}`);
    
    // Show summary statistics
    const staffData = Object.values(analyzer.staffData).filter(staff => staff.totalActivities > 0);
    
    if (staffData.length > 0) {
      console.log('\n📈 SUMMARY STATISTICS:');
      console.log(`   Active Staff Today: ${staffData.length}`);
      console.log(`   Total Tickets Touched: ${[...new Set(staffData.flatMap(s => Object.keys(s.activities || []).map(a => s.activities[a].ticketId)))].length}`);
      console.log(`   Total Activities: ${staffData.reduce((sum, s) => sum + s.totalActivities, 0)}`);
      console.log(`   Total Comments: ${staffData.reduce((sum, s) => sum + s.commentsAdded, 0)}`);
      
      const topPerformer = staffData.reduce((top, staff) => 
        staff.ticketsWorkedOnCount > top.ticketsWorkedOnCount ? staff : top
      );
      console.log(`   Top Performer: ${topPerformer.name} (${topPerformer.ticketsWorkedOnCount} tickets)`);
    }
    
  } catch (error) {
    console.error('❌ Staff Performance Analysis failed:', error.message);
    
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
analyzeStaffPerformance();