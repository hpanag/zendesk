const OpenAI = require('openai');

let client = null;

function createClient() {
  if (client || !process.env.OPENAI_API_KEY) {
    return client;
  }

  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined
  });

  return client;
}

async function requestChatCompletion(messages) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const currentClient = createClient();
    if (!currentClient) {
      return null;
    }

    const response = await currentClient.chat.completions.create({
      model: process.env.OPENAI_GPT5_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 4000,
      messages
    });

    return response?.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('Failed to retrieve GPT-5 response:', error.message);
    return null;
  }
}

module.exports = {
  requestChatCompletion
};
