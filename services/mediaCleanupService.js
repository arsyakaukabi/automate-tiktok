const fs = require('fs/promises');
const logger = require('../logger');

async function deleteFileIfExists(filePath) {
  if (!filePath) {
    return false;
  }

  try {
    await fs.unlink(filePath);
    logger.info('Deleted media file', { file_path: filePath });
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.warn('Media file already removed', { file_path: filePath });
      return false;
    }
    throw err;
  }
}

async function cleanupMediaFiles({ mp4Path, wavPath }) {
  const deletions = [];
  if (mp4Path) {
    deletions.push(deleteFileIfExists(mp4Path));
  }
  if (wavPath) {
    deletions.push(deleteFileIfExists(wavPath));
  }

  if (!deletions.length) {
    return;
  }

  // Fail only if deletion throws other than ENOENT.
  await Promise.all(deletions);
}

module.exports = {
  cleanupMediaFiles
};
