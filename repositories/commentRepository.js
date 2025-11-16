const db = require('../db');

const insertCommentStmt = db.prepare(
  'INSERT OR IGNORE INTO comments (url_id) VALUES (?)'
);

const updatePromptStmt = db.prepare(
  `UPDATE comments
     SET prompt_text = @prompt_text
   WHERE url_id = @url_id`
);

const getCommentByIdStmt = db.prepare(
  'SELECT * FROM comments WHERE id = ?'
);

const getCommentWithUrlStmt = db.prepare(
  `SELECT c.*, u.url
     FROM comments c
     JOIN urls u ON u.id = c.url_id
    WHERE c.id = ?`
);

const getCommentByUrlIdStmt = db.prepare(
  'SELECT * FROM comments WHERE url_id = ?'
);

const updateLlmCommentStmt = db.prepare(
  `UPDATE comments
     SET llm_comment = @llm_comment,
         is_generated = @is_generated
   WHERE id = @id`
);

const markAsPostedStmt = db.prepare(
  `UPDATE comments
     SET is_posted = 1,
         posted_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'),
         posted_by = @posted_by
   WHERE id = @id`
);

const queueBaseQuery = `
  SELECT
    c.id,
    c.prompt_text,
    c.llm_comment,
    c.is_generated,
    c.is_posted,
    c.posted_at,
    c.posted_by,
    u.url
  FROM comments c
  JOIN urls u ON u.id = c.url_id
  WHERE c.is_posted = 0
  ORDER BY c.id ASC
`;

function ensureCommentRecord(urlId) {
  insertCommentStmt.run(urlId);
}

function updatePrompt({ urlId, promptText }) {
  updatePromptStmt.run({
    url_id: urlId,
    prompt_text: promptText
  });
}

function getCommentById(id) {
  return getCommentByIdStmt.get(id);
}

function getCommentWithUrl(id) {
  return getCommentWithUrlStmt.get(id);
}

function getCommentByUrlId(urlId) {
  return getCommentByUrlIdStmt.get(urlId);
}

function updateLlmComment({ id, llmComment, isGenerated = true }) {
  updateLlmCommentStmt.run({
    id,
    llm_comment: llmComment,
    is_generated: isGenerated ? 1 : 0
  });
}

function markAsPosted({ id, postedBy }) {
  markAsPostedStmt.run({
    id,
    posted_by: postedBy || null
  });
}

function listQueue(limit) {
  let sql = queueBaseQuery;
  const params = [];
  if (typeof limit === 'number' && limit > 0) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  return db.prepare(sql).all(...params);
}

module.exports = {
  ensureCommentRecord,
  updatePrompt,
  getCommentById,
  getCommentWithUrl,
  getCommentByUrlId,
  updateLlmComment,
  markAsPosted,
  listQueue
};
