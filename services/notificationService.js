const fetch = require('node-fetch');
const { TELEGRAM_NOTIFY_URL } = require('../config');
const logger = require('../logger');

async function postNotification(path, body) {
  if (!TELEGRAM_NOTIFY_URL) {
    return;
  }

  try {
    const response = await fetch(`${TELEGRAM_NOTIFY_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('Notification webhook failed', {
        path,
        status: response.status,
        body: text
      });
      return;
    }
    logger.info('Notification delivered', { path });
  } catch (err) {
    logger.error('Notification webhook error', {
      path,
      error: err.message
    });
  }
}

function notifyPromptReady(payload) {
  return postNotification('/notify/prompt', payload);
}

function notifyCommentReady(payload) {
  return postNotification('/notify/comment', payload);
}

module.exports = {
  notifyPromptReady,
  notifyCommentReady
};
