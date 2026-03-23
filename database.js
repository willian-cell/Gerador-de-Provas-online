const { Pool } = require('pg');

// ─── Conexão com PostgreSQL (Neon ou local) ────────────────
if (!process.env.DATABASE_URL) {
  console.error('[DB] ❌ Variável DATABASE_URL não definida!');
  console.error('[DB] Crie um banco em https://neon.tech e adicione DATABASE_URL no Render.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

// ─── Conversor de parâmetros  ?  →  $1, $2, ... ──────────
// Permite que todos os arquivos de rota continuem usando ?
function toPostgres(sql, params = []) {
  let i = 0;
  const converted = sql.replace(/\?/g, () => `$${++i}`);
  return [converted, params];
}

// ─── Criação das tabelas ───────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id        SERIAL PRIMARY KEY,
        name      TEXT NOT NULL,
        cpf       TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS files (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        filename   TEXT NOT NULL,
        filepath   TEXT NOT NULL,
        filesize   INTEGER DEFAULT 0,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS exams (
        id               SERIAL PRIMARY KEY,
        user_id          INTEGER NOT NULL REFERENCES users(id),
        file_id          INTEGER NOT NULL REFERENCES files(id),
        style            TEXT NOT NULL,
        total_questions  INTEGER NOT NULL,
        correct_answers  INTEGER DEFAULT 0,
        score            DOUBLE PRECISION DEFAULT 0,
        completed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        id            SERIAL PRIMARY KEY,
        file_id       INTEGER NOT NULL REFERENCES files(id),
        style         TEXT NOT NULL,
        question_json TEXT NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS review_questions (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id),
        file_id       INTEGER NOT NULL REFERENCES files(id),
        style         TEXT NOT NULL,
        question_json TEXT NOT NULL,
        question_hash TEXT NOT NULL,
        added_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, question_hash)
      );
    `);
    console.log('[DB] ✅ Tabelas verificadas/criadas com sucesso.');
  } finally {
    client.release();
  }
}

// ─── Helpers async (mesma API usada nos arquivos de rota) ─
const db = {
  // Retorna uma linha
  getAsync: async (sql, params = []) => {
    const [q, p] = toPostgres(sql, params);
    const { rows } = await pool.query(q, p);
    return rows[0] || undefined;
  },

  // Retorna todas as linhas
  allAsync: async (sql, params = []) => {
    const [q, p] = toPostgres(sql, params);
    const { rows } = await pool.query(q, p);
    return rows;
  },

  // Executa INSERT / UPDATE / DELETE
  // Retorna { lastID, changes } para manter compatibilidade com código existente
  runAsync: async (sql, params = []) => {
    // Para INSERT com RETURNING id (usado em alguns casos)
    let sqlToRun = sql;

    // Se for INSERT sem RETURNING, adiciona RETURNING id para pegar lastID
    if (/^\s*INSERT/i.test(sql) && !/RETURNING/i.test(sql)) {
      sqlToRun = sql.trimEnd().replace(/;?\s*$/, '') + ' RETURNING id';
    }

    const [q, p] = toPostgres(sqlToRun, params);
    const result = await pool.query(q, p);

    return {
      lastID: result.rows[0]?.id ?? null,
      changes: result.rowCount
    };
  }
};

// Inicia o banco de dados ao carregar o módulo
initDB().catch(err => {
  console.error('[DB] ❌ Erro ao iniciar banco de dados:', err.message);
  process.exit(1);
});

module.exports = db;
