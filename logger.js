const util = require('util');

function formatMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return meta ? ` ${meta}` : '';
  }

  const cleaned = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined)
  );

  if (!Object.keys(cleaned).length) {
    return '';
  }

  return ` ${JSON.stringify(cleaned)}`;
}

function log(level, message, meta) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}${formatMeta(meta)}`;
  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  info(message, meta) {
    log('INFO', message, meta);
  },
  warn(message, meta) {
    log('WARN', message, meta);
  },
  error(message, meta) {
    log('ERROR', message, meta);
  }
};
