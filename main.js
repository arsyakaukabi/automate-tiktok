require('./polyfills');
require('./db'); // ensure database initialized
const express = require('express');
const logger = require('./logger');
const urlRoutes = require('./routes/urlRoutes');
const commentRoutes = require('./routes/commentRoutes');
const { scheduleDownloadJob } = require('./jobs/downloadJob');
const { scheduleAudioConversionJob } = require('./jobs/audioConversionJob');
const { scheduleTranscriptionJob } = require('./jobs/transcriptionJob');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const start = Date.now();
  logger.info('Incoming request', {
    method: req.method,
    path: req.originalUrl
  });

  res.on('finish', () => {
    logger.info('Request completed', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - start
    });
  });

  next();
});
app.use(urlRoutes);
app.use(commentRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`TikTok downloader listening on port ${PORT}`);
  scheduleDownloadJob();
  scheduleAudioConversionJob();
  scheduleTranscriptionJob();
});
