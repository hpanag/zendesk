const ZendeskReportingService = require('./ZendeskReportingService');

/**
 * Call Analytics Service for Dashboard
 * Provides 5-day call data with answered/unanswered breakdown
 */
class CallAnalyticsService {
  constructor() {
    this.reportingService = new ZendeskReportingService();
  }

  /**
   * Get formatted 5-day call analytics for dashboard
   */
  async get5DayCallAnalytics(phoneNumberIds = null) {
    try {
      console.log('📞 Fetching 5-day call analytics...');
      
      // Get raw data from Zendesk
      const rawData = await this.reportingService.getLast5DaysCallData(phoneNumberIds);
      
      // Process the data to get answered/unanswered counts
      const processedData = this.reportingService.processCallData(rawData);
      
      // Format for dashboard consumption
      const dashboardData = this.formatForDashboard(processedData);
      
      console.log('✅ Call analytics retrieved successfully');
      return dashboardData;
      
    } catch (error) {
      console.error('❌ Error fetching call analytics:', error.message);
      throw error;
    }
  }

  /**
   * Format data specifically for dashboard display
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
          answer_rate: day.total_calls > 0 ? 
            Math.round((day.answered_calls / day.total_calls) * 100) : 0,
          error: day.error || null
        })),
        summary: summary,
        chart_data: this.prepareChartData(processedData),
        last_updated: new Date().toISOString()
      }
    };
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(data) {
    const totals = data.reduce((acc, day) => ({
      total_calls: acc.total_calls + day.total_calls,
      answered_calls: acc.answered_calls + day.answered_calls,
      unanswered_calls: acc.unanswered_calls + day.unanswered_calls
    }), { total_calls: 0, answered_calls: 0, unanswered_calls: 0 });

    const overallAnswerRate = totals.total_calls > 0 ? 
      Math.round((totals.answered_calls / totals.total_calls) * 100) : 0;

    return {
      ...totals,
      overall_answer_rate: overallAnswerRate,
      average_daily_calls: Math.round(totals.total_calls / data.length),
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
          name: 'Answered Calls',
          data: data.map(d => d.answered_calls),
          color: '#00d4aa'
        },
        {
          name: 'Unanswered Calls', 
          data: data.map(d => d.unanswered_calls),
          color: '#ff6b6b'
        },
        {
          name: 'Total Calls',
          data: data.map(d => d.total_calls),
          color: '#4f46e5'
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