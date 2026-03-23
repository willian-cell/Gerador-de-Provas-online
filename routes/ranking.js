const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', async (req, res) => {
  try {
    const ranking = await db.allAsync(`
      SELECT
        u.id, u.name, u.cpf,
        COUNT(e.id) as total_exams,
        ROUND(AVG(e.score), 1) as avg_score,
        MAX(e.score) as best_score,
        SUM(e.correct_answers) as total_correct,
        SUM(e.total_questions) as total_questions
      FROM users u
      JOIN exams e ON u.id = e.user_id
      GROUP BY u.id
      ORDER BY avg_score DESC, total_correct DESC
      LIMIT 100
    `);
    const masked = ranking.map((r, i) => ({
      ...r,
      position: i + 1,
      cpf: r.cpf.substring(0, 3) + '.***.***-' + r.cpf.substring(9)
    }));
    res.json(masked);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao carregar ranking.' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const user = await db.getAsync(`
      SELECT u.id, u.name, COUNT(e.id) as total_exams,
        ROUND(AVG(e.score), 1) as avg_score,
        MAX(e.score) as best_score
      FROM users u
      JOIN exams e ON u.id = e.user_id
      WHERE u.id = ?
      GROUP BY u.id
    `, [req.params.userId]);
    if (!user) return res.json({ position: null, stats: null });
    const all = await db.allAsync(`
      SELECT u.id, AVG(e.score) as avg_score FROM users u
      JOIN exams e ON u.id = e.user_id
      GROUP BY u.id ORDER BY avg_score DESC
    `);
    const position = all.findIndex(r => r.id === user.id) + 1;
    res.json({ position, stats: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar posição do usuário.' });
  }
});

module.exports = router;
