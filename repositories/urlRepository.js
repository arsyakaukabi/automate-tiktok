const db = require('../db');

const insertUrlStmt = db.prepare(
  'INSERT OR IGNORE INTO urls (url) VALUES (?)'
);
const selectPendingStmt = db.prepare(
  'SELECT * FROM urls WHERE is_downloaded = 0 ORDER BY id ASC LIMIT 1'
);
const updateDownloadStmt = db.prepare(
  `UPDATE urls
     SET is_downloaded = @is_downloaded,
         mp4_path = @mp4_path,
         create_time = @create_time,
         video_desc = @video_desc,
         author_username = @author_username,
         author_signature = @author_signature
   WHERE id = @id`
);

function insertUrls(urls = []) {
  return urls.map((rawUrl) => {
    const normalized = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!normalized) {
      return { url: rawUrl, inserted: false, reason: 'invalid url' };
    }

    try {
      const info = insertUrlStmt.run(normalized);
      return {
        url: normalized,
        inserted: info.changes > 0,
        reason: info.changes > 0 ? null : 'duplicate'
      };
    } catch (err) {
      return { url: normalized, inserted: false, reason: err.message };
    }
  });
}

function getNextPendingUrl() {
  return selectPendingStmt.get();
}

function markAsDownloaded({
  id,
  filePath,
  videoDesc,
  authorUsername,
  authorSignature,
  createTime
}) {
  updateDownloadStmt.run({
    id,
    is_downloaded: 1,
    mp4_path: filePath,
    create_time: typeof createTime === 'number' ? createTime : null,
    video_desc: videoDesc || null,
    author_username: authorUsername || null,
    author_signature: authorSignature || null
  });
}

module.exports = {
  insertUrls,
  getNextPendingUrl,
  markAsDownloaded
};
