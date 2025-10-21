# Building a Zendesk Ticket Chatbot 🤖

This guide explains how to create a chatbot that can answer ticket-related questions using live Zendesk data and GPT-5, similar to what you experienced when you asked "how many tickets did we get today?"

## What You Already Have ✅

Your setup already includes:
- ✅ Zendesk API integration (`ZendeskClient`)
- ✅ GPT-5 chat interface (`web/zendeskchat.html`)
- ✅ Live data fetching service (`TicketDataService`)
- ✅ Enhanced GPT responder with live data injection
- ✅ Working demo script (`demo-chatbot.js`)

## How It Works 🔧

### 1. Live Data Fetching
The `TicketDataService` class fetches real-time data from your Zendesk instance:

```javascript
const service = new TicketDataService();
const summary = await service.getComprehensiveTicketSummary();
```

**What it fetches:**
- Today's ticket creation count
- Current status breakdown (new, open, pending, hold, solved, closed)
- Recent 7-day trends
- Priority breakdown (urgent, high, normal, low)
- Ticket volume by channel

### 2. GPT-5 Integration
The enhanced GPT responder (`gptResponder.js`) automatically:

1. **Fetches live data** before calling GPT-5
2. **Injects data as context** into the conversation
3. **Falls back gracefully** if API calls fail

```javascript
// This happens automatically when you ask a question
const result = await generateChatReply([
  { role: 'user', content: 'How many tickets did we get today?' }
]);
```

### 3. Smart Context Enhancement
When you ask a question, the system:

1. ✅ Gets your question
2. ✅ Fetches fresh Zendesk data
3. ✅ Adds the data as system context for GPT-5
4. ✅ GPT-5 responds with data-grounded answers
5. ✅ Returns the response with source indication

## Testing Your Chatbot 🧪

### Command Line Demo
```bash
# Test basic functionality
node demo-chatbot.js "How many tickets did we get today?"

# Test different question types
node demo-chatbot.js "What's our current backlog?"
node demo-chatbot.js "Break down tickets by status"
node demo-chatbot.js "How many urgent tickets do we have?"
node demo-chatbot.js "Show me the 7-day ticket trend"
```

### Web Interface
1. Start the server: `node server.js`
2. Open: `http://localhost:3000/web/zendeskchat.html`
3. Ask questions like:
   - "How many tickets did we get today?"
   - "What's our current backlog situation?"
   - "Are there any urgent tickets I should know about?"

## Customizing Your Chatbot 🎛️

### 1. Modify System Prompt
Edit the default behavior in `src/services/gptResponder.js`:

```javascript
const DEFAULT_SYSTEM_PROMPT = 
  'You are a Zendesk expert. Focus on actionable insights and highlight urgent issues...';
```

Or set via environment variable:
```bash
GPT5_SYSTEM_PROMPT="Your custom instructions here..."
```

### 2. Add More Data Sources
Extend `TicketDataService.js` to fetch additional metrics:

```javascript
async getAgentPerformance() {
  // Fetch agent statistics
}

async getSatisfactionScores() {
  // Fetch CSAT data
}
```

### 3. Create Specialized Endpoints
Add specific API endpoints in `server.js`:

```javascript
// Add route for executive summaries
if (req.url.startsWith('/api/executive-summary')) {
  // Handle executive-focused questions
}
```

## Environment Setup 📋

Make sure your `.env` file includes:

```properties
# Required for Zendesk data
ZENDESK_SUBDOMAIN=your-subdomain
ZENDESK_EMAIL=your-email
ZENDESK_API_TOKEN=your-token

# Required for GPT-5 responses
OPENAI_API_KEY=sk-proj-your-key-here

# Optional customizations
OPENAI_GPT5_MODEL=gpt-4o-mini
GPT5_SYSTEM_PROMPT=Your custom system prompt
```

## Example Questions Your Chatbot Can Answer 💬

**Volume & Creation:**
- "How many tickets did we get today?"
- "What's the ticket volume trend this week?"
- "Compare today's volume to yesterday"

**Status & Backlog:**
- "What's our current backlog?"
- "How many tickets are pending?"
- "Break down tickets by status"

**Priority & Urgency:**
- "Do we have any urgent tickets?"
- "Show me high-priority ticket counts"
- "What requires immediate attention?"

**Trends & Analysis:**
- "How are we doing compared to last week?"
- "What's our ticket resolution rate?"
- "Show me the 7-day trend"

## Response Quality 📊

Your chatbot will provide responses like:

```
Today, 100 new tickets were created.

Current status breakdown:
- New: 16 tickets  
- Open: 171 tickets
- Pending: 87 tickets
- Active backlog: 360 tickets total

Source: gpt5-enhanced (live Zendesk data)
```

## Next Steps 🚀

1. **Test extensively** with your team's common questions
2. **Customize the system prompt** for your workflow
3. **Add more data sources** as needed
4. **Deploy the web interface** for team use
5. **Monitor API usage** and response quality

The chatbot is fully functional and ready to help your team understand ticket metrics instantly! 🎉