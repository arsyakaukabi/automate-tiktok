const express = require('express');
const router = express.Router();
const commentRepository = require('../repositories/commentRepository');
const { generateCommentFromPrompt } = require('../services/llmService');
const { notifyCommentReady } = require('../services/notificationService');
const urlRepository = require('../repositories/urlRepository');
const transcriptRepository = require('../repositories/transcriptRepository');
const { cleanupMediaFiles } = require('../services/mediaCleanupService');
const logger = require('../logger');

router.post('/comments/:id/generate', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid comment id'
    });
  }

  const comment = commentRepository.getCommentWithUrl(id);
  if (!comment) {
    return res.status(404).json({
      status: 'error',
      message: 'Comment not found'
    });
  }

  if (!comment.prompt_text) {
    return res.status(400).json({
      status: 'error',
      message: 'Prompt text not available for this comment'
    });
  }

  try {
    const llmComment = await generateCommentFromPrompt(comment.prompt_text);
    commentRepository.updateLlmComment({ id, llmComment, isGenerated: true });
    await notifyCommentReady({
      id,
      url: comment.url,
      llm_comment: llmComment
    });
    return res.json({
      status: 'success',
      result: {
        id,
        prompt_text: comment.prompt_text,
        llm_comment: llmComment,
        is_generated: 1
      }
    });
  } catch (error) {
    console.error('LLM generation error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

router.post('/submit', async (req, res) => {
  const { id, posted_by: postedBy } = req.body || {};
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid comment id'
    });
  }

  const comment = commentRepository.getCommentById(numericId);
  if (!comment) {
    return res.status(404).json({
      status: 'error',
      message: 'Comment not found'
    });
  }

  commentRepository.markAsPosted({
    id: numericId,
    postedBy
  });

  const urlRecord = urlRepository.getUrlById(comment.url_id);
  const transcriptRecord =
    transcriptRepository.getTranscriptByUrlId(comment.url_id);

  try {
    await cleanupMediaFiles({
      mp4Path: urlRecord && urlRecord.mp4_path,
      wavPath: transcriptRecord && transcriptRecord.wav_path
    });
  } catch (err) {
    logger.warn('Failed to cleanup media files after posting', {
      comment_id: numericId,
      url_id: comment.url_id,
      error: err.message
    });
  }

  return res.json({
    status: 'success',
    result: {
      id: numericId,
      is_posted: 1,
      posted_by: postedBy || null
    }
  });
});

router.get('/queue', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const includeDetails =
    req.query.details === '1' ||
    req.query.details === 'true';
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    return res.status(400).json({
      status: 'error',
      message: 'limit must be a positive integer'
    });
  }

  const rows = commentRepository.listQueue(limit);
  const result = rows.map((row) => {
    const base = {
      id: row.id,
      status: deriveStatus(row),
      url: row.url
    };
    if (includeDetails) {
      return {
        ...base,
        prompt_text: row.prompt_text,
        llm_comment: row.llm_comment
      };
    }
    return base;
  });

  return res.json({ status: 'success', result });
});

function deriveStatus(row) {
  if (row.llm_comment) {
    return 'llm_ready';
  }
  if (row.prompt_text) {
    return 'prompt_ready';
  }
  return 'pending';
}

module.exports = router;
