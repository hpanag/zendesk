const { requestChatCompletion } = require('./gptClient');
const { buildFallbackAnswer, getLiveTicketData } = require('./dataSummaries');
const ZendeskReportingService = require('./ZendeskReportingService');

const OPTIMIZED_SYSTEM_PROMPT = `You are Zendesk GPT-5 Copilot, a specialized support analytics assistant with access to live Zendesk data. You help analyze tickets, users, organizations, satisfaction ratings, and operational insights.

Your data access includes:
- Live ticket data (status, volume, assignments, recent activity)
- User and organization information
- Agent performance and activity
- Customer satisfaction ratings
- Business rules (triggers, automations, macros, views)
- System configuration (ticket fields, user fields, tags)

Always provide specific, actionable insights based on the actual data available. If historical data for specific days isn't available, explain this clearly and offer alternatives.

Keep responses concise and focused on the most important metrics and trends.`;

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
    { role: 'system', content: OPTIMIZED_SYSTEM_PROMPT },
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

async function getOptimizedZendeskData(userQuestion) {
  try {
    const service = new ZendeskReportingService();
    const lowerQuestion = userQuestion.toLowerCase();
    const contextData = [];

    // Always get basic ticket data - this is reliable
    try {
      const liveTicketData = await getLiveTicketData();
      if (liveTicketData) {
        contextData.push(`Current Ticket Data:\n${liveTicketData}`);
      }
    } catch (error) {
      console.log('Could not fetch live ticket data:', error.message);
    }

    // Get specific data based on question keywords, but keep it focused
    const dataPromises = [];

    if (lowerQuestion.includes('user') || lowerQuestion.includes('agent') || lowerQuestion.includes('organization')) {
      dataPromises.push(service.getUsers().then(data => ({ type: 'Users', data })).catch(() => null));
      dataPromises.push(service.getOrganizations().then(data => ({ type: 'Organizations', data })).catch(() => null));
    }

    if (lowerQuestion.includes('satisfaction') || lowerQuestion.includes('rating') || lowerQuestion.includes('csat')) {
      dataPromises.push(service.getSatisfactionRatings().then(data => ({ type: 'Satisfaction', data })).catch(() => null));
    }

    if (lowerQuestion.includes('trigger') || lowerQuestion.includes('automation') || lowerQuestion.includes('macro') || lowerQuestion.includes('workflow')) {
      dataPromises.push(service.getTriggers().then(data => ({ type: 'Triggers', data })).catch(() => null));
      dataPromises.push(service.getAutomations().then(data => ({ type: 'Automations', data })).catch(() => null));
      dataPromises.push(service.getMacros().then(data => ({ type: 'Macros', data })).catch(() => null));
    }

    if (lowerQuestion.includes('tag') || lowerQuestion.includes('field') || lowerQuestion.includes('config')) {
      dataPromises.push(service.getTags().then(data => ({ type: 'Tags', data })).catch(() => null));
      dataPromises.push(service.getTicketFields().then(data => ({ type: 'Ticket Fields', data })).catch(() => null));
    }

    // Execute all promises and format results
    const results = await Promise.allSettled(dataPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value && result.value.data) {
        const { type, data } = result.value;
        let summary = '';
        
        switch (type) {
          case 'Users':
            const users = data.users || [];
            const agents = users.filter(u => u.role === 'agent');
            const endUsers = users.filter(u => u.role === 'end-user');
            summary = `Users Summary:
- Total users: ${users.length}
- Agents: ${agents.length}
- End users: ${endUsers.length}
- Active users: ${users.filter(u => u.active).length}`;
            break;
            
          case 'Organizations':
            const orgs = data.organizations || [];
            summary = `Organizations Summary:
- Total organizations: ${orgs.length}
- Organizations with domains: ${orgs.filter(o => o.domain_names && o.domain_names.length > 0).length}`;
            break;
            
          case 'Satisfaction':
            const ratings = data.satisfaction_ratings || [];
            const good = ratings.filter(r => r.score === 'good').length;
            const bad = ratings.filter(r => r.score === 'bad').length;
            summary = `Customer Satisfaction:
- Total ratings: ${ratings.length}
- Good ratings: ${good}
- Bad ratings: ${bad}
- Satisfaction rate: ${ratings.length > 0 ? ((good / ratings.length) * 100).toFixed(1) : 0}%`;
            break;
            
          case 'Triggers':
            const triggers = data.triggers || [];
            summary = `Triggers: ${triggers.length} total, ${triggers.filter(t => t.active).length} active`;
            break;
            
          case 'Automations':
            const automations = data.automations || [];
            summary = `Automations: ${automations.length} total, ${automations.filter(a => a.active).length} active`;
            break;
            
          case 'Macros':
            const macros = data.macros || [];
            summary = `Macros: ${macros.length} total, ${macros.filter(m => m.active).length} active`;
            break;
            
          case 'Tags':
            const tags = data.tags || [];
            summary = `Tags: ${tags.length} total tags available`;
            break;
            
          case 'Ticket Fields':
            const fields = data.ticket_fields || [];
            summary = `Ticket Fields: ${fields.length} total, ${fields.filter(f => f.active).length} active`;
            break;
            
          default:
            summary = `${type}: Data available`;
        }
        
        if (summary) {
          contextData.push(summary);
        }
      }
    }

    return contextData.join('\n\n');
  } catch (error) {
    console.error('Error gathering optimized data:', error.message);
    return null;
  }
}

async function generateChatReply(messages) {
  const preparedMessages = enforceSystemPrompt(messages);
  const userQuestion = extractLatestUserQuestion(preparedMessages);

  // Get focused Zendesk data
  let contextData = null;
  if (process.env.OPENAI_API_KEY) {
    try {
      contextData = await getOptimizedZendeskData(userQuestion);
    } catch (error) {
      console.log('Could not fetch optimized data:', error.message);
    }
  }

  // Add context data if available
  if (contextData) {
    const dataContextMessage = {
      role: 'system',
      content: `Current Zendesk data:\n\n${contextData}\n\nUse this data to provide specific insights about current operations.`
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
          source: contextData ? 'gpt5-optimized' : 'gpt5-basic'
        };
      }
    } catch (error) {
      console.log('GPT-5 request failed:', error.message);
    }
  }

  // Fallback to cached data
  return {
    reply: buildFallbackAnswer(userQuestion),
    source: 'fallback'
  };
}

module.exports = {
  generateChatReply
};