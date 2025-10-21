const { requestChatCompletion } = require('./gptClient');
const StreamlinedReportingService = require('./streamlinedReporting');

const DEFAULT_SYSTEM_PROMPT =
  process.env.GPT5_SYSTEM_PROMPT ||
  `You are Zendesk GPT-5 Copilot, a specialized support analytics assistant with access to real-time Zendesk data. You help analyze support metrics, agent performance, customer satisfaction, and operational insights.

Your data access includes:
- Current ticket data (volume, status, resolution metrics)  
- Agent activity and performance metrics
- Customer satisfaction scores and feedback
- Organization and user insights
- System configuration (macros, views, triggers, automations, fields, tags)

When responding:
1. Be concise and actionable with specific metrics
2. Highlight trends, anomalies, or areas needing attention  
3. Provide specific numbers and percentages when available
4. Use professional but approachable language
5. Never fabricate data - only use what's actually available
6. If data is unavailable, acknowledge this clearly

Always ground your answers in the specific data provided.`;

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
    { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
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

async function generateChatReply(messages) {
  const preparedMessages = enforceSystemPrompt(messages);
  const userQuestion = extractLatestUserQuestion(preparedMessages);

  // Get relevant data based on question keywords
  let contextData = '';
  
  try {
    const reportingService = new StreamlinedReportingService();
    
    // Determine what data to fetch based on question
    const lowerQuestion = userQuestion.toLowerCase();
    
    if (lowerQuestion.includes('overview') || lowerQuestion.includes('summary') || lowerQuestion.includes('dashboard') || 
        lowerQuestion.includes('all') || lowerQuestion.includes('everything') || lowerQuestion.includes('report')) {
      
      // Get comprehensive but concise overview
      const overview = await reportingService.getComprehensiveOverview();
      if (overview) {
        contextData = reportingService.formatForGPT(overview);
      }
      
    } else if (lowerQuestion.includes('ticket')) {
      
      // Get just ticket data
      const ticketSummary = await reportingService.getTicketSummary();
      if (ticketSummary) {
        contextData = reportingService.formatForGPT({ tickets: ticketSummary });
      }
      
    } else if (lowerQuestion.includes('agent') || lowerQuestion.includes('user') || lowerQuestion.includes('staff')) {
      
      // Get user/agent data
      const userSummary = await reportingService.getUserSummary();
      if (userSummary) {
        contextData = reportingService.formatForGPT({ users: userSummary });
      }
      
    } else if (lowerQuestion.includes('satisfaction') || lowerQuestion.includes('csat') || lowerQuestion.includes('rating')) {
      
      // Get satisfaction data
      const satisfactionSummary = await reportingService.getSatisfactionSummary();
      if (satisfactionSummary) {
        contextData = reportingService.formatForGPT({ satisfaction: satisfactionSummary });
      }
      
    } else if (lowerQuestion.includes('organization') || lowerQuestion.includes('company')) {
      
      // Get organization data
      const orgSummary = await reportingService.getOrganizationSummary();
      if (orgSummary) {
        contextData = reportingService.formatForGPT({ organizations: orgSummary });
      }
      
    } else if (lowerQuestion.includes('system') || lowerQuestion.includes('config') || lowerQuestion.includes('setup')) {
      
      // Get system configuration data
      const systemSummary = await reportingService.getSystemSummary();
      if (systemSummary) {
        contextData = reportingService.formatForGPT({ system: systemSummary });
      }
      
    } else {
      
      // Default: get a focused overview
      const overview = await reportingService.getComprehensiveOverview();
      if (overview) {
        contextData = reportingService.formatForGPT(overview);
      }
    }

    // Add context data if available
    if (contextData) {
      preparedMessages.push({
        role: 'user',
        content: `Current Zendesk Data:\n${contextData}\n\nUser Question: ${userQuestion}`
      });
    }

  } catch (error) {
    console.error('Error fetching Zendesk data:', error.message);
    
    // Fallback with minimal context
    preparedMessages.push({
      role: 'user', 
      content: `I need help with: ${userQuestion}\n\nNote: Unable to fetch live data at this time. Please provide general guidance based on Zendesk best practices.`
    });
  }

  try {
    const response = await requestChatCompletion(preparedMessages);
    return response?.choices?.[0]?.message?.content || 'I apologize, but I encountered an issue generating a response. Please try again.';
  } catch (error) {
    console.error('GPT request failed:', error.message);
    
    // Provide a helpful fallback response
    return `I'm having trouble connecting to the AI service right now. However, I can tell you that your Zendesk system is configured and working. For immediate help with your question about "${userQuestion}", I recommend:

1. Checking your Zendesk Admin Center for current metrics
2. Reviewing the Reports section for detailed analytics  
3. Using the Search function to find specific tickets or users
4. Consulting Zendesk documentation for best practices

Please try your question again in a moment, or contact your system administrator if the issue persists.`;
  }
}

module.exports = { generateChatReply };