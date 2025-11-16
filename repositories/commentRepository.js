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

const updateLlmCommentStmt = db.prepare(
  `UPDATE comments
     SET llm_comment = @llm_comment
   WHERE id = @id`
);

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

function updateLlmComment({ id, llmComment }) {
  updateLlmCommentStmt.run({
    id,
    llm_comment: llmComment
  });
}

module.exports = {
  ensureCommentRecord,
  updatePrompt,
  getCommentById,
  updateLlmComment
};
