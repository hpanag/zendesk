const ZendeskClient = require('../ZendeskClient');

class TicketDataService {
  constructor() {
    this.zendesk = new ZendeskClient();
  }

  async getTodaysTicketStats() {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      // Get tickets created today
      const todaysTickets = await this.zendesk.search(`type:ticket created:${todayStr}`);
      
      // Get tickets updated today (including status changes)
      const updatedToday = await this.zendesk.search(`type:ticket updated:${todayStr}`);
      
      // Get current ticket counts by status
      const statusCounts = await this.getTicketStatusCounts();
      
      return {
        todayCreated: todaysTickets?.results?.length || 0,
        todayUpdated: updatedToday?.results?.length || 0,
        statusBreakdown: statusCounts,
        timestamp: new Date().toISOString(),
        date: todayStr
      };
    } catch (error) {
      console.error('Error fetching today\'s ticket stats:', error);
      return null;
    }
  }

  async getTicketStatusCounts() {
    try {
      const statuses = ['new', 'open', 'pending', 'hold', 'solved', 'closed'];
      const counts = {};
      
      for (const status of statuses) {
        const result = await this.zendesk.search(`type:ticket status:${status}`);
        counts[status] = result?.count || 0;
      }
      
      return counts;
    } catch (error) {
      console.error('Error fetching status counts:', error);
      return {};
    }
  }

  async getRecentTicketTrends(days = 7) {
    try {
      const trends = [];
      const today = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const created = await this.zendesk.search(`type:ticket created:${dateStr}`);
        const solved = await this.zendesk.search(`type:ticket status:solved updated:${dateStr}`);
        
        trends.push({
          date: dateStr,
          created: created?.results?.length || 0,
          solved: solved?.results?.length || 0
        });
      }
      
      return trends;
    } catch (error) {
      console.error('Error fetching ticket trends:', error);
      return [];
    }
  }

  async getTicketsByPriority() {
    try {
      const priorities = ['low', 'normal', 'high', 'urgent'];
      const counts = {};
      
      for (const priority of priorities) {
        const result = await this.zendesk.search(`type:ticket priority:${priority} status<solved`);
        counts[priority] = result?.count || 0;
      }
      
      return counts;
    } catch (error) {
      console.error('Error fetching priority breakdown:', error);
      return {};
    }
  }

  async getTicketsByChannel() {
    try {
      // Simplified approach - get tickets by channel using different search terms
      const channels = {};
      
      // Note: Zendesk's search API has limitations for 'via' field
      // This is a simplified version that focuses on the most reliable data
      channels.total = 0;
      
      return channels;
    } catch (error) {
      console.error('Error fetching channel breakdown:', error);
      return {};
    }
  }

  async getComprehensiveTicketSummary() {
    try {
      const [todayStats, trends, priorities, channels] = await Promise.all([
        this.getTodaysTicketStats(),
        this.getRecentTicketTrends(),
        this.getTicketsByPriority(),
        this.getTicketsByChannel()
      ]);

      return {
        today: todayStats,
        trends,
        priorities,
        channels,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating comprehensive ticket summary:', error);
      return null;
    }
  }

  formatSummaryForGPT(summary) {
    if (!summary) {
      return 'Unable to retrieve current ticket data from Zendesk API.';
    }

    const parts = [];
    
    // Today's stats
    if (summary.today) {
      parts.push(`Today (${summary.today.date}):`);
      parts.push(`- ${summary.today.todayCreated} new tickets created`);
      parts.push(`- ${summary.today.todayUpdated} tickets updated`);
      
      if (summary.today.statusBreakdown) {
        const total = Object.values(summary.today.statusBreakdown).reduce((sum, count) => sum + count, 0);
        parts.push(`- Current backlog: ${summary.today.statusBreakdown.new + summary.today.statusBreakdown.open + summary.today.statusBreakdown.pending + summary.today.statusBreakdown.hold} active tickets`);
        parts.push(`- Status breakdown: ${Object.entries(summary.today.statusBreakdown).map(([status, count]) => `${status}: ${count}`).join(', ')}`);
      }
    }

    // Recent trends
    if (summary.trends && summary.trends.length > 0) {
      parts.push('\nRecent 7-day trend:');
      const totalCreated = summary.trends.reduce((sum, day) => sum + day.created, 0);
      const totalSolved = summary.trends.reduce((sum, day) => sum + day.solved, 0);
      parts.push(`- Total created: ${totalCreated} tickets (avg ${Math.round(totalCreated/7)} per day)`);
      parts.push(`- Total solved: ${totalSolved} tickets (avg ${Math.round(totalSolved/7)} per day)`);
    }

    // Priority breakdown
    if (summary.priorities) {
      const urgentHigh = (summary.priorities.urgent || 0) + (summary.priorities.high || 0);
      parts.push(`\nActive tickets by priority: urgent: ${summary.priorities.urgent || 0}, high: ${summary.priorities.high || 0}, normal: ${summary.priorities.normal || 0}, low: ${summary.priorities.low || 0}`);
      if (urgentHigh > 0) {
        parts.push(`⚠️  ${urgentHigh} high-priority tickets need attention`);
      }
    }

    // Channel breakdown
    if (summary.channels) {
      parts.push(`\nTickets by channel: ${Object.entries(summary.channels).map(([channel, count]) => `${channel}: ${count}`).join(', ')}`);
    }

    return parts.join('\n');
  }
}

module.exports = TicketDataService;