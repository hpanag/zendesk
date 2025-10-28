const ZendeskClient = require('./src/ZendeskClient');
const fs = require('fs');

/**
 * Export 2025 ticket categories to CSV for Excel analysis
 */

async function exportTicketCategoriesToCSV() {
  try {
    console.log('📊 Exporting 2025 Ticket Categories to CSV...');
    
    const client = new ZendeskClient();
    
    // Get sample of tickets for analysis
    console.log('🔍 Fetching ticket data...');
    const result = await client.search('type:ticket created>=2025-01-01', { per_page: 100 });
    
    if (!result.results || result.results.length === 0) {
      console.log('❌ No tickets found for 2025');
      return;
    }
    
    console.log(`📈 Analyzing ${result.results.length} tickets...`);
    
    // Prepare CSV data
    const csvData = [];
    
    // CSV Header
    csvData.push([
      'Ticket ID',
      'Subject',
      'Status',
      'Priority',
      'Group ID',
      'Created Date',
      'Updated Date',
      'Tags',
      'Sales Cycle',
      'Pre-Sales Category',
      'Post-Sale Category',
      'Order Management Category',
      'Reason For Calling',
      'Inquiry Type',
      'Detected Category (Subject)',
      'Detected Category (Keywords)'
    ]);
    
    // Process each ticket
    result.results.forEach(ticket => {
      // Extract custom field values
      const customFields = {};
      if (ticket.custom_fields) {
        ticket.custom_fields.forEach(field => {
          customFields[field.id] = field.value;
        });
      }
      
      // Detect category from subject
      const subject = (ticket.subject || '').toLowerCase();
      let detectedCategory = 'Other';
      let detectedKeywords = [];
      
      const categoryKeywords = {
        'Parts/Hardware': ['missing', 'hardware', 'parts', 'replacement', 'screw', 'bolt'],
        'Assembly': ['assembly', 'instruction', 'install', 'setup', 'guide'],
        'Shipping/Delivery': ['shipping', 'delivery', 'freight', 'tracking', 'delayed'],
        'Returns': ['return', 'exchange', 'cancel', 'refund'],
        'Order Management': ['order', 'po#', 'tracking', 'status'],
        'Billing': ['billing', 'invoice', 'payment', 'price', 'cost'],
        'Product Info': ['product', 'specifications', 'dimensions', 'color'],
        'Warranty': ['warranty', 'damage', 'defect', 'quality']
      };
      
      Object.entries(categoryKeywords).forEach(([category, keywords]) => {
        keywords.forEach(keyword => {
          if (subject.includes(keyword)) {
            detectedCategory = category;
            detectedKeywords.push(keyword);
          }
        });
      });
      
      // Build CSV row
      const row = [
        ticket.id,
        (ticket.subject || '').replace(/[",\\n\\r]/g, ' '), // Clean subject for CSV
        ticket.status,
        ticket.priority || '',
        ticket.group_id || '',
        ticket.created_at,
        ticket.updated_at,
        (ticket.tags || []).join('; '),
        customFields[19885225321620] || '', // Sales Cycle
        customFields[19885854346772] || '', // Pre-Sales Category
        customFields[19940437490068] || '', // Post-Sale Category  
        customFields[19940362070164] || '', // Order Management Category
        customFields[24164978257044] || '', // Reason For Calling
        customFields[41713375917076] || '', // Inquiry Type
        detectedCategory,
        detectedKeywords.join('; ')
      ];
      
      csvData.push(row);
    });
    
    // Convert to CSV string
    const csvContent = csvData.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\\n');
    
    // Write to file
    const filename = `zendesk-categories-2025-${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, csvContent, 'utf8');
    
    console.log(`✅ CSV exported successfully: ${filename}`);
    console.log(`📊 Total tickets exported: ${csvData.length - 1}`);
    
    // Print category summary
    const categorySummary = {};
    csvData.slice(1).forEach(row => {
      const category = row[14]; // Detected Category column
      categorySummary[category] = (categorySummary[category] || 0) + 1;
    });
    
    console.log('\\n📈 Category Summary:');
    Object.entries(categorySummary)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        const percentage = ((count / (csvData.length - 1)) * 100).toFixed(1);
        console.log(`   ${category}: ${count} tickets (${percentage}%)`);
      });
    
  } catch (error) {
    console.error('❌ Error exporting to CSV:', error.message);
  }
}

// Run the export
exportTicketCategoriesToCSV();