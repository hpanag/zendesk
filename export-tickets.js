const TicketExporter = require('./src/TicketExporter');

async function exportLast1000Tickets() {
  console.log('🚀 Starting Zendesk ticket export (Last 1000 tickets)...');
  console.log(`📡 Connected to: ${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`);
  
  try {
    const exporter = new TicketExporter();
    
    // Export all tickets to Excel
    const filePath = await exporter.exportToExcel();
    
    console.log('\n🎉 Export completed successfully!');
    console.log(`📂 Your Excel file is saved at: ${filePath}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    
    if (error.response?.status === 401) {
      console.error('🔐 Authentication failed. Please check your credentials in the .env file.');
    } else if (error.response?.status === 403) {
      console.error('🚫 Access forbidden. Please check your API permissions.');
    } else if (error.response?.status === 404) {
      console.error('🔍 Resource not found. Please check your subdomain.');
    }
  }
}

// Run the export
exportLast1000Tickets();