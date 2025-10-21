const { requestChatCompletion } = require('./gptClient');
const { buildFallbackAnswer } = require('./dataSummaries');
const OnDemandZendeskService = require('./OnDemandZendeskService');

const REALTIME_SYSTEM_PROMPT = `You are Zendesk GPT-5 Copilot, a specialized support analytics assistant with access to real-time Zendesk data. You analyze live data fetched on-demand from Zendesk APIs based on the user's specific question.

Your data access includes:
- Real-time ticket data (current status, volume, assignments, activity)
- Live user and organization information
- Current satisfaction ratings and customer feedback
- Active business rules (triggers, automations, macros)
- System configuration and tags

IMPORTANT: The data provided is fetched live from Zendesk APIs specifically for the user's question. Always reference that this is current, real-time data and provide specific insights based on the actual numbers and metrics shown.

Always provide actionable insights and be specific about the timeframe of the data (current/live data).`;

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((entry) => entry && typeof entry === 'object' && typeof entry.role === 'string' && typeof entry.content === 'string')
    .map((entry) => ({
      role: entry.role,
      content: entry.content
    }));
}

function enforceSystemPrompt(messages) {
  const sanitized = sanitizeMessages(messages);
  const hasSystem = sanitized.some((msg) => msg.role === 'system');

  if (hasSystem) {
    const [firstSystem] = sanitized.filter((msg) => msg.role === 'system');
    return [firstSystem, ...sanitized.filter((msg) => msg.role !== 'system').slice(-8)];
  }

  return [
    { role: 'system', content: REALTIME_SYSTEM_PROMPT },
    ...sanitized.slice(-8)
  ];
}

function extractLatestUserQuestion(messages) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      return messages[i].content;
    }
  }
  return '';
}

async function getRealtimeZendeskData(userQuestion) {
  try {
    console.log('🎯 Fetching real-time Zendesk data for question:', userQuestion.substring(0, 50) + '...');
    
    const onDemandService = new OnDemandZendeskService();
    const realtimeData = await onDemandService.getRelevantData(userQuestion);
    
    if (!realtimeData) {
      console.log('❌ No real-time data available');
      return null;
    }

    console.log('✅ Real-time data fetched successfully');
    console.log('📊 Data summary length:', realtimeData.length, 'characters');
    
    return realtimeData;
  } catch (error) {
    console.error('❌ Error fetching real-time data:', error.message);
    return null;
  }
}

async function generateChatReply(messages) {
  const preparedMessages = enforceSystemPrompt(messages);
  const userQuestion = extractLatestUserQuestion(preparedMessages);

  // Get real-time Zendesk data only when needed
  let contextData = null;
  if (process.env.OPENAI_API_KEY) {
    try {
      contextData = await getRealtimeZendeskData(userQuestion);
    } catch (error) {
      console.log('Could not fetch real-time data:', error.message);
    }
  }

  // Add context data if available
  if (contextData) {
    const dataContextMessage = {
      role: 'system',
      content: `Real-time Zendesk data (fetched live on ${new Date().toISOString()}):\n\n${contextData}\n\nUse this live data to provide specific, current insights about Zendesk operations.`
    };
    preparedMessages.splice(1, 0, dataContextMessage);
  }

  // Try GPT-5 first
  if (process.env.OPENAI_API_KEY) {
    try {
      const liveReply = await requestChatCompletion(preparedMessages);
      if (liveReply) {
        return { 
          reply: liveReply, 
          source: contextData ? 'gpt5-realtime' : 'gpt5-basic',
          dataSource: contextData ? 'live-api' : 'none'
        };
      }
    } catch (error) {
      console.log('GPT-5 request failed:', error.message);
    }
  }

  // Fallback to cached data
  return {
    reply: buildFallbackAnswer(userQuestion),
    source: 'fallback',
    dataSource: 'static'
  };
}

module.exports = {
  generateChatReply
};