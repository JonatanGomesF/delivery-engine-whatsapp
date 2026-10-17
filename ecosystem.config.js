// ================================================================
// ecosystem.config.js — Configuração PM2 da Engine WhatsApp
// Uso: pm2 start ecosystem.config.js
//
// Os tenants são gerenciados dinamicamente via painel (Vercel).
// Não há entradas fixas aqui — cada instância é iniciada via
// pm2 start index.js --name <nome> com as ENVs corretas.
// ================================================================
module.exports = {
    apps: []
};