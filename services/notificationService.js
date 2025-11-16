const fetch = require('node-fetch');
const { TELEGRAM_NOTIFY_URL } = require('../config');

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
      console.error(
        `[Notification] Failed to notify ${path}: ${response.status} ${text}`
      );
    }
  } catch (err) {
    console.error(`[Notification] Error calling bot webhook: ${err.message}`);
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
