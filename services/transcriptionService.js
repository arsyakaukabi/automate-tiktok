const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
const {
  ELEVENLABS_API_KEY,
  ELEVENLABS_STT_MODEL_ID,    // misalnya: "scribe_v1"
  ELEVENLABS_LANGUAGE_CODE,   // opsional, mis: "ind" / "eng" / dst
  ELEVENLABS_STT_URL
} = require('../config');

// const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

async function transcribeAudio(filePath, options = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not set in config/env');
  }

  const modelId =
    options.model_id ||
    options.modelId ||
    ELEVENLABS_STT_MODEL_ID ||
    'scribe_v1';

  const languageCode =
    options.language_code ||
    options.languageCode ||
    ELEVENLABS_LANGUAGE_CODE ||
    null; // null = auto detect

  const diarize =
    typeof options.diarize === 'boolean' ? options.diarize : true;

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model_id', modelId);

  if (languageCode) {
    form.append('language_code', languageCode);
  }

  // diarization flag
  form.append('diarize', String(diarize)); // "true" / "false"

  const response = await fetch(ELEVENLABS_STT_URL, {
    method: 'POST',
    body: form,
    headers: {
      ...form.getHeaders(),
      'xi-api-key': ELEVENLABS_API_KEY,
      Accept: 'application/json',
    },
  });

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

  // Kalau tidak ada diarization / words, atau cuma 1 speaker → return text biasa
  const words = Array.isArray(data.words) ? data.words : [];
  const speakerSet = new Set(
    words
      .map((w) => w.speaker)
      .filter((s) => s !== null && s !== undefined)
  );

  if (!diarize || speakerSet.size <= 1 || words.length === 0) {
    // Single speaker / diarize=false
    return data.text.trim();
  }

  // Multiple speaker: gabung text per speaker
  // (sederhana: semua kata per speaker, tanpa urut dialog bolak-balik)
  const speakerTextMap = new Map();

  for (const w of words) {
    const speakerId =
      w.speaker !== null && w.speaker !== undefined ? w.speaker : 0;
    if (!speakerTextMap.has(speakerId)) {
      speakerTextMap.set(speakerId, []);
    }
    speakerTextMap.get(speakerId).push(w.word);
  }

  // Rapikan jadi kalimat + susun per speaker
  const lines = [];
  const sortedSpeakers = Array.from(speakerTextMap.keys()).sort(
    (a, b) => a - b
  );

  for (const speakerId of sortedSpeakers) {
    const tokens = speakerTextMap.get(speakerId) || [];
    let text = tokens.join(' ');

    // Rapihin spasi sebelum tanda baca sederhana
    text = text.replace(/\s+([,.!?;:])/g, '$1').trim();

    lines.push(`Speaker ${speakerId}: ${text}`);
  }

  return lines.join('\n');
}

module.exports = {
  transcribeAudio,
};
