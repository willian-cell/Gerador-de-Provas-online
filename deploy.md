# 🚀 Deploy no Render.com — WBO Tecnologia

## Pré-requisitos
- Conta em [github.com](https://github.com) (gratuita)
- Conta em [render.com](https://render.com) (gratuita)
- Conta em [neon.tech](https://neon.tech) (banco de dados gratuito)

---

## Passo 1 — Criar banco de dados no Neon (gratuito, persistente)

1. Acesse [neon.tech](https://neon.tech) e crie uma conta
2. Clique em **"Create Project"**
3. Nome: `gerador-de-provas` → clique **Create**
4. Na tela seguinte, copie a **Connection String** que começa com:
   ```
   postgresql://usuario:senha@host.neon.tech/nomedobanco?sslmode=require
   ```
   > ⚠️ Guarde essa string — você vai usá-la no próximo passo.

---

## Passo 2 — Subir o código no GitHub

```powershell
git init
git add .
git commit -m "primeiro commit - WBO Tecnologia"
git remote add origin https://github.com/SEU_USUARIO/gerador-de-provas.git
git branch -M main
git push -u origin main
```

---

## Passo 3 — Criar o serviço no Render

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. **New → Web Service** → conecte o repositório GitHub
3. Configure:

| Campo | Valor |
|-------|-------|
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Plan** | `Free` |

---

## Passo 4 — Variáveis de Ambiente no Render

Na aba **"Environment"** adicione:

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | *(string de conexão do Neon)* |
| `GROQ_API_KEY` | *(sua chave Groq)* |
| `SESSION_SECRET` | *(string aleatória longa)* |
| `NODE_VERSION` | `20` |

> 🔴 Nunca compartilhe `DATABASE_URL` ou `GROQ_API_KEY`.

---

## Passo 5 — Deploy

1. Clique em **"Create Web Service"**
2. Aguarde o build (2–5 min)
3. URL pública: `https://gerador-de-provas.onrender.com`

> 💡 No plano gratuito, o serviço **hiberna após 15 min** de inatividade.
> Use [UptimeRobot](https://uptimerobot.com) para manter sempre acordado (gratuito).

---

## Atualizações Futuras

```powershell
git add .
git commit -m "descrição da mudança"
git push
# → Render faz redeploy automaticamente
```

---

## Alternativas ao Render

| Plataforma | Prós | Contra |
|-----------|------|--------|
| **Railway** | Simples, 500h/mês grátis | Precisa de cartão |
| **Fly.io** | Mais rápido, volumes grátis | Configuração mais complexa |
| **VPS DigitalOcean** | Controle total | R$ 30/mês, requer Linux |
