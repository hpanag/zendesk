const ZendeskClient = require('./ZendeskClient');

class TicketKPIAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
    this.ticketData = [];
    this.kpis = {};
  }

  async fetchAllTicketsForAnalysis() {
    console.log('📊 Fetching tickets for KPI analysis...');
    let page = 1;
    let totalFetched = 0;
    const maxTickets = 10000; // Zendesk limit

    while (totalFetched < maxTickets) {
      try {
        console.log(`Fetching page ${page}...`);
        const perPage = Math.min(100, maxTickets - totalFetched);
        
        const response = await this.zendesk.getTickets({
          page: page,
          per_page: perPage,
          sort_by: 'created_at',
          sort_order: 'desc'
        });

        if (response.tickets && response.tickets.length > 0) {
          this.ticketData.push(...response.tickets);
          totalFetched += response.tickets.length;
          console.log(`Fetched ${response.tickets.length} tickets (Total: ${totalFetched})`);
          
          if (totalFetched >= maxTickets || !response.next_page) {
            break;
          }
          
          page++;
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          break;
        }
      } catch (error) {
        if (error.response?.data?.errors?.[0]?.code === 'InvalidPaginationDepth') {
          console.log(`⚠️ Reached pagination limit at ${totalFetched} tickets`);
          break;
        }
        console.error(`Error fetching page ${page}:`, error.message);
        break;
      }
    }

    console.log(`✅ Total tickets fetched for analysis: ${this.ticketData.length}`);
    return this.ticketData;
  }

  calculateStatusKPIs() {
    console.log('📈 Calculating status-based KPIs...');
    
    const statusCounts = {};
    const priorityCounts = {};
    const typeCounts = {};
    const channelCounts = {};
    const satisfactionCounts = {};
    
    // Group tickets by various dimensions
    this.ticketData.forEach(ticket => {
      // Status counts
      const status = ticket.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      // Priority counts
      const priority = ticket.priority || 'normal';
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
      
      // Type counts
      const type = ticket.type || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      
      // Channel counts
      const channel = ticket.via?.channel || 'unknown';
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
      
      // Satisfaction counts
      const satisfaction = ticket.satisfaction_rating?.score || 'not_rated';
      satisfactionCounts[satisfaction] = (satisfactionCounts[satisfaction] || 0) + 1;
    });

    return {
      statusCounts,
      priorityCounts,
      typeCounts,
      channelCounts,
      satisfactionCounts
    };
  }

  calculateTimeBasedKPIs() {
    console.log('⏱️ Calculating time-based KPIs...');
    
    const now = new Date();
    const statusMetrics = {};
    
    // Initialize status metrics
    const allStatuses = [...new Set(this.ticketData.map(t => t.status))];
    allStatuses.forEach(status => {
      statusMetrics[status] = {
        count: 0,
        avgAgeInHours: 0,
        avgResolutionTimeInHours: 0,
        oldestTicketDays: 0,
        newestTicketDays: 0,
        totalAgeInHours: 0,
        totalResolutionTimeInHours: 0,
        resolvedCount: 0,
        tickets: []
      };
    });

    this.ticketData.forEach(ticket => {
      const status = ticket.status;
      const createdAt = new Date(ticket.created_at);
      const updatedAt = new Date(ticket.updated_at);
      
      // Calculate age in hours
      const ageInHours = (now - createdAt) / (1000 * 60 * 60);
      
      statusMetrics[status].count++;
      statusMetrics[status].totalAgeInHours += ageInHours;
      statusMetrics[status].tickets.push({
        id: ticket.id,
        subject: ticket.subject,
        ageInHours: ageInHours,
        createdAt: ticket.created_at
      });
      
      // If ticket is resolved, calculate resolution time
      if (['solved', 'closed'].includes(status)) {
        const resolutionTimeInHours = (updatedAt - createdAt) / (1000 * 60 * 60);
        statusMetrics[status].totalResolutionTimeInHours += resolutionTimeInHours;
        statusMetrics[status].resolvedCount++;
      }
    });

    // Calculate averages and find oldest/newest for each status
    Object.keys(statusMetrics).forEach(status => {
      const metrics = statusMetrics[status];
      if (metrics.count > 0) {
        metrics.avgAgeInHours = metrics.totalAgeInHours / metrics.count;
        
        // Sort tickets by age to find oldest and newest
        metrics.tickets.sort((a, b) => b.ageInHours - a.ageInHours);
        metrics.oldestTicketDays = metrics.tickets[0]?.ageInHours / 24 || 0;
        metrics.newestTicketDays = metrics.tickets[metrics.tickets.length - 1]?.ageInHours / 24 || 0;
        
        if (metrics.resolvedCount > 0) {
          metrics.avgResolutionTimeInHours = metrics.totalResolutionTimeInHours / metrics.resolvedCount;
        }
      }
    });

    return statusMetrics;
  }

  calculateDateRangeKPIs() {
    console.log('📅 Calculating date range KPIs...');
    
    const now = new Date();
    const ranges = {
      today: [],
      last7days: [],
      last30days: [],
      last90days: [],
      older: []
    };

    this.ticketData.forEach(ticket => {
      const createdAt = new Date(ticket.created_at);
      const daysDiff = (now - createdAt) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 1) {
        ranges.today.push(ticket);
      } else if (daysDiff < 7) {
        ranges.last7days.push(ticket);
      } else if (daysDiff < 30) {
        ranges.last30days.push(ticket);
      } else if (daysDiff < 90) {
        ranges.last90days.push(ticket);
      } else {
        ranges.older.push(ticket);
      }
    });

    // Calculate status breakdown for each range
    const rangeKPIs = {};
    Object.keys(ranges).forEach(range => {
      const tickets = ranges[range];
      const statusBreakdown = {};
      
      tickets.forEach(ticket => {
        const status = ticket.status || 'unknown';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });
      
      rangeKPIs[range] = {
        totalCount: tickets.length,
        statusBreakdown: statusBreakdown
      };
    });

    return rangeKPIs;
  }

  async generateKPIReport() {
    try {
      // Fetch all tickets
      await this.fetchAllTicketsForAnalysis();
      
      if (this.ticketData.length === 0) {
        console.log('⚠️ No tickets found for analysis');
        return null;
      }

      console.log('\n🔍 Generating comprehensive KPI report...');

      // Calculate all KPIs
      const basicKPIs = this.calculateStatusKPIs();
      const timeBasedKPIs = this.calculateTimeBasedKPIs();
      const dateRangeKPIs = this.calculateDateRangeKPIs();

      this.kpis = {
        summary: {
          totalTickets: this.ticketData.length,
          analysisDate: new Date().toISOString(),
          dataRange: {
            oldest: this.ticketData.reduce((oldest, ticket) => 
              new Date(ticket.created_at) < new Date(oldest.created_at) ? ticket : oldest
            ).created_at,
            newest: this.ticketData.reduce((newest, ticket) => 
              new Date(ticket.created_at) > new Date(newest.created_at) ? ticket : newest
            ).created_at
          }
        },
        statusBreakdown: basicKPIs.statusCounts,
        priorityBreakdown: basicKPIs.priorityCounts,
        typeBreakdown: basicKPIs.typeCounts,
        channelBreakdown: basicKPIs.channelCounts,
        satisfactionBreakdown: basicKPIs.satisfactionCounts,
        timeBasedMetrics: timeBasedKPIs,
        dateRangeAnalysis: dateRangeKPIs
      };

      return this.kpis;
    } catch (error) {
      console.error('❌ Error generating KPI report:', error.message);
      throw error;
    }
  }

  printKPIReport() {
    if (!this.kpis || Object.keys(this.kpis).length === 0) {
      console.log('⚠️ No KPI data available. Run generateKPIReport() first.');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 ZENDESK TICKET KPI REPORT');
    console.log('='.repeat(60));
    
    // Summary
    console.log(`\n📋 SUMMARY:`);
    console.log(`   Total Tickets: ${this.kpis.summary.totalTickets.toLocaleString()}`);
    console.log(`   Analysis Date: ${new Date(this.kpis.summary.analysisDate).toLocaleString()}`);
    console.log(`   Data Range: ${new Date(this.kpis.summary.dataRange.oldest).toLocaleDateString()} to ${new Date(this.kpis.summary.dataRange.newest).toLocaleDateString()}`);

    // Status Breakdown
    console.log(`\n🎯 STATUS BREAKDOWN:`);
    Object.entries(this.kpis.statusBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([status, count]) => {
        const percentage = ((count / this.kpis.summary.totalTickets) * 100).toFixed(1);
        console.log(`   ${status.toUpperCase().padEnd(12)}: ${count.toString().padStart(6)} tickets (${percentage}%)`);
      });

    // Priority Breakdown
    console.log(`\n⚡ PRIORITY BREAKDOWN:`);
    Object.entries(this.kpis.priorityBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([priority, count]) => {
        const percentage = ((count / this.kpis.summary.totalTickets) * 100).toFixed(1);
        console.log(`   ${priority.toUpperCase().padEnd(12)}: ${count.toString().padStart(6)} tickets (${percentage}%)`);
      });

    // Channel Breakdown
    console.log(`\n📡 CHANNEL BREAKDOWN:`);
    Object.entries(this.kpis.channelBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([channel, count]) => {
        const percentage = ((count / this.kpis.summary.totalTickets) * 100).toFixed(1);
        console.log(`   ${channel.toUpperCase().padEnd(12)}: ${count.toString().padStart(6)} tickets (${percentage}%)`);
      });

    // Time-based metrics for each status
    console.log(`\n⏱️ TIME-BASED METRICS BY STATUS:`);
    Object.entries(this.kpis.timeBasedMetrics)
      .filter(([, metrics]) => metrics.count > 0)
      .sort(([,a], [,b]) => b.count - a.count)
      .forEach(([status, metrics]) => {
        console.log(`\n   ${status.toUpperCase()}:`);
        console.log(`     Count: ${metrics.count}`);
        console.log(`     Avg Age: ${metrics.avgAgeInHours.toFixed(1)} hours (${(metrics.avgAgeInHours/24).toFixed(1)} days)`);
        console.log(`     Oldest: ${metrics.oldestTicketDays.toFixed(1)} days`);
        console.log(`     Newest: ${metrics.newestTicketDays.toFixed(1)} days`);
        if (metrics.avgResolutionTimeInHours > 0) {
          console.log(`     Avg Resolution Time: ${metrics.avgResolutionTimeInHours.toFixed(1)} hours (${(metrics.avgResolutionTimeInHours/24).toFixed(1)} days)`);
        }
      });

    // Date Range Analysis
    console.log(`\n📅 TICKETS BY DATE RANGE:`);
    Object.entries(this.kpis.dateRangeAnalysis).forEach(([range, data]) => {
      console.log(`\n   ${range.toUpperCase().replace(/([a-z])([0-9])/g, '$1 $2')}:`);
      console.log(`     Total: ${data.totalCount} tickets`);
      if (Object.keys(data.statusBreakdown).length > 0) {
        Object.entries(data.statusBreakdown)
          .sort(([,a], [,b]) => b - a)
          .forEach(([status, count]) => {
            console.log(`       ${status}: ${count}`);
          });
      }
    });

    console.log('\n' + '='.repeat(60));
  }

  async exportKPIsToJSON(filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      filename = `zendesk-kpis-${timestamp}.json`;
    }

    const fs = require('fs');
    const path = require('path');
    
    const filePath = path.join(__dirname, '..', 'data', filename);
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.kpis, null, 2));
      console.log(`✅ KPI data exported to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('❌ Error exporting KPI data:', error.message);
      throw error;
    }
  }
}

module.exports = TicketKPIAnalyzer;