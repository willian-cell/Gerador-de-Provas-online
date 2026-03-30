const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../database');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado.' });
  next();
};

// ---------- Text extraction ----------
async function extractText(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  if (ext === '.txt' || ext === '.md') return fs.readFileSync(filepath, 'utf-8');
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(fs.readFileSync(filepath));
    return data.text;
  }
  if (ext === '.docx' || ext === '.doc') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filepath });
    return result.value;
  }
  throw new Error('Formato não suportado.');
}

// ---------- Shuffle helper ----------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Split text into varied chunks ----------
function getTextChunks(text) {
  const size = 6000;
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}

// ---------- Detect subject for better context ----------
async function getSubject(text) {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ 
        role: 'user', 
        content: `Analise as primeiras 1000 palavras deste texto e identifique o ASSUNTO PRINCIPAL (ex: Direito Administrativo, Medicina, Engenharia Civil). Retorne APENAS o nome do assunto em até 4 palavras.\n\nTEXTO:\n${text.substring(0, 4000)}` 
      }],
      temperature: 0.1,
      max_tokens: 20
    });
    return response.choices[0].message.content.trim().replace(/[^a-zA-Z\sÀ-ÿ]/g, '');
  } catch {
    return 'Assunto Geral';
  }
}

// ---------- Build variety-aware Groq prompt ----------
function buildPrompt(style, count, startNum, textChunk, existingStatements, subject) {
  const existingBlock = existingStatements.length > 0
    ? `\n\nQUESTÕES JÁ GERADAS (NÃO REPITA ESTES TEMAS/AFIRMAÇÕES):\n${existingStatements.slice(-80).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`
    : '';

  const variety = [
    'definições e conceitos fundamentais',
    'aplicações práticas e exemplos concretos',
    'exceções, casos especiais e situações atípicas',
    'comparações e diferenças entre elementos',
    'sequências históricas ou procedimentais',
    'consequências e implicações de normas ou ações',
    'requisitos, condições e prazos',
    'questões de concursos reais (viva sua base de conhecimento de provas anteriores)',
    'responsabilidades e competências',
    'penalidades e sanções previstas',
    'jurisprudência e entendimentos de tribunais',
    'detalhes técnicos e minúcias do texto',
  ];

  const complexities = ['baixa', 'média', 'alta'];
  
  const angle = variety[startNum % variety.length];
  const complexity = complexities[Math.floor(startNum / count) % complexities.length];

  const realExamInstruction = `Se o assunto (**${subject}**) for comum em concursos públicos (CESPE, FGV, OAB, etc.), inclua pelo menos 20% de questões baseadas em PROVAS REAIS anteriores. 
Para essas questões, comece o enunciado com "[QUESTÃO REAL: Banca/Órgão/Ano]" e use seu conhecimento interno para ser fiel ao estilo e conteúdo das provas originais que tratam deste assunto.`;

  if (style === 'cespe') {
    return `Você é um examinador de elite especializado em concursos públicos (estilo CESPE/CEBRASPE).
Assunto detectado: **${subject}**.
Sua missão é elaborar questões de **${complexity} complexidade** a partir do texto base.

INSTRUÇÕES CRÍTICAS:
1. Escreva TUDO em Português do Brasil.
2. Cada questão deve ser uma afirmação completa, bem escrita e contextualizada.
3. **Gabarito Indiscutível**: O erro ou acerto deve ser baseado EXATAMENTE no texto ou em fundamentos consolidados do assunto.
4. **Variedade**: Foque especialmente em: **${angle}**.
5. ${realExamInstruction}
6. GERE EXATAMENTE ${count} QUESTÕES.
7. **Explicação Educativa**: Forneça uma fundamentação acadêmica/legal para cada questão.

Numere começando em ${startNum}.
${existingBlock}

Retorne SOMENTE um JSON array de objetos:
[{"id":${startNum},"statement":"texto da afirmação","answer":"certo","explanation":"fundamentação detalhada"}, ...]

TEXTO DE BASE:
${textChunk}`;
  } else {
    return `Você é um examinador de elite especializado em questões de múltipla escolha para concursos e exames.
Assunto detectado: **${subject}**.
Sua missão é elaborar questões de **${complexity} complexidade** a partir do texto base.

INSTRUÇÕES CRÍTICAS:
1. Escreva TUDO em Português do Brasil.
2. Cada enunciado deve ser completo e conter o contexto necessário.
3. **Gabarito Claro e Único**: Somente uma alternativa correta. Distratores plausíveis.
4. **Variedade**: Foque especialmente em: **${angle}**.
5. ${realExamInstruction}
6. GERE EXATAMENTE ${count} QUESTÕES com 4 alternativas (A, B, C, D).
7. **Explicação Educativa**: Detalhe por que a correta está certa.

Numere começando em ${startNum}.
${existingBlock}

Retorne SOMENTE um JSON array de objetos:
[{"id":${startNum},"question":"enunciado","a":"opção A","b":"opção B","c":"opção C","d":"opção D","answer":"a","explanation":"fundamentação detalhada"}, ...]

TEXTO DE BASE:
${textChunk}`;
  }
}

// ---------- Generate one batch from Groq ----------
async function generateBatch(textChunks, style, count, startNum, existingStatements, subject) {
  const chunkIndex = Math.floor(startNum / 50) % textChunks.length;
  const textChunk = textChunks[chunkIndex];
  const prompt = buildPrompt(style, count, startNum, textChunk, existingStatements, subject);

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.85,
    max_tokens: 8000,
  });

  const raw = response.choices[0].message.content.trim();
  const startIdx = raw.indexOf('[');
  const endIdx = raw.lastIndexOf(']');
  if (startIdx === -1 || endIdx === -1) throw new Error('Groq não retornou JSON válido.');
  return JSON.parse(raw.substring(startIdx, endIdx + 1));
}

