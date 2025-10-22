const ZendeskReportingService = require('./ZendeskReportingService');
const CallAnalyticsCacheService = require('./CallAnalyticsCacheService');

/**
 * Call Analytics Service for Dashboard
 * Provides 30-day call data with answered/unanswered breakdown
 * Uses caching to reduce API calls - only fetches today's data real-time
 */
class CallAnalyticsService {
  constructor() {
    this.reportingService = new ZendeskReportingService();
    this.cache = new CallAnalyticsCacheService();
  }

  /**
   * Get formatted 30-day call analytics for dashboard
   * Uses cache for previous days, fetches today's data real-time
   */
  async get30DayCallAnalytics(phoneNumberIds = null, forceRefresh = false) {
    try {
      console.log(`📞 Fetching 30-day call analytics${forceRefresh ? ' (force refresh)' : ''}...`);
      
      // Generate last 30 days
      const dates = this.getLast30Days();
      const today = new Date().toISOString().split('T')[0];
      
      // Get data for each day
      const dailyData = [];
      for (const date of dates) {
        let dayData;
        
        if (forceRefresh) {
          // Force refresh: fetch from API and update cache
          console.log(`🔄 Force refreshing call data for ${date}...`);
          dayData = await this.getCallDataForDate(date, phoneNumberIds);
          await this.cache.setCachedData(date, dayData);
        } else if (date === today) {
          // Today: check if cache is fresh (< 15 minutes), otherwise fetch new data
          const isFresh = await this.cache.isTodayDataFresh(date);
          if (isFresh) {
            console.log(`📅 Using fresh cached call data for today (${date})`);
            dayData = await this.cache.getCachedData(date);
          } else {
            console.log(`📅 Fetching fresh call data for today (${date})`);
            dayData = await this.getCallDataForDate(date, phoneNumberIds);
            await this.cache.setCachedData(date, dayData);
          }
        } else {
          // Previous days: use cache if available, otherwise fetch and cache
          dayData = await this.cache.getCachedData(date);
          if (!dayData) {
            console.log(`📅 Cache miss for ${date}, fetching call data from API...`);
            dayData = await this.getCallDataForDate(date, phoneNumberIds);
            await this.cache.setCachedData(date, dayData);
          }
        }
        
        dailyData.push(dayData);
      }
      
      // Format for dashboard consumption
      const dashboardData = this.formatForDashboard(dailyData);
      
      // Add cache info to response
      dashboardData.data.cache_info = await this.cache.getCacheStats();
      
      console.log('✅ Call analytics retrieved successfully');
      return dashboardData;
      
    } catch (error) {
      console.error('❌ Error fetching call analytics:', error.message);
      return {
        success: false,
        error: error.message,
        last_updated: new Date().toISOString()
      };
    }
  }

  /**
   * Get last 30 days as date strings
   */
  getLast30Days() {
    const dates = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }

  /**
   * Get call data for a specific date
   */
  async getCallDataForDate(dateStr, phoneNumberIds = null) {
    try {
      console.log(`📊 Fetching call stats for ${dateStr}...`);
      
      // Get call data for this specific date using the correct method
      const dayData = await this.reportingService.getDailyCallStats(dateStr, phoneNumberIds);
      
      // Extract data from the overview object if it exists
      const overview = dayData.overview || {};
      const totalCalls = overview.total_calls || 0;
      const answeredCalls = overview.answered_calls || 0;
      const unansweredCalls = overview.missed_calls || overview.abandoned_calls || overview.unanswered_calls || 0;
      
      console.log(`📊 ${dateStr} data: ${totalCalls} total, ${answeredCalls} answered, ${unansweredCalls} unanswered`);
      
      return {
        date: dateStr,
        day_name: this.getDayName(dateStr),
        total_calls: totalCalls,
        answered_calls: answeredCalls,
        unanswered_calls: unansweredCalls,
        callbacks: overview.callbacks || 0,
        voicemails: overview.voicemails || 0,
        exceeded_wait_time: overview.exceeded_wait_time || 0,
        outbound_calls: overview.outbound_calls || 0,
        inbound_calls: overview.inbound_calls || (totalCalls - (overview.outbound_calls || 0)),
        answer_rate: totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0,
        callback_rate: totalCalls > 0 ? Math.round(((overview.callbacks || 0) / totalCalls) * 100) : 0,
        error: dayData.error || null
      };
      
    } catch (error) {
      console.error(`❌ Error getting call data for ${dateStr}:`, error.message);
      return {
        date: dateStr,
        day_name: this.getDayName(dateStr),
        total_calls: 0,
        answered_calls: 0,
        unanswered_calls: 0,
        callbacks: 0,
        voicemails: 0,
        exceeded_wait_time: 0,
        outbound_calls: 0,
        inbound_calls: 0,
        answer_rate: 0,
        callback_rate: 0,
        error: error.message
      };
    }
  }

  /**
   * Clear cache for call analytics
   */
  async clearCache() {
    try {
      await this.cache.clearAllCache();
      console.log('🗑️ Call analytics cache cleared');
      return { success: true, message: 'Cache cleared successfully' };
    } catch (error) {
      console.error('❌ Error clearing call cache:', error.message);
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
      console.error('❌ Error getting call cache stats:', error.message);
      return null;
    }
  }

