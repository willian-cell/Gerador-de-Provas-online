# 🎓 Gerador de Provas Online

> **por Willian Batista Oliveira**

Sistema web com Inteligência Artificial que transforma documentos em provas completas automaticamente.

---

## ▶️ Como Iniciar

```powershell
cd "C:\Users\willi\Desktop\gerador de provas online"
npm start
```

Acesse: **http://localhost:3000**

---

## 📋 Recursos

| # | Recurso |
|---|---------|
| 🔐 | **Login/Cadastro** por nome e CPF apenas |
| 📁 | **Upload** de PDF, TXT, DOCX (até 50 MB), com pastas por usuário |
| 🤖 | **IA Groq** gera de 10 a 10.000 questões por arquivo |
| 📝 | Estilos **CESPE** (Certo/Errado) ou **Múltipla Escolha** (A/B/C/D) |
| 📊 | **Pontuação automática** com gabarito e explicações detalhadas |
| 🏆 | **Ranking global** dos usuários por média de acertos |
| 👤 | **Perfil** com histórico completo de provas realizadas |
| 💾 | Banco de dados **SQLite3** local em `data/provas.db` |
| 💎 | **UI Premium** azul/branco/verde/preto com glassmorphism |

---

## 🗂️ Estrutura do Projeto

```
gerador de provas online/
├── server.js           ← Servidor Express (porta 3000)
├── database.js         ← SQLite3 — criação das tabelas
├── .env                ← Chave da API Groq
├── package.json
├── data/
│   └── provas.db       ← Banco de dados (gerado automaticamente)
├── uploads/            ← Arquivos enviados (por usuário)
├── routes/
│   ├── auth.js         ← Cadastro, login, logout
│   ├── upload.js       ← Upload e gestão de arquivos
│   ├── exam.js         ← Geração de questões (Groq) e pontuação
│   └── ranking.js      ← Ranking global
└── public/
    ├── index.html      ← Login / Cadastro
    ├── dashboard.html  ← Upload + Geração de provas
    ├── exam.html       ← Realização da prova (paginada)
    ├── ranking.html    ← Ranking dos usuários
    ├── profile.html    ← Perfil e histórico
    └── css/style.css   ← Design system premium
```

---

## 🧪 Como Usar

1. **Cadastre-se** com nome completo e CPF
2. **Faça upload** de um arquivo PDF, TXT ou DOCX no Dashboard
3. **Selecione** o arquivo, o estilo da prova e a quantidade de questões
4. Clique em **"Gerar Questões com IA"** — o Groq analisa o documento inteiro
5. **Responda** as questões (10 por página) e finalize a prova
6. Veja sua **pontuação**, o gabarito e as explicações
7. Confira sua posição no **Ranking** global

---

## ⚙️ Variáveis de Ambiente (`.env`)

```env
GROQ_API_KEY=sua_chave_aqui
SESSION_SECRET=sua_secret_aqui
PORT=3000
```

---

## 📦 Dependências Principais

| Pacote | Função |
|--------|--------|
| `express` | Servidor web |
| `sqlite3` | Banco de dados local |
| `multer` | Upload de arquivos |
| `groq-sdk` | Geração de questões com IA |
| `pdf-parse` | Leitura de arquivos PDF |
| `mammoth` | Leitura de arquivos DOCX |
| `express-session` | Sessão de usuário |

---

> **Nota sobre grandes volumes:** Para 100+ questões, o processo é feito em lotes de 50 e pode levar alguns minutos. Questões já geradas ficam em cache no banco de dados para reuso imediato.
