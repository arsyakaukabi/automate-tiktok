const db = require('../db');

const insertTranscriptStmt = db.prepare(
  'INSERT OR IGNORE INTO transcripts (url_id) VALUES (?)'
);

const getPendingConversionStmt = db.prepare(`
  SELECT
    u.id AS url_id,
    u.mp4_path,
    t.id AS transcript_id,
    t.is_converted
  FROM urls u
  LEFT JOIN transcripts t ON t.url_id = u.id
  WHERE u.is_downloaded = 1
    AND u.mp4_path IS NOT NULL
    AND (t.id IS NULL OR t.is_converted = 0)
  ORDER BY u.id
  LIMIT 1
`);

const updateConversionStmt = db.prepare(
  `UPDATE transcripts
     SET is_converted = 1,
         wav_path = @wav_path
   WHERE url_id = @url_id`
);

const getPendingTranscriptionStmt = db.prepare(`
  SELECT
    t.url_id,
    t.wav_path,
    u.video_desc,
    u.author_username,
    u.author_signature,
    u.url,
    u.created_at,
    u.create_time
  FROM transcripts t
  JOIN urls u ON u.id = t.url_id
  WHERE t.is_converted = 1
    AND t.wav_path IS NOT NULL
    AND t.is_transcripted = 0
  ORDER BY t.id
  LIMIT 1
`);

const updateTranscriptionStmt = db.prepare(
  `UPDATE transcripts
     SET is_transcripted = 1,
         transcript_text = @transcript_text
   WHERE url_id = @url_id`
);

function ensureTranscriptRecord(urlId) {
  insertTranscriptStmt.run(urlId);
}

function getNextPendingConversion() {
  return getPendingConversionStmt.get();
}

function getNextPendingTranscription() {
  return getPendingTranscriptionStmt.get();
}

function markAsConverted({ urlId, wavPath }) {
  updateConversionStmt.run({
    url_id: urlId,
    wav_path: wavPath
  });
}

function markAsTranscripted({ urlId, transcriptText }) {
  updateTranscriptionStmt.run({
    url_id: urlId,
    transcript_text: transcriptText
  });
}

module.exports = {
  ensureTranscriptRecord,
  getNextPendingConversion,
  getNextPendingTranscription,
  markAsConverted,
  markAsTranscripted
};
