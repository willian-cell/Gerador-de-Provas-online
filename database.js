const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Usa DATA_DIR (disco Render) ou fallback para ./data/
let dataDir = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR)
  : path.join(__dirname, 'data');

try {
  fs.mkdirSync(dataDir, { recursive: true });
} catch (e) {
  console.warn(`[DB] DATA_DIR "${dataDir}" não gravável (${e.code}). Usando ./data/`);
  dataDir = path.join(__dirname, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'provas.db');
console.log(`[DB] Banco em: ${dbPath}`);

const db = new Database(dbPath);

// Configurações de performance e segurança
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Criação das tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    filesize INTEGER DEFAULT 0,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    style TEXT NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER DEFAULT 0,
    score REAL DEFAULT 0,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (file_id) REFERENCES files(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    style TEXT NOT NULL,
    question_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id)
  );

  CREATE TABLE IF NOT EXISTS review_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    style TEXT NOT NULL,
    question_json TEXT NOT NULL,
    question_hash TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, question_hash),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (file_id) REFERENCES files(id)
  );
`);

console.log('[DB] Tabelas verificadas/criadas com sucesso.');

// ──────── Helpers promisificados (mesma API dos arquivos de rota) ────────

db.getAsync = (sql, params = []) => {
  try {
    return Promise.resolve(db.prepare(sql).get(params));
  } catch (err) {
    return Promise.reject(err);
  }
};

db.allAsync = (sql, params = []) => {
  try {
    return Promise.resolve(db.prepare(sql).all(params));
  } catch (err) {
    return Promise.reject(err);
  }
};

db.runAsync = (sql, params = []) => {
  try {
    const result = db.prepare(sql).run(params);
    return Promise.resolve({ lastID: result.lastInsertRowid, changes: result.changes });
  } catch (err) {
    return Promise.reject(err);
  }
};

module.exports = db;
