const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { getMensagensNicho } = require('./niches');

// =====================================================================
// Diretório base da aplicação (compatível com pkg .exe e modo dev)
// =====================================================================
const APP_DIR = process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');

// =====================================================================
// Credenciais do Banco Multi-Tenant (delivery_platform)
// Definidas via variáveis de ambiente OU hardcoded aqui como fallback
// =====================================================================
// Preferência: chave de serviço (engine multi-tenant), com fallback para
// a publishable key usada nas instalações standalone (pkg / painel local).
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://errczksxtizgpmjzfhnv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_MmLNWGDwYO0fVxVUC8lCEA_pU113fNw';

// =====================================================================
// Identidade do tenant — resolvida na seguinte ordem:
//   1. process.env.CLIENTE_ID (PM2 / .env do ecosystem)  ← engines multi-tenant
//   2. config_delivery.json (instalações standalone / pkg)
// Nenhum dado de negócio é gravado em arquivo: o Supabase é a fonte.
// =====================================================================
const CONFIG_DELIVERY_PATH = path.join(APP_DIR, 'config_delivery.json');

let CLIENTE_ID    = '';
let NOME_CLIENTE  = 'Meu Delivery';
let NICHE_PADRAO  = 'delivery';

// Helper read-only para o config de identidade (não confundir com dados locais)
function fsReadFileJson(caminho) {
    try {
        const fs = require('fs');
        if (fs.existsSync(caminho)) return JSON.parse(fs.readFileSync(caminho, 'utf8'));
    } catch (e) {}
    return null;
}

// 1. Ambiente (PM2 / dotenv) — prioridade máxima
if (process.env.CLIENTE_ID) {
    CLIENTE_ID = String(process.env.CLIENTE_ID).trim().toLowerCase().replace(/\s+/g, '_');
}
if (process.env.NICHE) {
    NICHE_PADRAO = String(process.env.NICHE).trim().toLowerCase() || 'delivery';
}

// 2. config_delivery.json — fallback (quando não há CLIENTE_ID de ambiente)
try {
    const cfg = fsReadFileJson(CONFIG_DELIVERY_PATH);
    if (cfg) {
        if (!CLIENTE_ID && cfg.clienteId) {
            CLIENTE_ID = String(cfg.clienteId).trim().toLowerCase().replace(/\s+/g, '_');
        }
        if (cfg.nomeEstabelecimento) NOME_CLIENTE = String(cfg.nomeEstabelecimento).trim();
        if (cfg.niche)               NICHE_PADRAO = String(cfg.niche).trim().toLowerCase() || 'delivery';
    }
} catch (e) {
    console.warn('⚠️ Não foi possível ler config_delivery.json.');
}

// =====================================================================
// TRAVA DE SEGURANÇA — impede iniciar sem identidade de tenant definida.
// Sem isso, cada instalação esquecida criaria um registro junk na tabela
// `clientes` do banco compartilhado. Na engine o CLIENTE_ID vem do env
// do PM2 (.env / ecosystem.config.js); em instalações standalone vem do
// config_delivery.json.
// =====================================================================
const CONFIG_EXEMPLO = 'troque_este_campo';
if (!CLIENTE_ID || CLIENTE_ID === CONFIG_EXEMPLO) {
    console.error('\n' + '='.repeat(70));
    console.error(' ERRO: CLIENTE_ID não configurado.');
    console.error('='.repeat(70));
    console.error(' Modo Engine (PM2): defina "CLIENTE_ID" no .env ou no env');
    console.error('   de cada app do ecosystem.config.js.');
    console.error(' Modo Standalone: abra o arquivo "config_delivery.json" e');
    console.error('   preencha "clienteId" e "nomeEstabelecimento".');
    console.error('');
    console.error(' Exemplo: "climeditu2" / "Clínica Editu"');
    console.error('='.repeat(70) + '\n');
    process.exit(1);
}

// =====================================================================
// Seeds de provisionamento — usados SOMENTE ao criar um cliente NOVO
// no Supabase. Não são mais persistidos em arquivo local nem enviados
// para a nuvem depois da criação (não sobrescrevem atualizações SaaS).
// =====================================================================
const DEFAULT_CATEGORIAS = [
    { id: 'marmitex', nome: 'Marmitex do Dia (Almoço)',       icone: '🍱', turno: 'dia',    ordem: 1, ativo: true },
    { id: 'pizza',    nome: 'Pizzas Artesanais (Jantar & Noite)', icone: '🍕', turno: 'noite',  ordem: 2, ativo: true },
    { id: 'bebida',   nome: 'Bebidas & Extras',                icone: '🥤', turno: 'todos',  ordem: 3, ativo: true }
];

