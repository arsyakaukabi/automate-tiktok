const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { AUDIO_DIR } = require('../config');

function ensureFileExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Source file not found: ${filePath}`);
  }
}

function buildOutputPath(inputPath) {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  return path.join(AUDIO_DIR, `${baseName}.wav`);
}

function convertMp4ToWav(inputPath) {
  ensureFileExists(inputPath);
  const outputPath = buildOutputPath(inputPath);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-acodec',
      'pcm_s16le',
      '-ar',
      '44100',
      '-ac',
      '2',
      outputPath
    ]);

    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => reject(err));
  });
}

module.exports = {
  convertMp4ToWav
};
