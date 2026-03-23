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

// ---------- Build variety-aware Groq prompt ----------
function buildPrompt(style, count, startNum, textChunk, existingStatements) {
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
    'vedações, proibições e restrições',
    'responsabilidades e competências',
    'penalidades e sanções previstas',
  ];
  const angle = variety[startNum % variety.length];

  if (style === 'cespe') {
    return `Você é um examinador especialista em concursos públicos (CESPE/CEBRASPE) com foco em elaborar questões profundas, precisas e bem contextualizadas.

IMPORTANTE: Escreva TUDO em Português do Brasil — enunciados, afirmações e explicações.

Sua missão: gerar EXATAMENTE ${count} questões NOVAS e INÉDITAS no estilo CESPE a partir do texto.
- Cada questão é uma AFIRMAÇÃO completa e bem elaborada (mínimo 2 frases quando necessário) sobre o conteúdo.
- Explore ângulos variados. Neste lote, foque especialmente em: **${angle}**.
- Misture afirmações corretas e incorretas (meta: ~50% certo, ~50% errado).
- As afirmações incorretas devem conter erros sutis baseados no conteúdo real.
- As explicações devem ser detalhadas e educativas em Português, citando trechos do texto quando relevante.
- Numere começando em ${startNum}.
${existingBlock}
Retorne SOMENTE um JSON array válido, sem texto extra:
[{"id":${startNum},"statement":"afirmação completa e contextualizada","answer":"certo","explanation":"explicação detalhada em português com base no texto"}, ...]

TEXTO:
${textChunk}`;
  } else {
    return `Você é um examinador especialista em concursos públicos com foco em múltipla escolha profunda e bem contextualizada.

IMPORTANTE: Escreva TUDO em Português do Brasil — enunciados, alternativas e explicações.

Sua missão: gerar EXATAMENTE ${count} questões NOVAS e INÉDITAS de múltipla escolha (A, B, C, D) a partir do texto.
- Cada questão deve ter enunciado completo com contexto suficiente para ser respondida.
- Explore ângulos variados. Neste lote, foque especialmente em: **${angle}**.
- Os distratores (alternativas erradas) devem ser plausíveis e baseados no conteúdo.
- As explicações devem ser educativas em Português e citar o fundamento correto.
- Distribua as respostas corretas entre A, B, C e D de forma equilibrada.
- Numere começando em ${startNum}.
${existingBlock}
Retorne SOMENTE um JSON array válido, sem texto extra:
[{"id":${startNum},"question":"enunciado","a":"texto A","b":"texto B","c":"texto C","d":"texto D","answer":"a","explanation":"explicação detalhada em português"}, ...]

TEXTO:
${textChunk}`;
  }
}

// ---------- Generate one batch from Groq ----------
async function generateBatch(textChunks, style, count, startNum, existingStatements) {
  // Rotate through text chunks to increase coverage on large files
  const chunkIndex = Math.floor(startNum / 50) % textChunks.length;
  const textChunk = textChunks[chunkIndex];
  const prompt = buildPrompt(style, count, startNum, textChunk, existingStatements);

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.85,      // higher temp = more variety
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

// ---------- POST /api/exam/generate ----------
router.post('/generate', requireAuth, async (req, res) => {
  const { fileId, style, totalQuestions } = req.body;
  if (!fileId || !style || !totalQuestions) return res.status(400).json({ error: 'Parâmetros incompletos.' });
  const total = Math.min(Math.max(parseInt(totalQuestions), 10), 10000);
  if (!['cespe', 'multipla'].includes(style)) return res.status(400).json({ error: 'Estilo inválido.' });

  const file = await db.getAsync('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, req.session.userId]);
  if (!file) return res.status(404).json({ error: 'Arquivo não encontrado.' });

  try {
    const text = await extractText(file.filepath);
    if (!text || text.trim().length < 100) return res.status(400).json({ error: 'Arquivo sem conteúdo suficiente.' });

    const textChunks = getTextChunks(text);

    // Load existing pool from DB
    const poolRows = await db.allAsync(
      'SELECT question_json FROM questions WHERE file_id = ? AND style = ? ORDER BY RANDOM()',
      [fileId, style]
    );
    let pool = poolRows.map(r => JSON.parse(r.question_json));

    // If pool has enough → shuffle and return without calling Groq again
    if (pool.length >= total) {
      const selected = shuffle(pool).slice(0, total).map((q, i) => ({ ...q, id: i + 1 }));
      return res.json({ success: true, questions: selected, fromCache: true });
    }

    // Need to generate more questions to fill the gap
    const needed = total - pool.length;
    const existingStatements = pool.map(getQuestionKey);
    const BATCH_SIZE = 50;
    const newQuestions = [];

    while (newQuestions.length < needed) {
      const batchCount = Math.min(BATCH_SIZE, needed - newQuestions.length);
      const startNum = pool.length + newQuestions.length + 1;
      const allExisting = [...existingStatements, ...newQuestions.map(getQuestionKey)];

      try {
        const batch = await generateBatch(textChunks, style, batchCount, startNum, allExisting);

        // Deduplicate within batch and against existing pool
        const existingKeys = new Set(allExisting);
        const unique = batch.filter(q => {
          const key = getQuestionKey(q);
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });

        newQuestions.push(...unique.slice(0, batchCount));
      } catch (batchErr) {
        if (pool.length + newQuestions.length === 0) throw batchErr;
        break; // return what we have
      }

      if (newQuestions.length >= needed) break;
      await new Promise(r => setTimeout(r, 400));
    }

    // Persist new questions to pool
    for (const q of newQuestions) {
      await db.runAsync(
        'INSERT INTO questions (file_id, style, question_json) VALUES (?, ?, ?)',
        [fileId, style, JSON.stringify(q)]
      ).catch(() => {}); // ignore constraint errors
    }

    // Combine pool + new, shuffle, slice, renumber
    const combined = shuffle([...pool, ...newQuestions]);
    const selected = combined.slice(0, total).map((q, i) => ({ ...q, id: i + 1 }));

    res.json({ success: true, questions: selected, fromCache: false });
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
