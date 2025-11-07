const ZendeskClient = require('./src/ZendeskClient');
const fs = require('fs');
const path = require('path');

async function exportTicketsToCSV() {
  try {
    console.log('📥 Exporting LAST 20 DAYS of tickets to CSV...\n');
    const client = new ZendeskClient();
    
    // Calculate date range
    const today = new Date();
    const twentyDaysAgo = new Date(today);
    twentyDaysAgo.setDate(today.getDate() - 20);
    
    const startDate = twentyDaysAgo.toISOString().split('T')[0];
    
    console.log('📅 Start date:', startDate);
    console.log('📅 End date:', today.toISOString().split('T')[0]);
    console.log('🔍 Fetching ALL tickets updated in last 20 days...\n');
    
    // Query for all tickets updated in last 20 days
    const query = 'type:ticket updated>=' + startDate;
    
    // First, just do a count to see how many we have
    console.log('📊 Counting tickets...');
    const countResult = await client.search(query, { per_page: 1 });
    const totalCount = countResult.count;
    console.log('📊 Total tickets found:', totalCount);
    
    // Now fetch all with pagination - fetch up to first 5000 only
    let allTickets = [];
    let offset = 0;
    const pageSize = 100;
    const maxTickets = 5000;
    
    console.log('📥 Starting fetch (max ' + maxTickets + ' tickets)...\n');
    
    let fetchCount = 0;
    while (allTickets.length < totalCount && allTickets.length < maxTickets && fetchCount < 100) {
      try {
        fetchCount++;
        console.log('   📄 Fetching batch ' + fetchCount + ' (offset: ' + offset + ')...');
        
        const response = await client.makeRequest('GET', '/search.json', {
          query: query,
          per_page: pageSize,
          sort_by: 'updated_at',
          sort_order: 'desc',
          offset: offset
        });
        
        if (response.results && response.results.length > 0) {
          allTickets = allTickets.concat(response.results);
          console.log('   ✓ Batch ' + fetchCount + ': ' + response.results.length + ' tickets (Total: ' + allTickets.length + ')');
          offset += pageSize;
          
          if (response.results.length < pageSize) {
            console.log('   ✅ End of data reached');
            break;
          }
        } else {
          console.log('   ✅ No more results');
          break;
        }
      } catch (error) {
        console.error('❌ Error in batch ' + fetchCount + ':', error.message);
        break;
      }
    }
    
    console.log('\n✅ Fetching complete!');
    console.log('📊 Total tickets exported:', allTickets.length);
    
    if (allTickets.length === 0) {
      console.log('⚠️ No tickets found');
      return;
    }
    
    // Define standard fields
    const standardFields = [
      'id', 'created_at', 'updated_at', 'type', 'subject', 'description',
      'priority', 'status', 'requester_id', 'submitter_id', 'assignee_id',
      'organization_id', 'group_id', 'has_incidents', 'is_public', 'due_at',
      'tags', 'satisfaction_rating', 'custom_status_id', 'brand_id',
      'allow_channelback', 'allow_attachments', 'from_messaging_channel'
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
    
    // Helper functions
    function escapeCSV(value) {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
      }
      return stringValue;
    }
    
    function formatValue(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') {
        if (Array.isArray(value)) return value.join('; ');
        if (value.id) return value.id;
        if (value.name) return value.name;
        return JSON.stringify(value);
      }
      return String(value);
    }
    
    // Build CSV content
    console.log('\n📝 Building CSV content...');
    let csvContent = csvHeader + '\n';
    
    allTickets.forEach((ticket, index) => {
      if (index % 1000 === 0 && index > 0) {
        console.log('   ✓ Processed ' + index + ' rows...');
      }
      
      const row = standardFields.map(field => {
        return escapeCSV(formatValue(ticket[field]));
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
          row.push(escapeCSV(formatValue(customFieldMap[cfId] || '')));
        });
      }
      
      csvContent += row.join(',') + '\n';
    });
    
    // Write to file
    const filename = 'rawdata20days.csv';
    const filepath = path.join(__dirname, filename);
    
    console.log('💾 Writing file...');
    fs.writeFileSync(filepath, csvContent, 'utf-8');
    
    const fileSize = fs.statSync(filepath).size;
    
    console.log('\n✅ CSV file created successfully!');
    console.log('📄 File:', filepath);
    console.log('📊 Data rows:', allTickets.length);
    console.log('📋 Total columns:', standardFields.length + customFieldArray.length);
    console.log('📏 File size:', (fileSize / 1024 / 1024).toFixed(2), 'MB');
    console.log('\n🎉 File is ready to import into Excel!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

exportTicketsToCSV();
