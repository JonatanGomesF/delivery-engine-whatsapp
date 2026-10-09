// ================================================================
// ecosystem.config.js — Configuração PM2 da Engine WhatsApp
// Uso: pm2 start ecosystem.config.js
// ================================================================
module.exports = {
    apps: [
        // ── Tenant 1: restaurante_bom_sabor2 ─────────────────────
        {
            name:        'delivery-engine',
            script:      'index.js',
            cwd:         __dirname,
            watch:       false,
            autorestart: true,
            max_restarts: 10,
            min_uptime:  '10s',
            restart_delay: 5000,
            error_file:  './logs/engine1-error.log',
            out_file:    './logs/engine1-output.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs:  true,
            max_memory_restart: '800M',
            interpreter: 'node',
            exec_mode:   'fork',
            env: {
                NODE_ENV:           'production',
                PORT:               3001,
                CLIENTE_ID:         'restaurante_bom_sabor2',
                WWEBJS_AUTH_PATH:   './.wwebjs_auth_engine1'   // sessão isolada por tenant
            }
        },

        // ── Tenant 2: pizzaria_teste ──────────────────────────────
        {
            name:        'delivery-engine-pizzaria',
            script:      'index.js',
            cwd:         __dirname,
            watch:       false,
            autorestart: true,
            max_restarts: 10,
            min_uptime:  '10s',
            restart_delay: 5000,
            error_file:  './logs/engine2-error.log',
            out_file:    './logs/engine2-output.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs:  true,
            max_memory_restart: '800M',
            interpreter: 'node',
            exec_mode:   'fork',
            env: {
                NODE_ENV:           'production',
                PORT:               3002,
                CLIENTE_ID:         'pizzaria_teste',
                WWEBJS_AUTH_PATH:   './.wwebjs_auth_engine2'   // sessão isolada — QR próprio
            }
        },

        // ── Tenant 3: barbearia_estilo (Barbershop) ───────────────
        {
            name:        'engine-barbershop',
            script:      'index.js',
            cwd:         __dirname,
            watch:       false,
            autorestart: true,
            max_restarts: 10,
            min_uptime:  '10s',
            restart_delay: 5000,
            error_file:  './logs/engine3-error.log',
            out_file:    './logs/engine3-output.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs:  true,
            max_memory_restart: '800M',
            interpreter: 'node',
            exec_mode:   'fork',
            env: {
                NODE_ENV:           'production',
                PORT:               3003,
                CLIENTE_ID:         'barbearia_estilo',       // ← id do tenant no Supabase
                // NICHE não é mais necessário — o motor único lê o niche do Supabase
                WWEBJS_AUTH_PATH:   './.wwebjs_auth_engine3'  // sessão WhatsApp isolada
            }
        }
    ]
};
