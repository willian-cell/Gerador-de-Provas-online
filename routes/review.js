const express = require('express');
const router = express.Router();
const db = require('../database');

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado.' });
  next();
};

// GET /api/review/questions
router.get('/questions', requireAuth, async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT rq.id, rq.style, rq.question_json, rq.added_at, f.filename
       FROM review_questions rq
       JOIN files f ON rq.file_id = f.id
       WHERE rq.user_id = ?
       ORDER BY rq.added_at DESC`,
      [req.session.userId]
    );
    const questions = rows.map(r => ({
      id: r.id,
      style: r.style,
      filename: r.filename,
      added_at: r.added_at,
      ...JSON.parse(r.question_json)
    }));
    res.json(questions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao carregar banco de revisão.' });
  }
});

// DELETE /api/review/question/:id
router.delete('/question/:id', requireAuth, async (req, res) => {
  try {
    await db.runAsync(
      'DELETE FROM review_questions WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover questão.' });
  }
});

// DELETE /api/review/all
router.delete('/all', requireAuth, async (req, res) => {
  try {
    await db.runAsync(
      'DELETE FROM review_questions WHERE user_id = ?',
      [req.session.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao limpar banco de revisão.' });
  }
});

// POST /api/review/submit — submit review exam (removes correct, keeps wrong)
router.post('/submit', requireAuth, async (req, res) => {
  const { answers, questions } = req.body;
  if (!answers || !questions) return res.status(400).json({ error: 'Dados incompletos.' });

  let correct = 0;
  const total = questions.length;
  const results = questions.map((q, i) => {
    const userAnswer = (answers[i] || '').toLowerCase().trim();
    const correctAnswer = (q.answer || '').toLowerCase().trim();
    const isCorrect = userAnswer === correctAnswer;
    if (isCorrect) correct++;
    return { ...q, userAnswer, isCorrect };
  });
  const score = total > 0 ? (correct / total) * 100 : 0;

  try {
    // Remove correctly answered questions from review bank
    // NOTE: r.id is the review_questions PK sent from the frontend
    for (const r of results) {
      if (r.isCorrect && r.id) {
        await db.runAsync(
          'DELETE FROM review_questions WHERE id = ? AND user_id = ?',
          [r.id, req.session.userId]
        );
      }
    }
    res.json({ success: true, correct, total, score: Math.round(score * 10) / 10, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar revisão.' });
  }
});

module.exports = router;
