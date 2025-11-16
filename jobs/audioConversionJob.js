const transcriptRepository = require('../repositories/transcriptRepository');
const { convertMp4ToWav } = require('../services/audioService');
const { JOB_INTERVAL_MS } = require('../config');
const logger = require('../logger');

let conversionJobRunning = false;

async function processPendingConversion(row) {
  if (!row || !row.url_id || !row.mp4_path) {
    return;
  }

  transcriptRepository.ensureTranscriptRecord(row.url_id);
  const wavPath = await convertMp4ToWav(row.mp4_path);
  transcriptRepository.markAsConverted({
    urlId: row.url_id,
    wavPath
  });
  logger.info('Audio conversion finished', {
    url_id: row.url_id,
    mp4_path: row.mp4_path,
    wav_path: wavPath
  });
}

async function runAudioConversionJob() {
  if (conversionJobRunning) {
    return;
  }

  conversionJobRunning = true;
  try {
    const processedIds = new Set();
    let row;
    while ((row = transcriptRepository.getNextPendingConversion())) {
      if (processedIds.has(row.url_id)) {
        break;
      }
      processedIds.add(row.url_id);
      try {
        await processPendingConversion(row);
      } catch (err) {
        logger.error('Audio conversion failed', {
          url_id: row?.url_id,
          mp4_path: row?.mp4_path,
          error: err.message
        });
        continue;
      }
    }
  } finally {
    conversionJobRunning = false;
  }
}

function scheduleAudioConversionJob() {
  setInterval(runAudioConversionJob, JOB_INTERVAL_MS);
  runAudioConversionJob();
}

module.exports = {
  scheduleAudioConversionJob,
  runAudioConversionJob
};
