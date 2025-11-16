require('./polyfills');
require('./db'); // ensure database initialized
const express = require('express');
const urlRoutes = require('./routes/urlRoutes');
const commentRoutes = require('./routes/commentRoutes');
const { scheduleDownloadJob } = require('./jobs/downloadJob');
const { scheduleAudioConversionJob } = require('./jobs/audioConversionJob');
const { scheduleTranscriptionJob } = require('./jobs/transcriptionJob');

const app = express();
app.use(express.json());
app.use(urlRoutes);
app.use(commentRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TikTok downloader listening on port ${PORT}`);
  scheduleDownloadJob();
  scheduleAudioConversionJob();
  scheduleTranscriptionJob();
});
