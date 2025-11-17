const path = require('path');
const fs = require('fs');
require('dotenv').config();

const VIDEO_DIR = path.join(__dirname, 'video');
const AUDIO_DIR = path.join(__dirname, 'audio');
const PROMPT_FILE = path.join(__dirname, 'prompts.yaml');
const JOB_INTERVAL_MS =
  Number(process.env.DOWNLOAD_JOB_INTERVAL_MS) || 10000;
// const SPEECHES_BASE_URL =
//   process.env.SPEACHES_BASE_URL || 'http://localhost:8000';
// const TRANSCRIPTION_MODEL_ID =
//   process.env.TRANSCRIPTION_MODEL_ID ||
//   'guillaumekln/faster-whisper-base';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_STT_MODEL_ID = process.env.ELEVENLABS_STT_MODEL_ID || 'scribe_v1';
const ELEVENLABS_LANGUAGE_CODE = process.env.ELEVENLABS_LANGUAGE_CODE || "ind";
const ELEVENLABS_STT_URL = process.env.ELEVENLABS_STT_URL || "";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const TELEGRAM_NOTIFY_URL = process.env.TELEGRAM_NOTIFY_URL || '';
fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.mkdirSync(AUDIO_DIR, { recursive: true });

module.exports = {
  VIDEO_DIR,
  AUDIO_DIR,
  PROMPT_FILE,
  JOB_INTERVAL_MS,
  // SPEECHES_BASE_URL,
  // TRANSCRIPTION_MODEL_ID,
  ELEVENLABS_API_KEY,
  ELEVENLABS_STT_MODEL_ID,
  ELEVENLABS_LANGUAGE_CODE,
  ELEVENLABS_STT_URL,

  GEMINI_API_KEY,
  GEMINI_MODEL,
  TELEGRAM_NOTIFY_URL
};
