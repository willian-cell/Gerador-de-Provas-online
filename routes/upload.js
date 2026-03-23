const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado.' });
  next();
};

const UPLOADS_BASE = process.env.DATA_DIR
  ? require('path').join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_BASE, String(req.session.userId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.txt', '.docx', '.doc', '.md'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Formato não suportado. Use PDF, TXT, DOCX ou MD.'));
  }
});

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  try {
    const result = await db.runAsync(
      'INSERT INTO files (user_id, filename, filepath, filesize) VALUES (?, ?, ?, ?)',
      [req.session.userId, req.file.originalname, req.file.path, req.file.size]
    );
    res.json({ success: true, file: { id: result.lastID, filename: req.file.originalname, filesize: req.file.size } });
  } catch (err) { res.status(500).json({ error: 'Erro ao salvar arquivo.' }); }
});

router.get('/files', requireAuth, async (req, res) => {
  const files = await db.allAsync(
    'SELECT id, filename, filesize, uploaded_at FROM files WHERE user_id = ? ORDER BY uploaded_at DESC',
    [req.session.userId]
  );
  res.json(files);
});

router.delete('/:id', requireAuth, async (req, res) => {
  const file = await db.getAsync('SELECT * FROM files WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
  if (!file) return res.status(404).json({ error: 'Arquivo não encontrado.' });
  try {
    // Delete physical file
    try { fs.unlinkSync(file.filepath); } catch {}
    // Cascade: remove generated question pool and review entries for this file
    await db.runAsync('DELETE FROM questions WHERE file_id = ?', [file.id]);
    await db.runAsync(
      'DELETE FROM review_questions WHERE file_id = ? AND user_id = ?',
      [file.id, req.session.userId]
    );
    await db.runAsync('DELETE FROM files WHERE id = ?', [file.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir arquivo.' });
  }
});

module.exports = router;
