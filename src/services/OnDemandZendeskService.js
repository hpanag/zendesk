const ZendeskReportingService = require('./ZendeskReportingService');

/**
 * On-Demand Zendesk Data Service
 * Fetches real-time data only when requested, no caching
 */
class OnDemandZendeskService {
  constructor() {
    this.service = new ZendeskReportingService();
  }

  /**
   * Get specific data based on user question keywords
   * Only fetches what's needed for the question
   */
  async getRelevantData(userQuestion) {
    const lowerQuestion = userQuestion.toLowerCase();
    const dataPromises = [];
    const dataTypes = [];

    console.log('🎯 Analyzing question for relevant APIs:', userQuestion.substring(0, 100) + '...');

    // Voice/Call queries
    if (this.isVoiceQuery(lowerQuestion)) {
      console.log('📞 Fetching voice/call data...');
      
      // Get comprehensive call statistics for today
      dataPromises.push(
        this.service.getCallStatistics('today')
          .then(data => ({ type: 'call_statistics', data }))
          .catch(error => ({ type: 'call_statistics', error: error.message }))
      );
      dataTypes.push('call_statistics');

      // Get Talk statistics
      dataPromises.push(
        this.service.getTalkStats()
          .then(data => ({ type: 'talk_stats', data }))
          .catch(error => ({ type: 'talk_stats', error: error.message }))
      );
      dataTypes.push('talk_stats');

      // Get call overview for today
      dataPromises.push(
        this.service.getCallOverview('today')
          .then(data => ({ type: 'call_overview', data }))
          .catch(error => ({ type: 'call_overview', error: error.message }))
      );
      dataTypes.push('call_overview');

      // Get Talk overview which provides comprehensive voice metrics
      dataPromises.push(
        this.service.getTalkOverview('today')
          .then(data => ({ type: 'talk_overview', data }))
          .catch(error => ({ type: 'talk_overview', error: error.message }))
      );
      dataTypes.push('talk_overview');

      // Get current queue activity for real-time data
      dataPromises.push(
        this.service.getCurrentQueueActivity()
          .then(data => ({ type: 'queue_activity', data }))
          .catch(error => ({ type: 'queue_activity', error: error.message }))
      );
      dataTypes.push('queue_activity');

      // Get agent activity for staffing insights
      dataPromises.push(
        this.service.getAgentsActivity()
          .then(data => ({ type: 'agents_activity', data }))
          .catch(error => ({ type: 'agents_activity', error: error.message }))
      );
      dataTypes.push('agents_activity');

      // Get missed call statistics if specifically asked or for comprehensive call data
      if (lowerQuestion.includes('missed') || lowerQuestion.includes('unanswered')) {
        dataPromises.push(
          this.service.getMissedCallStats()
            .then(data => ({ type: 'missed_calls', data }))
            .catch(error => ({ type: 'missed_calls', error: error.message }))
        );
        dataTypes.push('missed_calls');
      }

      // Get Talk agents activity
      dataPromises.push(
        this.service.getTalkAgents()
          .then(data => ({ type: 'talk_agents', data }))
          .catch(error => ({ type: 'talk_agents', error: error.message }))
      );
      dataTypes.push('talk_agents');

      // Get historical data if asking about date ranges
      if (lowerQuestion.includes('yesterday') || lowerQuestion.includes('week') || 
          lowerQuestion.includes('month') || lowerQuestion.includes('history')) {
        dataPromises.push(
          this.service.getTalkHistoricalStats()
            .then(data => ({ type: 'historical_stats', data }))
            .catch(error => ({ type: 'historical_stats', error: error.message }))
        );
        dataTypes.push('historical_stats');
      }

      // Get call analytics if asking for detailed analysis
      if (lowerQuestion.includes('analytics') || lowerQuestion.includes('analysis') ||
          lowerQuestion.includes('performance') || lowerQuestion.includes('report')) {
        dataPromises.push(
          this.service.getCallAnalytics()
            .then(data => ({ type: 'call_analytics', data }))
            .catch(error => ({ type: 'call_analytics', error: error.message }))
        );
        dataTypes.push('call_analytics');
      }

      // Get phone numbers if asking about infrastructure
      if (lowerQuestion.includes('phone') || lowerQuestion.includes('number')) {
        dataPromises.push(
          this.service.getTalkPhoneNumbers()
            .then(data => ({ type: 'phone_numbers', data }))
            .catch(error => ({ type: 'phone_numbers', error: error.message }))
        );
        dataTypes.push('phone_numbers');
      }

      // Get call records for detailed call data
      if (lowerQuestion.includes('record') || lowerQuestion.includes('detail') ||
          lowerQuestion.includes('individual') || lowerQuestion.includes('specific')) {
        dataPromises.push(
          this.service.getCallRecords()
            .then(data => ({ type: 'call_records', data }))
            .catch(error => ({ type: 'call_records', error: error.message }))
        );
        dataTypes.push('call_records');
      }
    }

    // Chat queries
    if (this.isChatQuery(lowerQuestion)) {
      console.log('💬 Fetching chat data...');
      dataPromises.push(
        this.service.getChatAnalytics()
          .then(data => ({ type: 'chat_analytics', data }))
          .catch(error => ({ type: 'chat_analytics', error: error.message }))
      );
      dataTypes.push('chat_analytics');
    }

    // Ticket-related queries
    if (this.isTicketQuery(lowerQuestion)) {
      console.log('📧 Fetching tickets data...');
      
      // Determine if specific status is requested
      let ticketQuery = null;
      let isTimeBasedQuery = false;
      
      // Handle time-based queries first
      if (lowerQuestion.includes('this week') || lowerQuestion.includes('week')) {
        isTimeBasedQuery = true;
        const monday = this.getStartOfWeek();
        const mondayStr = monday.toISOString().split('T')[0];
        
        if (lowerQuestion.includes('closed')) {
          ticketQuery = `type:ticket status:closed updated>${mondayStr}`;
          console.log('🔍 Searching for tickets closed this week...');
        } else if (lowerQuestion.includes('solved')) {
          ticketQuery = `type:ticket status:solved updated>${mondayStr}`;
          console.log('🔍 Searching for tickets solved this week...');
        } else if (lowerQuestion.includes('open')) {
          ticketQuery = `type:ticket status:open created>${mondayStr}`;
          console.log('🔍 Searching for tickets opened this week...');
        } else {
          ticketQuery = `type:ticket updated>${mondayStr}`;
          console.log('🔍 Searching for all ticket activity this week...');
        }
      } else if (lowerQuestion.includes('today')) {
        isTimeBasedQuery = true;
        const today = new Date().toISOString().split('T')[0];
        
        if (lowerQuestion.includes('closed')) {
          ticketQuery = `type:ticket status:closed updated>${today}`;
          console.log('🔍 Searching for tickets closed today...');
        } else if (lowerQuestion.includes('solved')) {
          ticketQuery = `type:ticket status:solved updated>${today}`;
          console.log('🔍 Searching for tickets solved today...');
        } else if (lowerQuestion.includes('open')) {
          ticketQuery = `type:ticket status:open created>${today}`;
          console.log('🔍 Searching for tickets opened today...');
        } else {
          ticketQuery = `type:ticket updated>${today}`;
          console.log('🔍 Searching for today\'s ticket activity...');
        }
      } else if (lowerQuestion.includes('open')) {
        ticketQuery = 'type:ticket status:open';
        console.log('🔍 Searching for open tickets specifically...');
      } else if (lowerQuestion.includes('new')) {
        ticketQuery = 'type:ticket status:new';
        console.log('🔍 Searching for new tickets specifically...');
      } else if (lowerQuestion.includes('pending')) {
        ticketQuery = 'type:ticket status:pending';
        console.log('🔍 Searching for pending tickets specifically...');
      } else if (lowerQuestion.includes('solved')) {
        ticketQuery = 'type:ticket status:solved';
        console.log('🔍 Searching for solved tickets specifically...');
      } else if (lowerQuestion.includes('closed')) {
        ticketQuery = 'type:ticket status:closed';
        console.log('🔍 Searching for closed tickets specifically...');
      }

      if (ticketQuery) {
        // Use search API for specific status queries
        dataPromises.push(
          this.service.search(ticketQuery, { per_page: 100 })
            .then(data => ({ 
              type: 'tickets', 
              data: { 
                tickets: data.results || [], 
                count: data.count || 0,
                search_query: ticketQuery,
                is_time_based: isTimeBasedQuery
              } 
            }))
            .catch(error => ({ type: 'tickets', error: error.message }))
        );
      } else {
        // Use regular tickets API for general queries
        dataPromises.push(
          this.service.getTickets({ per_page: 100 })
            .then(data => ({ type: 'tickets', data }))
            .catch(error => ({ type: 'tickets', error: error.message }))
        );
      }
      dataTypes.push('tickets');
    }

    // User/Agent queries
    if (this.isUserQuery(lowerQuestion)) {
      console.log('👥 Fetching users data...');
      dataPromises.push(
        this.service.getUsers()
          .then(data => ({ type: 'users', data }))
          .catch(error => ({ type: 'users', error: error.message }))
      );
      dataTypes.push('users');
    }

    // Organization queries
    if (this.isOrganizationQuery(lowerQuestion)) {
      console.log('🏢 Fetching organizations data...');
      dataPromises.push(
        this.service.getOrganizations()
          .then(data => ({ type: 'organizations', data }))
          .catch(error => ({ type: 'organizations', error: error.message }))
      );
      dataTypes.push('organizations');
    }

    // Satisfaction/CSAT queries
    if (this.isSatisfactionQuery(lowerQuestion)) {
      console.log('⭐ Fetching satisfaction ratings...');
      dataPromises.push(
        this.service.getSatisfactionRatings()
          .then(data => ({ type: 'satisfaction', data }))
          .catch(error => ({ type: 'satisfaction', error: error.message }))
      );
      dataTypes.push('satisfaction');
    }

    // Business rules queries
    if (this.isBusinessRulesQuery(lowerQuestion)) {
      console.log('⚙️ Fetching business rules...');
      if (lowerQuestion.includes('trigger')) {
        dataPromises.push(
          this.service.getTriggers()
            .then(data => ({ type: 'triggers', data }))
            .catch(error => ({ type: 'triggers', error: error.message }))
        );
        dataTypes.push('triggers');
      }
      if (lowerQuestion.includes('automation')) {
        dataPromises.push(
          this.service.getAutomations()
            .then(data => ({ type: 'automations', data }))
            .catch(error => ({ type: 'automations', error: error.message }))
        );
        dataTypes.push('automations');
      }
      if (lowerQuestion.includes('macro')) {
        dataPromises.push(
          this.service.getMacros()
            .then(data => ({ type: 'macros', data }))
            .catch(error => ({ type: 'macros', error: error.message }))
        );
        dataTypes.push('macros');
      }
    }

    // Groups/Teams queries
    if (this.isGroupQuery(lowerQuestion)) {
      console.log('👥 Fetching groups data...');
      dataPromises.push(
        this.service.getGroups()
          .then(data => ({ type: 'groups', data }))
          .catch(error => ({ type: 'groups', error: error.message }))
      );
      dataTypes.push('groups');
    }

    // Tags queries
    if (this.isTagQuery(lowerQuestion)) {
      console.log('🏷️ Fetching tags data...');
      dataPromises.push(
        this.service.getTags()
          .then(data => ({ type: 'tags', data }))
          .catch(error => ({ type: 'tags', error: error.message }))
      );
      dataTypes.push('tags');
    }

    // If no specific data type detected, get basic ticket overview
    if (dataPromises.length === 0) {
      console.log('📊 No specific data type detected, fetching basic tickets overview...');
      dataPromises.push(
        this.service.getTickets()
          .then(data => ({ type: 'tickets', data }))
          .catch(error => ({ type: 'tickets', error: error.message }))
      );
      dataTypes.push('tickets');
    }

    console.log(`🔍 Making ${dataPromises.length} API call(s) for: ${dataTypes.join(', ')}`);

    // Execute only the relevant API calls
    const results = await Promise.allSettled(dataPromises);
    const processedData = {};

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const { type, data, error } = result.value;
        if (error) {
          console.log(`❌ ${type} API failed: ${error}`);
          processedData[type] = { error };
        } else if (data) {
          processedData[type] = data;
          console.log(`✅ ${type} API succeeded`);
        }
      }
    }

    return this.formatDataForGPT(processedData, userQuestion);
  }

  // Helper method to get start of current week (Monday)
  getStartOfWeek() {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // If Sunday, go back 6 days to Monday
    
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);
    
    return monday;
  }

  // Query type detection methods
  isVoiceQuery(question) {
    const voiceKeywords = [
      // Basic call terms
      'call', 'calls', 'phone', 'voice', 'talk', 'dialer',
      
      // Call actions
      'dialed', 'answered', 'missed', 'transferred', 'hold', 'hung up',
      'pickup', 'ring', 'busy', 'voicemail', 'callback', 'incoming', 'outgoing',
      
      // Call metrics
      'call volume', 'call duration', 'wait time', 'hold time',
      'talk time', 'wrap time', 'queue time', 'response time',
      'call handling', 'call resolution', 'first call resolution',
      
      // Agent activities  
      'agent availability', 'agent status', 'on call', 'available',
      'away', 'offline', 'break', 'lunch',
      
      // Call analytics
      'call statistics', 'call metrics', 'call performance',
      'call reports', 'call analytics', 'call data',
      
      // Time-based call queries
      'calls today', 'calls this week', 'calls this month',
      'daily calls', 'weekly calls', 'monthly calls',
      'total calls', 'number of calls', 'call count',
      
      // Quality metrics
      'call quality', 'call satisfaction', 'call rating',
      'abandoned calls', 'dropped calls', 'call completion'
    ];
    
    return voiceKeywords.some(keyword => 
      question.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  isChatQuery(question) {
    return question.includes('chat') || question.includes('live chat') ||
           question.includes('messaging') || question.includes('conversation');
  }

  isTicketQuery(question) {
    return question.includes('ticket') || question.includes('issue') || 
           question.includes('request') || question.includes('problem') ||
           question.includes('volume') || question.includes('backlog') ||
           question.includes('status') || question.includes('open') ||
           question.includes('closed') || question.includes('solved') ||
           question.includes('pending') || question.includes('today') ||
           question.includes('yesterday') || question.includes('week');
  }

  isUserQuery(question) {
    return question.includes('user') || question.includes('agent') ||
           question.includes('customer') || question.includes('staff') ||
           question.includes('employee') || question.includes('people');
  }

  isOrganizationQuery(question) {
    return question.includes('organization') || question.includes('company') ||
           question.includes('client') || question.includes('account');
  }

  isSatisfactionQuery(question) {
    return question.includes('satisfaction') || question.includes('csat') ||
           question.includes('rating') || question.includes('feedback') ||
           question.includes('survey') || question.includes('score');
  }

  isBusinessRulesQuery(question) {
    return question.includes('trigger') || question.includes('automation') ||
           question.includes('macro') || question.includes('workflow') ||
           question.includes('rule') || question.includes('process');
  }

  isGroupQuery(question) {
    return question.includes('group') || question.includes('team') ||
           question.includes('department') || question.includes('queue');
  }

  isTagQuery(question) {
    return question.includes('tag') || question.includes('label') ||
           question.includes('category') || question.includes('classification');
  }

  /**
   * Format data for GPT consumption
   */
  formatDataForGPT(data, userQuestion) {
    const sections = [];
    const currentDate = new Date().toISOString().split('T')[0];

    sections.push(`📊 Real-time Zendesk data (fetched on-demand for: "${userQuestion.substring(0, 50)}...")`);
    sections.push(`📅 Data timestamp: ${new Date().toISOString()}`);

    // Format tickets data
    if (data.tickets && data.tickets.tickets) {
      const tickets = data.tickets.tickets;
      const totalCount = data.tickets.count || tickets.length;
      
      // Check if this was a search query
      if (data.tickets.search_query) {
        let searchType = 'Filtered';
        let timeContext = '';
        
        // Determine search type and time context
        if (data.tickets.search_query.includes('status:open')) {
          searchType = 'Open';
        } else if (data.tickets.search_query.includes('status:new')) {
          searchType = 'New';
        } else if (data.tickets.search_query.includes('status:pending')) {
          searchType = 'Pending';
        } else if (data.tickets.search_query.includes('status:solved')) {
          searchType = 'Solved';
        } else if (data.tickets.search_query.includes('status:closed')) {
          searchType = 'Closed';
        }
        
        // Add time context for time-based queries
        if (data.tickets.is_time_based) {
          const today = new Date().toISOString().split('T')[0];
          const monday = this.getStartOfWeek().toISOString().split('T')[0];
          
          if (data.tickets.search_query.includes(`updated>${monday}`)) {
            timeContext = ' This Week';
          } else if (data.tickets.search_query.includes(`created>${monday}`)) {
            timeContext = ' This Week (Created)';
          } else if (data.tickets.search_query.includes(`updated>${today}`)) {
            timeContext = ' Today';
          } else if (data.tickets.search_query.includes(`created>${today}`)) {
            timeContext = ' Today (Created)';
          }
        }
        
        const displayTitle = `${searchType}${timeContext}`;
        
        sections.push(`📧 ${displayTitle} Tickets:
• Total ${displayTitle.toLowerCase()} tickets: ${totalCount}
• Showing: ${tickets.length} tickets
• Search query: ${data.tickets.search_query}`);
        
        // Show recent tickets from the search results
        if (tickets.length > 0) {
          const recentTickets = tickets.slice(0, 5);
          const ticketList = recentTickets.map(t => {
            const dateInfo = data.tickets.is_time_based && t.updated_at ? 
              ` (Updated: ${new Date(t.updated_at).toLocaleDateString()})` : '';
            return `  - #${t.id}: ${(t.subject || 'No subject').substring(0, 50)}...${dateInfo}`;
          }).join('\n');
          sections.push(`Recent ${displayTitle.toLowerCase()} tickets:\n${ticketList}`);
        }
      } else {
        // Regular ticket breakdown
        const openTickets = tickets.filter(t => t.status === 'open').length;
        const pendingTickets = tickets.filter(t => t.status === 'pending').length;
        const solvedTickets = tickets.filter(t => t.status === 'solved').length;
        const newTickets = tickets.filter(t => t.status === 'new').length;
        const closedTickets = tickets.filter(t => t.status === 'closed').length;
        
        // Today's activity
        const today = new Date().toISOString().split('T')[0];
        const todayTickets = tickets.filter(t => 
          t.created_at?.startsWith(today) || t.updated_at?.startsWith(today)
        ).length;

        sections.push(`📧 Tickets Overview:
• Total tickets shown: ${tickets.length}${totalCount && totalCount !== tickets.length ? ` (of ${totalCount} total)` : ''}
• New: ${newTickets}
• Open: ${openTickets}
• Pending: ${pendingTickets}
• Solved: ${solvedTickets}
• Closed: ${closedTickets}
• Today's activity: ${todayTickets} tickets`);
      }
    }

    // Format users data
    if (data.users && data.users.users) {
      const users = data.users.users;
      const agents = users.filter(u => u.role === 'agent');
      const endUsers = users.filter(u => u.role === 'end-user');
      const activeUsers = users.filter(u => u.active);

      sections.push(`👥 Users Overview:
• Total users: ${users.length}
• Agents: ${agents.length}
• End users: ${endUsers.length}
• Active users: ${activeUsers.length}`);
    }

    // Format voice/call data
    if (data.talk_stats) {
      let callInfo = [];
      if (data.talk_stats.stats) {
        const stats = data.talk_stats.stats;
        callInfo.push(`📞 Voice/Call Statistics:`);
        if (stats.total_calls !== undefined) callInfo.push(`• Total calls: ${stats.total_calls}`);
        if (stats.answered_calls !== undefined) callInfo.push(`• Answered calls: ${stats.answered_calls}`);
        if (stats.missed_calls !== undefined) callInfo.push(`• Missed calls: ${stats.missed_calls}`);
        if (stats.inbound_calls !== undefined) callInfo.push(`• Inbound calls: ${stats.inbound_calls}`);
        if (stats.outbound_calls !== undefined) callInfo.push(`• Outbound calls: ${stats.outbound_calls}`);
        if (stats.avg_call_duration !== undefined) callInfo.push(`• Average call duration: ${stats.avg_call_duration}s`);
      } else {
        callInfo.push(`📞 Voice/Call Data: Available (structure may vary by Zendesk configuration)`);
      }
      sections.push(callInfo.join('\n'));
    }

    if (data.call_overview) {
      let overviewInfo = [];
      if (data.call_overview.overview) {
        const overview = data.call_overview.overview;
        overviewInfo.push(`📊 Call Overview (Today):`);
        if (overview.total_volume !== undefined) overviewInfo.push(`• Total call volume: ${overview.total_volume}`);
        if (overview.answered_volume !== undefined) overviewInfo.push(`• Answered volume: ${overview.answered_volume}`);
        if (overview.missed_volume !== undefined) overviewInfo.push(`• Missed volume: ${overview.missed_volume}`);
        if (overview.callback_requests !== undefined) overviewInfo.push(`• Callback requests: ${overview.callback_requests}`);
      } else {
        overviewInfo.push(`📊 Call Overview: Data available from Talk API`);
      }
      sections.push(overviewInfo.join('\n'));
    }

    if (data.missed_calls) {
      let missedInfo = [];
      if (data.missed_calls.missed_calls) {
        const missed = data.missed_calls.missed_calls;
        missedInfo.push(`📵 Missed Calls: ${missed.length} missed calls found`);
      } else {
        missedInfo.push(`📵 Missed Calls: Data available from Talk API`);
      }
      sections.push(missedInfo.join('\n'));
    }

    if (data.talk_agents) {
      let agentInfo = [];
      if (data.talk_agents.agents) {
        const agents = data.talk_agents.agents;
        const activeAgents = agents.filter(a => a.active || a.online).length;
        agentInfo.push(`🎧 Talk Agents:`);
        agentInfo.push(`• Total Talk agents: ${agents.length}`);
        agentInfo.push(`• Active/Online agents: ${activeAgents}`);
      } else {
        agentInfo.push(`🎧 Talk Agents: Data available from Talk API`);
      }
      sections.push(agentInfo.join('\n'));
    }

    // Additional voice data formatting
    if (data.call_statistics) {
      let statsInfo = [];
      if (data.call_statistics.statistics) {
        const stats = data.call_statistics.statistics;
        statsInfo.push(`📈 Call Statistics (Today):`);
        if (stats.total_calls !== undefined) statsInfo.push(`• Total calls processed: ${stats.total_calls}`);
        if (stats.answered_calls !== undefined) statsInfo.push(`• Successfully answered: ${stats.answered_calls}`);
        if (stats.abandoned_calls !== undefined) statsInfo.push(`• Abandoned calls: ${stats.abandoned_calls}`);
        if (stats.service_level !== undefined) statsInfo.push(`• Service level: ${stats.service_level}%`);
      } else {
        statsInfo.push(`📈 Call Statistics: Real-time data available`);
      }
      sections.push(statsInfo.join('\n'));
    }

    if (data.talk_overview) {
      let talkInfo = [];
      if (data.talk_overview.data) {
        const overview = data.talk_overview.data;
        talkInfo.push(`📊 Talk Overview:`);
        if (overview.calls_volume !== undefined) talkInfo.push(`• Call volume: ${overview.calls_volume}`);
        if (overview.calls_answered !== undefined) talkInfo.push(`• Calls answered: ${overview.calls_answered}`);
        if (overview.average_wait_time !== undefined) talkInfo.push(`• Average wait time: ${overview.average_wait_time}s`);
      } else {
        talkInfo.push(`📊 Talk Overview: Comprehensive voice metrics available`);
      }
      sections.push(talkInfo.join('\n'));
    }

    if (data.queue_activity) {
      let queueInfo = [];
      if (data.queue_activity.activity) {
        const activity = data.queue_activity.activity;
        queueInfo.push(`🔄 Current Queue Activity:`);
        if (activity.calls_waiting !== undefined) queueInfo.push(`• Calls waiting: ${activity.calls_waiting}`);
        if (activity.longest_wait !== undefined) queueInfo.push(`• Longest wait time: ${activity.longest_wait}s`);
        if (activity.agents_available !== undefined) queueInfo.push(`• Agents available: ${activity.agents_available}`);
      } else {
        queueInfo.push(`🔄 Queue Activity: Real-time queue data available`);
      }
      sections.push(queueInfo.join('\n'));
    }

    if (data.agents_activity) {
      let activityInfo = [];
      if (data.agents_activity.agents) {
        const agents = data.agents_activity.agents;
        const onCall = agents.filter(a => a.status === 'on_call').length;
        const available = agents.filter(a => a.status === 'available').length;
        activityInfo.push(`👨‍💼 Agent Activity:`);
        activityInfo.push(`• Agents on call: ${onCall}`);
        activityInfo.push(`• Agents available: ${available}`);
        activityInfo.push(`• Total active agents: ${agents.length}`);
      } else {
        activityInfo.push(`👨‍💼 Agent Activity: Real-time agent status available`);
      }
      sections.push(activityInfo.join('\n'));
    }

    if (data.historical_stats) {
      let histInfo = [];
      if (data.historical_stats.stats) {
        const stats = data.historical_stats.stats;
        histInfo.push(`📊 Historical Voice Data: Available for trend analysis`);
      } else {
        histInfo.push(`📊 Historical Voice Data: Historical call metrics available`);
      }
      sections.push(histInfo.join('\n'));
    }

    if (data.call_analytics) {
      let analyticsInfo = [];
      if (data.call_analytics.analytics) {
        const analytics = data.call_analytics.analytics;
        analyticsInfo.push(`🔍 Call Analytics: Detailed performance analysis available`);
      } else {
        analyticsInfo.push(`🔍 Call Analytics: Advanced call metrics and insights available`);
      }
      sections.push(analyticsInfo.join('\n'));
    }

    if (data.phone_numbers) {
      let phoneInfo = [];
      if (data.phone_numbers.phone_numbers) {
        const phones = data.phone_numbers.phone_numbers;
        phoneInfo.push(`📱 Phone Numbers: ${phones.length} configured numbers`);
      } else {
        phoneInfo.push(`📱 Phone Numbers: Phone system configuration available`);
      }
      sections.push(phoneInfo.join('\n'));
    }

    if (data.call_records) {
      let recordsInfo = [];
      if (data.call_records.calls) {
        const calls = data.call_records.calls;
        recordsInfo.push(`📋 Call Records: ${calls.length} detailed call records available`);
      } else {
        recordsInfo.push(`📋 Call Records: Individual call details available`);
      }
      sections.push(recordsInfo.join('\n'));
    }

    // Format chat data
    if (data.chat_analytics) {
      let chatInfo = [];
      if (data.chat_analytics.analytics) {
        const analytics = data.chat_analytics.analytics;
        chatInfo.push(`💬 Chat Analytics:`);
        if (analytics.total_chats !== undefined) chatInfo.push(`• Total chats: ${analytics.total_chats}`);
        if (analytics.served_chats !== undefined) chatInfo.push(`• Served chats: ${analytics.served_chats}`);
        if (analytics.missed_chats !== undefined) chatInfo.push(`• Missed chats: ${analytics.missed_chats}`);
        if (analytics.avg_response_time !== undefined) chatInfo.push(`• Average response time: ${analytics.avg_response_time}s`);
      } else {
        chatInfo.push(`💬 Chat Analytics: Data available from Chat API`);
      }
      sections.push(chatInfo.join('\n'));
    }

    // Format organizations data
    if (data.organizations && data.organizations.organizations) {
      const orgs = data.organizations.organizations;
      sections.push(`🏢 Organizations: ${orgs.length} total organizations`);
    }

    // Format satisfaction data
    if (data.satisfaction && data.satisfaction.satisfaction_ratings) {
      const ratings = data.satisfaction.satisfaction_ratings;
      const good = ratings.filter(r => r.score === 'good').length;
      const bad = ratings.filter(r => r.score === 'bad').length;
      const rate = ratings.length > 0 ? ((good / ratings.length) * 100).toFixed(1) : '0';

      sections.push(`⭐ Customer Satisfaction:
• Total ratings: ${ratings.length}
• Satisfaction rate: ${rate}%
• Good ratings: ${good}
• Bad ratings: ${bad}`);
    }

    // Format business rules data
    if (data.triggers && data.triggers.triggers) {
      const triggers = data.triggers.triggers;
      const activeTriggers = triggers.filter(t => t.active).length;
      sections.push(`⚙️ Triggers: ${triggers.length} total, ${activeTriggers} active`);
    }

    if (data.automations && data.automations.automations) {
      const automations = data.automations.automations;
      const activeAutomations = automations.filter(a => a.active).length;
      sections.push(`🤖 Automations: ${automations.length} total, ${activeAutomations} active`);
    }

    if (data.macros && data.macros.macros) {
      const macros = data.macros.macros;
      const activeMacros = macros.filter(m => m.active).length;
      sections.push(`📝 Macros: ${macros.length} total, ${activeMacros} active`);
    }

    // Format groups data
    if (data.groups && data.groups.groups) {
      const groups = data.groups.groups;
      sections.push(`👥 Groups/Teams: ${groups.length} total groups`);
    }

    // Format tags data
    if (data.tags && data.tags.tags) {
      const tags = data.tags.tags;
      sections.push(`🏷️ Tags: ${tags.length} available tags`);
    }

    return sections.join('\n\n');
  }
}

module.exports = OnDemandZendeskService;