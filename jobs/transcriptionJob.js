const transcriptRepository = require('../repositories/transcriptRepository');
const commentRepository = require('../repositories/commentRepository');
const { transcribeAudio } = require('../services/transcriptionService');
const { buildPrompt } = require('../services/promptService');
const { notifyPromptReady } = require('../services/notificationService');
const { JOB_INTERVAL_MS } = require('../config');
const logger = require('../logger');

let transcriptionJobRunning = false;

async function processPendingTranscription(row) {
  if (!row) return;

  const transcriptText = await transcribeAudio(row.wav_path);
  transcriptRepository.markAsTranscripted({
    urlId: row.url_id,
    transcriptText
  });

  commentRepository.ensureCommentRecord(row.url_id);
  const commentRecord = commentRepository.getCommentByUrlId(row.url_id);
  if (!commentRecord) {
    throw new Error(`Comment record missing for url_id=${row.url_id}`);
  }
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
  await notifyPromptReady({
    id: commentRecord.id,
    url: row.url,
    prompt_text: prompt
  });

  logger.info('Transcription completed', {
    url_id: row.url_id
  });
}

async function runTranscriptionJob() {
  if (transcriptionJobRunning) {
    return;
  }

  transcriptionJobRunning = true;
  try {
    const processedIds = new Set();
    let row;
    while ((row = transcriptRepository.getNextPendingTranscription())) {
      if (processedIds.has(row.url_id)) {
        break;
      }
      processedIds.add(row.url_id);
      try {
        await processPendingTranscription(row);
      } catch (err) {
        logger.error('Transcription job failed', {
          url_id: row?.url_id,
          error: err.message
        });
        continue;
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