const DEFAULT_CARDAPIO = [
    {
        "id": 1,
        "categoria": "marmitex",
        "nome": "Marmitex P (Pequena)",
        "descricao": "Arroz branco, feijão caseiro, 1 opção de carne e guarnição do dia",
        "preco": 18,
        "turno": "dia",
        "icone": "🍱",
        "ativo": true
    },
    {
        "id": 2,
        "categoria": "marmitex",
        "nome": "Marmitex M (Média - Mais Vendida)",
        "descricao": "Arroz branco, feijão fresquinho, carne generosa, farofa e guarnições",
        "preco": 22,
        "turno": "dia",
        "icone": "🍱",
        "ativo": true
    },
    {
        "id": 3,
        "categoria": "marmitex",
        "nome": "Marmitex G (Grande)",
        "descricao": "Porção reforçada: Arroz, feijão, 2 carnes à sua escolha, salada e acompanhamentos",
        "preco": 26,
        "turno": "dia",
        "icone": "🍛",
        "ativo": true
    },
    {
        "id": 4,
        "categoria": "pizza",
        "nome": "ABOBRINHA Mussarela, abobrinha e parmesão",
        "descricao": "Família: R$ 87.90 | Grande: R$ 56.90 | Média: R$ 47.90",
        "preco": 87.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 5,
        "categoria": "pizza",
        "nome": "ALHO E ÓLEO Mussarela e alho frito",
        "descricao": "Família: R$ 83.90 | Grande: R$ 59.90 | Média: R$ 47.90",
        "preco": 83.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 6,
        "categoria": "pizza",
        "nome": "ALICE Mussarela e aliche",
        "descricao": "Família: R$ 110.90 | Grande: R$ 89.90 | Média: R$ 63.90",
        "preco": 110.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 7,
        "categoria": "pizza",
        "nome": "AMERICANA Mussarela, presunto, ervilha e palmito",
        "descricao": "Família: R$ 90.90 | Grande: R$ 59.90 | Média: R$ 50.90",
        "preco": 90.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 8,
        "categoria": "pizza",
        "nome": "ATUM Atum e cebola",
        "descricao": "Família: R$ 95.90 | Grande: R$ 74.90 | Média: R$ 49.90",
        "preco": 95.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 9,
        "categoria": "pizza",
        "nome": "BACON Mussarela, bacon, cebola e parmesão",
        "descricao": "Família: R$ 103.90 | Grande: R$ 77.90 | Média: R$ 57.90",
        "preco": 103.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 10,
        "categoria": "pizza",
        "nome": "BAIANA Calabresa moída, cebola e molho de pimenta",
        "descricao": "Família: R$ 83.90 | Grande: R$ 59.90 | Média: R$ 44.90",
        "preco": 83.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 11,
        "categoria": "pizza",
        "nome": "BATATA FRITA 1 Mussarela, batata frita, bacon e parmesão",
        "descricao": "Família: R$ 99.90 | Grande: R$ 77.90 | Média: R$ 55.90",
        "preco": 99.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 12,
        "categoria": "pizza",
        "nome": "BATATA FRITA 2 Mussarela, batata frita, bacon e catupiry",
        "descricao": "Família: R$ 99.90 | Grande: R$ 77.90 | Média: R$ 55.90",
        "preco": 99.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 13,
        "categoria": "pizza",
        "nome": "BATATA FRITA 3 Mussarela, batata frita, bacon e cheddar",
        "descricao": "Família: R$ 99.90 | Grande: R$ 77.90 | Média: R$ 55.90",
        "preco": 99.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 14,
        "categoria": "pizza",
        "nome": "BOM SABOR Mussarela, frango, milho, palmito e cheddar",
        "descricao": "Família: R$ 94.90 | Grande: R$ 73.90 | Média: R$ 48.90",
        "preco": 94.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 15,
        "categoria": "pizza",
        "nome": "BRÓCOLIS Mussarela, brócolis, catupiry, bacon e alho frito",
        "descricao": "Família: R$ 99.90 | Grande: R$ 77.90 | Média: R$ 53.90",
        "preco": 99.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 16,
        "categoria": "pizza",
        "nome": "CAIPIRA Mussarela, frango com catupiry e milho",
        "descricao": "Família: R$ 99.90 | Grande: R$ 77.90 | Média: R$ 53.90",
        "preco": 99.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 17,
        "categoria": "pizza",
        "nome": "CALABRESA Calabresa e cebola",
        "descricao": "Família: R$ 90.90 | Grande: R$ 59.90 | Média: R$ 42.90",
        "preco": 90.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 18,
        "categoria": "pizza",
        "nome": "CALABRESA ESPECIAL Calabresa, cebola e catupiry",
        "descricao": "Família: R$ 93.90 | Grande: R$ 62.90 | Média: R$ 43.90",
        "preco": 93.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 19,
        "categoria": "pizza",
        "nome": "CALZONE À MODA Mussarela, escarola, calabresa, milho, palmito, catupiry e parmesão",
        "descricao": "Família: R$ 110.00 | Grande: R$ 88.90 | Média: R$ 60.90",
        "preco": 110,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 20,
        "categoria": "pizza",
        "nome": "CREME DE FRANGO Mussarela, frango desfiado, catupiry e parmesão",
        "descricao": "Família: R$ 110.00 | Grande: R$ 88.90 | Média: R$ 59.90",
        "preco": 110,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 21,
        "categoria": "pizza",
        "nome": "CATUPIRY Mussarela e catupiry",
        "descricao": "Família: R$ 90.90 | Grande: R$ 59.90 | Média: R$ 45.90",
        "preco": 90.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 22,
        "categoria": "pizza",
        "nome": "CINCO QUEIJOS Mussarela, provolone, gorgonzola, catupiry e parmesão",
        "descricao": "Família: R$ 118.90 | Grande: R$ 93.90 | Média: R$ 67.90",
        "preco": 118.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 23,
        "categoria": "pizza",
        "nome": "CROCANTE Frango com catupiry, mussarela e batata palha",
        "descricao": "Família: R$ 90.90 | Grande: R$ 62.90 | Média: R$ 49.90",
        "preco": 90.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 24,
        "categoria": "pizza",
        "nome": "ESCAROLA Mussarela e escarola",
        "descricao": "Família: R$ 82.90 | Grande: R$ 59.90 | Média: R$ 42.90",
        "preco": 82.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 25,
        "categoria": "pizza",
        "nome": "ESCAROLA 2 Mussarela, escarola, aliche e parmesão",
        "descricao": "Família: R$ 110.90 | Grande: R$ 91.90 | Média: R$ 64.90",
        "preco": 110.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 26,
        "categoria": "pizza",
        "nome": "ESCAROLA 3 Mussarela, escarola, catupiry e bacon",
        "descricao": "Família: R$ 105.90 | Grande: R$ 89.90 | Média: R$ 59.90",
        "preco": 105.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 27,
        "categoria": "pizza",
        "nome": "FANÁTICOS Mussarela, champignon, bacon fatiado, pimentão fatiado e parmesão",
        "descricao": "Família: R$ 99.90 | Grande: R$ 69.90 | Média: R$ 52.90",
        "preco": 99.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 28,
        "categoria": "pizza",
        "nome": "FRANGO COM CATUPIRY Mussarela, frango e catupiry",
        "descricao": "Família: R$ 93.90 | Grande: R$ 63.90 | Média: R$ 49.90",
        "preco": 93.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 29,
        "categoria": "pizza",
        "nome": "FRANGO COM CHEDDAR Mussarela, frango e cheddar",
        "descricao": "Família: R$ 93.90 | Grande: R$ 63.90 | Média: R$ 49.90",
        "preco": 93.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 30,
        "categoria": "pizza",
        "nome": "GUARANÁ Presunto, mussarela, cebola, catupiry, tomate picado, champignon e azeitonas recheadas",
        "descricao": "Família: R$ 99.90 | Grande: R$ 73.90 | Média: R$ 60.90",
        "preco": 99.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 31,
        "categoria": "pizza",
        "nome": "LOMBO Mussarela, lombo e cebola",
        "descricao": "Família: R$ 91.90 | Grande: R$ 64.90 | Média: R$ 49.90",
        "preco": 91.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 32,
        "categoria": "pizza",
        "nome": "LOMBO ESPECIAL Mussarela, lombo, bacon, cebola e catupiry",
        "descricao": "Família: R$ 98.90 | Grande: R$ 71.90 | Média: R$ 54.90",
        "preco": 98.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 33,
        "categoria": "pizza",
        "nome": "MARGUERITA Mussarela e manjericão",
        "descricao": "Família: R$ 90.90 | Grande: R$ 62.90 | Média: R$ 42.90",
        "preco": 90.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 34,
        "categoria": "pizza",
        "nome": "MARGUERITA ESPECIAL Mussarela de búfala, manjericão e alho frito",
        "descricao": "Família: R$ 96.90 | Grande: R$ 80.90 | Média: R$ 54.90",
        "preco": 96.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 35,
        "categoria": "pizza",
        "nome": "MILHO Mussarela e milho",
        "descricao": "Família: R$ 85.90 | Grande: R$ 59.90 | Média: R$ 42.90",
        "preco": 85.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 36,
        "categoria": "pizza",
        "nome": "MILHO COM CATUPIRY Mussarela, milho e catupiry",
        "descricao": "Família: R$ 89.90 | Grande: R$ 62.90 | Média: R$ 47.90",
        "preco": 89.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 37,
        "categoria": "pizza",
        "nome": "MODA DA CASA Mussarela, escarola, cebola, catupiry, bacon e calabresa",
        "descricao": "Família: R$ 97.90 | Grande: R$ 64.90 | Média: R$ 51.90",
        "preco": 97.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 38,
        "categoria": "pizza",
        "nome": "MODA DA FAMÍLIA BOM SABOR Mussarela, frango picado e refogado, provolone, tomate e cebola",
        "descricao": "Família: R$ 115.90 | Grande: R$ 90.90 | Média: R$ 64.90",
        "preco": 115.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 39,
        "categoria": "pizza",
        "nome": "MODA DA GABY Mussarela, contra-filé refogado, provolone, tomate e cebola",
        "descricao": "Família: R$ 125.90 | Grande: R$ 99.90 | Média: R$ 69.90",
        "preco": 125.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 40,
        "categoria": "pizza",
        "nome": "MODA DO PIZZAIOLLO Mussarela, presunto, ovo, catupiry e bacon",
        "descricao": "Família: R$ 97.90 | Grande: R$ 64.90 | Média: R$ 50.90",
        "preco": 97.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 41,
        "categoria": "pizza",
        "nome": "MUSSARELA Mussarela e rodelas de tomate",
        "descricao": "Família: R$ 97.90 | Grande: R$ 61.90 | Média: R$ 43.90",
        "preco": 97.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 42,
        "categoria": "pizza",
        "nome": "MUSSARELA ESPECIAL Mussarela de búfala e tomate seco",
        "descricao": "Família: R$ 107.90 | Grande: R$ 83.90 | Média: R$ 58.90",
        "preco": 107.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 43,
        "categoria": "pizza",
        "nome": "NAPOLITANA Mussarela, rodelas de tomate e parmesão",
        "descricao": "Família: R$ 99.90 | Grande: R$ 65.90 | Média: R$ 46.90",
        "preco": 99.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 44,
        "categoria": "pizza",
        "nome": "PALMITO Mussarela e palmito",
        "descricao": "Família: R$ 92.90 | Grande: R$ 64.90 | Média: R$ 58.90",
        "preco": 92.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 45,
        "categoria": "pizza",
        "nome": "PALMITO COM CATUPIRY Mussarela, palmito e catupiry",
        "descricao": "Família: R$ 95.90 | Grande: R$ 66.90 | Média: R$ 59.90",
        "preco": 95.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 46,
        "categoria": "pizza",
        "nome": "PEITO DE PERU Mussarela, peito de peru e catupiry",
        "descricao": "Família: R$ 98.90 | Grande: R$ 84.90 | Média: R$ 55.90",
        "preco": 98.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 47,
        "categoria": "pizza",
        "nome": "PEPPERONI Mussarela e pepperoni",
        "descricao": "Família: R$ 113.90 | Grande: R$ 84.90 | Média: R$ 57.90",
        "preco": 113.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 48,
        "categoria": "pizza",
        "nome": "PORTUGUESA Mussarela, presunto, ovo, ervilha, palmito e cebola",
        "descricao": "Família: R$ 97.90 | Grande: R$ 66.90 | Média: R$ 50.90",
        "preco": 97.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 49,
        "categoria": "pizza",
        "nome": "PRESUNTO Mussarela, presunto e rodelas de tomate",
        "descricao": "Família: R$ 85.90 | Grande: R$ 59.90 | Média: R$ 44.90",
        "preco": 85.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 50,
        "categoria": "pizza",
        "nome": "PRESUNTO 2 Mussarela, presunto, tomate e catupiry",
        "descricao": "Família: R$ 93.90 | Grande: R$ 64.90 | Média: R$ 48.90",
        "preco": 93.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 51,
        "categoria": "pizza",
        "nome": "PROVOLONE Mussarela, provolone e rodelas de tomate",
        "descricao": "Família: R$ 113.90 | Grande: R$ 85.90 | Média: R$ 59.90",
        "preco": 113.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 52,
        "categoria": "pizza",
        "nome": "QUATRO QUEIJOS Mussarela, provolone, gorgonzola e catupiry",
        "descricao": "Família: R$ 115.90 | Grande: R$ 91.90 | Média: R$ 65.90",
        "preco": 115.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 53,
        "categoria": "pizza",
        "nome": "RÚCULA Mussarela de búfala, tomate seco e rúcula",
        "descricao": "Família: R$ 107.90 | Grande: R$ 86.90 | Média: R$ 58.90",
        "preco": 107.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 54,
        "categoria": "pizza",
        "nome": "SEIS QUEIJOS Mussarela, provolone, gorgonzola, parmesão, ricota e catupiry",
        "descricao": "Família: R$ 119.90 | Grande: R$ 96.90 | Média: R$ 67.90",
        "preco": 119.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 55,
        "categoria": "pizza",
        "nome": "SICILIANA Mussarela, champignon e bacon",
        "descricao": "Família: R$ 104.90 | Grande: R$ 79.90 | Média: R$ 55.90",
        "preco": 104.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 56,
        "categoria": "pizza",
        "nome": "STROGONOFF DE CARNE Mussarela, strogonoff de carne e batata palha",
        "descricao": "Família: R$ 118.90 | Grande: R$ 97.90 | Média: R$ 70.90",
        "preco": 118.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 57,
        "categoria": "pizza",
        "nome": "STROGONOFF DE FRANGO Mussarela, strogonoff de frango e batata palha",
        "descricao": "Família: R$ 106.90 | Grande: R$ 94.90 | Média: R$ 65.90",
        "preco": 106.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 58,
        "categoria": "pizza",
        "nome": "TOSCANA Mussarela, calabresa moída e cebola",
        "descricao": "Família: R$ 91.90 | Grande: R$ 59.90 | Média: R$ 43.90",
        "preco": 91.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 59,
        "categoria": "pizza",
        "nome": "TRÊS QUEIJOS Mussarela, provolone e catupiry",
        "descricao": "Família: R$ 110.90 | Grande: R$ 85.90 | Média: R$ 59.90",
        "preco": 110.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 60,
        "categoria": "pizza",
        "nome": "VEGETARIANA Mussarela, palmito, ervilha, brócolis e ovo",
        "descricao": "Família: R$ 93.90 | Grande: R$ 61.90 | Média: R$ 50.90",
        "preco": 93.9,
        "turno": "noite",
        "icone": "🍕",
        "ativo": true
    },
    {
        "id": 61,
        "categoria": "pizza",
        "nome": "BANANA Mussarela, banana, açúcar e canela e leite condensado",
        "descricao": "Família: R$ 90.90 | Grande: R$ 60.90 | Média: R$ 45.90",
        "preco": 90.9,
        "turno": "noite",
        "icone": "🍰",
        "ativo": true
    },
    {
        "id": 62,
        "categoria": "pizza",
        "nome": "BRIGADEIRO Pasta de chocolate e granulado",
        "descricao": "Família: R$ 103.90 | Grande: R$ 70.90 | Média: R$ 50.90",
        "preco": 103.9,
        "turno": "noite",
        "icone": "🍰",
        "ativo": true
    },
    {
        "id": 63,
        "categoria": "pizza",
        "nome": "ROMEU E JULIETA Mussarela e goiabada",
        "descricao": "Família: R$ 90.90 | Grande: R$ 60.90 | Média: R$ 45.90",
        "preco": 90.9,
        "turno": "noite",
        "icone": "🍰",
        "ativo": true
    },
    {
        "id": 64,
        "categoria": "pizza",
        "nome": "PRESTÍGIO Pasta de chocolate, granulado e coco ralado",
        "descricao": "Família: R$ 106.90 | Grande: R$ 71.90 | Média: R$ 55.90",
        "preco": 106.9,
        "turno": "noite",
        "icone": "🍰",
        "ativo": true
    },
    {
        "id": 65,
        "categoria": "bebida",
        "nome": "Coca-Cola",
        "descricao": "",
        "preco": 18,
        "turno": "todos",
        "icone": "🥤",
        "ativo": true
    },
    {
        "id": 66,
        "categoria": "bebida",
        "nome": "Fanta Laranja",
        "descricao": "",
        "preco": 16,
        "turno": "todos",
        "icone": "🥤",
        "ativo": true
    },
    {
        "id": 67,
        "categoria": "bebida",
        "nome": "Tubaina",
        "descricao": "",
        "preco": 12,
        "turno": "todos",
        "icone": "🥤",
        "ativo": true
    },
    {
        "id": 68,
        "categoria": "bebida",
        "nome": "Kuat",
        "descricao": "",
        "preco": 12,
        "turno": "todos",
        "icone": "🥤",
        "ativo": true
    }
];

