const ZendeskClient = require('../ZendeskClient');

/**
 * Ticket Analytics Service for Dashboard
 * Provides business ticket analytics by date (excludes automated call tickets)
 */
class TicketAnalyticsService {
  constructor() {
    this.client = new ZendeskClient();
    this.ticketStatuses = ['new', 'open', 'pending', 'hold', 'solved', 'closed'];
  }

  /**
   * Get 5-day ticket analytics with status breakdown
   */
  async get5DayTicketAnalytics() {
    try {
      console.log('🎫 Fetching 5-day ticket analytics...');
      
      // Generate last 5 days
      const dates = this.getLast5Days();
      
      // Get data for each day
      const dailyData = [];
      for (const date of dates) {
        const dayData = await this.getTicketDataForDate(date);
        dailyData.push(dayData);
      }
      
      // Format for dashboard
      const formattedData = this.formatForDashboard(dailyData);
      
      console.log('✅ Ticket analytics retrieved successfully');
      return formattedData;
      
    } catch (error) {
      console.error('❌ Error fetching ticket analytics:', error.message);
      return {
        success: false,
        error: error.message,
        last_updated: new Date().toISOString()
      };
    }
  }

  /**
   * Get last 5 days as date strings
   */
  getLast5Days() {
    const dates = [];
    for (let i = 4; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }

  /**
   * Get daily business ticket metrics focusing on meaningful customer service activities
   * Excludes automated call tickets to show actual business ticket workflow
   * Each category represents specific actions that happened on that day
   */
  async getTicketDataForDate(dateStr) {
    try {
      console.log(`📅 Getting daily ticket metrics for ${dateStr}...`);
      
      const dayData = {
        date: dateStr,
        day_name: this.getDayName(dateStr),
        total_tickets: 0,
        new: 0,          // Tickets created this day
        open: 0,         // Tickets reopened or set to open this day  
        pending: 0,      // Tickets moved to pending this day
        hold: 0,         // Tickets put on hold this day
        solved: 0,       // Tickets solved this day
        closed: 0        // Tickets closed this day
      };
      
      const nextDate = this.getNextDate(dateStr);
      
      // 1. NEW TICKETS: Count manual business tickets created on this specific day (excluding automated tickets)
      try {
        // Exclude common automated ticket types
        const excludePatterns = [
          '-subject:"Call with Caller"',
          '-subject:"Buyer messages"', 
          '-subject:"Return Shipment"',
          '-subject:"Action Required"',
          '-subject:"New Ticket in Partner"',
          '-subject:"RA Number Notification"'
        ].join(' ');
        
        const newTicketsQuery = `type:ticket created>=${dateStr} created<${nextDate} ${excludePatterns}`;
        const newResult = await this.client.search(newTicketsQuery, { per_page: 1 });
        dayData.new = newResult.count || 0;
        console.log(`  � Manual business tickets: ${dayData.new}`);
        
        // Get total for reference
        try {
          const totalQuery = `type:ticket created>=${dateStr} created<${nextDate}`;
          const totalResult = await this.client.search(totalQuery, { per_page: 1 });
          const automatedCount = (totalResult.count || 0) - dayData.new;
          console.log(`  🤖 Automated tickets: ${automatedCount} (excluded from analytics)`);
          console.log(`  📊 Total created: ${totalResult.count || 0} (${Math.round((dayData.new / (totalResult.count || 1)) * 100)}% manual)`);
        } catch (totalError) {
          console.log(`  � Unable to get total count for comparison`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`❌ Error getting new tickets:`, error.message);
      }

      // 2. SOLVED TICKETS: Tickets that were marked as solved on this day
      try {
        const solvedQuery = `type:ticket status:solved updated>=${dateStr} updated<${nextDate}`;
        const solvedResult = await this.client.search(solvedQuery, { per_page: 1 });
        dayData.solved = solvedResult.count || 0;
        console.log(`  ✅ Tickets solved: ${dayData.solved}`);
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`❌ Error getting solved tickets:`, error.message);
      }

      // 3. CLOSED TICKETS: Tickets that were closed on this day
      try {
        const closedQuery = `type:ticket status:closed updated>=${dateStr} updated<${nextDate}`;
        const closedResult = await this.client.search(closedQuery, { per_page: 1 });
        dayData.closed = closedResult.count || 0;
        console.log(`  🔒 Tickets closed: ${dayData.closed}`);
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`❌ Error getting closed tickets:`, error.message);
      }

      // 4. PENDING TICKETS: Tickets moved to pending on this day
      try {
        const pendingQuery = `type:ticket status:pending updated>=${dateStr} updated<${nextDate}`;
        const pendingResult = await this.client.search(pendingQuery, { per_page: 1 });
        dayData.pending = pendingResult.count || 0;
        console.log(`  ⏳ Tickets moved to pending: ${dayData.pending}`);
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`❌ Error getting pending tickets:`, error.message);
      }

      // 5. HOLD TICKETS: Tickets put on hold on this day
      try {
        const holdQuery = `type:ticket status:hold updated>=${dateStr} updated<${nextDate}`;
        const holdResult = await this.client.search(holdQuery, { per_page: 1 });
        dayData.hold = holdResult.count || 0;
        console.log(`  🛑 Tickets put on hold: ${dayData.hold}`);
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`❌ Error getting hold tickets:`, error.message);
      }

