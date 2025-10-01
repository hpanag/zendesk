const ZendeskClient = require('./ZendeskClient');

class LiveFeedAnalyzer {
  constructor() {
    this.zendesk = new ZendeskClient();
    this.liveFeedData = {};
  }

  async getCurrentCallQueue() {
    console.log('📞 Checking current call queue...');
    
    try {
      // Try to get real-time queue data from Voice/Talk API first
      try {
        const voiceStats = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
        
        if (voiceStats && voiceStats.current_queue_activity) {
          const queueData = voiceStats.current_queue_activity;
          
          console.log(`📋 Found ${queueData.calls_waiting || 0} calls currently in queue (from Voice API)`);
          
          return {
            callsInQueue: queueData.calls_waiting || 0,
            callbacksWaiting: queueData.callbacks_waiting || 0,
            averageWaitTime: queueData.average_wait_time || 0,
            longestWaitTime: queueData.longest_wait_time || 0,
            queueSource: 'voice_api',
            queuedTickets: [] // Voice API doesn't provide ticket details
          };
        }
      } catch (voiceError) {
        console.log('Voice API not available, falling back to ticket search...');
      }
      
      // Fallback: Get tickets that are currently in queue (new voice tickets)
      const response = await this.zendesk.search('type:ticket channel:voice status:new', {
        per_page: 100,
        sort_by: 'created_at',
        sort_order: 'asc'
      });

      const queuedCalls = response.results || [];
      
      console.log(`📋 Found ${queuedCalls.length} calls currently in queue (from tickets)`);
      
      return {
        callsInQueue: queuedCalls.length,
        queueSource: 'tickets',
        queuedTickets: queuedCalls.map(ticket => ({
          id: ticket.id,
          subject: ticket.subject,
          createdAt: ticket.created_at,
          waitTime: this.calculateWaitTime(ticket.created_at)
        }))
      };
    } catch (error) {
      console.error('Error fetching call queue:', error.message);
      return {
        callsInQueue: 0,
        queuedTickets: [],
        error: error.message
      };
    }
  }

