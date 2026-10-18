// ================================================================
// launcher.js — Inicializador dinâmico de tenants via PM2
//
// Uso: node launcher.js  (ou npm run launch)
//
// 1. Consulta o Supabase por todos os clientes com status_conta = 'ativo'
// 2. Para cada cliente:
//    a. Verifica via 'pm2 jlist' se o processo já existe
//    b. Se existir → pm2 delete <name>  (limpa a instância anterior)
//    c. pm2 start index.js --name engine-<id> ...  (sempre fresh)
// 3. Exibe logs claros de progresso e resultado
// ================================================================

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const util             = require('util');
const { createClient } = require('@supabase/supabase-js');

// Promisifica a função exec para permitir arranques sequenciais (await)
const execPromise = util.promisify(require('child_process').exec);

// ── Configuração Supabase ────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
                  || process.env.NEXT_PUBLIC_SUPABASE_URL
                  || process.env.SUPABASE_URL_BASE;

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  || process.env.SUPABASE_KEY
                  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[LAUNCHER] ❌  Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_KEY) são obrigatórias no .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Porta base ───────────────────────────────────────────────────
const BASE_PORT = 3001;

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Executa um comando shell de forma sequencial (await).
 * Resolve com stdout, rejeita com o erro + stderr.
 */
async function run(cmd) {
    const { stdout } = await execPromise(cmd);
    return stdout.trim();
}

/**
 * Monta o comando PM2 para um dado cliente, juntamente com o environment
 * do processo filho.
 * O objeto `env` herda `process.env` (onde o .env já foi carregado no topo —
 * incluindo SUPABASE_URL / SUPABASE_SERVICE_KEY / etc.) e injeta as
 * variáveis específicas do tenant: NODE_ENV, PORT, CLIENTE_ID e a pasta de
 * sessão isolada.
 */
function buildPm2Command(cliente, porta) {
    const name      = `engine-${cliente.id}`;
    const authPath  = `./.wwebjs_auth_${cliente.id}`;

    // Comando enxuto: as variáveis de ambiente vão pelo objeto `env`
    // do execPromise (evita `--env` frágil / interpolação no shell).
    const cmd = [
        'pm2 start index.js',
        `--name "${name}"`,
        '--max-memory-restart 450M',
        '--log-date-format "YYYY-MM-DD HH:mm:ss"'
    ].join(' ');

    const env = {
        ...process.env,               // repassa todo o .env do launcher (inclui Supabase)
        NODE_ENV: 'production',
        PORT: porta,
        CLIENTE_ID: cliente.id,
        WWEBJS_AUTH_PATH: authPath
    };

    return { name, cmd, env };
}

/**
 * Retorna um Set com os nomes de todos os processos actuais no PM2.
 * Usa 'pm2 jlist' (saída JSON) para evitar parsing frágil de texto.
 * Se o PM2 não tiver nenhum processo, devolve um Set vazio.
 */
async function getRunningPm2Names() {
    try {
        const raw = await run('pm2 jlist');
        const list = JSON.parse(raw || '[]');
        return new Set(list.map(p => p.name));
    } catch {
        // PM2 pode retornar erro se a daemon não estiver ativa ainda — tudo bem
        return new Set();
    }
}

/**
 * Remove silenciosamente um processo do PM2 se ele já existir.
 * Ignora erros (processo pode não existir).
 */
async function deleteIfRunning(name, runningNames) {
    if (!runningNames.has(name)) return false; // não existia
    try {
        await run(`pm2 delete "${name}"`);
    } catch {
        // ignora — o delete pode falhar se o processo já morreu sozinho
    }
    return true; // existia e foi removido
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║        LAUNCHER — Engine WhatsApp Tenants        ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    // 1. Buscar tenants ativos
    console.log('[LAUNCHER] 🔍  Consultando clientes ativos no Supabase...');

    const { data: clientes, error } = await supabase
        .from('clientes')
        .select('id, nome, niche, status_conta')
        .eq('status_conta', 'ativo');

    if (error) {
        console.error('[LAUNCHER] ❌  Erro ao consultar o Supabase:', error.message);
        process.exit(1);
    }

    if (!clientes || clientes.length === 0) {
        console.warn('[LAUNCHER] ⚠️   Nenhum cliente ativo encontrado. Nenhuma engine foi iniciada.');
        process.exit(0);
    }

    console.log(`[LAUNCHER] ✅  ${clientes.length} cliente(s) ativo(s) encontrado(s):\n`);
    let idxLista = 0;
    for (const cliente of clientes) {
        const porta = BASE_PORT + idxLista;
        console.log(`   [${idxLista + 1}] ${cliente.id.padEnd(30)} nome: ${(cliente.nome || '—').padEnd(25)} porta: ${porta}`);
        idxLista++;
    }
    console.log('');

    // 2. Iniciar cada tenant via PM2 (com upsert: delete → start)
    //    ARRANQUE SEQUENCIAL: aguarda o PM2 confirmar cada processo antes do
    //    próximo e faz uma pausa, para não subir todos os navegadores
    //    (Puppeteer) em simultâneo — isso fazia as engines crasharem (stopped).
    let iniciados  = 0;
    let reiniciados = 0;
    let falhas     = 0;

    // Lê de uma vez todos os processos PM2 ativos (evita N chamadas)
    const runningNames = await getRunningPm2Names();
    console.log(`[LAUNCHER] 🔎  Processos PM2 ativos detectados: ${runningNames.size}\n`);

    let i = 0;
    for (const cliente of clientes) {
        const porta   = BASE_PORT + i;
        const { name, cmd, env } = buildPm2Command(cliente, porta);

        // Verifica e remove instância prévia
        const jaExistia = await deleteIfRunning(name, runningNames);
        const acao = jaExistia ? '♻️   Reiniciando' : '🚀  Iniciando';
        console.log(`[LAUNCHER] ${acao} "${cliente.id}" na porta ${porta}...`);

        try {
            // Aguarda o PM2 confirmar a criação do processo antes do próximo.
            // `env` injeta o .env completo (Supabase) + variáveis do tenant no
            // processo filho; `cwd` garante que index.js seja encontrado.
            const { stdout } = await execPromise(cmd, { cwd: __dirname, env });
            const output = (stdout || '').trim();
            console.log(`[LAUNCHER] ✅  ${name} → porta ${porta} — OK`);
            if (output) console.log(`             ↳ ${output}`);
            jaExistia ? reiniciados++ : iniciados++;
        } catch (err) {
            const detalhe = (err.stderr || err.message || '').toString().trim();
            console.error(`[LAUNCHER] ❌  ${name} → FALHA: ${detalhe}`);
            falhas++;
        }

        i++;

        // Pausa de 3s entre arranques (excepto depois do último)
        if (i < clientes.length) {
            console.log('[LAUNCHER] ⏳  Pausa de 3s antes do próximo arranque...\n');
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    // 3. Resumo final
    console.log('');
    console.log('──────────────────────────────────────────────────');
    console.log(`[LAUNCHER] 📊  Resumo:`);
    console.log(`             ✅  Novos iniciados : ${iniciados}`);
    console.log(`             ♻️   Reiniciados     : ${reiniciados}`);
    console.log(`             ❌  Falhas          : ${falhas}`);
    console.log('──────────────────────────────────────────────────');
    console.log('');

    if (falhas > 0) process.exit(1);
}

main().catch(err => {
    console.error('[LAUNCHER] 💥  Erro inesperado:', err.message);
    process.exit(1);
});
