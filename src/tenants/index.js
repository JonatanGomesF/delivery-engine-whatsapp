// =====================================================================
// src/tenants/index.js — Gerenciador e Loader Dinâmico de Tenants
// =====================================================================

const path = require('path');
const fs = require('fs');
const defaultTenant = require('./default');

const TENANTS_MAP = {
    'default': defaultTenant,
    'caoguarda': require('./caoguarda'),
    'sabordapraia': require('./sabordapraia'),
    'barbearia_estilo': require('./barbearia_estilo'),
    'barbeariaestilo': require('./barbearia_estilo'),
    'barberestilo2': require('./barbearia_estilo'),
    'barberestilo': require('./barbearia_estilo')
};

function normalizarClienteId(clienteId) {
    if (!clienteId || typeof clienteId !== 'string') return '';
    return clienteId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function carregarTenant(clienteId = process.env.CLIENTE_ID) {
    const rawId = normalizarClienteId(clienteId);

    if (!rawId) {
        return defaultTenant;
    }

    if (TENANTS_MAP[rawId]) {
        return TENANTS_MAP[rawId];
    }

    const idSemSeparador = rawId.replace(/[-_]/g, '');
    if (TENANTS_MAP[idSemSeparador]) {
        return TENANTS_MAP[idSemSeparador];
    }

    try {
        const filePath = path.join(__dirname, `${rawId}.js`);
        if (fs.existsSync(filePath)) {
            const tenantCarregado = require(filePath);
            TENANTS_MAP[rawId] = tenantCarregado;
            return tenantCarregado;
        }
    } catch (err) {}

    return defaultTenant;
}

module.exports = {
    carregarTenant,
    getTenant: carregarTenant,
    defaultTenant,
    TENANTS_MAP
};
