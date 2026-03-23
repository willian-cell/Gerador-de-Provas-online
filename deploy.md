# 🚀 Deploy no Render.com — WBO Tecnologia

## Pré-requisitos
- Conta em [github.com](https://github.com) (gratuita)
- Conta em [render.com](https://render.com) (gratuita)

---

## Passo 1 — Subir o código no GitHub

Abra o terminal PowerShell **na pasta do projeto** e execute:

```powershell
# Inicializa o repositório Git
git init
git add .
git commit -m "primeiro commit - WBO Tecnologia"

# Conecta ao seu repositório do GitHub
# (crie o repositório VAZIO no github.com primeiro, depois use o link abaixo)
git remote add origin https://github.com/SEU_USUARIO/gerador-de-provas.git
git push -u origin main
```

> ⚠️ **IMPORTANTE:** Crie o repositório no GitHub como **privado** para proteger seu código. O arquivo `.env` já está no `.gitignore` e não será enviado.

---

## Passo 2 — Criar o serviço no Render

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Clique em **"New → Web Service"**
3. Conecte ao seu repositório GitHub (`gerador-de-provas`)
4. Configure:

| Campo | Valor |
|-------|-------|
| **Name** | `gerador-de-provas` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Plan** | `Free` |
| **Region** | `Oregon (US West)` |

---

## Passo 3 — Variáveis de Ambiente

Na aba **"Environment"** do serviço, adicione:

| Variável | Valor |
|----------|-------|
| `GROQ_API_KEY` | `gsk_VL8K...` (sua chave real) |
| `SESSION_SECRET` | qualquer string longa e aleatória |
| `DATA_DIR` | `/var/data` |

> 🔴 **ATENÇÃO:** Nunca compartilhe sua `GROQ_API_KEY`. Use uma string forte e única no `SESSION_SECRET`.

---

## Passo 4 — Disco Persistente (para SQLite + uploads)

O plano **Free não inclui disco persistente**. Existem 2 opções:

### Opção A — Render Disk ✅ Recomendado (US$ 0.25/GB/mês ≈ R$ 1,50/mês)

Na aba **"Disks"** do serviço:

- **Name:** `wbo-data`
- **Mount Path:** `/var/data`
- **Size:** `1 GB`

### Opção B — Plano Free sem persistência

> ⚠️ **AVISO:** No plano gratuito sem disco, o banco de dados e os arquivos enviados **serão apagados a cada redeploy**. Funciona para testes, mas não para uso real contínuo.

---

## Passo 5 — Deploy

1. Clique em **"Create Web Service"**
2. Aguarde o build (2–5 minutos)
3. Render vai exibir a URL pública: `https://gerador-de-provas.onrender.com`

> 💡 No plano gratuito, o serviço **hiberna após 15 min de inatividade**. O primeiro acesso após a hibernação leva \~30 segundos para acordar.

---

## Atualizações Futuras

```powershell
# A cada mudança, basta:
git add .
git commit -m "descrição da mudança"
git push
# → Render detecta e faz deploy automaticamente
```

---

## Alternativas ao Render

| Plataforma | Prós | Contra |
|-----------|------|--------|
| **Railway** | Simples, 500h/mês grátis | Precisa de cartão para ativar |
| **Fly.io** | Persistência gratuita, mais rápido | Configuração mais complexa |
| **VPS DigitalOcean** | Controle total, R$ 30/mês | Requer configuração Linux |