      // 6. REOPENED/OPEN TICKETS: Tickets that became open on this day (excluding new ones)
      try {
        const openQuery = `type:ticket status:open updated>=${dateStr} updated<${nextDate} -created>=${dateStr}`;
        const openResult = await this.client.search(openQuery, { per_page: 1 });
        dayData.open = openResult.count || 0;
        console.log(`  🔄 Tickets reopened/opened: ${dayData.open}`);
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`❌ Error getting reopened tickets:`, error.message);
      }

      // Calculate total daily activity
      dayData.total_tickets = dayData.new + dayData.open + dayData.pending + 
                             dayData.hold + dayData.solved + dayData.closed;
      
      console.log(`  � Total daily activity: ${dayData.total_tickets} tickets`);
      
      return dayData;
      
    } catch (error) {
      console.error(`❌ Error processing date ${dateStr}:`, error.message);
      return {
        date: dateStr,
        day_name: this.getDayName(dateStr),
        total_tickets: 0,
        new: 0,
        open: 0,
        pending: 0,
        hold: 0,
        solved: 0,
        closed: 0,
        error: error.message
      };
    }
  }

  /**
   * Get next date string
   */
  getNextDate(dateStr) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  }

  /**
   * Format data for dashboard consumption
   */
  formatForDashboard(dailyData) {
    const summary = this.calculateSummary(dailyData);
    
    return {
      success: true,
      data: {
        daily_breakdown: dailyData,
        summary: summary,
        chart_data: this.prepareChartData(dailyData),
        last_updated: new Date().toISOString()
      }
    };
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(data) {
    const totals = data.reduce((acc, day) => ({
      total_tickets: acc.total_tickets + day.total_tickets,
      new: acc.new + (day.new || 0),
      open: acc.open + (day.open || 0),
      pending: acc.pending + (day.pending || 0),
      hold: acc.hold + (day.hold || 0),
      solved: acc.solved + (day.solved || 0),
      closed: acc.closed + (day.closed || 0)
    }), { 
      total_tickets: 0,
      new: 0,
      open: 0,
      pending: 0,
      hold: 0,
      solved: 0,
      closed: 0
    });

    // Calculate active tickets (everything except closed)
    const activeTickets = totals.new + totals.open + totals.pending + totals.hold + totals.solved;

    return {
      ...totals,
      active_tickets: activeTickets,
      closed_rate: totals.total_tickets > 0 ? 
        Math.round((totals.closed / totals.total_tickets) * 100) : 0,
      average_daily_tickets: Math.round(totals.total_tickets / data.length),
      period: '5 days',
      start_date: data[0]?.date,
      end_date: data[data.length - 1]?.date
    };
  }

  /**
   * Prepare data for charts (ApexCharts format)
   */
  prepareChartData(data) {
    const dates = data.map(d => d.date);
    const dayNames = data.map(d => this.getDayName(d.date));
    
    return {
      categories: dayNames,
      series: [
        {
          name: 'Created (Business)',
          data: data.map(d => d.new || 0),
          color: '#17a2b8'
        },
        {
          name: 'Open', 
          data: data.map(d => d.open || 0),
          color: '#007bff'
        },
        {
          name: 'Pending',
          data: data.map(d => d.pending || 0),
          color: '#ffc107'
        },
        {
          name: 'Hold',
          data: data.map(d => d.hold || 0),
          color: '#fd7e14'
        },
        {
          name: 'Solved',
          data: data.map(d => d.solved || 0),
          color: '#28a745'
        },
        {
          name: 'Closed',
          data: data.map(d => d.closed || 0),
          color: '#6c757d'
        }
      ],
      dates: dates
    };
  }

  /**
   * Get day name from date string
   */
  getDayName(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) {
      return 'Today';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }

  /**
   * Get current ticket status counts (real-time)
   */
  async getCurrentTicketCounts() {
    try {
      console.log('🎫 Getting current ticket status counts...');
      
      const counts = {
        timestamp: new Date().toISOString()
      };
      
      for (const status of this.ticketStatuses) {
        try {
          const query = `type:ticket status:${status}`;
          const result = await this.client.search(query, { per_page: 1 });
          counts[status] = result.count || 0;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (error) {
          console.error(`❌ Error getting current ${status} count:`, error.message);
          counts[status] = 0;
        }
      }
      
      // Calculate totals
      counts.total_tickets = this.ticketStatuses.reduce((sum, status) => sum + counts[status], 0);
      counts.active_tickets = counts.new + counts.open + counts.pending + counts.hold + counts.solved;
      
      return {
        success: true,
        data: counts
      };
      
    } catch (error) {
      console.error('❌ Error getting current ticket counts:', error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = TicketAnalyticsService;