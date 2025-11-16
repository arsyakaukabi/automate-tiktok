const express = require('express');
const router = express.Router();
const urlRepository = require('../repositories/urlRepository');
const { downloadTikTokVideo } = require('../services/tiktokService');

router.post('/add', (req, res) => {
  const { url } = req.body || {};
  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({
      status: 'error',
      message: '`url` is required'
    });
  }

  const [result] = urlRepository.insertUrls([url.trim()]);
  return res.json({ status: 'success', result });
});

router.post('/urls', (req, res) => {
  const { urls } = req.body || {};
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Payload harus berupa array URL pada field `urls`'
    });
  }

  const summary = urlRepository.insertUrls(urls);
  return res.json({ status: 'success', result: summary });
});

router.post('/download', async (req, res) => {
  const { url } = req.body || {};
  if (!url) {
    return res
      .status(400)
      .json({ status: 'error', message: 'TikTok video URL is required' });
  }

  try {
    const { result } = await downloadTikTokVideo(url);
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
