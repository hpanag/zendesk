const ZendeskClient = require('./src/ZendeskClient');
const fs = require('fs');
const path = require('path');

async function exportTicketsToCSV() {
  try {
    console.log('📥 Exporting last 20 days of tickets to CSV...\n');
    const client = new ZendeskClient();
    
    // Calculate date range: last 20 days from today
    const today = new Date();
    const twentyDaysAgo = new Date(today);
    twentyDaysAgo.setDate(today.getDate() - 20);
    
    const startDate = twentyDaysAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];
    
    console.log('📅 Date range:', startDate, 'to', endDate);
    console.log('🔍 Fetching ALL tickets (created, updated, or closed in last 20 days)...\n');
    
    // Fetch all tickets that were created, updated, or closed in the last 20 days
    // Using updated_at to capture all tickets that were worked on
    const query = 'type:ticket updated>=' + startDate;
    let allTickets = [];
    let pageCount = 0;
    let offset = 0;
    const pageSize = 100;
    const maxPages = 200; // Safety limit: up to 20,000 tickets
    
    console.log('📊 Fetching tickets with pagination (max 20,000)...');
    
    // Continue fetching until we get no more results
    let hasMore = true;
    while (hasMore) {
      try {
        console.log('   � Fetching offset: ' + offset + '...');
        
        // Use direct API call for better pagination control
        const response = await client.makeRequest('GET', '/search.json', {
          query: query,
          per_page: pageSize,
          sort_by: 'updated_at',
          sort_order: 'desc',
          offset: offset
        });
        
        if (response.results && response.results.length > 0) {
          allTickets = allTickets.concat(response.results);
          pageCount++;
          console.log('   ✓ Page ' + pageCount + ': ' + response.results.length + ' tickets (' + allTickets.length + ' total)');
          
          offset += pageSize;
          
          // Check if there are more results
          if (response.results.length < pageSize) {
            hasMore = false;
            console.log('\n✅ Reached end of results');
          }
        } else {
          hasMore = false;
          console.log('\nℹ️ No more results');
        }
      } catch (error) {
        console.error('❌ Error fetching page:', error.message);
        hasMore = false;
      }
    }
    
    console.log('\n✅ Total tickets fetched:', allTickets.length);
    
    if (allTickets.length === 0) {
      console.log('⚠️ No tickets found');
      return;
    }
    
    // Define all fields we want to export
    const standardFields = [
      'id',
      'created_at',
      'updated_at',
      'type',
      'subject',
      'description',
      'priority',
      'status',
      'requester_id',
      'submitter_id',
      'assignee_id',
      'organization_id',
      'group_id',
      'has_incidents',
      'is_public',
      'due_at',
      'tags',
      'satisfaction_rating',
      'custom_status_id',
      'brand_id',
      'allow_channelback',
      'allow_attachments',
      'from_messaging_channel'
    ];
    
    // Get unique custom field IDs
    const customFieldIds = new Set();
    allTickets.forEach(ticket => {
      if (ticket.custom_fields && Array.isArray(ticket.custom_fields)) {
        ticket.custom_fields.forEach(cf => {
          if (cf.id) customFieldIds.add(cf.id);
        });
      }
    });
    
    const customFieldArray = Array.from(customFieldIds).sort((a, b) => a - b);
    
    // Build CSV header
    let csvHeader = standardFields.join(',');
    if (customFieldArray.length > 0) {
      csvHeader += ',' + customFieldArray.map(id => 'custom_field_' + id).join(',');
    }
    
    // Escape CSV value
    function escapeCSV(value) {
      if (value === null || value === undefined) {
        return '';
      }
      
      const stringValue = String(value);
      
      // If contains comma, quote, or newline, wrap in quotes and escape inner quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
      }
      
      return stringValue;
    }
    
    // Convert value to string based on type
    function formatValue(value) {
      if (value === null || value === undefined) {
        return '';
      }
      
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          return value.join('; ');
        }
        // For object fields like requester, try to get the ID or name
        if (value.id) return value.id;
        if (value.name) return value.name;
        return JSON.stringify(value);
      }
      
      return String(value);
    }
    
    // Build CSV rows
    console.log('\n📝 Building CSV content...');
    let csvContent = csvHeader + '\n';
    
    allTickets.forEach((ticket, index) => {
      if (index % 500 === 0 && index > 0) {
        console.log('   ✓ Processed ' + index + ' tickets...');
      }
      const row = standardFields.map(field => {
        let value = ticket[field];
        value = formatValue(value);
        return escapeCSV(value);
      });
      
      // Add custom fields
      if (customFieldArray.length > 0) {
        const customFieldMap = {};
        if (ticket.custom_fields && Array.isArray(ticket.custom_fields)) {
          ticket.custom_fields.forEach(cf => {
            customFieldMap[cf.id] = cf.value;
          });
        }
        
        customFieldArray.forEach(cfId => {
          const value = customFieldMap[cfId] || '';
          row.push(escapeCSV(formatValue(value)));
        });
      }
      
      csvContent += row.join(',') + '\n';
    });
    
    // Write to file
    const filename = 'rawdata20days.csv';
    const filepath = path.join(__dirname, filename);
    
    console.log('\n💾 Writing file...');
    fs.writeFileSync(filepath, csvContent, 'utf-8');
    
    console.log('\n✅ CSV file created successfully!');
    console.log('📄 File:', filepath);
    console.log('📊 Rows:', allTickets.length);
    console.log('📋 Columns:', standardFields.length + customFieldArray.length);
    console.log('📏 Size:', (fs.statSync(filepath).size / 1024).toFixed(2), 'KB');
    console.log('\n🎉 Ready to import into Excel!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', error.response.data);
    }
  }
}

exportTicketsToCSV();
