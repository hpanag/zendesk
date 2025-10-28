const ZendeskClient = require('./src/ZendeskClient');

/**
 * Zendesk 2025 Tickets by Category Report Generator
 * 
 * This script analyzes all tickets from 2025 and categorizes them based on:
 * 1. Custom fields (Sales Cycle, Inquiry Category, etc.)
 * 2. Subject line keywords
 * 3. Tags
 * 4. Groups/Departments
 */

class ZendeskCategoryReporter {
  constructor() {
    this.client = new ZendeskClient();
    
    // Define category mappings based on your custom fields
    this.categoryMappings = {
      // Sales Cycle Categories (Field ID: 19885225321620)
      'Pre-Sale Question: Product': 'Pre-Sales',
      'Pricing/Quote': 'Pre-Sales', 
      'Check out Issues': 'Website/Checkout',
      'Color Samples': 'Product Information',
      'Order Management: Tracking': 'Order Management',
      'Delivery Issue': 'Shipping/Delivery',
      'Return/Cancellation Request': 'Returns/Cancellations',
      'Post-shipment: Parts': 'Parts/Hardware',
      'Warranty': 'Warranty',
      'Instruction Sheet': 'Assembly/Instructions',
      'Assembly Assistance': 'Assembly/Instructions',
      
      // Inquiry Categories
      'Product Inquiry': 'Product Information',
      'Color Sample Request': 'Product Information',
      'Pricing': 'Pricing/Billing',
      'Services': 'Services',
      'Assembly\\Installation': 'Assembly/Instructions',
      'Delivery Options': 'Shipping/Delivery',
      'Space Planning': 'Services',
      
      // Post-Sale Categories
      'Order Replacement Parts': 'Parts/Hardware',
      'Missing_ hardware': 'Parts/Hardware', 
      'Assembly Guides': 'Assembly/Instructions',
      'Order Status': 'Order Management',
      'Touch marker/pen': 'Parts/Hardware',
      'Wall Bed Hardware Kit Request': 'Parts/Hardware'
    };
    
    // Subject keyword mappings
    this.subjectKeywords = {
      'Shipping/Delivery': [
        'shipping', 'delivery', 'ship', 'freight', 'carrier', 'tracking', 
        'delayed', 'transit', 'eta', 'delivered', 'missed delivery'
      ],
      'Billing/Payment': [
        'billing', 'invoice', 'payment', 'charge', 'refund', 'credit',
        'promo code', 'discount', 'pricing', 'quote', 'cost'
      ],
      'Assembly/Instructions': [
        'assembly', 'instruction', 'install', 'setup', 'guide', 
        'how to', 'assembly assistance', 'assemble'
      ],
      'Returns/Cancellations': [
        'return', 'exchange', 'cancel', 'refund', 'send back'
      ],
      'Parts/Hardware': [
        'missing', 'hardware', 'parts', 'replacement', 'screw', 
        'bolt', 'piece', 'component'
      ],
      'Warranty/Damage': [
        'warranty', 'damage', 'defect', 'broken', 'quality', 
        'collapse', 'injury', 'safety'
      ],
      'Order Management': [
        'order', 'purchase', 'tracking', 'status', 'po#', 'order#'
      ],
      'Product Information': [
        'product', 'specifications', 'dimensions', 'color', 'sample',
        'swatch', 'model', 'item'
      ]
    };
  }

  /**
   * Generate comprehensive category report for 2025
   */
  async generateCategoryReport() {
    console.log('📊 Generating 2025 Zendesk Tickets Category Report');
    console.log('================================================\\n');
    
    try {
      // Get all 2025 tickets
      console.log('🔍 Fetching all 2025 tickets...');
      const allTickets = await this.fetchAll2025Tickets();
      
      console.log(`📈 Total 2025 tickets found: ${allTickets.length}\\n`);
      
      // Analyze by custom fields
      const customFieldCategories = this.analyzeByCustomFields(allTickets);
      
      // Analyze by subject keywords
      const subjectCategories = this.analyzeBySubjectKeywords(allTickets);
      
      // Analyze by tags
      const tagCategories = this.analyzeByTags(allTickets);
      
      // Analyze by groups
      const groupCategories = this.analyzeByGroups(allTickets);
      
      // Generate final consolidated report
      const consolidatedReport = this.consolidateCategories(
        customFieldCategories,
        subjectCategories,
        tagCategories,
        groupCategories
      );
      
      // Print detailed report
      this.printDetailedReport(consolidatedReport, allTickets.length);
      
      // Generate summary statistics
      this.printSummaryStats(allTickets);
      
      return consolidatedReport;
      
    } catch (error) {
      console.error('❌ Error generating report:', error.message);
      throw error;
    }
  }
  
