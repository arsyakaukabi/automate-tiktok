require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const API_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const TELEGRAM_BOT_PORT =
  Number(process.env.TELEGRAM_BOT_PORT) || 3100;
const DEFAULT_CHAT_ID = process.env.TELEGRAM_DEFAULT_CHAT_ID
  ? Number(process.env.TELEGRAM_DEFAULT_CHAT_ID)
  : null;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN / TELEGRAM_BOT_TOKEN is not set');
}

const bot = new Telegraf(BOT_TOKEN);
const knownChats = new Set();
if (DEFAULT_CHAT_ID) {
  knownChats.add(DEFAULT_CHAT_ID);
}

const chatMessages = new Map();

// ---------- Helpers ----------

function ensureChatId(chatId) {
  if (typeof chatId === 'number') {
    knownChats.add(chatId);
  }
}

function isTikTokUrl(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  const trimmed = text.trim();
  const regex = /^(?:https?:\/\/)(?:(?:(?:www|m)\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|t\/[\w-]+)(?:[/?#][^\s]*)?|(?:vm|vt)\.tiktok\.com\/[\w-]+\/?(?:[?#][^\s]*)?)$/i;

  return regex.test(trimmed);
}

async function callBackend(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  return response.json();
}

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncateForTelegram(text = '', maxLength = 3500) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function buildOpenVideoButton(url) {
  return Markup.button.url('🔗 Open Video', url || 'https://www.tiktok.com');
}

function buildPromptKeyboard(id, url) {
  return Markup.inlineKeyboard([
    [buildOpenVideoButton(url)],
    [
      Markup.button.callback('⚙️ Generate Comment', `generate:${id}`),
      Markup.button.callback('✅ Submit (posted)', `submit:${id}`)
    ]
  ]);
}

function buildCommentKeyboard(id, url) {
  return Markup.inlineKeyboard([
    [buildOpenVideoButton(url)],
    [Markup.button.callback('✅ Submit (posted)', `submit:${id}`)]
  ]);
}

function formatHelp() {
  return [
    '👋 Kirim tautan video TikTok untuk memulai pipeline unduh.',
    '',
    'Perintah:',
    '/queue {n} - daftar singkat antrean (default semua)',
    '/get {n} - tampilkan per item (prompt/LLM/pending)',
    '/clear - hapus riwayat pesan bot di chat ini',
    '/help - bantuan'
  ].join('\n');
}

function formatPostedBy(ctx) {
  const from = ctx.from || {};
  if (from.username) return `@${from.username}`;
  if (from.first_name || from.last_name) {
    return [from.first_name, from.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  return String(from.id || '');
}

function trackMessageId(chatId, messageId) {
  if (!chatId || !messageId) return;
  const list = chatMessages.get(chatId) || [];
  list.push(messageId);
  chatMessages.set(chatId, list);
}

function untrackMessageId(chatId, messageId) {
  if (!chatId || !messageId) return;
  const list = chatMessages.get(chatId);
  if (!list) return;
  const filtered = list.filter((id) => id !== messageId);
  chatMessages.set(chatId, filtered);
}

function resolveChatId(ctx) {
  return (
    ctx.chat?.id ||
    ctx.message?.chat?.id ||
    ctx.callbackQuery?.message?.chat?.id ||
    ctx.inlineMessageId
  );
}

async function replyWithTracking(ctx, text, options) {
  if (!ctx) {
    throw new Error('Telegram context is missing');
  }
  const chatId = resolveChatId(ctx);
  if (typeof chatId === 'undefined') {
    throw new Error('Chat ID missing for reply');
  }
  const message = await ctx.telegram.sendMessage(chatId, text, options);
  trackMessageId(chatId, message.message_id);
  return message;
}

async function sendMessageToChat(chatId, text, options) {
  const message = await bot.telegram.sendMessage(chatId, text, options);
  trackMessageId(chatId, message.message_id);
  return message;
}

async function fetchQueue(limit, includeDetails) {
  const params = new URLSearchParams();
  if (limit) {
    params.set('limit', limit);
  }
  if (includeDetails) {
    params.set('details', '1');
  }
  const query = params.toString();
  return callBackend(`/queue${query ? `?${query}` : ''}`, {
    method: 'GET'
  });
}

async function handleEnqueue(ctx, url) {
  try {
    const payload = await callBackend('/add', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    const status = payload?.result?.inserted
      ? 'ditambahkan ke antrean'
      : 'sudah ada di antrean';
    return replyWithTracking(
      ctx,
      `✅ URL diproses (${status}). Pipeline akan berjalan otomatis.`
    );
  } catch (err) {
    console.error('Failed to add URL:', err.message);
    return replyWithTracking(
      ctx,
      '❌ Gagal menambahkan URL. Coba lagi nanti atau gunakan /help.'
    );
  }
}

async function sendQueue(ctx, limit) {
  try {
    const payload = await fetchQueue(limit, false);
    const rows = payload?.result || [];
    if (!rows.length) {
      return replyWithTracking(ctx, 'Antrean kosong 🎉');
    }
    const lines = rows.map(
      (row) => `ID ${row.id}, ${row.status}, ${row.url}`
    );
    return replyWithTracking(ctx, lines.join('\n'));
  } catch (err) {
    console.error('Failed to fetch queue:', err.message);
    return replyWithTracking(ctx, 'Tidak bisa mengambil antrean sekarang.');
  }
}

async function sendPromptBubble(chatId, payload) {
  const truncated = truncateForTelegram(payload.prompt_text || '');
  const text = `<b>Prompt Ready (#${payload.id})</b>\n<pre>${escapeHtml(
    truncated
  )}</pre>`;
  await sendMessageToChat(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: buildPromptKeyboard(payload.id, payload.url).reply_markup
  });
}

async function sendCommentBubble(chatId, payload) {
  const truncated = truncateForTelegram(payload.llm_comment || '');
  const text = `<b>LLM Comment (#${payload.id})</b>\n<pre>${escapeHtml(
    truncated
  )}</pre>`;
  await sendMessageToChat(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: buildCommentKeyboard(payload.id, payload.url).reply_markup
  });
}

async function sendPendingBubble(chatId, payload) {
  const text = `<b>Pending (#${payload.id})</b>\nStatus: ${payload.status}\n${payload.url}`;
  await sendMessageToChat(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: buildPromptKeyboard(payload.id, payload.url).reply_markup
  });
}

async function notifyQueueBubble(chatId, item) {
  if (item.llm_comment) {
    await sendCommentBubble(chatId, {
      id: item.id,
      llm_comment: item.llm_comment,
      url: item.url
    });
    return;
  }
  if (item.prompt_text) {
    await sendPromptBubble(chatId, {
      id: item.id,
      prompt_text: item.prompt_text,
      url: item.url
    });
    return;
  }
  await sendPendingBubble(chatId, item);
}

async function broadcastPromptMessage(payload) {
  if (!knownChats.size) {
    console.warn('No chat registered for prompt notification');
    return;
  }

  for (const chatId of knownChats) {
    try {
      await sendPromptBubble(chatId, payload);
    } catch (err) {
      console.error(
        `Failed to send prompt notification to ${chatId}:`,
        err.message
      );
    }
  }
}

async function broadcastCommentMessage(payload) {
  if (!knownChats.size) {
    console.warn('No chat registered for comment notification');
    return;
  }

  for (const chatId of knownChats) {
    try {
      await sendCommentBubble(chatId, payload);
    } catch (err) {
      console.error(
        `Failed to send comment notification to ${chatId}:`,
        err.message
      );
    }
  }
}

// ---------- Telegram Listeners ----------

bot.start((ctx) => {
  ensureChatId(ctx.chat.id);
  return replyWithTracking(ctx, formatHelp());
});

bot.help((ctx) => replyWithTracking(ctx, formatHelp()));

bot.command('queue', (ctx) => {
  ensureChatId(ctx.chat.id);
  const [, limitArg] = ctx.message.text.trim().split(/\s+/);
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;
  if (limitArg && (!Number.isInteger(limit) || limit <= 0)) {
    return replyWithTracking(ctx, 'Gunakan angka positif untuk `/queue {n}`.');
  }
  return sendQueue(ctx, limit);
});

bot.command('clear', async (ctx) => {
  ensureChatId(ctx.chat.id);
  const chatId = ctx.chat.id;
  const ids = chatMessages.get(chatId) || [];
  let deleted = 0;
  for (const messageId of ids) {
    try {
      await ctx.telegram.deleteMessage(chatId, messageId);
      deleted += 1;
    } catch (err) {
      console.error(`Failed to delete message ${messageId}:`, err.message);
    }
  }
  chatMessages.set(chatId, []);
  const confirmation = await replyWithTracking(
    ctx,
    `Riwayat bot dibersihkan (${deleted} pesan).`
  );
  setTimeout(() => {
    ctx.telegram
      .deleteMessage(chatId, confirmation.message_id)
      .then(() => {
        untrackMessageId(chatId, confirmation.message_id);
      })
      .catch((err) => {
        console.error('Failed to delete confirmation message:', err.message);
      });
  }, 2000);
});

bot.command('get', async (ctx) => {
  ensureChatId(ctx.chat.id);
  const [, limitArg] = ctx.message.text.trim().split(/\s+/);
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;
  if (limitArg && (!Number.isInteger(limit) || limit <= 0)) {
    return replyWithTracking(ctx, 'Gunakan angka positif untuk `/get {n}`.');
  }

  try {
    const payload = await fetchQueue(limit, true);
    const rows = payload?.result || [];
    if (!rows.length) {
      return replyWithTracking(ctx, 'Tidak ada item dengan status is_posted=0.');
    }

    for (const row of rows) {
      await notifyQueueBubble(ctx.chat.id, row);
    }
  } catch (err) {
    console.error('Failed to fetch queue details:', err.message);
    return replyWithTracking(ctx, 'Tidak bisa mengambil data saat ini.');
  }
});

bot.on('text', (ctx) => {
  ensureChatId(ctx.chat.id);
  const text = ctx.message.text || '';
  if (text.startsWith('/')) {
    // Command handled elsewhere
    return;
  }

  if (isTikTokUrl(text)) {
    return handleEnqueue(ctx, text.trim());
  }
  return replyWithTracking(
    ctx,
    'Format tidak dikenal. Gunakan /help untuk panduan.'
  );
});

bot.action(/generate:(\d+)/, async (ctx) => {
  const id = Number(ctx.match[1]);
  await ctx.answerCbQuery('Generating...');
  try {
    await callBackend(`/comments/${id}/generate`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await replyWithTracking(
      ctx,
      `⚙️ Sedang generate komentar untuk ID ${id}. Tunggu notifikasi.`
    );
  } catch (err) {
    console.error('generate failed', err.message);
    await replyWithTracking(ctx, 'Gagal men-trigger generate. Coba ulang.');
  }
});

bot.action(/submit:(\d+)/, async (ctx) => {
  const id = Number(ctx.match[1]);
  await ctx.answerCbQuery('Submitting...');
  try {
    await callBackend('/submit', {
      method: 'POST',
      body: JSON.stringify({
        id,
        posted_by: formatPostedBy(ctx)
      })
    });
    await ctx.editMessageReplyMarkup({
      inline_keyboard: [
        [Markup.button.callback('✅ Sudah diposting', 'noop')]
      ]
    });
    await replyWithTracking(ctx, `✅ Menandai ID ${id} sebagai posted.`);
  } catch (err) {
    console.error('submit failed', err.message);
    await replyWithTracking(ctx, 'Tidak bisa submit sekarang.');
  }
});

bot.action('noop', (ctx) => ctx.answerCbQuery('Tidak ada aksi.'));

bot.launch().then(() => {
  console.log('Telegram bot running');
});

// ---------- Notification Server ----------

const notificationApp = express();
notificationApp.use(express.json());

notificationApp.post('/notify/prompt', async (req, res) => {
  const { id, prompt_text: promptText, url } = req.body || {};
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    typeof promptText !== 'string' ||
    typeof url !== 'string'
  ) {
    return res.status(400).json({ status: 'error', message: 'Invalid payload' });
  }

  await broadcastPromptMessage({
    id,
    prompt_text: promptText,
    url
  });

  return res.json({ status: 'ok' });
});

notificationApp.post('/notify/comment', async (req, res) => {
  const { id, llm_comment: llmComment, url } = req.body || {};
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    typeof llmComment !== 'string' ||
    typeof url !== 'string'
  ) {
    return res.status(400).json({ status: 'error', message: 'Invalid payload' });
  }

  await broadcastCommentMessage({
    id,
    llm_comment: llmComment,
    url
  });

  return res.json({ status: 'ok' });
});

notificationApp.listen(TELEGRAM_BOT_PORT, () => {
  console.log(`Notification server on :${TELEGRAM_BOT_PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
