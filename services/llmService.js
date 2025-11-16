const { GoogleGenAI } = require('@google/genai');
const { GEMINI_API_KEY, GEMINI_MODEL } = require('../config');

let client;

function getClient() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return client;
}

async function generateCommentFromPrompt(promptText) {
  if (!promptText) {
    throw new Error('Prompt text is empty');
  }

  const ai = getClient();
  const contents = [
    {
      role: 'user',
      parts: [{ text: promptText }]
    }
  ];

  const response = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
      imageConfig: { imageSize: '1K' }
    },
    contents
  });

  let buffer = '';
  for await (const chunk of response) {
    if (chunk.text) {
      buffer += chunk.text;
    }
  }
  return buffer.trim();
}

module.exports = {
  generateCommentFromPrompt
};
