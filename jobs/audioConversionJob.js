const transcriptRepository = require('../repositories/transcriptRepository');
const { convertMp4ToWav } = require('../services/audioService');
const { JOB_INTERVAL_MS } = require('../config');

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
  console.log(`Converted ${row.mp4_path} -> ${wavPath}`);
}

async function runAudioConversionJob() {
  if (conversionJobRunning) {
    return;
  }

  conversionJobRunning = true;
  try {
    let row;
    while ((row = transcriptRepository.getNextPendingConversion())) {
      try {
        await processPendingConversion(row);
      } catch (err) {
        console.error(
          `Failed to convert ${row?.mp4_path || row?.url_id}: ${err.message}`
        );
        break;
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
