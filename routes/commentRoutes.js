const express = require('express');
const router = express.Router();
const commentRepository = require('../repositories/commentRepository');
const { generateCommentFromPrompt } = require('../services/llmService');

router.post('/comments/:id/generate', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid comment id'
    });
  }

  const comment = commentRepository.getCommentById(id);
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
    commentRepository.updateLlmComment({ id, llmComment });
    return res.json({
      status: 'success',
      result: {
        id,
        prompt_text: comment.prompt_text,
        llm_comment: llmComment
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

module.exports = router;
