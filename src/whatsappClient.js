const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
// ── Motor Único Genérico ─────────────────────────────────────────
// O niche é lido em tempo de execução do Supabase (tabela clientes).
// Não há mais arquivos .js separados por nicho.
const { processarMensagem } = require('./botEngine');
console.log(`💡 [ENGINE] Motor Único carregado (niche lido do Supabase em tempo real)`);

const APP_DIR = process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');

// ── Supabase: publica status do bot para o Painel Vercel via Realtime ─────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
                  || process.env.SUPABASE_SERVICE_KEY
                  || process.env.SUPABASE_KEY
                  || process.env.SUPABASE_ANON_KEY;

let _supabaseClient = null;
function getSupabase() {
    if (_supabaseClient) return _supabaseClient;
    try {
        const { createClient } = require('@supabase/supabase-js');
        if (!supabaseUrl || !supabaseKey) { console.warn('[BOT_STATUS] SUPABASE_URL ou SUPABASE_SERVICE_KEY não definidas — status não publicado.'); return null; }
        _supabaseClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    } catch(e) { console.warn('[BOT_STATUS] Supabase não disponível:', e.message); }
    return _supabaseClient;
}

/**
 * Publica o status do bot (QR, READY, DISCONNECTED, etc.) na tabela
 * bot_status — o Painel Vercel lê via Realtime.
 */
async function publicarStatusBot(clienteId, dadosStatus) {
    if (!supabaseUrl || !supabaseKey) {
        console.error(`[BOT_STATUS] SUPABASE_URL ou SUPABASE_SERVICE_KEY não definidas — status não publicado.`);
        return;
    }

    const sb = getSupabase();
    if (!sb || !clienteId) return;

    try {
        await sb.from('bot_status').upsert(
            { cliente_id: clienteId, ...dadosStatus, updated_at: new Date().toISOString() },
            { onConflict: 'cliente_id' }
        );
        console.log(`[BOT_STATUS] ✅ Status publicado no Supabase para ${clienteId}: ${dadosStatus.status}`);
    } catch(e) {
        console.warn('[BOT_STATUS] Erro ao publicar status:', e.message);
    }
}

/**
 * Remove a pasta de sessão do WhatsApp (.wwebjs_auth_<CLIENTE_ID>)
 * para forçar a geração de um novo QR Code sem cache residual.
 */
function limparSessaoAuth() {
    try {
        const clienteId = process.env.CLIENTE_ID;
        const authPath  = process.env.WWEBJS_AUTH_PATH
            ? path.resolve(APP_DIR, process.env.WWEBJS_AUTH_PATH)
            : path.join(APP_DIR, `.wwebjs_auth_${clienteId || 'default'}`);

        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log(`🗑️  [AUTH] Pasta de sessão removida: ${authPath}`);
        } else {
            console.log(`ℹ️  [AUTH] Pasta de sessão não encontrada (já limpa): ${authPath}`);
        }
    } catch (e) {
        console.warn('[AUTH] Erro ao remover pasta de sessão:', e.message);
    }
}

// Helper para localizar o executável do Chrome/Edge/Brave em qualquer Windows
function findChromeExecutable() {
    try {
        const puppeteerPath = puppeteer.executablePath();
        if (puppeteerPath && fs.existsSync(puppeteerPath)) return puppeteerPath;
    } catch(e) {}

    const standardPaths = [
        // Linux (Ubuntu, Debian, Hetzner, etc.)
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',

        // Google Chrome (Windows)
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
        process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
        process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe') : null,

        // Microsoft Edge (Nativo no Windows 10 e 11!)
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
        process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
        process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,

        // Brave Browser
        'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe') : null
    ];

    for (const p of standardPaths) {
        if (p && fs.existsSync(p)) {
            return p;
        }
    }
    return undefined;
}

class WhatsAppManager {
    constructor() {
        this.client = null;
        this.status = 'DISCONNECTED'; // DISCONNECTED, INITIALIZING, QR_READY, AUTHENTICATED, READY, ERROR
        this.currentQr = null;
        this.currentQrImage = null;
        this.userInfo = null;
        this.eventEmitter = null;
        this.startTime = Date.now();
        this.processedMessages = new Set();
        this.recentBotReplies = new Set();
    }

