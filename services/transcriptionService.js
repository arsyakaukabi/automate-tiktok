const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
const {
  SPEECHES_BASE_URL,
  TRANSCRIPTION_MODEL_ID,
  TRANSCRIPTION_LANGUAGE,
  TRANSCRIPTION_TEMPERATURE,
} = require('../config');

async function transcribeAudio(filePath, options = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  const language = options.language || TRANSCRIPTION_LANGUAGE || 'id';
  const temperature =
    typeof options.temperature === 'number'
      ? options.temperature
      : TRANSCRIPTION_TEMPERATURE ?? 1;

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model', TRANSCRIPTION_MODEL_ID);

  // OpenAI-compatible params (didukung Speaches karena dia mirror API OpenAI)
  form.append('language', language);               // contoh: "id"
  form.append('temperature', String(temperature)); // harus string di multipart

  const response = await fetch(
    `${SPEECHES_BASE_URL}/v1/audio/transcriptions`,
    {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Transcription request failed (${response.status}): ${text}`
    );
  }

  const data = await response.json();
  if (!data.text) {
    throw new Error('Transcription response missing text');
  }
  return data.text;
}

module.exports = {
  transcribeAudio,
};
