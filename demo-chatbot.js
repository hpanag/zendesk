#!/usr/bin/env node

/**
 * Demo script showing how to use the enhanced GPT-5 chatbot for ticket-related questions
 * 
 * Usage:
 *   node demo-chatbot.js "How many tickets did we get today?"
 *   node demo-chatbot.js "What's our current backlog?"
 *   node demo-chatbot.js "Show me ticket trends for the past week"
 */

const { generateChatReply } = require('./src/services/gptResponder');

async function demoChatbot(question) {
  console.log('🤖 Zendesk GPT-5 Chatbot Demo');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`❓ Question: ${question}`);
  console.log('');
  console.log('🔄 Fetching live ticket data and generating response...');
  console.log('');

  try {
    const result = await generateChatReply([
      { role: 'user', content: question }
    ]);

    console.log('✅ Response:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(result.reply);
    console.log('');
    console.log(`📡 Source: ${result.source}`);
    
    if (result.source === 'gpt5-enhanced') {
      console.log('✨ This response includes live Zendesk data!');
    } else if (result.source === 'gpt5') {
      console.log('⚡ GPT-5 response (no live data enhancement)');
    } else {
      console.log('📊 Fallback response using cached data');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Get question from command line or use default
const question = process.argv[2] || 'How many tickets did we get today?';

demoChatbot(question).catch(console.error);