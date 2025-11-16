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
  const regex =
    /https?:\/\/(www\.)?(vm\.)?tiktok\.com\/[^\s]+/i;
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
    '/queue {n} - daftar item belum diposting',
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

async function handleEnqueue(ctx, url) {
  try {
    const payload = await callBackend('/add', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    const status = payload?.result?.inserted
      ? 'ditambahkan ke antrean'
      : 'sudah ada di antrean';
    return ctx.reply(
      `✅ URL diproses (${status}). Pipeline akan berjalan otomatis.`
    );
  } catch (err) {
    console.error('Failed to add URL:', err.message);
    return ctx.reply(
      '❌ Gagal menambahkan URL. Coba lagi nanti atau gunakan /help.'
    );
  }
}

async function sendQueue(ctx, limit) {
  try {
    const query = limit ? `?limit=${limit}` : '';
    const payload = await callBackend(`/queue${query}`, {
      method: 'GET'
    });
    const rows = payload?.result || [];
    if (!rows.length) {
      return ctx.reply('Antrean kosong 🎉');
    }
    const lines = rows.map(
      (row) => `ID ${row.id}, ${row.status}, ${row.url}`
    );
    return ctx.reply(lines.join('\n'));
  } catch (err) {
    console.error('Failed to fetch queue:', err.message);
    return ctx.reply('Tidak bisa mengambil antrean sekarang.');
  }
}

async function broadcastPromptMessage(payload) {
  if (!knownChats.size) {
    console.warn('No chat registered for prompt notification');
    return;
  }

  const text = `<b>Prompt Ready (#${payload.id})</b>\n<pre>${escapeHtml(
    payload.prompt_text
  )}</pre>`;

  for (const chatId of knownChats) {
    try {
      await bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: buildPromptKeyboard(payload.id, payload.url).reply_markup
      });
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

  const text = `<b>LLM Comment (#${payload.id})</b>\n<pre>${escapeHtml(
    payload.llm_comment
  )}</pre>`;

  for (const chatId of knownChats) {
    try {
      await bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: buildCommentKeyboard(payload.id, payload.url).reply_markup
      });
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
  return ctx.reply(formatHelp());
});

bot.help((ctx) => ctx.reply(formatHelp()));

bot.command('queue', (ctx) => {
  ensureChatId(ctx.chat.id);
  const [, limitArg] = ctx.message.text.trim().split(/\s+/);
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;
  if (limitArg && (!Number.isInteger(limit) || limit <= 0)) {
    return ctx.reply('Gunakan angka positif untuk `/queue {n}`.');
  }
  return sendQueue(ctx, limit);
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
  return ctx.reply('Format tidak dikenal. Gunakan /help untuk panduan.');
});

bot.action(/generate:(\d+)/, async (ctx) => {
  const id = Number(ctx.match[1]);
  await ctx.answerCbQuery('Generating...');
  try {
    await callBackend(`/comments/${id}/generate`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    await ctx.reply(
      `⚙️ Sedang generate komentar untuk ID ${id}. Tunggu notifikasi.`
    );
  } catch (err) {
    console.error('generate failed', err.message);
    await ctx.reply('Gagal men-trigger generate. Coba ulang.');
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
    await ctx.reply(`✅ Menandai ID ${id} sebagai posted.`);
  } catch (err) {
    console.error('submit failed', err.message);
    await ctx.reply('Tidak bisa submit sekarang.');
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
