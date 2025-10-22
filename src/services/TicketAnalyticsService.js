const ZendeskClient = require('../ZendeskClient');
const TicketCacheService = require('./TicketCacheService');

/**
 * Ticket Analytics Service for Dashboard
 * Provides business ticket analytics by date (excludes automated call tickets)
 * Uses caching to reduce API calls - only fetches today's data real-time
 */
class TicketAnalyticsService {
  constructor() {
    this.client = new ZendeskClient();
    this.cache = new TicketCacheService();
    this.ticketStatuses = ['new', 'open', 'pending', 'hold', 'solved', 'closed'];
  }

  /**
   * Get 5-day ticket analytics with status breakdown
   * Uses cache for previous days, fetches today's data real-time
   */
  async get5DayTicketAnalytics(forceRefresh = false) {
    try {
      console.log(`🎫 Fetching 5-day ticket analytics${forceRefresh ? ' (force refresh)' : ''}...`);
      
      // Generate last 5 days
      const dates = this.getLast5Days();
      const today = new Date().toISOString().split('T')[0];
      
      // Get data for each day
      const dailyData = [];
      for (const date of dates) {
        let dayData;
        
        if (forceRefresh) {
          // Force refresh: fetch from API and update cache
          console.log(`🔄 Force refreshing data for ${date}...`);
          dayData = await this.getTicketDataForDate(date);
          await this.cache.setCachedData(date, dayData);
        } else if (date === today) {
          // Today: check if cache is fresh (< 15 minutes), otherwise fetch new data
          const isFresh = await this.cache.isTodayDataFresh(date);
          if (isFresh) {
            console.log(`📅 Using fresh cached data for today (${date})`);
            dayData = await this.cache.getCachedData(date);
          } else {
            console.log(`📅 Fetching fresh data for today (${date})`);
            dayData = await this.getTicketDataForDate(date);
            await this.cache.setCachedData(date, dayData);
          }
        } else {
          // Previous days: use cache if available, otherwise fetch and cache
          dayData = await this.cache.getCachedData(date);
          if (!dayData) {
            console.log(`📅 Cache miss for ${date}, fetching from API...`);
            dayData = await this.getTicketDataForDate(date);
            await this.cache.setCachedData(date, dayData);
          }
        }
        
        dailyData.push(dayData);
      }
      
      // Format for dashboard
      const formattedData = this.formatForDashboard(dailyData);
      
      // Add cache info to response
      formattedData.data.cache_info = await this.cache.getCacheStats();
      
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
        // Get all tickets first, then estimate manual count using known patterns
        const totalQuery = `type:ticket created>=${dateStr} created<${nextDate}`;
        const totalResult = await this.client.search(totalQuery, { per_page: 50 });
        
        if (totalResult.results && totalResult.results.length > 0) {
          // Filter out automated ticket patterns
          const manualTickets = totalResult.results.filter(ticket => {
            const subject = ticket.subject || '';
            return !subject.includes('Call with Caller') &&
                   !subject.includes('Buyer messages') &&
                   !subject.includes('Return Shipment') &&
                   !subject.includes('Action Required') &&
                   !subject.includes('New Ticket in Partner') &&
                   !subject.includes('RA Number');
          });
          
          const sampleSize = totalResult.results.length;
          const manualRatio = manualTickets.length / sampleSize;
          dayData.new = Math.round((totalResult.count || 0) * manualRatio);
          
          console.log(`  🎫 Manual business tickets: ${dayData.new} (estimated)`);
          console.log(`  🤖 Automated tickets: ${(totalResult.count || 0) - dayData.new} (excluded)`);
          console.log(`  📊 Total created: ${totalResult.count || 0} (${Math.round(manualRatio * 100)}% manual, sample: ${manualTickets.length}/${sampleSize})`);
        } else {
          dayData.new = 0;
          console.log(`  🎫 No tickets found for ${dateStr}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`❌ Error getting new tickets:`, error.message);
      }

      // 2. SOLVED TICKETS: Manual business ticket solutions (excluding automated/bulk processing)
      try {
        // Get all solved tickets first, then filter out automated ones
        const totalSolvedQuery = `type:ticket status:solved updated>=${dateStr} updated<${nextDate}`;
        const totalSolvedResult = await this.client.search(totalSolvedQuery, { per_page: 50 });
        
        if (totalSolvedResult.results && totalSolvedResult.results.length > 0) {
          // Filter out automated/bulk solved tickets
          const manualSolves = totalSolvedResult.results.filter(ticket => {
            const subject = ticket.subject || '';
            return !subject.includes('Need for Replacement Part') &&
                   !subject.includes('Call with Caller') &&
                   !subject.includes('Inquiry from Amazon') &&
                   !subject.includes('Buyer messages') &&
                   !subject.includes('Return Shipment') &&
                   !subject.includes('Action Required') &&
                   !subject.includes('New Ticket in Partner') &&
                   !subject.includes('RA Number');
          });
          
          const sampleSize = totalSolvedResult.results.length;
          const manualRatio = manualSolves.length / sampleSize;
          dayData.solved = Math.round((totalSolvedResult.count || 0) * manualRatio);
          
          console.log(`  ✅ Manual business solutions: ${dayData.solved} (estimated)`);
          console.log(`  🤖 Auto-solved tickets: ${(totalSolvedResult.count || 0) - dayData.solved} (excluded)`);
          console.log(`  📊 Total solved: ${totalSolvedResult.count || 0} (${Math.round(manualRatio * 100)}% manual, sample: ${manualSolves.length}/${sampleSize})`);
        } else {
          dayData.solved = 0;
          console.log(`  ✅ No solved tickets found for ${dateStr}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`❌ Error getting solved tickets:`, error.message);
      }

      // 3. CLOSED TICKETS: Manual business ticket closures (excluding automated closures)
      try {
        // Get all closed tickets first, then filter out automated ones
        const totalClosedQuery = `type:ticket status:closed updated>=${dateStr} updated<${nextDate}`;
        const totalClosedResult = await this.client.search(totalClosedQuery, { per_page: 50 });
        
        if (totalClosedResult.results && totalClosedResult.results.length > 0) {
          // Filter out automated closures
          const manualClosures = totalClosedResult.results.filter(ticket => {
            const subject = ticket.subject || '';
            return !subject.includes('Abandoned Call') &&
                   !subject.includes('Call with Caller') &&
                   !subject.includes('Inquiry from Amazon') &&
                   !subject.includes('Buyer messages') &&
                   !subject.includes('Return Shipment') &&
                   !subject.includes('Action Required') &&
                   !subject.includes('New Ticket in Partner') &&
                   !subject.includes('RA Number');
          });
          
          const sampleSize = totalClosedResult.results.length;
          const manualRatio = manualClosures.length / sampleSize;
          dayData.closed = Math.round((totalClosedResult.count || 0) * manualRatio);
          
          console.log(`  🔒 Manual business closures: ${dayData.closed} (estimated)`);
          console.log(`  🤖 Auto-closed tickets: ${(totalClosedResult.count || 0) - dayData.closed} (excluded)`);
          console.log(`  📊 Total closed: ${totalClosedResult.count || 0} (${Math.round(manualRatio * 100)}% manual, sample: ${manualClosures.length}/${sampleSize})`);
        } else {
          dayData.closed = 0;
          console.log(`  🔒 No closed tickets found for ${dateStr}`);
        }
        
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
      
      console.log(`  📈 Total daily activity: ${dayData.total_tickets} tickets`);
      
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
    // Fix timezone issue by explicitly setting local midnight
    const date = new Date(dateStr + 'T00:00:00');
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
   * Clear cache for ticket analytics
   */
  async clearCache() {
    try {
      await this.cache.clearAllCache();
      console.log('🗑️ Ticket analytics cache cleared');
      return { success: true, message: 'Cache cleared successfully' };
    } catch (error) {
      console.error('❌ Error clearing cache:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      return await this.cache.getCacheStats();
    } catch (error) {
      console.error('❌ Error getting cache stats:', error.message);
      return null;
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