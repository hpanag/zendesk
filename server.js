require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateChatReply } = require('./src/services/gptResponder');
const CallAnalyticsService = require('./src/services/CallAnalyticsService');
const TicketAnalyticsService = require('./src/services/TicketAnalyticsService');
const VoiceAnalyticsService = require('./src/services/VoiceAnalyticsService');

const PORT = 3000;
const callAnalytics = new CallAnalyticsService();
const ticketAnalytics = new TicketAnalyticsService();
const voiceAnalytics = new VoiceAnalyticsService();

// MIME types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

async function handleChatRequest(req, res) {
  console.log(`📝 Handling chat request: ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
    if (body.length > 1e6) {
      console.log('❌ Request too large');
      req.socket.destroy();
    }
  });

  req.on('end', async () => {
    try {
      console.log('📄 Request body received, length:', body.length);
      const payload = body ? JSON.parse(body) : {};
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      
      console.log('🤖 Generating chat reply...');
      const result = await generateChatReply(messages);
      
      console.log('✅ Chat reply generated, source:', result.source);
      sendJson(res, 200, {
        reply: result.reply,
        source: result.source
      });
    } catch (error) {
      console.error('❌ Error handling GPT-5 chat request:', error);
      sendJson(res, 500, {
        error: 'Failed to process GPT-5 request',
        details: error.message
      });
    }
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error);
    sendJson(res, 400, { error: 'Bad request' });
  });
}

// Handle today's calls request using incremental API
async function handleTodaysCallsRequest(req, res) {
  try {
    console.log('📊 Fetching today\'s calls from incremental API...');
    
    const ZendeskClient = require('./src/ZendeskClient');
    const zendesk = new ZendeskClient();
    
    // Get today's start time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startTime = Math.floor(today.getTime() / 1000);
    
    // Fetch calls from incremental API
    const response = await zendesk.makeRequest('GET', 
      `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`
    );
    
    const allCalls = response.calls || [];
    
    // Filter to only today's calls
    const todaysCalls = allCalls.filter(call => {
      const callTime = new Date(call.created_at);
      return callTime >= today;
    });
    
    console.log(`✅ Retrieved ${todaysCalls.length} calls for today`);
    
    // Categorize calls with detailed breakdown
    const hourlyData = new Array(24).fill(0).map((_, hour) => ({
      hour: hour,
      hour_display: formatHour(hour),
      total: 0,
      agent_answered: 0,
      abandoned_ivr: 0,
      abandoned_queue: 0,
      abandoned_voicemail: 0,
      voicemails_left: 0
    }));
    
    let answeredByAgent = 0;
    let abandonedIVR = 0;
    let abandonedQueue = 0;
    let abandonedVoicemail = 0;
    let voicemailsLeft = 0;
    
    todaysCalls.forEach(call => {
      const callTime = new Date(call.created_at);
      const hour = callTime.getHours();
      
      hourlyData[hour].total++;
      
      // TRUE answered by agent: has agent_id AND talk_time > 0
      if (call.agent_id && call.talk_time > 0) {
        hourlyData[hour].agent_answered++;
        answeredByAgent++;
      }
      // Abandoned in IVR
      else if (call.completion_status === 'abandoned_in_ivr') {
        hourlyData[hour].abandoned_ivr++;
        abandonedIVR++;
      }
      // Abandoned in Queue
      else if (call.completion_status === 'abandoned_in_queue') {
        hourlyData[hour].abandoned_queue++;
        abandonedQueue++;
      }
      // Abandoned in Voicemail
      else if (call.completion_status === 'abandoned_in_voicemail') {
        hourlyData[hour].abandoned_voicemail++;
        abandonedVoicemail++;
      }
      
      // Check if voicemail was left (has recording)
      if (call.recording_url || call.voicemail) {
        hourlyData[hour].voicemails_left++;
        voicemailsLeft++;
      }
    });
    
    const result = {
      success: true,
      date: today.toISOString().split('T')[0],
      total_calls: todaysCalls.length,
      answered_by_agent: answeredByAgent,
      abandoned_ivr: abandonedIVR,
      abandoned_queue: abandonedQueue,
      abandoned_voicemail: abandonedVoicemail,
      voicemails_left: voicemailsLeft,
      total_abandoned: abandonedIVR + abandonedQueue + abandonedVoicemail,
      hourly_data: hourlyData,
      last_updated: new Date().toISOString()
    };
    
    console.log('📊 Response summary:');
    console.log(`  Total: ${result.total_calls}`);
    console.log(`  Answered: ${result.answered_by_agent}`);
    console.log(`  Abandoned IVR: ${result.abandoned_ivr}`);
    console.log(`  Abandoned Queue: ${result.abandoned_queue}`);
    console.log(`  Abandoned VM: ${result.abandoned_voicemail}`);
    console.log(`  Total Abandoned: ${result.total_abandoned}`);
    
    sendJson(res, 200, result);
    console.log('✅ Today\'s calls response sent');
    
  } catch (error) {
    console.error('❌ Error getting today\'s calls:', error);
    sendJson(res, 500, {
      success: false,
      error: 'Failed to get today\'s calls',
      details: error.message
    });
  }
}

function formatHour(hour) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
  return `${displayHour}:00 ${period}`;
}

async function handleTodaysTicketsRequest(req, res) {
  try {
    console.log('🎫 Fetching today\'s tickets...');
    
    const ZendeskClient = require('./src/ZendeskClient');
    const zendesk = new ZendeskClient();
    
    // Get today's start time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Fetch tickets created today
    const response = await zendesk.makeRequest('GET', 
      `/incremental/tickets.json?start_time=${Math.floor(today.getTime() / 1000)}`
    );
    
    const allTickets = response.tickets || [];
    
    // Filter to only today's tickets
    const todaysTickets = allTickets.filter(ticket => {
      const createdTime = new Date(ticket.created_at);
      return createdTime >= today;
    });
    
    console.log(`✅ Retrieved ${todaysTickets.length} tickets for today`);
    
    // Categorize tickets by status, priority, and channel
    const statusCounts = {};
    const priorityCounts = {};
    const channelCounts = {};
    const hourlyData = new Array(24).fill(0).map((_, hour) => ({
      hour: hour,
      hour_display: formatHour(hour),
      total: 0,
      new: 0,
      open: 0,
      pending: 0,
      solved: 0,
      closed: 0
    }));
    
    todaysTickets.forEach(ticket => {
      const createdTime = new Date(ticket.created_at);
      const hour = createdTime.getHours();
      
      // Count by status
      const status = ticket.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      hourlyData[hour][status] = (hourlyData[hour][status] || 0) + 1;
      hourlyData[hour].total++;
      
      // Count by priority
      const priority = ticket.priority || 'normal';
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
      
      // Count by channel
      const channel = ticket.via?.channel || 'unknown';
      channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    });
    
    const result = {
      success: true,
      date: today.toISOString().split('T')[0],
      total_tickets: todaysTickets.length,
      status_counts: statusCounts,
      priority_counts: priorityCounts,
      channel_counts: channelCounts,
      hourly_data: hourlyData,
      last_updated: new Date().toISOString()
    };
    
    console.log('📊 Tickets summary:');
    console.log(`  Total: ${result.total_tickets}`);
    console.log(`  Status:`, statusCounts);
    console.log(`  Priority:`, priorityCounts);
    console.log(`  Channel:`, channelCounts);
    
    sendJson(res, 200, result);
    console.log('✅ Today\'s tickets response sent');
    
  } catch (error) {
    console.error('❌ Error getting today\'s tickets:', error);
    sendJson(res, 500, {
      success: false,
      error: 'Failed to get today\'s tickets',
      details: error.message
    });
  }
}

async function handleTodaysAgentsRequest(req, res) {
  try {
    console.log('👥 Today\'s agents request');
    console.log('📊 Fetching today\'s agent performance data...');
    
    const ZendeskClient = require('./src/ZendeskClient');
    const zendesk = new ZendeskClient();
    
    // Get today's start time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startTime = Math.floor(today.getTime() / 1000);
    
    // Fetch today's tickets and calls in parallel
    const [ticketsResponse, callsResponse, usersResponse] = await Promise.all([
      zendesk.makeRequest('GET', `/incremental/tickets.json?start_time=${startTime}`),
      zendesk.makeRequest('GET', `/channels/voice/stats/incremental/calls.json?start_time=${startTime}`),
      zendesk.makeRequest('GET', '/users.json')
    ]);
    
    const allTickets = ticketsResponse.tickets || [];
    const allCalls = callsResponse.calls || [];
    const allUsers = usersResponse.users || [];
    
    // Filter to only today's data
    const todaysTickets = allTickets.filter(ticket => {
      const createdTime = new Date(ticket.created_at);
      return createdTime >= today;
    });
    
    const todaysCalls = allCalls.filter(call => {
      const createdTime = new Date(call.created_at);
      return createdTime >= today;
    });
    
    console.log(`✅ Retrieved ${todaysTickets.length} tickets and ${todaysCalls.length} calls for today`);
    
    // Create agent performance map
    const agentPerformance = {};
    
    // Process tickets - track assignee and solver
    todaysTickets.forEach(ticket => {
      const assigneeId = ticket.assignee_id;
      const updaterId = ticket.updated_by_id;
      
      if (assigneeId) {
        if (!agentPerformance[assigneeId]) {
          agentPerformance[assigneeId] = {
            id: assigneeId,
            tickets_assigned: 0,
            tickets_solved: 0,
            tickets_updated: 0,
            calls_answered: 0,
            calls_total: 0,
            total_talk_time: 0,
            avg_talk_time: 0
          };
        }
        agentPerformance[assigneeId].tickets_assigned++;
        
        if (ticket.status === 'solved' || ticket.status === 'closed') {
          agentPerformance[assigneeId].tickets_solved++;
        }
      }
      
      if (updaterId && updaterId !== assigneeId) {
        if (!agentPerformance[updaterId]) {
          agentPerformance[updaterId] = {
            id: updaterId,
            tickets_assigned: 0,
            tickets_solved: 0,
            tickets_updated: 0,
            calls_answered: 0,
            calls_total: 0,
            total_talk_time: 0,
            avg_talk_time: 0
          };
        }
        agentPerformance[updaterId].tickets_updated++;
      }
    });
    
    // Process calls
    todaysCalls.forEach(call => {
      const agentId = call.agent_id;
      
      if (agentId) {
        if (!agentPerformance[agentId]) {
          agentPerformance[agentId] = {
            id: agentId,
            tickets_assigned: 0,
            tickets_solved: 0,
            tickets_updated: 0,
            calls_answered: 0,
            calls_total: 0,
            total_talk_time: 0,
            avg_talk_time: 0
          };
        }
        
        agentPerformance[agentId].calls_total++;
        
        if (call.talk_time && call.talk_time > 0) {
          agentPerformance[agentId].calls_answered++;
          agentPerformance[agentId].total_talk_time += call.talk_time;
        }
      }
    });
    
    // Calculate averages and add user info
    const userMap = {};
    allUsers.forEach(user => {
      userMap[user.id] = user;
    });
    
    const agents = Object.values(agentPerformance).map(agent => {
      const user = userMap[agent.id];
      agent.name = user ? user.name : `Agent ${agent.id}`;
      agent.email = user ? user.email : '';
      
      if (agent.calls_answered > 0) {
        agent.avg_talk_time = Math.round(agent.total_talk_time / agent.calls_answered);
      }
      
      return agent;
    });
    
    // Filter to only agents with activity today
    const activeAgents = agents.filter(agent => 
      agent.tickets_assigned > 0 || 
      agent.tickets_solved > 0 || 
      agent.tickets_updated > 0 || 
      agent.calls_total > 0
    );
    
    // Sort by total activity (tickets + calls)
    activeAgents.sort((a, b) => {
      const aTotal = a.tickets_assigned + a.tickets_solved + a.calls_answered;
      const bTotal = b.tickets_assigned + b.tickets_solved + b.calls_answered;
      return bTotal - aTotal;
    });
    
    console.log(`📊 Agent performance summary:`);
    console.log(`  Active agents: ${activeAgents.length}`);
    console.log(`  Total tickets handled: ${activeAgents.reduce((sum, a) => sum + a.tickets_assigned, 0)}`);
    console.log(`  Total calls answered: ${activeAgents.reduce((sum, a) => sum + a.calls_answered, 0)}`);
    
    const response = {
      success: true,
      date: new Date().toISOString().split('T')[0],
      total_active_agents: activeAgents.length,
      total_tickets_handled: activeAgents.reduce((sum, a) => sum + a.tickets_assigned, 0),
      total_tickets_solved: activeAgents.reduce((sum, a) => sum + a.tickets_solved, 0),
      total_calls_answered: activeAgents.reduce((sum, a) => sum + a.calls_answered, 0),
      total_talk_time: activeAgents.reduce((sum, a) => sum + a.total_talk_time, 0),
      agents: activeAgents
    };
    
    sendJson(res, 200, response);
    console.log('✅ Today\'s agents response sent');
    
  } catch (error) {
    console.error('❌ Error getting today\'s agents:', error);
    sendJson(res, 500, {
      success: false,
      error: 'Failed to fetch agent data',
      message: error.message
    });
  }
}

async function handleCallAnalyticsRequest(req, res, period = '5-day') {
  try {
    console.log(`📊 Fetching ${period} call analytics...`);
    
    // Check for forceRefresh query parameter
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';
    
    if (forceRefresh) {
      console.log('🔄 Force refresh requested - fetching all call data from API');
    }
    
    let analytics;
    if (period === '30-day') {
      analytics = await callAnalytics.get30DayCallAnalytics(null, forceRefresh);
    } else {
      analytics = await callAnalytics.get5DayCallAnalytics(forceRefresh);
    }
    
    console.log('📈 Analytics data received, preparing response...');
    console.log('📋 Analytics success:', analytics?.success);
    console.log('📋 Analytics data keys:', analytics?.data ? Object.keys(analytics.data) : 'No data');
    console.log('📋 Cache info:', analytics?.data?.cache_info ? `${analytics.data.cache_info.fresh_entries} fresh, ${analytics.data.cache_info.expired_entries} expired` : 'No cache info');
    
    console.log('📤 Sending JSON response...');
    sendJson(res, 200, analytics);
    console.log('✅ Response sent successfully');
  } catch (error) {
    console.error(`❌ Error fetching ${period} call analytics:`, error);
    sendJson(res, 500, {
      success: false,
      error: `Failed to fetch ${period} call analytics`,
      details: error.message
    });
  }
}

// Handle real-time call analytics requests
async function handleRealTimeCallAnalyticsRequest(req, res) {
  try {
    console.log('🔴 Fetching real-time call analytics...');
    const analytics = await callAnalytics.getRealTimeCallAnalytics();
    sendJson(res, 200, analytics);
  } catch (error) {
    console.error('❌ Error fetching real-time analytics:', error);
    sendJson(res, 500, {
      success: false,
      error: 'Failed to fetch real-time analytics',
      details: error.message
    });
  }
}

// Handle ticket analytics requests
async function handleTicketAnalyticsRequest(req, res, period = '5-day') {
  try {
    console.log(`🎫 Fetching ${period} ticket analytics...`);
    
    // Check for forceRefresh query parameter
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';
    
    if (forceRefresh) {
      console.log('🔄 Force refresh requested - fetching all data from API');
    }
    
    let analytics;
    if (period === '5-day') {
      analytics = await ticketAnalytics.get5DayTicketAnalytics(forceRefresh);
    } else {
      // For future expansion
      analytics = await ticketAnalytics.get5DayTicketAnalytics(forceRefresh);
    }
    
    console.log('📈 Ticket analytics data received, preparing response...');
    console.log('📋 Analytics success:', analytics?.success);
    console.log('📋 Analytics data keys:', analytics?.data ? Object.keys(analytics.data) : 'No data');
    console.log('📋 Cache info:', analytics?.data?.cache_info ? `${analytics.data.cache_info.fresh_entries} fresh, ${analytics.data.cache_info.expired_entries} expired` : 'No cache info');
    
    console.log('📤 Sending JSON response...');
    sendJson(res, 200, analytics);
    console.log('✅ Response sent successfully');
  } catch (error) {
    console.error(`❌ Error fetching ${period} ticket analytics:`, error);
    sendJson(res, 500, {
      success: false,
      error: `Failed to fetch ${period} ticket analytics`,
      details: error.message
    });
  }
}

// Handle current ticket counts request
async function handleCurrentTicketCountsRequest(req, res) {
  try {
    console.log('🎫 Fetching current ticket counts...');
    const counts = await ticketAnalytics.getCurrentTicketCounts();
    sendJson(res, 200, counts);
  } catch (error) {
    console.error('❌ Error fetching current ticket counts:', error);
    sendJson(res, 500, {
      success: false,
      error: 'Failed to fetch current ticket counts',
      details: error.message
    });
  }
}

// Handle clear cache request
async function handleClearCacheRequest(req, res) {
  try {
    console.log('🗑️ Clearing ticket analytics cache...');
    const result = await ticketAnalytics.clearCache();
    
    console.log('📈 Cache clear result:', result?.success);
    
    sendJson(res, 200, result);
    console.log('✅ Cache clear response sent');
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    sendJson(res, 500, {
      success: false,
      error: 'Failed to clear cache',
      details: error.message
    });
  }
}

async function handleVoiceAnalyticsRequest(req, res) {
  try {
    // Parse query parameters
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';
    const selectedDate = url.searchParams.get('date'); // YYYY-MM-DD format
    
    if (selectedDate) {
      console.log('📞 Fetching voice analytics for selected date:', selectedDate);
    } else {
      console.log('📞 Fetching voice analytics for last Monday...');
    }
    
    if (forceRefresh) {
      console.log('🔄 Force refresh requested for voice analytics');
    }
    
    const result = await voiceAnalytics.getVoiceAnalyticsForDate(selectedDate);
    
    console.log('📊 Voice analytics result:', result?.success, 
      result?.data ? `Total calls: ${result.data.summary?.total_calls}` : 'No data');
    
    sendJson(res, 200, result);
    console.log('✅ Voice analytics response sent');
  } catch (error) {
    console.error('❌ Error getting voice analytics:', error);
    sendJson(res, 500, {
      success: false,
      error: 'Failed to get voice analytics',
      details: error.message
    });
  }
}

// Handle comprehensive voice analytics request with diagnostic info
async function handleComprehensiveVoiceAnalyticsRequest(req, res) {
  try {
    // Parse query parameters
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const selectedDate = url.searchParams.get('date'); // YYYY-MM-DD format
    
    if (selectedDate) {
      console.log('📊 Getting comprehensive voice analytics for selected date:', selectedDate);
    } else {
      console.log('📊 Getting comprehensive voice analytics for last Monday...');
    }
    
    const service = new VoiceAnalyticsService();
    
    const result = await service.getComprehensiveVoiceAnalytics(selectedDate);
    
    console.log('📊 Comprehensive voice analytics result:', 
      result?.data ? `Primary: ${result.data.primary_data?.summary?.total_calls} calls, Online target: ${result.data.diagnostic_info?.online_dashboard_target}` : 'No data');
    
    sendJson(res, 200, result);
    console.log('✅ Comprehensive voice analytics response sent');
  } catch (error) {
    console.error('❌ Error getting comprehensive voice analytics:', error);
    sendJson(res, 500, {
      success: false,
      error: 'Failed to get comprehensive voice analytics',
      details: error.message
    });
  }
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  console.log('🔍 Debug - Full URL:', req.url);
  console.log('🔍 Debug - Starts with /api/gpt5-chat:', req.url.startsWith('/api/gpt5-chat'));

  // Health check endpoint
  if (req.url === '/health' || req.url === '/api/health') {
    console.log('❤️ Health check request');
    sendJson(res, 200, { 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mode: 'real-time'
    });
    return;
  }

  // Today's calls endpoint - using incremental API
  if (req.url === '/api/calls/today') {
    console.log('📞 Today\'s calls request');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleTodaysCallsRequest(req, res);
      return;
    }
  }

  // Today's tickets endpoint
  if (req.url === '/api/tickets/today') {
    console.log('🎫 Today\'s tickets request');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleTodaysTicketsRequest(req, res);
      return;
    }
  }

  // Today's agents endpoint
  if (req.url === '/api/agents/today') {
    console.log('👥 Today\'s agents request');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleTodaysAgentsRequest(req, res);
      return;
    }
  }

  // Call Analytics endpoints - handle with query parameters
  if (req.url.startsWith('/api/call-analytics/5-day') || req.url === '/api/call-analytics') {
    console.log('📞 Call analytics request (5-day)');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleCallAnalyticsRequest(req, res, '5-day');
      return;
    }
  }

  // 30-day Call Analytics endpoint - handle with query parameters
  if (req.url.startsWith('/api/call-analytics/30-day')) {
    console.log('📞 Call analytics request (30-day)');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleCallAnalyticsRequest(req, res, '30-day');
      return;
    }
  }

  // Real-time call analytics endpoint
  if (req.url === '/api/call-analytics/realtime') {
    console.log('🔴 Real-time call analytics request');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization', 
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleRealTimeCallAnalyticsRequest(req, res);
      return;
    }
  }

  // Ticket Analytics endpoints - handle with query parameters
  if (req.url.startsWith('/api/ticket-analytics/5-day') || req.url === '/api/ticket-analytics') {
    console.log('🎫 Ticket analytics request (5-day)');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleTicketAnalyticsRequest(req, res, '5-day');
      return;
    }
  }

  // Current ticket counts endpoint
  if (req.url === '/api/ticket-analytics/current') {
    console.log('🎫 Current ticket counts request');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleCurrentTicketCountsRequest(req, res);
      return;
    }
  }

  // Clear cache endpoint
  if (req.url === '/api/ticket-analytics/clear-cache') {
    console.log('🗑️ Clear cache request');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'POST') {
      handleClearCacheRequest(req, res);
      return;
    }
  }

  // Voice Analytics endpoints
  if (req.url.startsWith('/api/voice-analytics') && !req.url.startsWith('/api/voice-analytics/comprehensive') && !req.url.startsWith('/api/voice-analytics/last-monday')) {
    console.log('📞 Voice analytics request (with date support)');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleVoiceAnalyticsRequest(req, res);
      return;
    }
  }

  if (req.url.startsWith('/api/voice-analytics/comprehensive')) {
    console.log('📞 Comprehensive voice analytics request');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleComprehensiveVoiceAnalyticsRequest(req, res);
      return;
    }
  }

  if (req.url.startsWith('/api/voice-analytics/last-monday')) {
    console.log('📞 Voice analytics request (Last Monday)');
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      });
      res.end();
      return;
    }
    
    if (req.method === 'GET') {
      handleVoiceAnalyticsRequest(req, res);
      return;
    }
  }

  if (req.url.startsWith('/api/gpt5-chat')) {
    console.log('🎯 Routing to chat handler');
    handleChatRequest(req, res);
    return;
  }

  // Default to index.html if requesting root
  let filePath = req.url === '/' ? '/web/index.html' : req.url;
  
  // Remove query string if present
  filePath = filePath.split('?')[0];
  
  // Build full file path
  const fullPath = path.join(__dirname, filePath);
  
  // Get file extension
  const ext = path.extname(fullPath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  // Check if file exists
  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (err) {
      console.log(`  404 Not Found: ${fullPath}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // Read and serve the file
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        console.log(`  500 Error reading file: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }

      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*' // Allow CORS
      });
      res.end(data);
      console.log(`  ✓ 200 OK (${contentType})`);
    });
  });
});

server.listen(PORT, () => {
  console.log('🌐 Zendesk Dashboard Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running at http://localhost:${PORT}/`);
  console.log('');
  console.log('📊 Available dashboards:');
  console.log(`   • Executive Dashboard: http://localhost:${PORT}/web/dash.html`);
  console.log(`   • Tickets Dashboard:   http://localhost:${PORT}/web/tickets.html`);
  console.log(`   • Voice Analytics:     http://localhost:${PORT}/web/voice.html`);
  console.log('');
  console.log('📂 Data file:');
  console.log(`   • API Data: http://localhost:${PORT}/data/execView.json`);
  console.log('');
  console.log('💡 Press Ctrl+C to stop the server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit, just log the error
});

// Start the server
// ...existing code...
