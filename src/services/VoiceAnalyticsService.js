const ZendeskReportingService = require('./ZendeskReportingService');

/**
 * Service for analyzing Zendesk Voice call data and status types
 * Provides executive-level analytics for call abandonment rates and status distribution
 */
class VoiceAnalyticsService {
  constructor() {
    this.reportingService = new ZendeskReportingService();
  }

  async getVoiceAnalyticsForDate(dateString = null) {
    try {
      // Use provided date or calculate last Monday
      let targetDate, targetDateStr, dayName;
      
      if (dateString) {
        targetDate = new Date(dateString + 'T00:00:00');
        targetDateStr = dateString;
        dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
        console.log('📞 Getting voice analytics for selected date:', targetDateStr);
        
        // Validate that the date is not in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        console.log('🔍 Date validation check:');
        console.log('   Target date:', targetDate.toISOString());
        console.log('   Today:', today.toISOString());
        console.log('   Target > Today?', targetDate > today);
        
        if (targetDate > today) {
          console.error('❌ Error: Cannot fetch voice analytics for future dates');
          return {
            success: false,
            error: 'Cannot fetch voice analytics for future dates. Date must be today or earlier.',
            data: null
          };
        }
      } else {
        targetDate = this.getLastMonday();
        targetDateStr = targetDate.toISOString().split('T')[0];
        dayName = 'Monday';
        console.log('📞 Getting voice analytics for last Monday:', targetDateStr);
      }
      
      console.log('🗓️ Analyzing voice data for:', targetDateStr, '(' + dayName + ')');
      
      // Fetch REAL call data from the API for this specific date - NO ARTIFICIAL DATA
      console.log('📊 Fetching REAL call records from API for', targetDateStr, '...');
      const callsData = await this.getCallsForDate(targetDateStr);
      
      if (!callsData) {
        throw new Error('Could not fetch call records for ' + targetDateStr);
      }
      
      console.log('✅ Retrieved', callsData.total_calls, 'REAL calls from API for', targetDateStr);
      
      // Calculate the call status breakdown from REAL data only
      const statusBreakdown = this.calculateCallStatusBreakdownFromRealCalls(callsData);
      const abandonmentRate = this.calculateAbandonmentRateFromRealCalls(callsData);
      const answered = callsData.answered_calls;
      const abandoned = callsData.abandoned_calls;
      
      return {
        success: true,
        data: {
          date: targetDateStr,
          day_name: dayName,
          call_status_breakdown: statusBreakdown,
          abandonment_rate: abandonmentRate,
          summary: {
            total_calls: callsData.total_calls,
            abandoned_calls: abandoned,
            answered_calls: answered,
            answered_rate: callsData.total_calls > 0 ? Math.round((answered / callsData.total_calls) * 100) : 0,
            abandonment_rate: abandonmentRate,
            voicemail_calls: callsData.voicemail_calls,
            callback_calls: callsData.callback_calls,
            abandonment_percentage: abandonmentRate
          },
          chart_data: this.prepareChartData(statusBreakdown),
          data_source: 'Zendesk Voice API /channels/voice/calls.json (REAL DATA ONLY - NO ARTIFICIAL VARIATION)'
        }
      };
      
    } catch (error) {
      console.error('❌ Error getting voice analytics:', error.message);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Get REAL call records for a specific date from the Zendesk API
   * Uses /channels/voice/calls.json endpoint with time range filtering
   * Returns ONLY actual call data - NO SYNTHETIC OR ARTIFICIAL DATA
   */
  async getCallsForDate(dateString) {
    try {
      // Create time range for the entire day in UTC
      const startTime = dateString + 'T00:00:00Z';
      const endTime = dateString + 'T23:59:59Z';
      
      console.log('📞 Querying calls for:', dateString, '(UTC)');
      
      // Fetch call records with the date filter
      const endpoint = '/channels/voice/calls.json?start_time=' + encodeURIComponent(startTime) + '&end_time=' + encodeURIComponent(endTime);
      const result = await this.reportingService.makeRequest('GET', endpoint);
      
      if (!result || !result.calls) {
        // If no calls found, return empty data
        console.log('⚠️ No call records found for', dateString, '- returning empty data (real result, not synthetic)');
        return {
          total_calls: 0,
          answered_calls: 0,
          abandoned_calls: 0,
          voicemail_calls: 0,
          callback_calls: 0,
          calls: []
        };
      }
      
      const calls = result.calls;
      console.log('✅ API returned', calls.length, 'call records for', dateString);
      
      // Analyze the REAL call records
      const analysis = this.analyzeRealCallRecords(calls);
      
      return {
        total_calls: analysis.total_calls,
        answered_calls: analysis.answered_calls,
        abandoned_calls: analysis.abandoned_calls,
        voicemail_calls: analysis.voicemail_calls,
        callback_calls: analysis.callback_calls,
        calls: calls,
        analysis_details: analysis
      };
      
    } catch (error) {
      console.error('❌ Error fetching calls for date', dateString + ':', error.message);
      throw error;
    }
  }

  /**
   * Analyze REAL call records from API
   * Extract actual call statuses without any artificial modification
   */
  analyzeRealCallRecords(calls) {
    const analysis = {
      total_calls: calls.length,
      answered_calls: 0,
      abandoned_calls: 0,
      voicemail_calls: 0,
      callback_calls: 0,
      other_calls: 0,
      call_details: []
    };
    
    calls.forEach(call => {
      let callType = 'other';
      
      // Check call completion status to determine outcome
      if (call.completion_status === 'answered') {
        analysis.answered_calls++;
        callType = 'answered';
      } else if (call.completion_status === 'abandoned' || call.status === 'abandoned') {
        analysis.abandoned_calls++;
        callType = 'abandoned';
      } else if (call.completion_status === 'voicemail' || call.status === 'voicemail') {
        analysis.voicemail_calls++;
        callType = 'voicemail';
      } else if (call.callback_requested) {
        analysis.callback_calls++;
        callType = 'callback_requested';
      } else {
        analysis.other_calls++;
      }
      
      // Store details for debugging
      analysis.call_details.push({
        id: call.id,
        type: callType,
        completion_status: call.completion_status,
        status: call.status,
        duration: call.duration,
        created_at: call.created_at
      });
    });
    
    console.log('📊 Call analysis for this date:', {
      total: analysis.total_calls,
      answered: analysis.answered_calls,
      abandoned: analysis.abandoned_calls,
      voicemail: analysis.voicemail_calls,
      callback: analysis.callback_calls,
      other: analysis.other_calls
    });
    
    return analysis;
  }

  /**
   * Calculate call status breakdown from REAL calls only
   */
  calculateCallStatusBreakdownFromRealCalls(callsData) {
    const breakdown = [];
    const total = callsData.total_calls || 1; // Avoid division by zero
    
    if (callsData.answered_calls > 0) {
      breakdown.push({
        status: 'Answered',
        count: callsData.answered_calls,
        percentage: Math.round((callsData.answered_calls / total) * 100),
        color: '#28a745',
        description: 'Calls successfully answered by agents'
      });
    }
    
    if (callsData.abandoned_calls > 0) {
      breakdown.push({
        status: 'Abandoned',
        count: callsData.abandoned_calls,
        percentage: Math.round((callsData.abandoned_calls / total) * 100),
        color: '#dc3545',
        description: 'Calls abandoned while waiting'
      });
    }
    
    if (callsData.voicemail_calls > 0) {
      breakdown.push({
        status: 'Voicemail',
        count: callsData.voicemail_calls,
        percentage: Math.round((callsData.voicemail_calls / total) * 100),
        color: '#ffc107',
        description: 'Calls that went to voicemail'
      });
    }
    
    if (callsData.callback_calls > 0) {
      breakdown.push({
        status: 'Callback Requested',
        count: callsData.callback_calls,
        percentage: Math.round((callsData.callback_calls / total) * 100),
        color: '#17a2b8',
        description: 'Callers who requested a callback'
      });
    }
    
    // Show "Other/In Progress" calls (calls without a recognized completion status)
    const otherCallsCount = callsData.total_calls - callsData.answered_calls - callsData.abandoned_calls - 
                           callsData.voicemail_calls - callsData.callback_calls;
    if (otherCallsCount > 0) {
      breakdown.push({
        status: 'In Progress',
        count: otherCallsCount,
        percentage: Math.round((otherCallsCount / total) * 100),
        color: '#6c757d',
        description: 'Calls currently in progress or no status available'
      });
    }
    
    // If no calls at all, return empty breakdown
    if (breakdown.length === 0 && callsData.total_calls === 0) {
      return [];
    }
    
    return breakdown;
  }

  /**
   * Calculate abandonment rate from REAL calls only
   */
  calculateAbandonmentRateFromRealCalls(callsData) {
    if (callsData.total_calls === 0) {
      return 0;
    }
    
    return Math.round((callsData.abandoned_calls / callsData.total_calls) * 100 * 100) / 100;
  }



  /**
   * Get voice analytics data for last Monday (backward compatibility)
   * Returns call status breakdown including abandonment rates
   */
  async getLastMondayVoiceAnalytics() {
    return this.getVoiceAnalyticsForDate();
  }

  /**
   * Get voice analytics data for the current week (Monday to today)
   * This might match what the online dashboard shows
   */
  async getWeeklyVoiceAnalytics() {
    try {
      console.log('📞 Getting voice analytics for current week...');
      
      // Calculate current week (Monday to today)
      const today = new Date();
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysFromMonday);
      monday.setHours(0, 0, 0, 0);
      
      const mondayStr = monday.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      
      console.log('🗓️ Analyzing voice data for week:', mondayStr, 'to', todayStr);
      
      // Get account overview data - note: the account_overview endpoint returns aggregate data
      // and doesn't support date range filtering reliably
      const endpoint = `/channels/voice/stats/account_overview.json`;
      const accountData = await this.reportingService.makeRequest('GET', endpoint);
      
      if (!accountData || !accountData.account_overview) {
        throw new Error('No account overview data available');
      }
      
      const overview = accountData.account_overview;
      
      // Calculate call status breakdown
      const callStatusBreakdown = this.calculateCallStatusBreakdown(overview);
      
      // Calculate abandonment rate
      const abandonmentRate = this.calculateAbandonmentRate(overview);
      
      return {
        success: true,
        data: {
          date_range: `${mondayStr} to ${todayStr}`,
          period: 'Current Week',
          call_status_breakdown: callStatusBreakdown,
          abandonment_rate: abandonmentRate,
          summary: {
            total_calls: overview.total_calls || 0,
            abandoned_calls: overview.total_calls_abandoned_in_queue || 0,
            answered_calls: this.calculateAnsweredCalls(overview),
            voicemail_calls: overview.total_voicemails || 0,
            callback_calls: overview.total_callback_calls || 0,
            outside_hours_calls: overview.total_calls_outside_business_hours || 0,
            inbound_calls: overview.total_inbound_calls || 0,
            outbound_calls: overview.total_outbound_calls || 0
          },
          chart_data: {
            labels: callStatusBreakdown.map(item => item.status),
            datasets: [{
              data: callStatusBreakdown.map(item => item.count),
              backgroundColor: ['#206bc4', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c'],
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          }
        }
      };
      
    } catch (error) {
      console.error('❌ Error getting weekly voice analytics:', error.message);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Get comprehensive voice analytics with multiple time periods and diagnostic info
   * This helps identify discrepancies with online dashboards
   * @param {string} selectedDate - Date in YYYY-MM-DD format (optional, defaults to last Monday)
   */
  async getComprehensiveVoiceAnalytics(selectedDate = null) {
    try {
      console.log('📞 Getting comprehensive voice analytics with diagnostic info...');
      
      // Get data for the selected date (or last Monday)
      const primaryData = await this.getVoiceAnalyticsForDate(selectedDate);
      const weeklyData = await this.getWeeklyVoiceAnalytics();
      
      // Calculate monthly data
      const today = new Date();
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      
      // Get account overview - note: date filtering may not work reliably
      const monthlyEndpoint = `/channels/voice/stats/account_overview.json`;
      const monthlyAccountData = await this.reportingService.makeRequest('GET', monthlyEndpoint);
      
      const monthlyOverview = monthlyAccountData.account_overview;
      const baseCalls = monthlyOverview.total_calls || 0;
      
      return {
        success: true,
        data: {
          primary_data: primaryData.success ? primaryData.data : null,
          alternative_periods: {
            current_week: weeklyData.success ? weeklyData.data : null,
            current_month: {
              date_range: `${firstOfMonthStr} to ${todayStr}`,
              period: 'Current Month',
              summary: {
                total_calls: baseCalls,
                abandoned_calls: monthlyOverview.total_calls_abandoned_in_queue || 0,
                answered_calls: this.calculateAnsweredCalls(monthlyOverview),
                voicemail_calls: monthlyOverview.total_voicemails || 0,
                callback_calls: monthlyOverview.total_callback_calls || 0,
                outside_hours_calls: monthlyOverview.total_calls_outside_business_hours || 0,
                inbound_calls: monthlyOverview.total_inbound_calls || 0,
                outbound_calls: monthlyOverview.total_outbound_calls || 0
              },
              abandonment_rate: this.calculateAbandonmentRate(monthlyOverview)
            }
          },
          diagnostic_info: {
            api_base_calls: primaryData.success ? primaryData.data.summary.total_calls : 0,
            online_dashboard_target: 397,
            discrepancy_ratio: primaryData.success && primaryData.data.summary.total_calls > 0 ? (397 / primaryData.data.summary.total_calls).toFixed(2) : 'N/A',
            possible_explanations: [
              'Online dashboard may show weekly totals (' + (primaryData.success ? primaryData.data.summary.total_calls * 5 : 0) + ' calls)',
              'Online dashboard may include call legs/transfers',
              'Online dashboard may use different time period',
              'Online dashboard may aggregate different metrics'
            ],
            data_source: 'Zendesk Voice API /channels/voice/stats/account_overview.json',
            last_updated: new Date().toISOString(),
            selected_date: selectedDate || 'Last Monday (auto-calculated)'
          }
        }
      };
      
    } catch (error) {
      console.error('❌ Error getting comprehensive voice analytics:', error.message);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Calculate last Monday's date
   */
  getLastMonday() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate days to go back to last Monday
    let daysBack;
    if (dayOfWeek === 0) { // Sunday
      daysBack = 6; // Go back to previous Monday
    } else if (dayOfWeek === 1) { // Monday
      daysBack = 7; // Go back to previous Monday (not today)
    } else {
      daysBack = dayOfWeek - 1 + 7; // Go back to previous Monday
    }
    
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - daysBack);
    lastMonday.setHours(0, 0, 0, 0);
    
    return lastMonday;
  }

  /**
   * Calculate answered calls (total - abandoned - outside hours - voicemails)
   */
  calculateAnsweredCalls(overview) {
    const total = overview.total_calls || 0;
    const abandoned = overview.total_calls_abandoned_in_queue || 0;
    const outsideHours = overview.total_calls_outside_business_hours || 0;
    const voicemails = overview.total_voicemails || 0;
    
    // When call center is closed, no calls are answered by agents
    // (all calls go to voicemail or are outside business hours)
    if (outsideHours >= total || voicemails >= total) {
      return 0; // No answered calls when center is closed
    }
    
    // Answered calls = total - abandoned - outside hours - voicemails
    const answered = Math.max(0, total - abandoned - outsideHours - voicemails);
    return answered;
  }

  /**
   * Calculate abandonment rate percentage from REAL API data only
   */
  calculateAbandonmentRate(callsData) {
    if (callsData.total_calls === 0) return 0;
    return Math.round((callsData.abandoned_calls / callsData.total_calls) * 100 * 100) / 100;
  }

  /**
   * Calculate detailed call status breakdown from REAL API data only
   */
  calculateCallStatusBreakdown(callsData) {
    const breakdown = [];
    const total = callsData.total_calls || 1;
    
    if (callsData.answered_calls > 0) {
      breakdown.push({
        status: 'Answered',
        count: callsData.answered_calls,
        percentage: Math.round((callsData.answered_calls / total) * 100),
        color: '#28a745',
        description: 'Calls successfully answered by agents'
      });
    }
    
    if (callsData.abandoned_calls > 0) {
      breakdown.push({
        status: 'Abandoned',
        count: callsData.abandoned_calls,
        percentage: Math.round((callsData.abandoned_calls / total) * 100),
        color: '#dc3545',
        description: 'Calls abandoned while waiting in queue'
      });
    }
    
    if (callsData.voicemail_calls > 0) {
      breakdown.push({
        status: 'Voicemail',
        count: callsData.voicemail_calls,
        percentage: Math.round((callsData.voicemail_calls / total) * 100),
        color: '#ffc107',
        description: 'Calls that went to voicemail'
      });
    }
    
    if (callsData.callback_calls > 0) {
      breakdown.push({
        status: 'Callback Requested',
        count: callsData.callback_calls,
        percentage: Math.round((callsData.callback_calls / total) * 100),
        color: '#17a2b8',
        description: 'Callers who requested a callback'
      });
    }
    
    return breakdown;
  }

  /**
   * Calculate percentage for a status from REAL data
   */
  calculatePercentage(count, total) {
    if (total === 0) return 0;
    return Math.round((count / total) * 100 * 100) / 100;
  }

  /**
   * Prepare data for chart visualization
   */
  prepareChartData(breakdown) {
    return {
      labels: breakdown.map(item => item.status),
      datasets: [{
        label: 'Call Distribution',
        data: breakdown.map(item => item.count),
        backgroundColor: breakdown.map(item => item.color),
        borderColor: breakdown.map(item => item.color),
        borderWidth: 1
      }],
      // Additional data for layered chart
      categories: breakdown.map(item => ({
        name: item.status,
        value: item.count,
        percentage: item.percentage,
        color: item.color,
        description: item.description
      }))
    };
  }

  /**
   * Create synthetic call records from account overview data
   * REMOVED - NO LONGER USING SYNTHETIC DATA - ONLY REAL API DATA
   */

  /**
   * Diagnostic method to check call data availability across multiple days
   */
  async diagnoseCallDataAvailability(daysBack = 7) {
    try {
      console.log('🔍 Diagnosing call data availability for the last', daysBack, 'days...');
      
      const results = [];
      const today = new Date();
      
      for (let i = 0; i < daysBack; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - i);
        const dateStr = targetDate.toISOString().split('T')[0];
        const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'short' });
        
        // Try the standard time range
        const startTime = dateStr + 'T00:00:00Z';
        const endTime = dateStr + 'T23:59:59Z';
        const endpoint = '/channels/voice/calls.json?start_time=' + startTime + '&end_time=' + endTime;
        
        try {
          const result = await this.reportingService.makeRequest('GET', endpoint);
          results.push({
            date: dateStr,
            day: dayName,
            calls: result.count || 0,
            hasData: (result.count || 0) > 0
          });
        } catch (error) {
          results.push({
            date: dateStr,
            day: dayName,
            calls: 0,
            error: error.message
          });
        }
      }
      
      console.log('📊 Call data availability:');
      results.forEach(result => {
        console.log(`  ${result.date} (${result.day}): ${result.calls} calls ${result.hasData ? '✅' : '❌'}`);
      });
      
      return results;
    } catch (error) {
      console.error('❌ Error in diagnosis:', error.message);
      return [];
    }
  }

  /**
   * Get voice analytics summary for dashboard cards
   */
  async getVoiceAnalyticsSummary() {
    try {
      const analytics = await this.getLastMondayVoiceAnalytics();
      
      if (!analytics.success) {
        throw new Error(analytics.error);
      }
      
      const { summary } = analytics.data;
      
      return {
        success: true,
        data: {
          total_calls: summary.total_calls,
          abandonment_rate: summary.abandonment_percentage,
          answered_rate: Math.round((summary.answered_calls / summary.total_calls) * 100 * 100) / 100,
          voicemail_rate: Math.round((summary.voicemail_calls / summary.total_calls) * 100 * 100) / 100,
          callback_requests: summary.callback_calls,
          date: analytics.data.date,
          day_name: analytics.data.day_name
        }
      };
      
    } catch (error) {
      console.error('❌ Error getting voice summary:', error.message);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
}

module.exports = VoiceAnalyticsService;