  /**
   * Fetch all 2025 tickets in batches
   */
  async fetchAll2025Tickets() {
    const tickets = [];
    let page = 1;
    const perPage = 100;
    
    while (true) {
      try {
        console.log(`   Fetching page ${page}...`);
        
        const result = await this.client.search('type:ticket created>=2025-01-01', {
          per_page: perPage,
          page: page
        });
        
        if (!result.results || result.results.length === 0) {
          break;
        }
        
        tickets.push(...result.results);
        
        // Add delay to avoid rate limiting
        await this.delay(100);
        
        page++;
        
        // Safety check to avoid infinite loop
        if (page > 100) {
          console.log('⚠️ Reached page limit, stopping...');
          break;
        }
        
      } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error.message);
        break;
      }
    }
    
    return tickets;
  }
  
  /**
   * Analyze tickets by custom field values
   */
  analyzeByCustomFields(tickets) {
    console.log('🏷️ Analyzing by custom fields...');
    
    const categories = {};
    const fieldMappings = {
      19885225321620: 'Sales Cycle',
      19885854346772: 'Pre-Sales Category', 
      19885862279700: 'Inquiry Category - Pre-Sales',
      19940362070164: 'Order Management Category',
      19940437490068: 'Post-Sale Category',
      24164978257044: 'Reason For Calling',
      41713375917076: 'Inquiry Type'
    };
    
    tickets.forEach(ticket => {
      if (ticket.custom_fields) {
        ticket.custom_fields.forEach(field => {
          if (fieldMappings[field.id] && field.value) {
            const fieldName = fieldMappings[field.id];
            const value = field.value;
            
            if (!categories[fieldName]) {
              categories[fieldName] = {};
            }
            
            if (!categories[fieldName][value]) {
              categories[fieldName][value] = 0;
            }
            
            categories[fieldName][value]++;
          }
        });
      }
    });
    
    return categories;
  }
  
  /**
   * Analyze tickets by subject line keywords
   */
  analyzeBySubjectKeywords(tickets) {
    console.log('📝 Analyzing by subject keywords...');
    
    const categories = {};
    
    Object.keys(this.subjectKeywords).forEach(category => {
      categories[category] = 0;
    });
    
    tickets.forEach(ticket => {
      const subject = (ticket.subject || '').toLowerCase();
      
      Object.entries(this.subjectKeywords).forEach(([category, keywords]) => {
        const hasKeyword = keywords.some(keyword => 
          subject.includes(keyword.toLowerCase())
        );
        
        if (hasKeyword) {
          categories[category]++;
        }
      });
    });
    
    return categories;
  }
  
  /**
   * Analyze tickets by tags
   */
  analyzeByTags(tickets) {
    console.log('🏷️ Analyzing by tags...');
    
    const tagCounts = {};
    
    tickets.forEach(ticket => {
      if (ticket.tags) {
        ticket.tags.forEach(tag => {
          if (!tagCounts[tag]) {
            tagCounts[tag] = 0;
          }
          tagCounts[tag]++;
        });
      }
    });
    
    // Sort tags by frequency
    const sortedTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20);
    
    return Object.fromEntries(sortedTags);
  }
  
  /**
   * Analyze tickets by groups
   */
  analyzeByGroups(tickets) {
    console.log('👥 Analyzing by groups...');
    
    const groupCounts = {};
    
    tickets.forEach(ticket => {
      const groupId = ticket.group_id;
      if (groupId) {
        if (!groupCounts[groupId]) {
          groupCounts[groupId] = 0;
        }
        groupCounts[groupId]++;
      }
    });
    
    return groupCounts;
  }
  
  /**
   * Consolidate all category analyses
   */
  consolidateCategories(customFields, subjects, tags, groups) {
    return {
      customFields,
      subjects,
      tags,
      groups,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Print detailed report
   */
  printDetailedReport(report, totalTickets) {
    console.log('\\n📋 DETAILED CATEGORY REPORT - 2025');
    console.log('====================================');
    
    console.log(`\\n📊 Total Tickets Analyzed: ${totalTickets.toLocaleString()}`);
    
    // Custom Fields Analysis
    console.log('\\n🏷️ CUSTOM FIELDS ANALYSIS');
    console.log('---------------------------');
    
    Object.entries(report.customFields).forEach(([fieldName, values]) => {
      console.log(`\\n${fieldName}:`);
      const sortedValues = Object.entries(values)
        .sort(([,a], [,b]) => b - a);
      
      sortedValues.forEach(([value, count]) => {
        const percentage = ((count / totalTickets) * 100).toFixed(1);
        console.log(`   • ${value}: ${count.toLocaleString()} tickets (${percentage}%)`);
      });
    });
    
    // Subject Keywords Analysis
    console.log('\\n📝 SUBJECT KEYWORD ANALYSIS');
    console.log('----------------------------');
    
    const sortedSubjects = Object.entries(report.subjects)
      .sort(([,a], [,b]) => b - a);
    
    sortedSubjects.forEach(([category, count]) => {
      const percentage = ((count / totalTickets) * 100).toFixed(1);
      console.log(`   • ${category}: ${count.toLocaleString()} tickets (${percentage}%)`);
    });
    
    // Top Tags Analysis
    console.log('\\n🏷️ TOP TAGS ANALYSIS');
    console.log('---------------------');
    
    Object.entries(report.tags).forEach(([tag, count]) => {
      const percentage = ((count / totalTickets) * 100).toFixed(1);
      console.log(`   • ${tag}: ${count.toLocaleString()} tickets (${percentage}%)`);
    });
  }
  
  /**
   * Print summary statistics
   */
  printSummaryStats(tickets) {
    console.log('\\n📈 SUMMARY STATISTICS');
    console.log('=====================');
    
    // Monthly breakdown
    const monthlyBreakdown = {};
    
    tickets.forEach(ticket => {
      const date = new Date(ticket.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyBreakdown[monthKey]) {
        monthlyBreakdown[monthKey] = 0;
      }
      monthlyBreakdown[monthKey]++;
    });
    
    console.log('\\nMonthly Ticket Counts:');
    Object.entries(monthlyBreakdown)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([month, count]) => {
        console.log(`   ${month}: ${count.toLocaleString()} tickets`);
      });
    
    // Status breakdown
    const statusBreakdown = {};
    
    tickets.forEach(ticket => {
      const status = ticket.status;
      if (!statusBreakdown[status]) {
        statusBreakdown[status] = 0;
      }
      statusBreakdown[status]++;
    });
    
    console.log('\\nStatus Breakdown:');
    Object.entries(statusBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([status, count]) => {
        console.log(`   ${status}: ${count.toLocaleString()} tickets`);
      });
    
    // Priority breakdown
    const priorityBreakdown = {};
    
    tickets.forEach(ticket => {
      const priority = ticket.priority || 'not set';
      if (!priorityBreakdown[priority]) {
        priorityBreakdown[priority] = 0;
      }
      priorityBreakdown[priority]++;
    });
    
    console.log('\\nPriority Breakdown:');
    Object.entries(priorityBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([priority, count]) => {
        console.log(`   ${priority}: ${count.toLocaleString()} tickets`);
      });
  }
  
  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export and run if called directly
if (require.main === module) {
  async function runReport() {
    try {
      const reporter = new ZendeskCategoryReporter();
      const report = await reporter.generateCategoryReport();
      
      console.log('\\n✅ Report generation complete!');
      console.log('📄 Report saved to console output');
      
    } catch (error) {
      console.error('❌ Report generation failed:', error.message);
      process.exit(1);
    }
  }
  
  runReport();
}

module.exports = ZendeskCategoryReporter;