const ZendeskClient = require('./ZendeskClient');

class TicketStatusTransitionAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
    this.statusTransitions = [];
    this.transitionStats = {};
  }

  async fetchTicketAudits(ticketId) {
    try {
      const response = await this.zendesk.makeRequest('GET', `/tickets/${ticketId}/audits.json`);
      return response.audits || [];
    } catch (error) {
      console.error(`Error fetching audits for ticket ${ticketId}:`, error.message);
      return [];
    }
  }

  async fetchRecentTicketsWithAudits(hours = 24) {
    console.log(`📊 Fetching tickets updated in the last ${hours} hours...`);
    
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);
    
    try {
      // Use the regular tickets API with updated_at filter instead of search
      let allTickets = [];
      let page = 1;
      let hasMore = true;
      const maxTickets = 500; // Reasonable limit for audit analysis
      
      while (hasMore && allTickets.length < maxTickets) {
        console.log(`Fetching page ${page} of recent tickets...`);
        
        const response = await this.zendesk.getTickets({
          page: page,
          per_page: 100,
          sort_by: 'updated_at',
          sort_order: 'desc'
        });
        
        if (response.tickets && response.tickets.length > 0) {
          // Filter tickets that were actually updated in our timeframe
          const recentTickets = response.tickets.filter(ticket => {
            const updatedAt = new Date(ticket.updated_at);
            return updatedAt >= cutoffDate;
          });
          
          allTickets.push(...recentTickets);
          console.log(`Found ${recentTickets.length} tickets updated in timeframe (Total: ${allTickets.length})`);
          
          // If no tickets in this batch match our timeframe, we're done
          if (recentTickets.length === 0) {
            hasMore = false;
          } else {
            hasMore = response.next_page !== null && response.tickets.length === 100;
            page++;
          }
          
          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          hasMore = false;
        }
      }
      
      console.log(`✅ Found ${allTickets.length} tickets updated in the last ${hours} hours`);
      return allTickets;
    } catch (error) {
      console.error('Error fetching recent tickets:', error.message);
      return [];
    }
  }

  extractStatusChangesFromAudits(audits, ticketId, timeframeHours = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - timeframeHours);
    
    const transitions = [];
    
    // Sort audits by creation time
    const sortedAudits = audits.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    for (let i = 0; i < sortedAudits.length; i++) {
      const audit = sortedAudits[i];
      const auditDate = new Date(audit.created_at);
      
      // Only look at audits within our timeframe
      if (auditDate < cutoffDate) continue;
      
      // Look for status changes in this audit
      if (audit.events) {
        audit.events.forEach(event => {
          if (event.field_name === 'status' && event.type === 'Change') {
            const previousStatus = event.previous_value;
            const newStatus = event.value;
            
            transitions.push({
              ticketId: ticketId,
              fromStatus: previousStatus,
              toStatus: newStatus,
              changedAt: audit.created_at,
              changedBy: audit.author_id,
              auditId: audit.id
            });
          }
        });
      }
    }
    
    return transitions;
  }

  async analyzeStatusTransitions(timeframeHours = 24) {
    try {
      console.log(`🔄 Analyzing status transitions in the last ${timeframeHours} hours...`);
      
      // Get recently updated tickets
      const recentTickets = await this.fetchRecentTicketsWithAudits(timeframeHours);
      
      if (recentTickets.length === 0) {
        console.log('No recently updated tickets found.');
        return {};
      }
      
      // Analyze each ticket's audit history
      let processedCount = 0;
      const batchSize = 10; // Process tickets in batches to manage API rate limits
      
      for (let i = 0; i < recentTickets.length; i += batchSize) {
        const batch = recentTickets.slice(i, i + batchSize);
        
        console.log(`Processing tickets ${i + 1}-${Math.min(i + batchSize, recentTickets.length)} of ${recentTickets.length}...`);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (ticket) => {
          const audits = await this.fetchTicketAudits(ticket.id);
          const transitions = this.extractStatusChangesFromAudits(audits, ticket.id, timeframeHours);
          return transitions;
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // Flatten and add to main array
        batchResults.forEach(transitions => {
          this.statusTransitions.push(...transitions);
        });
        
        processedCount += batch.length;
        
        // Add delay between batches
        if (i + batchSize < recentTickets.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`✅ Processed ${processedCount} tickets`);
      console.log(`🔄 Found ${this.statusTransitions.length} status transitions`);
      
      // Calculate transition statistics
      this.calculateTransitionStats(timeframeHours);
      
      return this.transitionStats;
      
    } catch (error) {
      console.error('❌ Error analyzing status transitions:', error.message);
      throw error;
    }
  }

  calculateTransitionStats(timeframeHours = 24) {
    console.log('📈 Calculating transition statistics...');
    
    const stats = {
      totalTransitions: this.statusTransitions.length,
      transitionCounts: {},
      fromStatusCounts: {},
      toStatusCounts: {},
      transitionDetails: [],
      timeframe: `Last ${timeframeHours} hours`,
      analysisDate: new Date().toISOString()
    };
    
    this.statusTransitions.forEach(transition => {
      const transitionKey = `${transition.fromStatus} → ${transition.toStatus}`;
      
      // Count transitions by type
      stats.transitionCounts[transitionKey] = (stats.transitionCounts[transitionKey] || 0) + 1;
      
      // Count from statuses
      stats.fromStatusCounts[transition.fromStatus] = (stats.fromStatusCounts[transition.fromStatus] || 0) + 1;
      
      // Count to statuses
      stats.toStatusCounts[transition.toStatus] = (stats.toStatusCounts[transition.toStatus] || 0) + 1;
      
      // Add to details
      stats.transitionDetails.push({
        ticketId: transition.ticketId,
        from: transition.fromStatus,
        to: transition.toStatus,
        when: transition.changedAt,
        by: transition.changedBy
      });
    });
    
    this.transitionStats = stats;
  }

  printTransitionReport() {
    if (!this.transitionStats || !this.transitionStats.totalTransitions || this.transitionStats.totalTransitions === 0) {
      console.log('⚠️ No status transitions found in the specified timeframe.');
      return;
    }
    
    const stats = this.transitionStats;
    
    console.log('\n' + '='.repeat(70));
    console.log('🔄 TICKET STATUS TRANSITION REPORT');
    console.log('='.repeat(70));
    
    console.log(`\n📋 SUMMARY:`);
    console.log(`   Timeframe: ${stats.timeframe}`);
    console.log(`   Analysis Date: ${new Date(stats.analysisDate).toLocaleString()}`);
    console.log(`   Total Transitions: ${stats.totalTransitions}`);
    
    console.log(`\n🔄 TRANSITION BREAKDOWN:`);
    Object.entries(stats.transitionCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([transition, count]) => {
        const percentage = ((count / stats.totalTransitions) * 100).toFixed(1);
        console.log(`   ${transition.padEnd(25)}: ${count.toString().padStart(3)} transitions (${percentage}%)`);
      });
    
    console.log(`\n📤 FROM STATUS (Tickets Leaving Status):`);
    Object.entries(stats.fromStatusCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([status, count]) => {
        const percentage = ((count / stats.totalTransitions) * 100).toFixed(1);
        console.log(`   ${status.toUpperCase().padEnd(12)}: ${count.toString().padStart(3)} tickets (${percentage}%)`);
      });
    
    console.log(`\n📥 TO STATUS (Tickets Entering Status):`);
    Object.entries(stats.toStatusCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([status, count]) => {
        const percentage = ((count / stats.totalTransitions) * 100).toFixed(1);
        console.log(`   ${status.toUpperCase().padEnd(12)}: ${count.toString().padStart(3)} tickets (${percentage}%)`);
      });
    
    console.log(`\n📝 RECENT TRANSITIONS (Last 10):`);
    const recentTransitions = stats.transitionDetails
      .sort((a, b) => new Date(b.when) - new Date(a.when))
      .slice(0, 10);
    
    recentTransitions.forEach((transition, index) => {
      const when = new Date(transition.when).toLocaleString();
      console.log(`   ${index + 1}. Ticket #${transition.ticketId}: ${transition.from} → ${transition.to} (${when})`);
    });
    
    console.log('\n' + '='.repeat(70));
  }

  async exportTransitionsToJSON(filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      filename = `zendesk-transitions-${timestamp}.json`;
    }

    const fs = require('fs');
    const path = require('path');
    
    const filePath = path.join(__dirname, '..', 'data', filename);
    
    try {
      const exportData = {
        ...this.transitionStats,
        rawTransitions: this.statusTransitions
      };
      
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      console.log(`✅ Transition data exported to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('❌ Error exporting transition data:', error.message);
      throw error;
    }
  }

  // Method to analyze specific transition patterns
  getSpecificTransition(fromStatus, toStatus) {
    const transitions = this.statusTransitions.filter(t => 
      t.fromStatus.toLowerCase() === fromStatus.toLowerCase() && 
      t.toStatus.toLowerCase() === toStatus.toLowerCase()
    );
    
    return {
      count: transitions.length,
      transitions: transitions.map(t => ({
        ticketId: t.ticketId,
        when: t.changedAt,
        by: t.changedBy
      }))
    };
  }
}

module.exports = TicketStatusTransitionAnalyzer;