const db = require('../db');

const insertCommentStmt = db.prepare(
  'INSERT OR IGNORE INTO comments (url_id) VALUES (?)'
);

const updatePromptStmt = db.prepare(
  `UPDATE comments
     SET prompt_text = @prompt_text
   WHERE url_id = @url_id`
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

module.exports = {
  ensureCommentRecord,
  updatePrompt
};
