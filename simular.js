// =====================================================================
// simular.js — Simulador Interativo do WhatsApp Bot no Terminal
// ---------------------------------------------------------------------
// Permite conversar interativamente com o botEngine diretamente pelo
// terminal, testando menus, listagem de imóveis, agendamento de visitas, etc.
//
// Uso:
//   node simular.js
//   node simular.js corretor1
//   node simular.js sabordapraia
// =====================================================================

const path = require('path');
const readline = require('readline');

// Lê tenant da linha de comando ou do .env
const argClienteId = process.argv[2];
if (argClienteId) {
    process.env.CLIENTE_ID = argClienteId;
}

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { processarMensagem, getNiche } = require('./src/botEngine');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const TELEFONE_CLIENTE = '5511999999999@c.us';
const NOME_CLIENTE = 'Cliente Teste';

async function iniciar() {
    console.clear();
    const clienteId = process.env.CLIENTE_ID || 'corretor1';
    const niche = await getNiche();

    console.log('===============================================================');
    console.log(`🤖 SIMULADOR WHATSAPP BOT — MOTOR MULTI-NICHO`);
    console.log(`🏢 Tenant / Loja: \x1b[36m${clienteId}\x1b[0m`);
    console.log(`🏷️  Nicho Ativo:   \x1b[35m${niche || 'desconhecido'}\x1b[0m`);
    console.log('===============================================================');
    console.log('💡 Digite uma mensagem e pressione ENTER (Ex: "oi", "1", "menu")');
    console.log('💡 Digite "sair" para encerrar a simulação.\n');

    // Simula a primeira mensagem de boas-vindas
    await enviarAoBot('oi');

    promptUsuario();
}

async function enviarAoBot(texto) {
    await processarMensagem({
        from: TELEFONE_CLIENTE,
        nome: NOME_CLIENTE,
        texto,
        sendMessage: async (to, msg) => {
            console.log('\n\x1b[32m🤖 BOT:\x1b[0m\n' + msg + '\n');
        },
        sendTyping: async () => {},
        emitEvent: () => {}
    });
}

function promptUsuario() {
    rl.question('\x1b[33m👤 VOCÊ:\x1b[0m ', async (input) => {
        const texto = (input || '').trim();
        if (texto.toLowerCase() === 'sair' || texto.toLowerCase() === 'exit') {
            console.log('\n👋 Simulação finalizada. Até mais!\n');
            rl.close();
            process.exit(0);
        }

        if (texto) {
            await enviarAoBot(texto);
        }

        promptUsuario();
    });
}

iniciar().catch(err => {
    console.error('❌ Erro no simulador:', err);
    process.exit(1);
});