    setEventEmitter(emitter) {
        this.eventEmitter = emitter;
    }

    emit(event, data) {
        if (this.eventEmitter) {
            this.eventEmitter(event, data);
        }
    }

    getStatus() {
        return {
            status: this.status,
            qr: this.currentQr,
            qrImage: this.currentQrImage,
            userInfo: this.userInfo,
            uptime: Math.floor((Date.now() - this.startTime) / 1000)
        };
    }

    async initialize() {
        if (this.client) {
            try {
                await this.client.destroy();
            } catch (e) {
                console.log("Aviso ao limpar cliente anterior:", e.message);
            }
            this.client = null;
        }

        this.status = 'INITIALIZING';
        this.currentQr = null;
        this.currentQrImage = null;
        this.emit('status_change', { status: this.status, message: 'Iniciando navegador WhatsApp...' });

        try {
            // Pasta de sessão isolada por tenant (via WWEBJS_AUTH_PATH no ecosystem.config.js)
            const authPath = process.env.WWEBJS_AUTH_PATH
                ? path.resolve(APP_DIR, process.env.WWEBJS_AUTH_PATH)
                : path.join(APP_DIR, '.wwebjs_auth');
            console.log(`📁 [AUTH] Sessão WhatsApp: ${authPath}`);

            const chromeExec = findChromeExecutable();

            if (chromeExec) {
                console.log(`🌐 [NAVEGADOR] Usando navegador do sistema: ${chromeExec}`);
            } else {
                console.log('🌐 [NAVEGADOR] Chromium embutido do Puppeteer');
            }

            const puppeteerConfig = {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
                ]
            };

            if (chromeExec) {
                puppeteerConfig.executablePath = chromeExec;
            }

            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: authPath
                }),
                puppeteer: puppeteerConfig
            });

            this.setupEventHandlers();
            await this.client.initialize();
        } catch (error) {
            console.error("❌ Falha ao inicializar WhatsApp Client:", error.message || error);
            this.status = 'ERROR';
            this.emit('status_change', { status: this.status, error: error.message });
        }
    }

    setupEventHandlers() {
        // Evento de QR Code
        this.client.on('qr', async (qr) => {
            this.currentQr = qr;
            console.log("\n📲 [QR CODE GERADO] Escaneie pelo WhatsApp no seu celular ou pelo Painel Web!");
            
            // Gera QR no terminal para compatibilidade imediata
            try {
                qrcodeTerminal.generate(qr, { small: true });
            } catch (e) {}

            try {
                // Gera imagem DataURL para o Frontend
                this.currentQrImage = await QRCode.toDataURL(qr, {
                    width: 320,
                    margin: 2,
                    color: {
                        dark: '#0F172A',
                        light: '#FFFFFF'
                    }
                });
            } catch (err) {
                console.error("Erro ao gerar QR Code DataURL:", err);
            }

            this.status = 'QR_READY';

            const qrPayload = {
                qr: this.currentQr,
                qrImage: this.currentQrImage,
                status: this.status
            };
            this.emit('qr', qrPayload);
            this.emit('status_change', qrPayload);

            // ── Publica QR Code no Supabase (Painel Vercel lê via Realtime) ──
            publicarStatusBot(process.env.CLIENTE_ID, {
                status: 'QR_READY',
                qr_string: this.currentQr,
                qr_image: this.currentQrImage,
                user_info: null,
                error_msg: null
            }).catch(() => {});
        });

        // Evento de Autenticação
        this.client.on('authenticated', () => {
            this.status = 'AUTHENTICATED';
            console.log("🔐 WhatsApp autenticado com sucesso!");
            const statusObj = this.getStatus();
            this.emit('authenticated', statusObj);
            this.emit('status_change', statusObj);
        });

        this.client.on('auth_failure', async (msg) => {
            this.status = 'DISCONNECTED';
            this.currentQr = null;
            this.currentQrImage = null;
            this.userInfo = null;
            console.error('❌ [AUTH FAILURE] Falha de autenticação:', msg);
            this.emit('status_change', { status: this.status, error: msg });

            // ── Publica DISCONNECTED no Supabase ──────────────────────────────
            await publicarStatusBot(process.env.CLIENTE_ID, {
                status:    'DISCONNECTED',
                qr_string: null,
                qr_image:  null,
                user_info: null,
                error_msg: `Auth failure: ${msg}`
            }).catch(() => {});

            // ── Apaga sessão para forçar novo QR Code limpo ──────────────────
            limparSessaoAuth();
        });

        // Evento de Conexão Pronta
        this.client.on('ready', async () => {
            this.status = 'READY';
            this.currentQr = null;
            this.currentQrImage = null;

            try {
                const info = this.client.info;
                this.userInfo = {
                    pushname: info?.pushname || 'Delivery Bot',
                    wid: info?.wid?.user ? `${info.wid.user}@c.us` : '',
                    phone: info?.wid?.user || '',
                    platform: info?.platform || 'WhatsApp Web'
                };
            } catch (err) {
                this.userInfo = { pushname: 'Delivery Bot', platform: 'Web' };
            }

            console.log(`🚀 [BOT ONLINE] Delivery Bot pronto! Conectado como: ${this.userInfo.pushname} (${this.userInfo.phone})`);
            
            const statusObj = this.getStatus();
            this.emit('ready', statusObj);
            this.emit('status_change', statusObj);

            // ── Publica READY no Supabase ────────────────────────────────
            publicarStatusBot(process.env.CLIENTE_ID, {
                status:     'READY',
                qr_string:  null,
                qr_image:   null,
                user_info:  this.userInfo,
                error_msg:  null,
                engine_url: `http://localhost:${process.env.PORT || 3001}`  // permite painel resolver sem config manual
            }).catch(() => {});
        });

        // Evento de Desconexão Automática (celular ou painel)
        this.client.on('disconnected', async (reason) => {
            console.log('⚠️ [WHATSAPP DESCONECTADO] Motivo:', reason);
            this.status = 'DISCONNECTED';
            this.userInfo = null;
            this.currentQr = null;
            this.currentQrImage = null;
            this.emit('status_change', { 
                status: 'DISCONNECTED', 
                reason, 
                message: 'WhatsApp desconectado. Gerando novo QR Code...' 
            });

            // ── Publica DISCONNECTED no Supabase ──────────────────────────────
            publicarStatusBot(process.env.CLIENTE_ID, {
                status:    'DISCONNECTED',
                qr_string: null,
                qr_image:  null,
                user_info: null,
                error_msg: `Desconectado: ${reason}`
            }).catch(() => {});

            // ── Apaga sessão para forçar novo QR Code limpo ──────────────────
            limparSessaoAuth();

            // Aguarda liberação dos arquivos do Chrome e reinicia para gerar novo QR Code
            setTimeout(async () => {
                try {
                    console.log('🔄 [RECONEXÃO AUTOMÁTICA] Inicializando novo leitor de QR Code...');
                    await this.restart();
                } catch (err) {
                    console.error('Erro ao reiniciar cliente após desconexão:', err.message);
                }
            }, 2500);
        });

        // Handler central para qualquer mensagem (clientes externos e mensagens de teste do próprio número)
        this.client.on('message_create', async (msg) => {
            await this.handleIncomingMessage(msg);
        });
    }

    async handleIncomingMessage(msg) {
        try {
            if (!msg) return;

            // 1. Ignora status/stories e broadcasts
            if (msg.isStatus || msg.broadcast || msg.from === 'status@broadcast' || msg.to === 'status@broadcast') {
                return;
            }

            const fromStr = String(msg.from || '');
            const toStr = String(msg.to || '');

            // 2. Ignora mensagens de grupos
            if (fromStr.endsWith('@g.us') || toStr.endsWith('@g.us')) {
                return;
            }

            // 3. Deduplicação de mensagens para evitar processamento duplicado
            const msgId = msg.id?._serialized || msg.id?.id;
            if (msgId) {
                if (this.processedMessages.has(msgId)) {
                    return;
                }
                this.processedMessages.add(msgId);
                if (this.processedMessages.size > 800) {
                    const first = this.processedMessages.values().next().value;
                    this.processedMessages.delete(first);
                }
            }

            const texto = (msg.body || '').trim();
            if (!texto) {
                return;
            }

            // 4. Tratamento de mensagens enviadas a partir da própria conta (fromMe: true)
            if (msg.fromMe) {
                // Se o texto for uma das respostas que o próprio bot enviou recentemente, ignora
                if (this.recentBotReplies.has(texto)) {
                    return;
                }

                // Identifica se é uma conversa consigo mesmo (ex: o usuário testando o bot pelo próprio WhatsApp)
                const myWid = this.userInfo?.wid || this.client?.info?.wid?.user || '';
                const cleanMyWid = myWid.replace(/\D/g, '');
                const cleanTo = toStr.replace(/\D/g, '');
                const cleanFrom = fromStr.replace(/\D/g, '');

                const isSelfChat = (fromStr === toStr) || 
                                   (cleanMyWid && cleanTo === cleanMyWid) || 
                                   (cleanMyWid && cleanFrom === cleanMyWid && cleanTo === cleanMyWid);

                // Se o dono estiver conversando manualmente com outra pessoa (cliente real), o bot não interfere
                if (!isSelfChat) {
                    return;
                }
                // Se for conversa consigo mesmo (teste do bot), permite o processamento!
            }

            // 5. Obtenção segura e ultra-rápida do nome do cliente
            let nome = 'Cliente';
            try {
                if (msg._data?.notifyName) {
                    nome = msg._data.notifyName;
                } else if (msg.notifyName) {
                    nome = msg.notifyName;
                } else {
                    const contact = await msg.getContact().catch(() => null);
                    if (contact && (contact.pushname || contact.name)) {
                        nome = contact.pushname || contact.name;
                    }
                }
            } catch (e) {
                nome = 'Cliente';
            }

            // Destinatário da resposta
            const targetChat = msg.fromMe ? (msg.to || msg.from) : msg.from;

            console.log(`\n📩 [WHATSAPP RECEBIDO] ${nome} (${targetChat}): "${texto}"`);

            // 6. Processamento no motor de regras do bot
            await processarMensagem({
                from: targetChat,
                nome,
                texto,
                sendMessage: async (to, content) => {
                    const destino = to || targetChat;
                    const contentTrim = (content || '').trim();

                    // Adiciona ao set de mensagens recentes do bot para prevenção de loops
                    this.recentBotReplies.add(contentTrim);
                    setTimeout(() => this.recentBotReplies.delete(contentTrim), 30000);

                    console.log(`📤 [WHATSAPP ENVIANDO] Para ${destino}: ${contentTrim.split('\n')[0]}...`);
                    
                    return await this.client.sendMessage(destino, content);
                },
                sendTyping: async () => {
                    try {
                        const chat = await msg.getChat().catch(() => null);
                        if (chat && chat.sendStateTyping) {
                            await chat.sendStateTyping();
                            await new Promise(r => setTimeout(r, 600));
                        }
                    } catch (e) {}
                },
                emitEvent: (event, data) => this.emit(event, data)
            });
        } catch (error) {
            console.error("❌ Erro ao processar mensagem do WhatsApp:", error);
        }
    }

    async restart() {
        console.log("🔄 Reiniciando cliente WhatsApp...");
        try {
            if (this.client) {
                await this.client.destroy().catch(() => {});
                this.client = null;
            }
        } catch (e) {}

        await new Promise(r => setTimeout(r, 1200));
        await this.initialize();
    }

    async logout() {
        try {
            this.status = 'DISCONNECTED';
            this.userInfo = null;
            this.currentQr = null;
            this.currentQrImage = null;
            this.emit('status_change', { status: this.status, message: 'Desconectando sessão...' });

            if (this.client) {
                try {
                    await this.client.logout().catch(() => {});
                } catch (e) {}
                try {
                    await this.client.destroy().catch(() => {});
                } catch (e) {}
                this.client = null;
            }

            setTimeout(async () => {
                await this.initialize();
            }, 2000);

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async sendMessage(to, message) {
        if (this.status !== 'READY' || !this.client) {
            throw new Error("WhatsApp não está conectado");
        }
        const messageTrim = (message || '').trim();
        this.recentBotReplies.add(messageTrim);
        setTimeout(() => this.recentBotReplies.delete(messageTrim), 30000);
        return await this.client.sendMessage(to, message);
    }
}

const whatsappManager = new WhatsAppManager();
module.exports = whatsappManager;