  async getTodaysCallMetrics() {
    console.log('📊 Fetching today\'s call metrics...');
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString().split('T')[0];
      
      // Get real call metrics from Voice Agent Activity API (most accurate source)
      let agentActivityData = null;
      try {
        const agentResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/agents_activity.json');
        agentActivityData = agentResponse.agents_activity || [];
        console.log(`✅ Found agent activity data for ${agentActivityData.length} agents`);
      } catch (error) {
        console.log('Agent activity API not available, falling back to tickets');
      }
      
      // Get today's tickets and filter for voice channel (for ticket counting)
      const todayTickets = await this.zendesk.getTickets({
        per_page: 100,
        sort_by: 'created_at',
        sort_order: 'desc'
      });
      
      // Filter for voice tickets created today
      const allTickets = todayTickets.tickets || [];
      const tickets = allTickets.filter(ticket => {
        const createdDate = new Date(ticket.created_at);
        const isToday = createdDate >= today;
        const isVoice = ticket.via?.channel === 'voice';
        return isToday && isVoice;
      });
      
      // Get current queue stats for real-time metrics
      let currentQueueStats = null;
      try {
        const queueResponse = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
        currentQueueStats = queueResponse.current_queue_activity;
      } catch (error) {
        console.log('Current queue stats not available');
      }
      
      // Calculate metrics using both Agent Activity API and tickets
      let totalCalls = 0;
      let totalInbound = 0;
      let totalOutbound = 0;
      let totalCallbacks = 0;
      let abandonedCalls = 0;
      let exceededWaitTime = 0;
      let maxCallsWaiting = currentQueueStats?.calls_waiting || 0;
      
      let totalDurationSeconds = 0;
      let totalWaitTimeSeconds = 0;
      let totalAnswerTimeSeconds = 0;
      let totalHoldTimeSeconds = 0;
      let callbackWaitTimeSeconds = 0;
      
      let callsWithDuration = 0;
      let callsWithWaitTime = 0;
      let callsWithAnswerTime = 0;
      let callsWithHoldTime = 0;
      let callbacksWithWaitTime = 0;

      // If we have agent activity data, use it for accurate metrics
      if (agentActivityData && agentActivityData.length > 0) {
        console.log('📊 Using Agent Activity API for accurate call metrics');
        
        agentActivityData.forEach(agent => {
          // Aggregate call counts
          totalCalls += (agent.calls_accepted || 0) + (agent.calls_denied || 0) + (agent.calls_missed || 0);
          totalInbound += agent.calls_accepted || 0; // Most accepted calls are inbound
          abandonedCalls += agent.calls_missed || 0;
          
          // Aggregate timing data (convert to seconds if needed)
          if (agent.total_talk_time > 0) {
            totalDurationSeconds += agent.total_talk_time;
            callsWithDuration++;
          }
          
          if (agent.average_talk_time > 0 && agent.calls_accepted > 0) {
            // If we have average and count, we can calculate total
            const agentTotalTalk = agent.average_talk_time * agent.calls_accepted;
            totalDurationSeconds += agentTotalTalk;
            callsWithDuration += agent.calls_accepted;
          }
          
          if (agent.total_hold_time > 0) {
            totalHoldTimeSeconds += agent.total_hold_time;
            callsWithHoldTime++;
          }
          
          if (agent.average_hold_time > 0 && agent.calls_put_on_hold > 0) {
            const agentTotalHold = agent.average_hold_time * agent.calls_put_on_hold;
            totalHoldTimeSeconds += agentTotalHold;
            callsWithHoldTime += agent.calls_put_on_hold;
          }
        });
        
        console.log(`📊 Agent Activity Summary: ${totalCalls} total calls, ${abandonedCalls} abandoned`);
      } else {
        // Fallback to ticket analysis
        console.log('📊 Using ticket analysis for call metrics');
        totalCalls = tickets.length;
      }
      
        // Supplement with ticket analysis for call classification and abandonment detection
      tickets.forEach(ticket => {
        const via = ticket.via;
        const subject = (ticket.subject || '').toLowerCase();
        const description = (ticket.description || '').toLowerCase();
        
        // Always analyze tickets for outbound/callback detection (more accurate than API)
        // Determine call direction from via source
        if (via && via.source) {
          const source = via.source;
          if (source.rel === 'outbound') {
            totalOutbound++;
            console.log(`📞 Found outbound call: ${ticket.subject} (Ticket #${ticket.id})`);
          }
        } else {
          // Fallback analysis based on subject/description
          if (subject.includes('outbound') || subject.includes('outgoing')) {
            totalOutbound++;
            console.log(`📞 Found outbound call by subject: ${ticket.subject} (Ticket #${ticket.id})`);
          }
        }
        
        // Check for callbacks
        if (subject.includes('callback') || 
            subject.includes('call back') ||
            description.includes('callback') ||
            description.includes('call back') ||
            description.includes('scheduled call')) {
          totalCallbacks++;
          console.log(`📞 Found callback call: ${ticket.subject} (Ticket #${ticket.id})`);
        }
        
        // If we don't have agent activity data, count tickets as calls
        if (!agentActivityData || agentActivityData.length === 0) {
          totalCalls++;
        }
        
        // Always analyze tickets for abandoned calls (more accurate than agent API for this metric)
        const createdAt = new Date(ticket.created_at);
        const updatedAt = new Date(ticket.updated_at);
        const ticketDuration = updatedAt - createdAt;
        
        const isAbandoned = (
          // Explicit abandonment indicators in subject/description
          subject.includes('abandoned') ||
          subject.includes('missed') ||
          subject.includes('no answer') ||
          subject.includes('unanswered') ||
          description.includes('abandoned') ||
          description.includes('missed') ||
          description.includes('no answer') ||
          description.includes('caller hung up') ||
          description.includes('disconnected')
        ) || (
          // Very short tickets that were never assigned (likely abandoned)
          ticketDuration < 30000 && !ticket.assignee_id // Less than 30 seconds and unassigned
        ) || (
          // Quick closed/solved tickets (potential abandonment)
          (ticket.status === 'closed' || ticket.status === 'solved') && 
          ticketDuration < 60000 && !ticket.assignee_id // Less than 1 minute, unassigned
        );
        
        if (isAbandoned) {
          abandonedCalls++;
        }
        
        // If we don't have agent timing data, extract from ticket descriptions
        if (!agentActivityData || agentActivityData.length === 0) {
          const customFields = ticket.custom_fields || [];
          
          customFields.forEach(field => {
            const value = parseFloat(field.value);
            if (!isNaN(value) && value > 0) {
              const fieldName = field.id.toString().toLowerCase();
              
              if (fieldName.includes('duration') || fieldName.includes('call_time')) {
                totalDurationSeconds += value;
                callsWithDuration++;
              } else if (fieldName.includes('wait') || fieldName.includes('queue')) {
                totalWaitTimeSeconds += value;
                callsWithWaitTime++;
                if (value > 300) exceededWaitTime++;
              } else if (fieldName.includes('answer') || fieldName.includes('pickup')) {
                totalAnswerTimeSeconds += value;
                callsWithAnswerTime++;
              } else if (fieldName.includes('hold')) {
                totalHoldTimeSeconds += value;
                callsWithHoldTime++;
              }
            }
          });
          
          // Extract timing from description patterns
          const durationMatch = description.match(/duration:?\s*(\d+(?:\.\d+)?)\s*(min|sec|minute|second)/i);
          if (durationMatch) {
            const duration = parseFloat(durationMatch[1]);
            const unit = durationMatch[2].toLowerCase();
            const durationInSeconds = unit.startsWith('min') ? duration * 60 : duration;
            
            if (durationInSeconds > 0) {
              totalDurationSeconds += durationInSeconds;
              callsWithDuration++;
            }
          }
          
          const waitMatch = description.match(/wait(?:ed|ing)?:?\s*(\d+(?:\.\d+)?)\s*(min|sec|minute|second)/i);
          if (waitMatch) {
            const waitTime = parseFloat(waitMatch[1]);
            const unit = waitMatch[2].toLowerCase();
            const waitTimeInSeconds = unit.startsWith('min') ? waitTime * 60 : waitTime;
            
            if (waitTimeInSeconds > 0) {
              totalWaitTimeSeconds += waitTimeInSeconds;
              callsWithWaitTime++;
              if (waitTimeInSeconds > 300) exceededWaitTime++;
            }
          }
        }
      });
      
      // Calculate averages (convert to minutes for readability)
      const avgDuration = callsWithDuration > 0 ? Math.round(totalDurationSeconds / callsWithDuration / 60 * 100) / 100 : 0;
      
      // For wait times: use current queue data as proxy if no historical data available
      let avgWaitTime = callsWithWaitTime > 0 ? Math.round(totalWaitTimeSeconds / callsWithWaitTime / 60 * 100) / 100 : 0;
      
      // If no historical wait time data, use current queue average as proxy for daily average
      if (avgWaitTime === 0 && currentQueueStats && currentQueueStats.average_wait_time > 0) {
        avgWaitTime = Math.round(currentQueueStats.average_wait_time / 60 * 100) / 100;
        console.log(`📊 Using current queue average wait (${avgWaitTime}min) as daily proxy`);
      }
      
      // Calculate exceeded wait times based on current queue patterns and call volume
      if (exceededWaitTime === 0 && currentQueueStats && currentQueueStats.average_wait_time > 300) {
        // If current average exceeds 5 minutes, estimate based on call volume
        // Assuming most calls today experienced similar wait times
        exceededWaitTime = Math.floor(totalCalls * 0.8); // Estimate 80% exceeded if current avg > 5min
        console.log(`📊 Estimated ${exceededWaitTime} calls exceeded wait time based on current queue patterns`);
      }
      
      // Calculate average time to answer from agent activity data (more accurate approach)
      let avgAnswerTime = 0;
      if (agentActivityData && agentActivityData.length > 0) {
        // Use the difference between total call duration and total talk time as answer time proxy
        const totalCallDuration = agentActivityData.reduce((sum, agent) => sum + (agent.total_call_duration || 0), 0);
        const totalTalkTime = agentActivityData.reduce((sum, agent) => sum + (agent.total_talk_time || 0), 0);
        const totalAccepted = agentActivityData.reduce((sum, agent) => sum + (agent.calls_accepted || 0), 0);
        
        if (totalAccepted > 0 && totalCallDuration > totalTalkTime) {
          const totalAnswerTimeFromActivity = totalCallDuration - totalTalkTime;
          avgAnswerTime = Math.round(totalAnswerTimeFromActivity / totalAccepted);
          console.log(`📊 Calculated average time to answer: ${avgAnswerTime}s from agent activity data`);
        }
      } else {
        // Fallback to parsed ticket data
        avgAnswerTime = callsWithAnswerTime > 0 ? Math.round(totalAnswerTimeSeconds / callsWithAnswerTime) : 0;
      }
      
      const avgHoldTime = callsWithHoldTime > 0 ? Math.round(totalHoldTimeSeconds / callsWithHoldTime / 60 * 100) / 100 : 0;
      
      // Calculate callback wait time from callback tickets
      let avgCallbackWaitTime = 0;
      if (totalCallbacks > 0) {
        const callbackTickets = tickets.filter(ticket => {
          const subject = (ticket.subject || '').toLowerCase();
          const description = (ticket.description || '').toLowerCase();
          return subject.includes('callback') || description.includes('callback') || subject.includes('call back');
        });
        
        if (callbackTickets.length > 0) {
          const callbackWaitTimes = callbackTickets.map(ticket => {
            const created = new Date(ticket.created_at);
            const updated = new Date(ticket.updated_at);
            return (updated - created) / 1000 / 60; // Convert to minutes
          }).filter(time => time > 0 && time < 120); // Reasonable range
          
          if (callbackWaitTimes.length > 0) {
            avgCallbackWaitTime = Math.round(
              callbackWaitTimes.reduce((a, b) => a + b, 0) / callbackWaitTimes.length * 100
            ) / 100;
            console.log(`📊 Calculated callback wait time: ${avgCallbackWaitTime} minutes from ${callbackWaitTimes.length} callbacks`);
          }
        }
      }
      
      // Use current queue stats for real-time data when available
      if (currentQueueStats) {
        maxCallsWaiting = Math.max(maxCallsWaiting, currentQueueStats.calls_waiting || 0);
      }
      
      // Adjust callback count to be subset of total calls, not additional
      totalCallbacks = Math.min(totalCallbacks, totalCalls);
      
      // Calculate inbound as total minus outbound (when we have agent activity data)
      if (agentActivityData && agentActivityData.length > 0) {
        totalInbound = totalCalls - totalOutbound;
        console.log(`📊 Calculated inbound calls: ${totalCalls} total - ${totalOutbound} outbound = ${totalInbound} inbound`);
      }
      
      const dataSource = agentActivityData && agentActivityData.length > 0 ? 'Agent Activity API + Ticket Analysis' : 'Ticket Analysis';
      
      console.log(`✅ Today's call metrics analysis complete (${dataSource}):`);
      console.log(`   📞 Total Calls: ${totalCalls}`);
      console.log(`   📞 Inbound: ${totalInbound}, Outbound: ${totalOutbound}, Callbacks: ${totalCallbacks}`);
      console.log(`   ❌ Abandoned: ${abandonedCalls}, ⏰ Exceeded Wait: ${exceededWaitTime}`);
      console.log(`   ⏱️  Avg Duration: ${avgDuration} min, Avg Wait: ${avgWaitTime} min`);
      console.log(`   📊 Data Source: ${dataSource}`);
      
      return {
        // Call volume metrics
        totalCalls: totalCalls,
        totalInboundCalls: totalInbound,
        totalOutboundCalls: totalOutbound,
        totalCallbackCalls: totalCallbacks,
        
        // Queue performance metrics
        abandonedInQueue: abandonedCalls,
        exceededQueueWaitTime: exceededWaitTime,
        maxCallsWaitingToday: maxCallsWaiting,
        
        // Timing metrics (in minutes except answer time in seconds)
        averageDuration: avgDuration,
        averageWaitTime: avgWaitTime,
        averageTimeToAnswer: avgAnswerTime,
        averageHoldTime: avgHoldTime,
        averageCallbackWaitTime: avgCallbackWaitTime,
        
        // Real-time queue data (if available)
        currentAverageWaitTime: currentQueueStats?.average_wait_time ? Math.round(currentQueueStats.average_wait_time / 60 * 100) / 100 : null,
        currentLongestWaitTime: currentQueueStats?.longest_wait_time ? Math.round(currentQueueStats.longest_wait_time / 60 * 100) / 100 : null,
        
        // Data quality indicators
        dataSource: agentActivityData && agentActivityData.length > 0 ? 'agent_activity_api' : 'voice_tickets_analysis',
        ticketsAnalyzed: tickets.length,
        agentsAnalyzed: agentActivityData ? agentActivityData.length : 0,
        hasCurrentQueueData: !!currentQueueStats,
        hasAgentActivityData: !!(agentActivityData && agentActivityData.length > 0)
      };
      
    } catch (error) {
      console.error('❌ Error fetching today\'s call metrics:', error.message);
      return {
        totalCalls: 0,
        totalInboundCalls: 0,
        totalOutboundCalls: 0,
        totalCallbackCalls: 0,
        abandonedInQueue: 0,
        exceededQueueWaitTime: 0,
        maxCallsWaitingToday: 0,
        averageDuration: 0,
        averageWaitTime: 0,
        averageTimeToAnswer: 0,
        averageHoldTime: 0,
        averageCallbackWaitTime: 0,
        error: `Failed to get call metrics: ${error.message}`
      };
    }
  }

  async getDetailedAgentStatus() {
    console.log('👥 Checking detailed agent status...');
    
    try {
      let voiceAgentsOnline = 0;
      let voiceApiAvailable = false;
      
      // Try to get real-time agent data from Voice API first
      try {
        const voiceStats = await this.zendesk.makeRequest('GET', '/channels/voice/stats/current_queue_activity.json');
        
        if (voiceStats && voiceStats.current_queue_activity && voiceStats.current_queue_activity.agents_online !== undefined) {
          voiceAgentsOnline = voiceStats.current_queue_activity.agents_online;
          voiceApiAvailable = true;
          console.log(`✅ Found ${voiceAgentsOnline} agents online via Voice API`);
        }
      } catch (voiceError) {
        console.log('Voice API not available for agents, using user data analysis...');
      }
      
      // Get all agents and admins (who can take calls)
      const [agentResponse, adminResponse] = await Promise.all([
        this.zendesk.getUsers({ role: 'agent', per_page: 100 }),
        this.zendesk.getUsers({ role: 'admin', per_page: 100 })
      ]);
      
      const allUsers = [...(agentResponse.users || []), ...(adminResponse.users || [])];
      const totalAgents = allUsers.length;
      
      // Analyze agent activity patterns
      const now = new Date();
      const recentThreshold = new Date(now.getTime() - (30 * 60 * 1000)); // 30 minutes ago
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      let recentlyActive = 0;
      let activeToday = 0;
      let neverLoggedIn = 0;
      
      // Get recent tickets to identify agents currently working
      const recentTickets = await this.zendesk.getTickets({
        per_page: 100,
        sort_by: 'updated_at',
        sort_order: 'desc'
      });
      
      const currentlyWorkingAgents = new Set();
      const todayActiveAgents = new Set();
      
      if (recentTickets.tickets) {
        recentTickets.tickets.forEach(ticket => {
          const updatedAt = new Date(ticket.updated_at);
          if (ticket.assignee_id) {
            if (updatedAt >= recentThreshold) {
              currentlyWorkingAgents.add(ticket.assignee_id);
            }
            if (updatedAt >= todayStart) {
              todayActiveAgents.add(ticket.assignee_id);
            }
          }
        });
      }
      
      // Analyze each agent's status
      allUsers.forEach(user => {
        if (user.last_login_at) {
          const lastLogin = new Date(user.last_login_at);
          if (lastLogin >= recentThreshold) {
            recentlyActive++;
          }
          if (lastLogin >= todayStart) {
            activeToday++;
          }
        } else {
          neverLoggedIn++;
        }
      });
      
      // Create intelligent status breakdown
      // Note: Since Zendesk doesn't provide real agent presence status,
      // we'll create estimates based on available data
      
      const estimatedOnline = voiceApiAvailable ? voiceAgentsOnline : Math.max(recentlyActive, currentlyWorkingAgents.size);
      const estimatedOnCall = Math.min(estimatedOnline, Math.floor(estimatedOnline * 0.3)); // Estimate 30% might be on calls
      const estimatedAvailable = estimatedOnline - estimatedOnCall;
      const estimatedAway = Math.max(0, activeToday - estimatedOnline); // Active today but not currently online
      const estimatedOffline = Math.max(0, totalAgents - activeToday - neverLoggedIn);
      
      console.log(`✅ Agent Status Analysis Complete:`);
      console.log(`   Total Agents: ${totalAgents}`);
      console.log(`   Estimated Online: ${estimatedOnline} (${voiceApiAvailable ? 'Voice API' : 'Activity-based'})`);
      console.log(`   Currently Working: ${currentlyWorkingAgents.size}`);
      
      return {
        totalAgents: totalAgents,
        agentsOnline: estimatedAvailable,
        agentsOnCall: estimatedOnCall,
        agentsAway: estimatedAway,
        agentsOffline: estimatedOffline,
        agentsTransfersOnly: 0, // Not available via API
        agentsOutboundCall: 0, // Not available via API
        
        // Additional metrics
        currentlyWorking: currentlyWorkingAgents.size,
        activeToday: activeToday,
        recentlyActive: recentlyActive,
        neverLoggedIn: neverLoggedIn,
        
        // Data source info
        dataSource: voiceApiAvailable ? 'voice_api_enhanced' : 'activity_analysis',
        voiceApiOnline: voiceApiAvailable ? voiceAgentsOnline : null,
        estimationNote: 'Some statuses estimated due to API limitations'
      };
      
    } catch (error) {
      console.error('Error fetching detailed agent status:', error.message);
      
      // Basic fallback
      return {
        totalAgents: 0,
        agentsOnline: 0,
        agentsOnCall: 0,
        agentsAway: 0,
        agentsOffline: 0,
        agentsTransfersOnly: 0,
        agentsOutboundCall: 0,
        error: `Failed to get agent status: ${error.message}`
      };
    }
  }

  calculateWaitTime(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const waitTimeMs = now - created;
    
    const minutes = Math.floor(waitTimeMs / (1000 * 60));
    const seconds = Math.floor((waitTimeMs % (1000 * 60)) / 1000);
    
    return {
      totalSeconds: Math.floor(waitTimeMs / 1000),
      formatted: `${minutes}:${seconds.toString().padStart(2, '0')}`
    };
  }

  async getLiveFeedData() {
    try {
      console.log('🔴 LIVE: Fetching real-time call center data...');
      
      const timestamp = new Date().toISOString();
      console.log(`📅 Live feed timestamp: ${new Date(timestamp).toLocaleString()}`);
      
      // Fetch all metrics simultaneously
      const [queueData, agentData, dailyMetrics] = await Promise.all([
        this.getCurrentCallQueue(),
        this.getDetailedAgentStatus(),
        this.getTodaysCallMetrics()
      ]);
      
      console.log(`📋 Found ${queueData.callsInQueue} calls currently in queue (${queueData.queueSource})`);
      console.log(`👥 Agent Status Summary:`);
      console.log(`   📊 Total Agents: ${agentData.totalAgents}`);
      console.log(`   🟢 Online: ${agentData.agentsOnline}`);
      console.log(`   📞 On Call: ${agentData.agentsOnCall}`);
      console.log(`   🟡 Away: ${agentData.agentsAway}`);
      console.log(`   🔴 Offline: ${agentData.agentsOffline}`);
      console.log(`📈 Today's Call Metrics:`);
      console.log(`   📞 Total Calls: ${dailyMetrics.totalCalls}`);
      console.log(`   📞 Inbound: ${dailyMetrics.totalInboundCalls}, Callbacks: ${dailyMetrics.totalCallbackCalls}`);
      console.log(`   ⏱️  Avg Duration: ${dailyMetrics.averageDuration}min, Avg Wait: ${dailyMetrics.averageWaitTime}min`);
      
      this.liveFeedData = {
        timestamp: timestamp,
        lastUpdated: new Date(timestamp).toLocaleString(),
        
        // Core metrics requested
        callsInQueue: queueData.callsInQueue,
        
        // Detailed agent status breakdown
        agents: {
          totalAgents: agentData.totalAgents,
          agentsOnline: agentData.agentsOnline,
          agentsOnCall: agentData.agentsOnCall,
          agentsAway: agentData.agentsAway,
          agentsOffline: agentData.agentsOffline,
          agentsTransfersOnly: agentData.agentsTransfersOnly,
          agentsOutboundCall: agentData.agentsOutboundCall,
          currentlyWorking: agentData.currentlyWorking,
          activeToday: agentData.activeToday
        },
        
        // Today's call metrics
        dailyMetrics: {
          totalCalls: dailyMetrics.totalCalls,
          totalInboundCalls: dailyMetrics.totalInboundCalls,
          totalOutboundCalls: dailyMetrics.totalOutboundCalls,
          totalCallbackCalls: dailyMetrics.totalCallbackCalls,
          abandonedInQueue: dailyMetrics.abandonedInQueue,
          exceededQueueWaitTime: dailyMetrics.exceededQueueWaitTime,
          maxCallsWaitingToday: dailyMetrics.maxCallsWaitingToday,
          averageDuration: dailyMetrics.averageDuration,
          averageWaitTime: dailyMetrics.averageWaitTime,
          averageTimeToAnswer: dailyMetrics.averageTimeToAnswer,
          averageHoldTime: dailyMetrics.averageHoldTime,
          averageCallbackWaitTime: dailyMetrics.averageCallbackWaitTime,
          currentAverageWaitTime: dailyMetrics.currentAverageWaitTime,
          currentLongestWaitTime: dailyMetrics.currentLongestWaitTime
        },
        
        // Additional context
        queueDetails: queueData,
        agentDetails: agentData,
        
        // Status
        status: 'live',
        dataFreshness: 'real-time'
      };
      
      console.log(`✅ Live feed data updated`);
      console.log(`📞 Calls in Queue: ${this.liveFeedData.callsInQueue}`);
      console.log(`👥 Total Agents: ${this.liveFeedData.agents.totalAgents}`);
      
      return this.liveFeedData;
      
    } catch (error) {
      console.error('❌ Error fetching live feed data:', error.message);
      
      this.liveFeedData = {
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toLocaleString(),
        callsInQueue: 0,
        agents: {
          totalAgents: 0,
          agentsOnline: 0,
          agentsOnCall: 0,
          agentsAway: 0,
          agentsOffline: 0,
          agentsTransfersOnly: 0,
          agentsOutboundCall: 0
        },
        dailyMetrics: {
          totalCalls: 0,
          totalInboundCalls: 0,
          totalOutboundCalls: 0,
          totalCallbackCalls: 0,
          abandonedInQueue: 0,
          exceededQueueWaitTime: 0,
          maxCallsWaitingToday: 0,
          averageDuration: 0,
          averageWaitTime: 0,
          averageTimeToAnswer: 0,
          averageHoldTime: 0,
          averageCallbackWaitTime: 0
        },
        status: 'error',
        error: error.message
      };
      
      throw error;
    }
  }

  printLiveFeed() {
    if (!this.liveFeedData || Object.keys(this.liveFeedData).length === 0) {
      console.log('⚠️ No live feed data available');
      return;
    }

    console.log('\n' + '='.repeat(50));
    console.log('🔴 LIVE CALL CENTER FEED');
    console.log('='.repeat(50));
    console.log(`🕐 Last Updated: ${this.liveFeedData.lastUpdated}`);
    console.log('');
    
    // Main metrics - large display
    console.log('📊 CURRENT STATUS:');
    console.log('');
    console.log(`   📞 CALLS IN QUEUE: ${this.liveFeedData.callsInQueue}`);
    console.log('');
    
    // Detailed agent status breakdown
    if (this.liveFeedData.agents) {
      console.log('👥 AGENT STATUS BREAKDOWN:');
      console.log('');
      console.log(`   📊 TOTAL AGENTS:      ${this.liveFeedData.agents.totalAgents}`);
      console.log(`   🟢 ONLINE:            ${this.liveFeedData.agents.agentsOnline}`);
      console.log(`   📞 ON CALL:           ${this.liveFeedData.agents.agentsOnCall}`);
      console.log(`   🟡 AWAY:              ${this.liveFeedData.agents.agentsAway}`);
      console.log(`   🔴 OFFLINE:           ${this.liveFeedData.agents.agentsOffline}`);
      console.log(`   📤 TRANSFERS ONLY:    ${this.liveFeedData.agents.agentsTransfersOnly}`);
      console.log(`   � OUTBOUND CALL:     ${this.liveFeedData.agents.agentsOutboundCall}`);
      console.log('');
      
      // Additional metrics
      if (this.liveFeedData.agents.currentlyWorking !== undefined) {
        console.log('📈 ACTIVITY METRICS:');
        console.log(`   🔄 Currently Working: ${this.liveFeedData.agents.currentlyWorking}`);
        console.log(`   📅 Active Today:      ${this.liveFeedData.agents.activeToday}`);
        console.log('');
      }
    }
    
    // Today's Call Metrics
    if (this.liveFeedData.dailyMetrics) {
      const daily = this.liveFeedData.dailyMetrics;
      console.log('📊 TODAY\'S CALL METRICS:');
      console.log('');
      console.log(`   📞 TOTAL CALLS:           ${daily.totalCalls}`);
      console.log(`   📞 TOTAL INBOUND:         ${daily.totalInboundCalls}`);
      console.log(`   📞 TOTAL OUTBOUND:        ${daily.totalOutboundCalls}`);
      console.log(`   📞 TOTAL CALLBACKS:       ${daily.totalCallbackCalls}`);
      console.log('');
      console.log(`   ❌ ABANDONED IN QUEUE:    ${daily.abandonedInQueue}`);
      console.log(`   ⏰ EXCEEDED WAIT TIME:    ${daily.exceededQueueWaitTime}`);
      console.log(`   📈 MAX CALLS WAITING:     ${daily.maxCallsWaitingToday}`);
      console.log('');
      console.log(`   ⏱️  AVG DURATION:          ${daily.averageDuration} min`);
      console.log(`   ⏱️  AVG WAIT TIME:         ${daily.averageWaitTime} min`);
      console.log(`   ⏱️  AVG TIME TO ANSWER:    ${daily.averageTimeToAnswer} sec`);
      console.log(`   ⏱️  AVG HOLD TIME:         ${daily.averageHoldTime} min`);
      console.log(`   ⏱️  AVG CALLBACK WAIT:     ${daily.averageCallbackWaitTime} min`);
      
      if (daily.currentAverageWaitTime !== null) {
        console.log('');
        console.log('🔴 REAL-TIME QUEUE METRICS:');
        console.log(`   ⏱️  Current Avg Wait:      ${daily.currentAverageWaitTime} min`);
        console.log(`   ⏱️  Current Longest Wait:  ${daily.currentLongestWaitTime} min`);
      }
      
      console.log('');
    } else {
      // Fallback for old format
      console.log(`   �👥 AGENTS ONLINE:  ${this.liveFeedData.onlineAgents || 0}`);
      console.log('');
    }
    
    // Queue details if available
    if (this.liveFeedData.queueDetails && this.liveFeedData.queueDetails.queuedTickets && this.liveFeedData.queueDetails.queuedTickets.length > 0) {
      console.log('📋 QUEUE DETAILS:');
      this.liveFeedData.queueDetails.queuedTickets.slice(0, 5).forEach((call, index) => {
        console.log(`   ${index + 1}. Ticket #${call.id} - Wait: ${call.waitTime.formatted}`);
      });
      
      if (this.liveFeedData.queueDetails.queuedTickets.length > 5) {
        console.log(`   ... and ${this.liveFeedData.queueDetails.queuedTickets.length - 5} more calls`);
      }
      console.log('');
    }
    
    // Agent summary
    if (this.liveFeedData.agents) {
      const agents = this.liveFeedData.agents;
      console.log('👥 AGENT STATUS SUMMARY:');
      console.log(`   🟢 Online:   ${agents.agentsOnline}`);
      console.log(`   📞 On Call:  ${agents.agentsOnCall}`);
      console.log(`   🟡 Away:     ${agents.agentsAway}`);
      console.log(`   🔴 Offline:  ${agents.agentsOffline}`);
      console.log(`   📊 Total:    ${agents.totalAgents}`);
    } else if (this.liveFeedData.agentDetails) {
      // Fallback for old format
      const agentData = this.liveFeedData.agentDetails;
      if (agentData.totalAgents && typeof agentData.totalAgents === 'number') {
        console.log('👥 AGENT STATUS:');
        console.log(`   Online:  ${agentData.onlineAgents}`);
        console.log(`   Offline: ${agentData.offlineAgents}`);
        console.log(`   Total:   ${agentData.totalAgents}`);
      }
    }
    
    console.log('='.repeat(50));
  }

  async exportLiveFeedToJSON(filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      filename = `live-feed-${timestamp}.json`;
    }

    const fs = require('fs');
    const path = require('path');
    
    const filePath = path.join(__dirname, '..', 'data', filename);
    
    try {
      // Create a comprehensive JSON for live feed with detailed agent status
      const cleanLiveFeed = {
        timestamp: this.liveFeedData.timestamp,
        lastUpdated: this.liveFeedData.lastUpdated,
        callsInQueue: this.liveFeedData.callsInQueue,
        
        // Detailed agent status breakdown
        agents: this.liveFeedData.agents || {
          totalAgents: this.liveFeedData.onlineAgents || 0,
          agentsOnline: this.liveFeedData.onlineAgents || 0,
          agentsOnCall: 0,
          agentsAway: 0,
          agentsOffline: 0,
          agentsTransfersOnly: 0,
          agentsOutboundCall: 0
        },
        
        // Today's comprehensive call metrics
        dailyMetrics: this.liveFeedData.dailyMetrics || {
          totalCalls: 0,
          totalInboundCalls: 0,
          totalOutboundCalls: 0,
          totalCallbackCalls: 0,
          abandonedInQueue: 0,
          exceededQueueWaitTime: 0,
          maxCallsWaitingToday: 0,
          averageDuration: 0,
          averageWaitTime: 0,
          averageTimeToAnswer: 0,
          averageHoldTime: 0,
          averageCallbackWaitTime: 0
        },
        
        status: this.liveFeedData.status
      };
      
      fs.writeFileSync(filePath, JSON.stringify(cleanLiveFeed, null, 2));
      console.log(`✅ Live feed data exported to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('❌ Error exporting live feed data:', error.message);
      throw error;
    }
  }

  // Method for continuous monitoring
  async startLiveFeed(intervalSeconds = 30) {
    console.log(`🔴 Starting live feed monitoring (updates every ${intervalSeconds} seconds)`);
    console.log('Press Ctrl+C to stop monitoring');
    
    const updateFeed = async () => {
      try {
        await this.getLiveFeedData();
        console.clear(); // Clear console for fresh display
        this.printLiveFeed();
        
        // Export updated data
        await this.exportLiveFeedToJSON('live-feed-current.json');
        
      } catch (error) {
        console.error('❌ Error updating live feed:', error.message);
      }
    };
    
    // Initial update
    await updateFeed();
    
    // Set up interval updates
    const interval = setInterval(updateFeed, intervalSeconds * 1000);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping live feed monitoring...');
      clearInterval(interval);
      process.exit(0);
    });
  }
}

module.exports = LiveFeedAnalyzer;