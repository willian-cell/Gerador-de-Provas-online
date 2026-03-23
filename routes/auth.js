const express = require('express');
const router = express.Router();
const db = require('../database');

function validateCPF(cpf) {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +c[i] * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== +c[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += +c[i] * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === +c[10];
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, cpf } = req.body;
  if (!name || !cpf) return res.status(400).json({ error: 'Nome e CPF são obrigatórios.' });
  const cleanCPF = cpf.replace(/\D/g, '');
  if (!validateCPF(cleanCPF)) return res.status(400).json({ error: 'CPF inválido. Deve conter 11 dígitos.' });
  try {
    const existing = await db.getAsync('SELECT id FROM users WHERE cpf = ?', [cleanCPF]);
    if (existing) return res.status(409).json({ error: 'CPF já cadastrado. Faça login.' });
    const result = await db.runAsync('INSERT INTO users (name, cpf) VALUES (?, ?)', [name.trim(), cleanCPF]);
    req.session.userId = result.lastID;
    req.session.userName = name.trim();
    req.session.userCPF = cleanCPF;
    res.json({ success: true, user: { id: result.lastID, name: name.trim(), cpf: cleanCPF } });
  } catch (err) { res.status(500).json({ error: 'Erro ao cadastrar usuário.' }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { cpf } = req.body;
  if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório.' });
  const cleanCPF = cpf.replace(/\D/g, '');
  try {
    const user = await db.getAsync('SELECT * FROM users WHERE cpf = ?', [cleanCPF]);
    if (!user) return res.status(404).json({ error: 'CPF não encontrado. Faça o cadastro.' });
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userCPF = user.cpf;
    res.json({ success: true, user: { id: user.id, name: user.name, cpf: user.cpf } });
  } catch (err) { res.status(500).json({ error: 'Erro ao fazer login.' }); }
});

// GET /api/auth/logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado.' });
  res.json({ id: req.session.userId, name: req.session.userName, cpf: req.session.userCPF });
});

module.exports = router;
