const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const Tiktok = require('@tobyg74/tiktok-api-dl');
const { VIDEO_DIR } = require('../config');

function resolveDownloadUrl(videoInfo) {
  const video = videoInfo.video || {};
  const downloadAddr = video.downloadAddr;
  const playAddr = video.playAddr;

  const findUrl = (addr) => {
    if (!addr) return null;
    if (Array.isArray(addr)) {
      for (const item of addr) {
        if (typeof item === 'string' && item) {
          return item;
        }
        if (item?.url) {
          return item.url;
        }
      }
      return null;
    }
    return addr.url || addr;
  };

  return findUrl(downloadAddr) || findUrl(playAddr);
}

async function downloadFile(sourceUrl, destinationPath) {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Unable to download video (status ${response.status})`);
  }

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(destinationPath);
    response.body.pipe(stream);
    response.body.on('error', reject);
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function downloadTikTokVideo(videoUrl) {
  const result = await Tiktok.Downloader(videoUrl, { version: 'v1' });
  if (!result || result.status !== 'success') {
    throw new Error('Failed to retrieve video metadata');
  }

  const videoInfo = result.result;
  const username =
    videoInfo.author?.uniqueId ||
    videoInfo.author?.username ||
    'unknown';
  const videoId = videoInfo.id || Date.now().toString();
  const fileName = `${username}_${videoId}.mp4`;
  const filePath = path.join(VIDEO_DIR, fileName);

  const downloadUrl = resolveDownloadUrl(videoInfo);
  if (!downloadUrl) {
    throw new Error('Download URL was not included in the TikTok response');
  }

  await downloadFile(downloadUrl, filePath);
  return { result, filePath };
}

module.exports = {
  downloadTikTokVideo
};
