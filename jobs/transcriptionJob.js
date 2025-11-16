const transcriptRepository = require('../repositories/transcriptRepository');
const commentRepository = require('../repositories/commentRepository');
const { transcribeAudio } = require('../services/transcriptionService');
const { buildPrompt } = require('../services/promptService');
const { JOB_INTERVAL_MS } = require('../config');

let transcriptionJobRunning = false;

async function processPendingTranscription(row) {
  if (!row) return;

  const transcriptText = await transcribeAudio(row.wav_path);
  transcriptRepository.markAsTranscripted({
    urlId: row.url_id,
    transcriptText
  });

  commentRepository.ensureCommentRecord(row.url_id);
  const createdIso =
    typeof row.create_time === 'number'
      ? new Date(row.create_time * 1000).toISOString()
      : row.create_time
      ? new Date(Number(row.create_time) * 1000).toISOString()
      : row.created_at || '';

  const prompt = buildPrompt({
    uploader_username: row.author_username || 'unknown',
    profile_signature: row.author_signature || '',
    created_iso: createdIso,
    text: row.video_desc || '',
    transcript: transcriptText
  });

  commentRepository.updatePrompt({
    urlId: row.url_id,
    promptText: prompt
  });

  console.log(`Transcripted URL ${row.url_id}`);
}

async function runTranscriptionJob() {
  if (transcriptionJobRunning) {
    return;
  }

  transcriptionJobRunning = true;
  try {
    let row;
    while ((row = transcriptRepository.getNextPendingTranscription())) {
      try {
        await processPendingTranscription(row);
      } catch (err) {
        console.error(`Failed transcription for url ${row?.url_id}: ${err.message}`);
        break;
      }
    }
  } finally {
    transcriptionJobRunning = false;
  }
}

function scheduleTranscriptionJob() {
  setInterval(runTranscriptionJob, JOB_INTERVAL_MS);
  runTranscriptionJob();
}

module.exports = {
  scheduleTranscriptionJob,
  runTranscriptionJob
};
