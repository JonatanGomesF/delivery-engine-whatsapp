// ================================================================
// index.js — Entry Point da Engine WhatsApp (Repositório 3)
// Responsabilidades:
//   1. Inicializa WhatsApp via whatsapp-web.js
//   2. Processa mensagens via botEngine.js
//   3. Publica status/QR Code na tabela bot_status (Supabase)
//   4. Expõe API Express local para o Painel Cliente ler se necessário
// Sem Socket.io — comunicação com frontend via Supabase Realtime.
// ================================================================
require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const http         = require('http');
const path         = require('path');
const fs           = require('fs');

const db                = require('./src/database');
const whatsappManager   = require('./src/whatsappClient');

const APP_DIR = path.resolve(__dirname);
const PORT    = process.env.PORT || 3001;

// ── Logging ───────────────────────────────────────────────────────
const logsDir = path.join(APP_DIR, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

function logErro(tipo, erro) {
    try {
        const msg   = erro ? (erro.stack || erro.message || String(erro)) : 'Erro desconhecido';
        const linha = `[${new Date().toISOString()}] ${tipo}: ${msg}\n`;
        fs.appendFileSync(path.join(logsDir, 'error.log'), linha, 'utf8');
    } catch (e) {}
}

// ── Handlers de erro global ───────────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('❌ [ERRO NÃO TRATADO]:', err.message);
    logErro('UNCAUGHT_EXCEPTION', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ [PROMISE REJEITADA]:', reason);
    logErro('UNHANDLED_REJECTION', reason);
});

// ── Express — API local (sem servir frontend) ─────────────────────
const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Healthcheck / Status
app.get('/health', (req, res) => {
    res.json({
        ok: true,
        botStatus: whatsappManager.getStatus().status,
        uptime:    process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', (req, res) => {
    const status = whatsappManager.getStatus();
    const stats  = db.getEstatisticas ? db.getEstatisticas() : {};
    res.json({ ...status, stats });
});

// Restart / Logout (chamados pelo bot-restart.js do Painel Master)
app.post('/api/bot/restart', async (req, res) => {
    console.log('🔄 [RESTART] Solicitação de reinício recebida via API.');
    res.json({ ok: true, message: 'Reiniciando WhatsApp...' });
    setTimeout(async () => {
        try { await whatsappManager.restart(); } catch(e) { logErro('RESTART', e); }
    }, 500);
});

app.post('/api/bot/logout', async (req, res) => {
    console.log('🔌 [LOGOUT] Desconectando sessão WhatsApp...');
    try {
        await whatsappManager.logout();
        res.json({ ok: true, message: 'Sessão desconectada.' });
    } catch(e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ── Polling do comando de restart do Painel Master ────────────────
// O Painel Master grava restart_requested_at na tabela bot_status.
// A engine verifica a cada 30s e reinicia se detectar novo comando.
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
);

let lastRestartTs = null;
async function verificarComandoRestart() {
    try {
        const { data } = await supabase
            .from('bot_status')
            .select('restart_requested_at, restart_action')
            .eq('cliente_id', process.env.CLIENTE_ID)
            .single();

        if (!data?.restart_requested_at) return;
        if (data.restart_requested_at === lastRestartTs) return;

        lastRestartTs = data.restart_requested_at;
        const acao = data.restart_action || 'restart';
        console.log(`⚡ [PM2 COMANDO] Ação "${acao}" recebida do Painel Master!`);

        // Limpa o comando para não executar de novo
        await supabase
            .from('bot_status')
            .update({ restart_requested_at: null, restart_action: null })
            .eq('cliente_id', process.env.CLIENTE_ID);

        if (acao === 'disconnect') {
            await whatsappManager.logout();
        } else {
            await whatsappManager.restart();
        }
    } catch(e) {
        // Silencioso — polling não deve derrubar a engine
    }
}

// ── Inicialização ─────────────────────────────────────────────────
async function main() {
    console.log('');
    console.log('======================================================');
    console.log('⚡  DELIVERY ENGINE WHATSAPP — Repositório 3');
    console.log(`🆔  Tenant: ${process.env.CLIENTE_ID || 'NÃO CONFIGURADO'}`);
    console.log(`🌐  API local: http://localhost:${PORT}`);
    console.log('======================================================');
    console.log('');

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias no .env!');
        process.exit(1);
    }
    if (!process.env.CLIENTE_ID) {
        console.error('❌ CLIENTE_ID é obrigatório no .env!');
        process.exit(1);
    }

    // Inicializa banco de dados local (Supabase sync)
    await db.inicializarDatabase();

    // Inicializa WhatsApp (grava QR/Status na tabela bot_status via whatsappClient.js)
    await whatsappManager.initialize();

    // Inicia API Express
    server.listen(PORT, () => {
        console.log(`🚀 [API LOCAL] Engine ouvindo em http://localhost:${PORT}`);
    });

    // Polling de comandos do Painel Master (a cada 30s)
    setInterval(verificarComandoRestart, 30000);
    console.log('⚡ [PM2 POLLING] Verificando comandos do Master Admin a cada 30s...');
}

main().catch(err => {
    console.error('❌ Falha fatal ao iniciar engine:', err.message);
    logErro('FATAL_STARTUP', err);
    process.exit(1);
});