// ---------- Get key text from a question (for dedup & anti-repeat) ----------
function getQuestionKey(q) {
  return (q.statement || q.question || '').substring(0, 80).toLowerCase().trim();
}

// ---------- Path Resolution Helper ----------
const UPLOADS_BASE = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, '..', 'uploads');

function resolveFilePath(file) {
  if (fs.existsSync(file.filepath)) return file.filepath;
  
  // Fallback: Check in local uploads folder using userId/filename
  const fileName = path.basename(file.filepath);
  const localPath = path.join(UPLOADS_BASE, String(file.user_id), fileName);
  if (fs.existsSync(localPath)) return localPath;
  
  return file.filepath; // Return original and let it fail if not found
}

// ---------- POST /api/exam/generate ----------
router.post('/generate', requireAuth, async (req, res) => {
  const { fileId, style, totalQuestions } = req.body;
  if (!fileId || !style || !totalQuestions) return res.status(400).json({ error: 'Parâmetros incompletos.' });
  const total = Math.min(Math.max(parseInt(totalQuestions), 10), 1000); // capped at 1000 as per user request
  if (!['cespe', 'multipla'].includes(style)) return res.status(400).json({ error: 'Estilo inválido.' });

  const file = await db.getAsync('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, req.session.userId]);
  if (!file) return res.status(404).json({ error: 'Arquivo não encontrado.' });

  try {
    const absolutePath = resolveFilePath(file);
    const text = await extractText(absolutePath);
    if (!text || text.trim().length < 100) return res.status(400).json({ error: 'Arquivo sem conteúdo suficiente.' });

    const textChunks = getTextChunks(text);

    // Load existing pool from DB (consistent order by id)
    const poolRows = await db.allAsync(
      'SELECT question_json FROM questions WHERE file_id = ? AND style = ? ORDER BY id ASC',
      [fileId, style]
    );
    let pool = poolRows.map(r => JSON.parse(r.question_json));

    // If pool has enough → return immediately
    if (pool.length >= total) {
      const selected = pool.slice(0, total).map((q, i) => ({ ...q, id: i + 1 }));
      return res.json({ success: true, questions: selected, finished: true });
    }

    // Identify subject if pool is empty or small (to improve batch context)
    const subject = await getSubject(text);

    // Need to generate more questions. Generate ONLY ONE batch (max 50) per call for modular delivery.
    const existingStatements = pool.map(getQuestionKey);
    const BATCH_SIZE = 50;
    const batchCount = Math.min(BATCH_SIZE, total - pool.length);
    const startNum = pool.length + 1;

    const batch = await generateBatch(textChunks, style, batchCount, startNum, existingStatements, subject);

    // Deduplicate against pool
    const existingKeys = new Set(existingStatements);
    const unique = [];
    for (const q of batch) {
      const key = getQuestionKey(q);
      if (!existingKeys.has(key)) {
        unique.push(q);
        existingKeys.add(key);
      }
    }

    // Persist new batch to pool
    for (const q of unique) {
      await db.runAsync(
        'INSERT INTO questions (file_id, style, question_json) VALUES (?, ?, ?)',
        [fileId, style, JSON.stringify(q)]
      ).catch(() => {});
    }

    // Combine pool + NEW questions only
    const updatedPool = [...pool, ...unique];
    const selected = updatedPool.slice(0, total).map((q, i) => ({ ...q, id: i + 1 }));

    res.json({ 
      success: true, 
      questions: selected, 
      count: selected.length,
      subject: subject,
      finished: selected.length >= total 
    });
  } catch (err) {
    console.error('Erro ao gerar questões:', err);
    res.status(500).json({ error: 'Erro ao gerar questões: ' + err.message });
  }
});

// ---------- POST /api/exam/submit ----------
router.post('/submit', requireAuth, async (req, res) => {
  const { fileId, style, answers, questions } = req.body;
  if (!fileId || !style || !answers || !questions) return res.status(400).json({ error: 'Dados incompletos.' });
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
    const result = await db.runAsync(
      'INSERT INTO exams (user_id, file_id, style, total_questions, correct_answers, score) VALUES (?, ?, ?, ?, ?, ?)',
      [req.session.userId, fileId, style, total, correct, score]
    );

    // Save wrong answers to review_questions (cumulative bank)
    for (const r of results) {
      const hash = Buffer.from(
        (r.statement || r.question || '') + style
      ).toString('base64').substring(0, 64);
      if (!r.isCorrect) {
        await db.runAsync(
          `INSERT INTO review_questions (user_id, file_id, style, question_json, question_hash)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (user_id, question_hash) DO NOTHING`,
          [req.session.userId, fileId, style, JSON.stringify(r), hash]
        );
      } else {
        await db.runAsync(
          'DELETE FROM review_questions WHERE user_id = ? AND question_hash = ?',
          [req.session.userId, hash]
        );
      }
    }

    res.json({ success: true, examId: result.lastID, correct, total, score: Math.round(score * 10) / 10, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar resultado.' });
  }
});

// ---------- GET /api/exam/history ----------
router.get('/history', requireAuth, async (req, res) => {
  const exams = await db.allAsync(`
    SELECT e.*, f.filename FROM exams e
    JOIN files f ON e.file_id = f.id
    WHERE e.user_id = ?
    ORDER BY e.completed_at DESC
  `, [req.session.userId]);
  res.json(exams);
});

module.exports = router;
