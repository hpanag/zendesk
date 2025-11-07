const fs = require('fs');
const path = require('path');

async function analyzeCustomerIssues() {
  try {
    console.log('📊 Analyzing customer issue patterns...\n');
    
    // Read the CSV file
    const filePath = path.join(__dirname, 'rawdata20days.csv');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Simple CSV parser
    const lines = fileContent.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    console.log('✅ Loaded', lines.length - 1, 'tickets\n');
    
    // Map header names to indices
    const headerIndex = {};
    headers.forEach((header, i) => {
      headerIndex[header] = i;
    });
    
    // Group tickets by customer (requester_id) and extract subject
    const customerMap = {};
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const row = parseCSVLine(line);
      const requesterId = row[headerIndex['requester_id']];
      const subject = (row[headerIndex['subject']] || 'No Subject').toLowerCase().trim();
      const ticketId = row[headerIndex['id']];
      const status = row[headerIndex['status']] || '';
      const createdAt = row[headerIndex['created_at']] || '';
      
      if (!requesterId) continue; // Skip tickets without requester
      
      if (!customerMap[requesterId]) {
        customerMap[requesterId] = {
          requester_id: requesterId,
          ticket_count: 0,
          issues: {},
          tickets: []
        };
      }
      
      customerMap[requesterId].ticket_count++;
      
      if (!customerMap[requesterId].issues[subject]) {
        customerMap[requesterId].issues[subject] = [];
      }
      customerMap[requesterId].issues[subject].push(ticketId);
      
      customerMap[requesterId].tickets.push({
        id: ticketId,
        subject: row[headerIndex['subject']],
        status: status,
        created_at: createdAt
      });
    }
    
    // Analyze the data
    let sameIssueCount = 0;
    let sameIssueInstances = 0;
    let differentIssueCount = 0;
    let totalCustomers = 0;
    let totalRepeatCustomers = 0;
    
    const sameIssueDetails = [];
    const differentIssueDetails = [];
    
    Object.values(customerMap).forEach(customer => {
      const issueCount = Object.keys(customer.issues).length;
      
      if (customer.ticket_count > 1) {
        totalRepeatCustomers++;
        
        // Check for same issue repeated
        Object.entries(customer.issues).forEach(([issue, ticketIds]) => {
          if (ticketIds.length > 1) {
            sameIssueCount++;
            sameIssueInstances += ticketIds.length;
            sameIssueDetails.push({
              requester_id: customer.requester_id,
              issue: issue,
              times_reached_out: ticketIds.length,
              ticket_ids: ticketIds.join('; ')
            });
          }
        });
        
        // Different issues by same customer
        if (issueCount > 1) {
          differentIssueCount++;
          differentIssueDetails.push({
            requester_id: customer.requester_id,
            unique_issues: issueCount,
            total_tickets: customer.ticket_count,
            issues: Object.keys(customer.issues).slice(0, 3).join(' | '),
            first_ticket: customer.tickets[0].created_at,
            last_ticket: customer.tickets[customer.tickets.length - 1].created_at
          });
        }
      }
      
      totalCustomers++;
    });
    
    // Create summary report
    console.log('📈 CUSTOMER ANALYSIS SUMMARY');
    console.log('============================\n');
    
    console.log('👥 Customer Statistics:');
    console.log('   Total Unique Customers:', totalCustomers);
    console.log('   Repeat Customers (2+ tickets):', totalRepeatCustomers);
    console.log('   One-time Customers:', totalCustomers - totalRepeatCustomers);
    console.log('   Repeat Customer Rate:', ((totalRepeatCustomers / totalCustomers) * 100).toFixed(1) + '%\n');
    
    console.log('🔄 SAME ISSUE - SAME CUSTOMER:');
    console.log('   ⭐ Customers reaching out for SAME issue: ' + sameIssueCount);
    console.log('   📊 Total repeated tickets: ' + sameIssueInstances);
    console.log('   (Multiple tickets on identical topic)\n');
    
    console.log('❓ DIFFERENT ISSUES - SAME CUSTOMER:');
    console.log('   ⭐ Customers reaching out for DIFFERENT issues: ' + differentIssueCount);
    console.log('   (Same customer, but different problems)\n');
    
    // Create two CSV files with detailed data
    
    // 1. Same Issue Analysis
    if (sameIssueDetails.length > 0) {
      const sameIssueCsv = buildCsv(
        ['Requester ID', 'Issue', 'Times Reached Out', 'Ticket IDs'],
        sameIssueDetails.map(item => [
          item.requester_id,
          item.issue,
          item.times_reached_out,
          item.ticket_ids
        ])
      );
      
      fs.writeFileSync(
        path.join(__dirname, 'analysis_same_issue.csv'),
        sameIssueCsv,
        'utf-8'
      );
      
      console.log('📄 File 1: analysis_same_issue.csv');
      console.log('   📊 Records: ' + sameIssueDetails.length);
      console.log('   🏆 Top repeated issues:');
      
      sameIssueDetails
        .sort((a, b) => b.times_reached_out - a.times_reached_out)
        .slice(0, 5)
        .forEach((item, i) => {
          console.log('     ' + (i+1) + '. "' + item.issue.substring(0, 50) + '..." - ' + item.times_reached_out + ' tickets');
        });
    }
    
    console.log('');
    
    // 2. Different Issues Analysis
    if (differentIssueDetails.length > 0) {
      const differentIssueCsv = buildCsv(
        ['Requester ID', 'Unique Issues', 'Total Tickets', 'Sample Issues', 'First Ticket', 'Last Ticket'],
        differentIssueDetails.map(item => [
          item.requester_id,
          item.unique_issues,
          item.total_tickets,
          item.issues,
          item.first_ticket,
          item.last_ticket
        ])
      );
      
      fs.writeFileSync(
        path.join(__dirname, 'analysis_different_issues.csv'),
        differentIssueCsv,
        'utf-8'
      );
      
      console.log('📄 File 2: analysis_different_issues.csv');
      console.log('   📊 Records: ' + differentIssueDetails.length);
      console.log('   🏆 Top customers with different issues:');
      
      differentIssueDetails
        .sort((a, b) => b.total_tickets - a.total_tickets)
        .slice(0, 5)
        .forEach((item, i) => {
          console.log('     ' + (i+1) + '. Customer ' + item.requester_id.substring(0, 10) + ' - ' + item.total_tickets + ' tickets, ' + item.unique_issues + ' different issues');
        });
    }
    
    console.log('\n✅ Analysis complete!\n');
    
    console.log('📊 KEY FINDINGS:');
    console.log('================');
    console.log('');
    console.log('❶ SAME ISSUE REPEATS (Most Important for Product Quality)');
    console.log('   ' + sameIssueCount + ' customers reached out multiple times for the SAME issue');
    console.log('   Total repeated tickets: ' + sameIssueInstances);
    console.log('   👉 This suggests: Incomplete fixes, recurring problems, or product bugs');
    console.log('');
    console.log('❷ DIFFERENT ISSUES (Customer Pain Points)');
    console.log('   ' + differentIssueCount + ' customers have tickets for DIFFERENT issues');
    console.log('   👉 This suggests: Multiple unrelated problems or complex product needs');
    console.log('');
    
    if (sameIssueCount > differentIssueCount) {
      console.log('⚠️  ACTION ITEM: Focus on resolving repeated issues!');
      console.log('   More customers are struggling with the same problem.');
      console.log('   Recommendation: Investigate top repeated issues for root causes.');
    } else {
      console.log('ℹ️  Customers are experiencing diverse issues.');
      console.log('   Recommendation: Improve customer education and product documentation.');
    }
    
    console.log('\n📁 Generated Analysis Files:');
    console.log('   📄 analysis_same_issue.csv');
    console.log('   📄 analysis_different_issues.csv');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Simple CSV line parser that handles quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Helper function to build CSV
function buildCsv(headers, rows) {
  const lines = [];
  
  // Add header
  lines.push(headers.map(escapeCSV).join(','));
  
  // Add rows
  rows.forEach(row => {
    lines.push(row.map(escapeCSV).join(','));
  });
  
  return lines.join('\n');
}

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
}

analyzeCustomerIssues();
