const urlRepository = require('../repositories/urlRepository');
const { downloadTikTokVideo } = require('../services/tiktokService');
const { JOB_INTERVAL_MS } = require('../config');
const logger = require('../logger');

let jobRunning = false;

async function processPendingUrl(row) {
  const { result, filePath } = await downloadTikTokVideo(row.url);
  const info = result.result;

  urlRepository.markAsDownloaded({
    id: row.id,
    filePath,
    videoDesc: info.desc || null,
    authorUsername:
      info.author?.uniqueId ||
      info.author?.username ||
      null,
    authorSignature: info.author?.signature || null,
    createTime: typeof info.createTime === 'number' ? info.createTime : null
  });

  logger.info('Download job completed', {
    url: row.url,
    file_path: filePath
  });
}

async function runDownloadJob() {
  if (jobRunning) {
    return;
  }

  jobRunning = true;
  try {
    const processedIds = new Set();
    let row;
    while ((row = urlRepository.getNextPendingUrl())) {
      if (processedIds.has(row.id)) {
        break;
      }
      processedIds.add(row.id);
      try {
        await processPendingUrl(row);
      } catch (err) {
        logger.error('Download job failed', {
          url: row.url,
          error: err.message
        });
        continue;
      }
    }
  } finally {
    jobRunning = false;
  }
}

function scheduleDownloadJob() {
  setInterval(runDownloadJob, JOB_INTERVAL_MS);
  runDownloadJob();
}

module.exports = {
  scheduleDownloadJob,
  runDownloadJob
};
