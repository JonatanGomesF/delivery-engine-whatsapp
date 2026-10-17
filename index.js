// ================================================================
// index.js — Entry Point da Engine WhatsApp (Repositório 3)
// Responsabilidades:
//   1. Inicializa WhatsApp via whatsapp-web.js
//   2. Processa mensagens via botEngine.js
//   3. Publica status/QR Code na tabela bot_status (Supabase)
//   4. Escuta comandos do Painel Master via Supabase Realtime (~1s)
// Arquitetura 100% Supabase — sem Cloudflare Tunnel, sem polling.
// ================================================================
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express      = require('express');
const cors         = require('cors');
const http         = require('http');
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

// ── Supabase Client (compartilhado) ──────────────────────────────
const { createClient } = require('@supabase/supabase-js');

// Lê as variáveis do Supabase com fallback para os nomes de chave comuns
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
                  || process.env.SUPABASE_KEY
                  || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error(`[ENGINE] ❌ ERRO: SUPABASE_URL ou SUPABASE_KEY não foram encontradas no process.env!`);
    console.error(`Valores atuais -> URL: ${supabaseUrl}, KEY: ${supabaseKey ? 'Definida' : 'Indefinida'}`);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

// ── Executar comando recebido do Painel Master ────────────────────
async function executarComandoRemoto(payload) {
    const acao = payload.restart_action || 'restart';
    const ts   = payload.restart_requested_at;
    if (!ts) return; // sem comando pendente

    console.log(`⚡ [REALTIME COMANDO] Ação "${acao}" recebida do Painel Master em tempo real!`);

    // Limpa o comando imediatamente para evitar re-execução
    await supabase
        .from('bot_status')
        .update({ restart_requested_at: null, restart_action: null })
        .eq('cliente_id', process.env.CLIENTE_ID);

    if (acao === 'disconnect') {
        try { await whatsappManager.logout(); } catch(e) { logErro('LOGOUT', e); }
    } else {
        setTimeout(async () => {
            try { await whatsappManager.restart(); } catch(e) { logErro('RESTART', e); }
        }, 800); // pequeno delay para a resposta da limpeza chegar ao Supabase
    }
}

// ── Supabase Realtime — escuta comandos do Painel Master ──────────
// Substitui o polling de 30s: latência cai para ~1 segundo.
function iniciarRealtimeCommands() {
    const clienteId = process.env.CLIENTE_ID;

    supabase
        .channel(`engine-commands-${clienteId}`)
        .on(
            'postgres_changes',
            {
                event:  'UPDATE',
                schema: 'public',
                table:  'bot_status',
                filter: `cliente_id=eq.${clienteId}`
            },
            async (payload) => {
                const novo = payload.new || {};
                // Executa apenas se vier um novo timestamp de restart
                if (novo.restart_requested_at) {
                    await executarComandoRemoto(novo);
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`⚡ [REALTIME] Escutando comandos do Painel Master para "${clienteId}"... (~1s latência)`);
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ [REALTIME] Erro no canal de comandos. Tentando reconectar...');
            }
        });
}

// ── Inicialização ─────────────────────────────────────────────────
async function main() {
    console.log('');
    console.log('======================================================');
    console.log('⚡  DELIVERY ENGINE WHATSAPP — Repositório 3');
    console.log(`🆔  Tenant: ${process.env.CLIENTE_ID || 'NÃO CONFIGURADO'}`);
    console.log(`🌐  API local: http://localhost:${PORT}`);
    console.log('📡  Comandos via: Supabase Realtime (~1s)');
    console.log('======================================================');
    console.log('');

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_KEY/SUPABASE_ANON_KEY) são obrigatórias no .env!');
        process.exit(1);
    }
    if (!process.env.CLIENTE_ID) {
        console.error('❌ CLIENTE_ID é obrigatório no .env!');
        process.exit(1);
    }

    // ── Validação estrita do tenant e nicho no Supabase ──────────────
    const { data: cliente, error } = await supabase
        .from('clientes')
        .select('niche, nome')
        .eq('id', process.env.CLIENTE_ID)
        .single();

    if (error || !cliente || !cliente.niche) {
        console.error(`[ENGINE] ❌ ERRO CRÍTICO: Nicho não configurado no Supabase para o cliente ${process.env.CLIENTE_ID}`);
        return; // Interrompe em vez de carregar fallback de delivery
    }

    console.log(`✅ [ENGINE] Tenant validado no Supabase: "${cliente.nome}" | Nicho: "${cliente.niche}"`);

    // Inicializa banco de dados local (Supabase sync)
    await db.inicializarDatabase();

    // Inicializa WhatsApp (grava QR/Status na tabela bot_status via whatsappClient.js)
    await whatsappManager.initialize();

    // Inicia API Express local (healthcheck + status)
    server.listen(PORT, () => {
        console.log(`🚀 [API LOCAL] Engine ouvindo em http://localhost:${PORT}`);
    });

    // Substitui polling por Supabase Realtime (~1s de latência)
    iniciarRealtimeCommands();
}

main().catch(err => {
    console.error('❌ Falha fatal ao iniciar engine:', err.message);
    logErro('FATAL_STARTUP', err);
    process.exit(1);
});