const DEFAULT_OPCOES_CARNES = [
    { id: 1, nome: '🥩 Bife Bovino Acebolado',        ativo: true },
    { id: 2, nome: '🍗 Peito de Frango Grelhado',     ativo: true },
    { id: 3, nome: '🥓 Bisteca Suína na Brasa',       ativo: true },
    { id: 4, nome: '🧀 Filé de Frango à Parmegiana',  ativo: true },
    { id: 5, nome: '🐟 Filé de Peixe Empanado',       ativo: true },
    { id: 6, nome: '🍳 Omelete com Queijo e Tomate',  ativo: true }
];

const DEFAULT_OPCOES_BORDAS = [
    { id: 1, nome: 'Tradicional (Sem borda extra)',    preco: 0.00,  ativo: true },
    { id: 2, nome: 'Borda de Catupiry Original',       preco: 8.00,  ativo: true },
    { id: 3, nome: 'Borda de Cheddar Cremoso',         preco: 8.00,  ativo: true },
    { id: 4, nome: 'Borda de Chocolate ao Leite',      preco: 10.00, ativo: true }
];

const DEFAULT_CONFIG = {
    nomeRestaurante:    NOME_CLIENTE,
    nomeSalao:          NOME_CLIENTE,
    slogan:             '',
    numeroDono:         '',
    chavePix:           '',
    endereco:           '',
    taxaEntregaPadrao:  5.00,
    tempoEstimadoMin:   30,
    tempoEstimadoMax:   50,
    horarioAlmoco:      '11:00 às 15:00',
    horarioJantar:      '18:00 às 23:30',
    fechadoHoje:        false,
    motivoFechado:      'Descanso semanal da equipe',
    dataFechadaManual:  null,
    diasSemana: { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' },
    categorias:    DEFAULT_CATEGORIAS,
    cardapio:      DEFAULT_CARDAPIO,
    opcoesCarnes:  DEFAULT_OPCOES_CARNES,
    opcoesBordas:  DEFAULT_OPCOES_BORDAS,
    mensagens:     getMensagensNicho(NICHE_PADRAO)
};

// =====================================================================
// Cliente Supabase — única fonte de verdade do sistema
// =====================================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

// Cache em memória (NÃO há mais arquivo local: agendamentos.json removido)
let cacheLocal = {
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    pedidos: [],
    agendamentos: [],
    conversa: {},
    niche: NICHE_PADRAO
};

// =====================================================================
// "Persistência" LOCAL agora é apenas memória.
// carregarDados/salvarDados continuam exportados para compatibilidade
// com a API antiga, mas NÃO escrevem nada em disco.
// =====================================================================
function carregarDados() {
    return cacheLocal;
}

function salvarDados(data) {
    cacheLocal = data;
    if (!cacheLocal.pedidos && cacheLocal.agendamentos) cacheLocal.pedidos = cacheLocal.agendamentos;
    if (!cacheLocal.agendamentos && cacheLocal.pedidos) cacheLocal.agendamentos = cacheLocal.pedidos;
    return true;
}

// =====================================================================
// AUTO-PROVISIONAMENTO: cria o cliente no Supabase na 1ª execução.
// IMPORTANTE (multi-tenant): se o cliente JÁ EXISTE, nada é sobrescrito.
// O Supabase (painel SaaS) é a fonte de verdade para dados editados.
// =====================================================================
async function provisionarCliente() {
    try {
        const { data: existe } = await supabase
            .from('clientes')
            .select('id, nome')
            .eq('id', CLIENTE_ID)
            .single();

        if (existe) {
            console.log(`✅ [SUPABASE] Cliente "${CLIENTE_ID}" já cadastrado. Nada a alterar.`);
            return true;
        }

        // Não existe — cria o registro do cliente (auto-provisioning)
        const cfg = cacheLocal.config;
        const { error } = await supabase.from('clientes').insert({
            id:                 CLIENTE_ID,
            nome:               NOME_CLIENTE,
            telefone_dono:      cfg.numeroDono       || '',
            chave_pix:          cfg.chavePix         || '',
            endereco:           cfg.endereco         || '',
            taxa_entrega:       cfg.taxaEntregaPadrao || 5.00,
            tempo_estimado_min: cfg.tempoEstimadoMin  || 30,
            tempo_estimado_max: cfg.tempoEstimadoMax  || 50,
            horario_almoco:     cfg.horarioAlmoco    || '11:00 às 15:00',
            horario_jantar:     cfg.horarioJantar    || '18:00 às 23:30',
            fechado_hoje:       false,
            motivo_fechado:     '',
            ativo:              true,
            plano:              'basico',
            niche:              NICHE_PADRAO,
            created_at:         new Date().toISOString(),
            updated_at:         new Date().toISOString()
        });

        if (error) throw error;
        console.log(`🎉 [SUPABASE] Cliente "${CLIENTE_ID}" criado com sucesso no banco!`);

        // Provisiona cardápio/categorias/opções apenas para cliente NOVO
        await provisionarCardapioPadrao();
        await provisionarCategoriasPadrao();
        await provisionarOpcoesPadrao();

        return true;
    } catch (err) {
        console.error('⚠️ [SUPABASE] Erro no provisionamento do cliente:', err.message);
        return false;
    }
}

async function provisionarCardapioPadrao() {
    try {
        const rows = DEFAULT_CARDAPIO.map(item => ({
            cliente_id: CLIENTE_ID,
            item_id:    item.id,
            categoria:  item.categoria,
            nome:       item.nome,
            descricao:  item.descricao || '',
            preco:      item.preco,
            turno:      item.turno || 'todos',
            icone:      item.icone || '🍽️',
            ativo:      item.ativo !== false,
            ordem:      item.id
        }));
        await supabase.from('cardapio').upsert(rows, { onConflict: 'cliente_id,item_id' });
        console.log(`📋 [SUPABASE] Cardápio padrão criado para "${CLIENTE_ID}".`);
    } catch (err) {
        console.warn('⚠️ [SUPABASE] Cardápio padrão não provisionado:', err.message);
    }
}

async function provisionarCategoriasPadrao() {
    try {
        const rows = DEFAULT_CATEGORIAS.map(cat => ({
            cliente_id:  CLIENTE_ID,
            categoria_id: cat.id,
            nome:        cat.nome,
            icone:       cat.icone || '🍽️',
            turno:       cat.turno || 'todos',
            ordem:       cat.ordem || 0,
            ativo:       cat.ativo !== false
        }));
        await supabase.from('categorias').upsert(rows, { onConflict: 'cliente_id,categoria_id' });
    } catch (err) {
        console.warn('⚠️ [SUPABASE] Categorias não provisionadas:', err.message);
    }
}

async function provisionarOpcoesPadrao() {
    try {
        const carnes = DEFAULT_OPCOES_CARNES.map(o => ({
            cliente_id: CLIENTE_ID, tipo: 'carne', opcao_id: o.id, nome: o.nome, preco: 0, ativo: o.ativo !== false
        }));
        const bordas = DEFAULT_OPCOES_BORDAS.map(o => ({
            cliente_id: CLIENTE_ID, tipo: 'borda', opcao_id: o.id, nome: o.nome, preco: o.preco || 0, ativo: o.ativo !== false
        }));
        await supabase.from('opcoes_extras').upsert([...carnes, ...bordas], { onConflict: 'cliente_id,tipo,opcao_id' });
    } catch (err) {
        console.warn('⚠️ [SUPABASE] Opções extras não provisionadas:', err.message);
    }
}

// =====================================================================
// Leitura das mensagens do bot (CRUD relacional no Supabase):
//   1. Base = termos do nicho (src/niches.js)
//   2. Sobrescreve com as LINHAS da tabela mensagens_bot
//      (id, cliente_id, chave, conteudo) filtradas por cliente_id.
// Sem JSONs empacotados: cada mensagem é um registro individual.
// Se o cliente não tem mensagem customizada, usa o nicho.
// =====================================================================
async function carregarMensagensDoNicho(niche) {
    const mensagens = { ...getMensagensNicho(niche) };

    try {
        const { data: rowsMen } = await supabase
            .from('mensagens_bot')
            .select('chave, conteudo')
            .eq('cliente_id', CLIENTE_ID);

        (rowsMen || []).forEach(m => {
            // Só sobrescreve com conteúdo real — linha vazia = mantém o padrão do nicho
            if (m && m.chave && m.conteudo) mensagens[m.chave] = m.conteudo;
        });
    } catch (e) { /* tabela pode não existir em bancos antigos */ }

    return mensagens;
}

// =====================================================================
// SINCRONIZAÇÃO: Supabase → cache (roda na inicialização e a cada 20s)
// FLUXO 100% READ-ONLY no boot: nada do cache local é enviado de volta
// para o banco aqui. Assim o boot NUNCA sobrescreve nem limpa registros
// atualizados no Supabase (cardápio, categoria, opções, mensagens).
// Escreve apenas o que é exclusivamente local (pedidos pendentes) e
// nunca apaga o que veio da nuvem.
// =====================================================================
async function sincronizarComSupabase() {
    try {
        // 1. Dados do cliente (fonte de verdade) + nicho + mensagens
        const { data: clienteData } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', CLIENTE_ID)
            .single();

        if (clienteData) {
            cacheLocal.config.nomeRestaurante  = clienteData.nome               || cacheLocal.config.nomeRestaurante;
            cacheLocal.config.nomeSalao        = cacheLocal.config.nomeRestaurante;
            cacheLocal.config.numeroDono       = clienteData.telefone_dono      || cacheLocal.config.numeroDono;
            cacheLocal.config.chavePix         = clienteData.chave_pix          || cacheLocal.config.chavePix;
            cacheLocal.config.endereco         = clienteData.endereco           || cacheLocal.config.endereco;
            cacheLocal.config.taxaEntregaPadrao = Number(clienteData.taxa_entrega) || cacheLocal.config.taxaEntregaPadrao;
            cacheLocal.config.tempoEstimadoMin  = clienteData.tempo_estimado_min  || cacheLocal.config.tempoEstimadoMin;
            cacheLocal.config.tempoEstimadoMax  = clienteData.tempo_estimado_max  || cacheLocal.config.tempoEstimadoMax;
            cacheLocal.config.horarioAlmoco     = clienteData.horario_almoco    || cacheLocal.config.horarioAlmoco;
            cacheLocal.config.horarioJantar     = clienteData.horario_jantar    || cacheLocal.config.horarioJantar;
            cacheLocal.config.fechadoHoje       = clienteData.fechado_hoje !== undefined ? clienteData.fechado_hoje : cacheLocal.config.fechadoHoje;
            cacheLocal.config.motivoFechado     = clienteData.motivo_fechado    || cacheLocal.config.motivoFechado;

            const niche = (clienteData.niche || cacheLocal.niche || NICHE_PADRAO);
            if (niche !== cacheLocal.niche) {
                cacheLocal.niche = niche;
                console.log(`[NICHE] Cliente "${CLIENTE_ID}" → nicho "${niche}".`);
            }
            // Compatibilidade com db.getNiche() do Motor Único
            cacheLocal.config.niche = niche;

            cacheLocal.config.mensagens = await carregarMensagensDoNicho(niche);
        }

        // 2. Cardápio do Supabase (nuvem manda; NÃO envia local de volta)
        const { data: cardapioData } = await supabase
            .from('cardapio')
            .select('*')
            .eq('cliente_id', CLIENTE_ID)
            .order('ordem', { ascending: true });

        if (cardapioData && cardapioData.length > 0) {
            cacheLocal.config.cardapio = cardapioData.map(r => ({
                id:        r.item_id,
                categoria: r.categoria,
                nome:      r.nome,
                descricao: r.descricao || '',
                preco:     Number(r.preco),
                turno:     r.turno || 'todos',
                icone:     r.icone || '🍽️',
                ativo:     r.ativo !== false
            }));
        } else if (!Array.isArray(cacheLocal.config.cardapio) || cacheLocal.config.cardapio.length === 0) {
            // Offline puro: usa os seeds em memória só para funcionar.
            cacheLocal.config.cardapio = DEFAULT_CARDAPIO;
        }

        // 3. Categorias do Supabase
        const { data: categoriasData } = await supabase
            .from('categorias')
            .select('*')
            .eq('cliente_id', CLIENTE_ID)
            .order('ordem', { ascending: true });

        if (categoriasData && categoriasData.length > 0) {
            cacheLocal.config.categorias = categoriasData.map(r => ({
                id:    r.categoria_id,
                nome:  r.nome,
                icone: r.icone || '🍽️',
                turno: r.turno || 'todos',
                ordem: r.ordem || 0,
                ativo: r.ativo !== false
            }));
        } else if (!Array.isArray(cacheLocal.config.categorias) || cacheLocal.config.categorias.length === 0) {
            cacheLocal.config.categorias = DEFAULT_CATEGORIAS;
        }

        // 4. Opções extras (carnes e bordas)
        const { data: opcoesData } = await supabase
            .from('opcoes_extras')
            .select('*')
            .eq('cliente_id', CLIENTE_ID);

        if (opcoesData && opcoesData.length > 0) {
            const carnes = opcoesData.filter(o => o.tipo === 'carne').map(o => ({ id: o.opcao_id, nome: o.nome, ativo: o.ativo }));
            const bordas = opcoesData.filter(o => o.tipo === 'borda').map(o => ({ id: o.opcao_id, nome: o.nome, preco: Number(o.preco), ativo: o.ativo }));
            if (carnes.length > 0) cacheLocal.config.opcoesCarnes = carnes;
            if (bordas.length > 0) cacheLocal.config.opcoesBordas = bordas;
        }

        // 5. Pedidos do Supabase (nuvem manda; mantém só os locais pendentes)
        const { data: pedData } = await supabase
            .from('pedidos')
            .select('*')
            .eq('cliente_id', CLIENTE_ID)
            .order('criado_em', { ascending: false })
            .limit(500);

        if (pedData && pedData.length > 0) {
            const mapped = pedData.map(p => ({
                id:              p.id,
                codigo:          p.codigo,
                cliente:         p.nome_cliente,
                telefone:        p.telefone,
                data:            p.data,
                horario:         p.horario,
                itens:           Array.isArray(p.itens) ? p.itens : [],
                servico:         p.servico || '',
                subtotal:        Number(p.subtotal) || 0,
                taxaEntrega:     Number(p.taxa_entrega) || 0,
                total:           Number(p.total) || 0,
                preco:           Number(p.total) || 0,
                tipoEntrega:     p.tipo_entrega || 'delivery',
                enderecoEntrega: p.endereco_entrega || '',
                bairro:          p.bairro || '',
                formaPagamento:  p.forma_pagamento || 'PIX',
                trocoPara:       p.troco_para ? Number(p.troco_para) : null,
                observacoes:     p.observacoes || '',
                status:          p.status || 'pendente',
                origem:          p.origem || 'whatsapp',
                tempoEstimado:   '',
                criadoEm:        p.criado_em,
                canceladoEm:     p.cancelado_em,
                concluidoEm:     p.concluido_em
            }));

            // Preserva apenas pedidos ainda não enviados à nuvem (offline)
            const idsNuvem = new Set(mapped.map(m => m.id));
            const apenasLocais = (cacheLocal.pedidos || []).filter(p => !idsNuvem.has(p.id));
            cacheLocal.pedidos      = [...mapped, ...apenasLocais];
            cacheLocal.agendamentos = cacheLocal.pedidos;
        }

        return true;
    } catch (err) {
        console.warn('⚠️ [SUPABASE] Erro na sincronização:', err.message);
        return false;
    }
}

// =====================================================================
// INICIALIZAÇÃO (chamada pelo server.js)
// =====================================================================
async function inicializarDatabase() {
    console.log(`\n🔌 [DELIVERY PLATFORM] Iniciando para o cliente: "${CLIENTE_ID}"`);
    console.log(`🏪 Estabelecimento: ${NOME_CLIENTE}`);
    console.log(`🌐 Banco: ${SUPABASE_URL}\n`);

    // 1ª passada: provisiona o cliente se ainda não existe no banco
    const provisionado = await provisionarCliente();

    // Sincroniza dados do Supabase → cache (read-only no boot)
    if (provisionado) {
        const ok = await sincronizarComSupabase();
        if (ok) {
            console.log(`✅ [NUVEM] Dados sincronizados com sucesso para "${CLIENTE_ID}"!`);
        } else {
            console.log(`ℹ️ [OFFLINE] Operando 100% em memória até a conexão voltar.`);
        }
    }

    // Sincroniza a cada 20 segundos
    setInterval(() => {
        sincronizarComSupabase().catch(() => {});
    }, 20000);
}

// =====================================================================
// Helpers de data / turno
// =====================================================================
function formatarDataLocal(d = new Date()) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function isFechadoHoje(dados = null) {
    if (!dados) dados = cacheLocal;
    const config  = dados.config || {};
    const hojeStr = formatarDataLocal(new Date());
    if (config.fechadoHoje === true) {
        if (!config.dataFechadaManual || config.dataFechadaManual === hojeStr) return true;
    }
    return false;
}

// Turno de comida é exclusivo do nicho delivery.
// Para nichos fora de delivery (agendamento: barbershop, clinic, petshop,
// salon) retorna null — o botEngine suprime totalmente a linha de turno.
function getTurnoAtual(niche) {
    if (niche && niche !== 'delivery') return null;

    const agora   = new Date();
    const minutos = agora.getHours() * 60 + agora.getMinutes();
    if (minutos >= 630 && minutos <= 930)  return { tipo: 'dia',   nome: 'Almoço (Marmitex)',   icone: '🍱', descricao: 'Marmitex fresquinhos saindo quentinhos do fogão!' };
    if (minutos >= 1050 || minutos <= 60)  return { tipo: 'noite', nome: 'Jantar & Pizzaria',    icone: '🍕', descricao: 'Pizzas artesanais quentinhas assadas no capricho!' };
    return { tipo: 'geral', nome: cacheLocal.config.nomeRestaurante || NOME_CLIENTE, icone: '🍽️', descricao: 'Almoço (Marmitex 11h às 15h) e Noite (Pizzas 18h às 23h30)' };
}

// Horário "normal" para nichos de agendamento (barbershop, clinic, petshop,
// salon). Exibe somente o que o tenant REALMENTE configurou — os valores
// padrão de delivery ('11:00 às 15:00' / '18:00 às 23:30') são ignorados,
// para não vazar horário de restaurante num menu de clínica/barbearia.
function getHorarioNormal() {
    const cfg = cacheLocal.config || {};
    const hAberto  = String(cfg.horarioAlmoco || '').trim();
    const hFecha   = String(cfg.horarioJantar || '').trim();
    const DEFAULT_ALMOCO = '11:00 às 15:00';
    const DEFAULT_JANTAR = '18:00 às 23:30';

    const partes = [];
    if (hAberto && hAberto !== DEFAULT_ALMOCO) partes.push(hAberto);
    if (hFecha && hFecha !== DEFAULT_JANTAR && hFecha !== hAberto) partes.push(hFecha);
    return partes.join(' / ');
}

// =====================================================================
// Cardápio & Categorias
// =====================================================================
function getCategorias(apenasAtivas = true) {
    let cats = cacheLocal.config.categorias || DEFAULT_CATEGORIAS;
    if (apenasAtivas) cats = cats.filter(c => c.ativo !== false);
    return cats.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}

function getCardapio(filtro = {}) {
    let cardapio = cacheLocal.config.cardapio || DEFAULT_CARDAPIO;
    if (filtro.categoria)                            cardapio = cardapio.filter(i => i.categoria === filtro.categoria);
    if (filtro.turno && filtro.turno !== 'todos')    cardapio = cardapio.filter(i => i.turno === filtro.turno || i.turno === 'todos');
    if (filtro.apenasAtivos !== false)               cardapio = cardapio.filter(i => i.ativo !== false);
    return cardapio;
}

// =====================================================================
// CRIAR PEDIDO
// =====================================================================
function criarPedido({
    cliente, telefone, itens = [], tipoEntrega = 'delivery',
    enderecoEntrega = '', bairro = '', formaPagamento = 'PIX',
    trocoPara = null, taxaEntrega = 0, observacoes = '', origem = 'whatsapp'
}) {
    const dados   = cacheLocal;
    const agora   = new Date();
    const dataStr = formatarDataLocal(agora);
    const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (isFechadoHoje(dados)) {
        return { success: false, error: `O restaurante está fechado no momento (${dados.config.motivoFechado || 'Atendimento pausado'}).`, codigo: 'RESTAURANTE_FECHADO' };
    }

    let subtotal = 0;
    const itensProcessados = itens.map((item, idx) => {
        const preco     = Number(item.preco) || 0;
        const qtd       = Number(item.qtd) || 1;
        const totalItem = preco * qtd;
        subtotal += totalItem;
        return { id: item.id || (idx + 1), nome: item.nome, qtd, preco, total: totalItem, observacao: item.observacao || '', opcoesCarne: item.opcoesCarne || null, borda: item.borda || null };
    });

    const taxa  = (tipoEntrega === 'delivery') ? (Number(taxaEntrega) || Number(dados.config.taxaEntregaPadrao) || 5.00) : 0;
    const total = subtotal + taxa;

    const numAleatorio     = Math.floor(1000 + Math.random() * 9000);
    const idGerado         = 'ped_' + Date.now() + '_' + numAleatorio;
    const codigoExibicao   = `#PED-${numAleatorio}`;
    const resumoItensTexto = itensProcessados.map(i => `${i.qtd}x ${i.nome}`).join(' + ');

    const novoPedido = {
        id: idGerado, codigo: codigoExibicao,
        cliente: cliente || 'Cliente WhatsApp', telefone,
        data: dataStr, horario: horaStr,
        itens: itensProcessados,
        servico: resumoItensTexto || 'Pedido',
        subtotal, taxaEntrega: taxa, total, preco: total,
        tipoEntrega, enderecoEntrega: enderecoEntrega || '', bairro: bairro || '',
        formaPagamento, trocoPara: trocoPara ? Number(trocoPara) : null,
        observacoes: observacoes || '', status: 'pendente', origem,
        tempoEstimado: `${dados.config.tempoEstimadoMin || 35} a ${dados.config.tempoEstimadoMax || 50} min`,
        criadoEm: agora.toISOString(), canceladoEm: null, concluidoEm: null
    };

    dados.pedidos.unshift(novoPedido);
    dados.agendamentos = dados.pedidos;
    if (dados.conversa && dados.conversa[telefone]) delete dados.conversa[telefone];
    salvarDados(dados);

    // Persiste no Supabase em segundo plano
    (async () => {
        try {
            await supabase.from('pedidos').insert({
                id:               novoPedido.id,
                cliente_id:       CLIENTE_ID,
                codigo:           novoPedido.codigo,
                nome_cliente:     novoPedido.cliente,
                telefone:         novoPedido.telefone,
                data:             novoPedido.data,
                horario:          novoPedido.horario,
                itens:            novoPedido.itens,
                servico:          novoPedido.servico,
                subtotal:         novoPedido.subtotal,
                taxa_entrega:     novoPedido.taxaEntrega,
                total:            novoPedido.total,
                tipo_entrega:     novoPedido.tipoEntrega,
                endereco_entrega: novoPedido.enderecoEntrega,
                bairro:           novoPedido.bairro,
                forma_pagamento:  novoPedido.formaPagamento,
                troco_para:       novoPedido.trocoPara,
                observacoes:      novoPedido.observacoes,
                status:           novoPedido.status,
                origem:           novoPedido.origem,
                criado_em:        novoPedido.criadoEm
            });
        } catch (err) {}
    })();

    return { success: true, pedido: novoPedido, agendamento: novoPedido };
}

// =====================================================================
// ATUALIZAR STATUS DO PEDIDO
// =====================================================================
function atualizarStatusPedido(id, novoStatus) {
    const dados  = cacheLocal;
    const pedido = dados.pedidos.find(p => p.id === id || p.codigo === id);
    if (!pedido) return { success: false, error: 'Pedido não encontrado.' };

    const agora     = new Date().toISOString();
    pedido.status   = novoStatus;
    if (novoStatus === 'concluido') pedido.concluidoEm = agora;
    if (novoStatus === 'cancelado') pedido.canceladoEm = agora;
    salvarDados(dados);

    (async () => {
        try {
            await supabase
                .from('pedidos')
                .update({
                    status:       novoStatus,
                    concluido_em: novoStatus === 'concluido' ? agora : null,
                    cancelado_em: novoStatus === 'cancelado' ? agora : null
                })
                .eq('id', pedido.id)
                .eq('cliente_id', CLIENTE_ID);
        } catch (err) {}
    })();

    return { success: true, pedido, agendamento: pedido };
}

function cancelarPedido(id, telefoneSolicitante = null) {
    const dados  = cacheLocal;
    const pedido = dados.pedidos.find(p =>
        (p.id === id || p.codigo === id) &&
        (!telefoneSolicitante || p.telefone === telefoneSolicitante)
    );
    if (!pedido) return { success: false, error: 'Pedido não encontrado ou não pertence a este número.' };
    if (pedido.status === 'concluido' || pedido.status === 'saiu_entrega') {
        return { success: false, error: 'Este pedido já saiu para entrega ou foi concluído e não pode ser cancelado automaticamente.' };
    }
    return atualizarStatusPedido(pedido.id, 'cancelado');
}

// =====================================================================
// BUSCA DE PEDIDOS
// =====================================================================
function getPedidosCliente(telefone) {
    return cacheLocal.pedidos.filter(p =>
        p.telefone === telefone && p.status !== 'cancelado' && p.status !== 'concluido'
    );
}

function getTodosPedidos(filtro = {}) {
    let lista = [...(cacheLocal.pedidos || [])];
    if (filtro.data)   lista = lista.filter(p => p.data === filtro.data);
    if (filtro.status) lista = lista.filter(p => p.status === filtro.status);
    if (filtro.busca) {
        const b = filtro.busca.toLowerCase();
        lista = lista.filter(p =>
            (p.cliente  && p.cliente.toLowerCase().includes(b)) ||
            (p.telefone && p.telefone.includes(b)) ||
            (p.codigo   && p.codigo.toLowerCase().includes(b)) ||
            (p.servico  && p.servico.toLowerCase().includes(b))
        );
    }
    return lista.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
}

// =====================================================================
// ESTATÍSTICAS
// =====================================================================
function getEstatisticas() {
    const dados         = cacheLocal;
    const hoje          = formatarDataLocal(new Date());
    const pedidosHoje   = dados.pedidos.filter(p => p.data === hoje && p.status !== 'cancelado');
    const pendentes     = pedidosHoje.filter(p => p.status === 'pendente' || p.status === 'em_preparo');
    const concluidos    = pedidosHoje.filter(p => p.status === 'concluido');
    const faturamento   = pedidosHoje.reduce((acc, curr) => acc + (curr.total || curr.preco || 0), 0);
    const totalGeral    = dados.pedidos.filter(p => p.status !== 'cancelado').length;

    return {
        pedidosHoje:        pedidosHoje.length,
        pedidosPendentes:   pendentes.length,
        pedidosConcluidos:  concluidos.length,
        faturamentoHoje:    faturamento,
        totalGeral,
        totalConfirmados:   pedidosHoje.length,
        totalConcluidos:    concluidos.length,
        faturamentoEstimado: faturamento,
        agendamentosHoje:   pedidosHoje.length
    };
}

// =====================================================================
// ESTADO DE CONVERSA (chatbot)
// =====================================================================
function getEstadoConversa(telefone) {
    return (cacheLocal.conversa && cacheLocal.conversa[telefone]) || { status: 'idle' };
}

function setEstadoConversa(telefone, estado) {
    if (!cacheLocal.conversa) cacheLocal.conversa = {};
    cacheLocal.conversa[telefone] = { ...estado, atualizadoEm: Date.now() };
    salvarDados(cacheLocal);

    (async () => {
        try {
            await supabase.from('conversas').upsert({
                cliente_id:   CLIENTE_ID,
                telefone,
                estado:       cacheLocal.conversa[telefone],
                atualizado_em: new Date().toISOString()
            });
        } catch (e) {}
    })();
}

function limparEstadoConversa(telefone) {
    if (cacheLocal.conversa && cacheLocal.conversa[telefone]) {
        delete cacheLocal.conversa[telefone];
        salvarDados(cacheLocal);
    }

    (async () => {
        try {
            await supabase
                .from('conversas')
                .delete()
                .eq('cliente_id', CLIENTE_ID)
                .eq('telefone', telefone);
        } catch (e) {}
    })();
}

// =====================================================================
// CONFIGURAÇÕES (getters e setters)
// =====================================================================
function getConfig() {
    // Garante que mensagens sempre existam (termos do nicho) mesmo
    // antes da primeira sincronização com o Supabase.
    if (!cacheLocal.config.mensagens || Object.keys(cacheLocal.config.mensagens).length === 0) {
        cacheLocal.config.mensagens = getMensagensNicho(cacheLocal.niche || NICHE_PADRAO);
    }
    return cacheLocal.config;
}

// Retorna o nicho do tenant (lido do Supabase em tempo de execução)
function getNiche() {
    return cacheLocal.niche || cacheLocal.config.niche || NICHE_PADRAO;
}

function salvarConfig(novaConfig) {
    cacheLocal.config = { ...cacheLocal.config, ...novaConfig };
    if (novaConfig.nomeRestaurante) cacheLocal.config.nomeSalao = novaConfig.nomeRestaurante;
    salvarDados(cacheLocal);

    const cfg = cacheLocal.config;

    // Persiste dados do cliente na tabela `clientes` (ação explícita do painel)
    (async () => {
        try {
            await supabase.from('clientes').upsert({
                id:                 CLIENTE_ID,
                nome:               cfg.nomeRestaurante || cfg.nomeSalao,
                telefone_dono:      cfg.numeroDono       || '',
                chave_pix:          cfg.chavePix         || '',
                endereco:           cfg.endereco         || '',
                taxa_entrega:       cfg.taxaEntregaPadrao || 5.00,
                tempo_estimado_min: cfg.tempoEstimadoMin  || 30,
                tempo_estimado_max: cfg.tempoEstimadoMax  || 50,
                horario_almoco:     cfg.horarioAlmoco    || '11:00 às 15:00',
                horario_jantar:     cfg.horarioJantar    || '18:00 às 23:30',
                fechado_hoje:       Boolean(cfg.fechadoHoje),
                motivo_fechado:     cfg.motivoFechado    || '',
                data_fechada_manual: cfg.dataFechadaManual || null,
                updated_at:         new Date().toISOString()
            });
        } catch (err) {}
    })();

    // Persiste cardápio atualizado
    if (novaConfig.cardapio) {
        (async () => {
            try {
                const rows = (novaConfig.cardapio || []).map(item => ({
                    cliente_id: CLIENTE_ID, item_id: item.id, categoria: item.categoria,
                    nome: item.nome, descricao: item.descricao || '', preco: item.preco,
                    turno: item.turno || 'todos', icone: item.icone || '🍽️',
                    ativo: item.ativo !== false, ordem: item.id, updated_at: new Date().toISOString()
                }));
                await supabase.from('cardapio').upsert(rows, { onConflict: 'cliente_id,item_id' });
            } catch (err) {}
        })();
    }

    // Persiste categorias atualizadas
    if (novaConfig.categorias) {
        (async () => {
            try {
                const rows = (novaConfig.categorias || []).map(cat => ({
                    cliente_id: CLIENTE_ID, categoria_id: cat.id, nome: cat.nome,
                    icone: cat.icone || '🍽️', turno: cat.turno || 'todos',
                    ordem: cat.ordem || 0, ativo: cat.ativo !== false
                }));
                await supabase.from('categorias').upsert(rows, { onConflict: 'cliente_id,categoria_id' });
            } catch (err) {}
        })();
    }

    // Persiste mensagens do bot na tabela mensagens_bot (padrão do painel SaaS)
    if (novaConfig.mensagens) {
        (async () => {
            try {
                const rows = Object.entries(novaConfig.mensagens || {}).map(([chave, conteudo]) => ({
                    cliente_id: CLIENTE_ID,
                    chave,
                    conteudo: conteudo || '',
                    updated_at: new Date().toISOString()
                }));
                if (rows.length > 0) {
                    await supabase.from('mensagens_bot').upsert(rows, { onConflict: 'cliente_id,chave' });
                }
            } catch (err) {}
        })();
    }

    return cacheLocal.config;
}

// =====================================================================
// Aliases de compatibilidade (mantém API existente inalterada)
// =====================================================================
const criarAgendamento = (params) => criarPedido({
    cliente: params.cliente, telefone: params.telefone,
    itens: [{ nome: params.servico || 'Refeição / Pedido', preco: params.preco || 25, qtd: 1 }],
    tipoEntrega: 'delivery', formaPagamento: 'PIX', origem: params.origem || 'manual'
});
const cancelarAgendamento  = (id, tel)  => cancelarPedido(id, tel);
const concluirAgendamento  = (id)       => atualizarStatusPedido(id, 'concluido');
const getAgendamentosCliente = (tel)    => getPedidosCliente(tel);
const getTodosAgendamentos = (filtro)   => getTodosPedidos(filtro);
const getHorariosDisponiveis    = () => ['11:00', '12:00', '13:00', '14:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
const getProximosDiasDisponiveis = () => [];

module.exports = {
    inicializarDatabase,
    sincronizarComSupabase,
    carregarDados,
    salvarDados,
    formatarDataLocal,
    isFechadoHoje,
    getTurnoAtual,
    getHorarioNormal,
    getCategorias,
    getCardapio,
    criarPedido,
    atualizarStatusPedido,
    cancelarPedido,
    getPedidosCliente,
    getTodosPedidos,
    getEstatisticas,
    getEstadoConversa,
    setEstadoConversa,
    limparEstadoConversa,
    getConfig,
    getNiche,
    salvarConfig,
    criarAgendamento,
    cancelarAgendamento,
    concluirAgendamento,
    getAgendamentosCliente,
    getTodosAgendamentos,
    getHorariosDisponiveis,
    getProximosDiasDisponiveis
};