  /**
   * Format data specifically for dashboard display with enhanced call categories
   */
  formatForDashboard(processedData) {
    const summary = this.calculateSummary(processedData);
    
    return {
      success: true,
      data: {
        daily_breakdown: processedData.map(day => ({
          date: day.date,
          day_name: this.getDayName(day.date),
          total_calls: day.total_calls,
          answered_calls: day.answered_calls,
          unanswered_calls: day.unanswered_calls,
          callbacks: day.callbacks || 0,
          voicemails: day.voicemails || 0,
          exceeded_wait_time: day.exceeded_wait_time || 0,
          outbound_calls: day.outbound_calls || 0,
          inbound_calls: day.inbound_calls || 0,
          answer_rate: day.total_calls > 0 ? 
            Math.round((day.answered_calls / day.total_calls) * 100) : 0,
          callback_rate: day.total_calls > 0 ?
            Math.round((day.callbacks / day.total_calls) * 100) : 0,
          error: day.error || null
        })),
        summary: summary,
        chart_data: this.prepareChartData(processedData),
        last_updated: new Date().toISOString()
      }
    };
  }

  /**
   * Calculate summary statistics with enhanced categories
   */
  calculateSummary(data) {
    const totals = data.reduce((acc, day) => ({
      total_calls: acc.total_calls + day.total_calls,
      answered_calls: acc.answered_calls + day.answered_calls,
      unanswered_calls: acc.unanswered_calls + day.unanswered_calls,
      callbacks: acc.callbacks + (day.callbacks || 0),
      voicemails: acc.voicemails + (day.voicemails || 0),
      exceeded_wait_time: acc.exceeded_wait_time + (day.exceeded_wait_time || 0),
      outbound_calls: acc.outbound_calls + (day.outbound_calls || 0),
      inbound_calls: acc.inbound_calls + (day.inbound_calls || 0)
    }), { 
      total_calls: 0, 
      answered_calls: 0, 
      unanswered_calls: 0,
      callbacks: 0,
      voicemails: 0,
      exceeded_wait_time: 0,
      outbound_calls: 0,
      inbound_calls: 0
    });

    const overallAnswerRate = totals.total_calls > 0 ? 
      Math.round((totals.answered_calls / totals.total_calls) * 100) : 0;
    
    const callbackRate = totals.total_calls > 0 ?
      Math.round((totals.callbacks / totals.total_calls) * 100) : 0;

    return {
      ...totals,
      overall_answer_rate: overallAnswerRate,
      callback_rate: callbackRate,
      average_daily_calls: Math.round(totals.total_calls / data.length),
      period: '30 days',
      start_date: data[0]?.date,
      end_date: data[data.length - 1]?.date
    };
  }

  /**
   * Prepare data for charts with enhanced categories (ApexCharts format)
   */
  prepareChartData(data) {
    const dates = data.map(d => d.date);
    const dayNames = data.map(d => this.getDayName(d.date));
    
    return {
      categories: dayNames,
      series: [
        {
          name: 'Answered Calls',
          data: data.map(d => d.answered_calls),
          color: '#28a745'
        },
        {
          name: 'Abandoned in Queue', 
          data: data.map(d => d.unanswered_calls),
          color: '#dc3545'
        },
        {
          name: 'Callback Requests',
          data: data.map(d => d.callbacks || 0),
          color: '#fd7e14'
        },
        {
          name: 'Voicemails',
          data: data.map(d => d.voicemails || 0),
          color: '#6f42c1'
        },
        {
          name: 'Exceeded Wait Time',
          data: data.map(d => d.exceeded_wait_time || 0),
          color: '#ffc107'
        },
        {
          name: 'Outbound Calls',
          data: data.map(d => d.outbound_calls || 0),
          color: '#20c997'
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
   * Get formatted 5-day call analytics for dashboard (backward compatibility)
   */
  async get5DayCallAnalytics(phoneNumberIds = null) {
    try {
      console.log('📞 Fetching 5-day call analytics...');
      
      // Get raw data from Zendesk
      const rawData = await this.reportingService.getLast5DaysCallData(phoneNumberIds);
      
      // Format for dashboard
      const formatted = this.formatForDashboard(rawData);
      
      return {
        success: true,
        data: formatted,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error in get5DayCallAnalytics:', error.message);
      return {
        success: false,
        error: error.message,
        last_updated: new Date().toISOString()
      };
    }
  }

  /**
   * Get real-time call analytics (for current day)
   */
  async getRealTimeCallAnalytics() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyStats = await this.reportingService.getDailyCallStats(today);
      const processed = this.reportingService.processCallData([dailyStats]);
      
      return {
        success: true,
        data: processed[0],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error fetching real-time analytics:', error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get call analytics for a specific date range
   */
  async getCallAnalyticsForDateRange(startDate, endDate, phoneNumberIds = null) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const promises = [];
      
      // Generate dates in range
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];
        promises.push(this.reportingService.getDailyCallStats(dateStr, phoneNumberIds));
      }
      
      const rawData = await Promise.allSettled(promises);
      const validData = rawData
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
      
      const processedData = this.reportingService.processCallData(validData);
      
      return {
        success: true,
        data: processedData,
        summary: this.calculateSummary(processedData),
        chart_data: this.prepareChartData(processedData)
      };
      
    } catch (error) {
      console.error('❌ Error fetching date range analytics:', error.message);
      throw error;
    }
  }
}

module.exports = CallAnalyticsService;