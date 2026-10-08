// ================================================================
// ecosystem.config.js — Configuração PM2 da Engine WhatsApp
// Uso: pm2 start ecosystem.config.js
// ================================================================
module.exports = {
    apps: [
        {
            name:        'delivery-engine',
            script:      'index.js',
            cwd:         __dirname,

            // ── Restart automático ────────────────────────────────
            watch:          false,          // não reinicia ao salvar arquivo
            autorestart:    true,           // reinicia se o processo cair
            max_restarts:   10,             // máximo 10 reinícios consecutivos
            min_uptime:     '10s',          // considera estável após 10s online
            restart_delay:  5000,           // espera 5s antes de reiniciar

            // ── Logs em arquivo ───────────────────────────────────
            error_file:  './logs/error.log',
            out_file:    './logs/output.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs:  true,

            // ── Variáveis de Ambiente ─────────────────────────────
            env: {
                NODE_ENV: 'production',
                PORT:     3001            // porta diferente do dev local (3000)
            },

            // ── Memória e Recursos ────────────────────────────────
            max_memory_restart: '800M',   // reinicia se ultrapassar 800MB (Chrome/Puppeteer pesa)

            // ── Interpretador ─────────────────────────────────────
            interpreter: 'node',
            exec_mode:   'fork'           // fork (não cluster) — WhatsApp Web.js não é compatível com cluster
        }
    ]
};
