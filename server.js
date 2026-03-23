require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

// Initialize DB (runs migrations on startup)
require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directory exists (uses DATA_DIR on Render for persistence)
let uploadsBase = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, 'uploads');

try {
  fs.mkdirSync(uploadsBase, { recursive: true });
} catch (e) {
  console.warn(`[Uploads] DATA_DIR not writable: ${e.code}. Falling back to ./uploads/`);
  uploadsBase = path.join(__dirname, 'uploads');
  fs.mkdirSync(uploadsBase, { recursive: true });
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'gerador_provas_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/exam', require('./routes/exam'));
app.use('/api/ranking', require('./routes/ranking'));
app.use('/api/review', require('./routes/review'));

// Auth guard for HTML pages — redirect to login if not authenticated
const requireAuthPage = (req, res, next) => {
  if (!req.session.userId) return res.redirect('/');
  next();
};

// SPA fallback - serve HTML pages
app.get('/dashboard', requireAuthPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/exam',      requireAuthPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'exam.html')));
app.get('/ranking',   requireAuthPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'ranking.html')));
app.get('/profile',   requireAuthPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));
app.get('/review',    requireAuthPage, (req, res) => res.sendFile(path.join(__dirname, 'public', 'review.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const server = app.listen(PORT, () => {
  console.log(`\n🎓 Gerador de Provas Online`);
  console.log(`📡 Servidor rodando em http://localhost:${PORT}`);
  console.log(`✅ Banco de dados SQLite iniciado\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ A porta ${PORT} já está em uso!`);
    console.error(`   Encerre o processo anterior e tente novamente:`);
    console.error(`   npx kill-port ${PORT}   (ou feche o terminal anterior)\n`);
  } else {
    console.error('Erro no servidor:', err);
  }
  process.exit(1);
});
