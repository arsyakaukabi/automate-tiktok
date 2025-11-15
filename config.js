const path = require('path');
const fs = require('fs');

const VIDEO_DIR = path.join(__dirname, 'video');
const AUDIO_DIR = path.join(__dirname, 'audio');
const PROMPT_FILE = path.join(__dirname, 'prompts.yaml');
const JOB_INTERVAL_MS =
  Number(process.env.DOWNLOAD_JOB_INTERVAL_MS) || 10000;
const SPEECHES_BASE_URL =
  process.env.SPEACHES_BASE_URL || 'http://localhost:8000';
const TRANSCRIPTION_MODEL_ID =
  process.env.TRANSCRIPTION_MODEL_ID ||
  'guillaumekln/faster-whisper-base';

fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.mkdirSync(AUDIO_DIR, { recursive: true });

module.exports = {
  VIDEO_DIR,
  AUDIO_DIR,
  PROMPT_FILE,
  JOB_INTERVAL_MS,
  SPEECHES_BASE_URL,
  TRANSCRIPTION_MODEL_ID
};
