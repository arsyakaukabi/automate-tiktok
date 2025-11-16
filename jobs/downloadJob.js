const urlRepository = require('../repositories/urlRepository');
const { downloadTikTokVideo } = require('../services/tiktokService');
const { JOB_INTERVAL_MS } = require('../config');

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

  console.log(`Downloaded ${row.url} -> ${filePath}`);
}

async function runDownloadJob() {
  if (jobRunning) {
    return;
  }

  jobRunning = true;
  try {
    let row;
    while ((row = urlRepository.getNextPendingUrl())) {
      try {
        await processPendingUrl(row);
      } catch (err) {
        console.error(`Failed to download ${row.url}: ${err.message}`);
        break;
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
