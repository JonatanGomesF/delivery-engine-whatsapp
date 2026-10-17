// =====================================================================
// src/tenants/barbearia_estilo.js — Componente de Tenant: Barbearia Estilo
// ---------------------------------------------------------------------
// Módulo isolado exclusivo para o CLIENTE_ID 'barbearia_estilo'.
// Focado no nicho de barbearia (agendamento de horários, corte, barba).
// =====================================================================

const MENU_PRINCIPAL_TEMPLATE = 
`💈 *BEM-VINDO À BARBEARIA ESTILO* 💈
_O seu visual no mais alto padrão!_

Olá, *{nome}*! Como podemos cuidar do seu estilo hoje?

1️⃣ 📅 *Agendar Atendimento (Escolher Serviço & Horário)*
2️⃣ ✂️ *Ver Serviços & Tabela de Preços*
3️⃣ ⏰ *Horários de Funcionamento & Localização*
4️⃣ 📋 *Meus Agendamentos (Consultar Status)*
5️⃣ ❌ *Cancelar Agendamento*
6️⃣ 👤 *Falar com um Barbeiro / Atendimento*

👉 _Digite o número da opção desejada (Ex: 1):_`;

function getMenuPrincipal({ nomeCliente, config, db, formatarTexto, avisoFechado = '' }) {
    let aviso = avisoFechado;
    if (!aviso && db && db.isFechadoHoje && db.isFechadoHoje()) {
        const motivo = config?.motivoFechado || 'Dia de descanso da equipe';
        aviso = `🛑 *AVISO:* A barbearia está fechada hoje (${motivo}).\n\n`;
    }

    const templateFinal = aviso ? `${aviso}${MENU_PRINCIPAL_TEMPLATE}` : MENU_PRINCIPAL_TEMPLATE;

    if (typeof formatarTexto === 'function') {
        return formatarTexto(templateFinal, {
            nome: nomeCliente || 'Cliente',
            restaurante: 'BARBEARIA ESTILO'
        });
    }

    return templateFinal.replace('{nome}', nomeCliente || 'Cliente');
}

function obterTabelaServicos() {
    return (
        `💈 *TABELA DE SERVIÇOS & VALORES — BARBEARIA ESTILO* 💈\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✂️ *CORTES:*\n` +
        `• *Corte de Cabelo Tradicional* — R$ 35,00\n  _Finalizado com navalha e pomada premium_\n` +
        `• *Corte Degradê / Fade* — R$ 40,00\n  _Degradê navalhado, acabamento impecável_\n` +
        `• *Corte + Sobrancelha* — R$ 45,00\n  _Alinhamento completo do visual_\n\n` +
        `🪒 *BARBAS:*\n` +
        `• *Barba Completa (Terapia de Toalha Quente)* — R$ 25,00\n  _Modelagem com navalha e hidratação de barba_\n` +
        `• *Barba Simples (Aparação & Contorno)* — R$ 15,00\n\n` +
        `🔥 *COMBOS VIP (Mais Pedidos):*\n` +
        `• *Combo Corte + Barba* — R$ 55,00\n  _O clássico completo para renovar o visual_\n` +
        `• *Combo Completo Estilo* — R$ 70,00\n  _Corte + Barba + Sobrancelha + Hidratação_\n\n` +
        `✨ *ESTÉTICA & TRATAMENTOS:*\n` +
        `• *Design de Sobrancelha* — R$ 15,00\n` +
        `• *Hidratação Capilar & Massagem* — R$ 40,00\n` +
        `• *Pigmentação de Barba ou Cabelo* — R$ 80,00\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👉 _Envie *1* para agendar seu horário agora mesmo!_`
    );
}

function obterInfoBarbearia(config = {}) {
    const endereco = config.endereco || 'Rua Principal, 100 - Centro';
    const contato = config.numeroDono ? config.numeroDono.replace('@c.us', '') : '(Consulte no chat)';
    const pix = config.chavePix || 'Chave cadastrada no local';

    return (
        `📍 *INFORMAÇÕES & HORÁRIOS — BARBEARIA ESTILO* 💈\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🏠 *Endereço:* ${endereco}\n\n` +
        `⏰ *Horários de Atendimento:*\n` +
        `• *Terça a Sexta:* 09:00 às 20:00\n` +
        `• *Sábado:* 08:30 às 19:30\n` +
        `• *Domingo e Segunda:* Fechado (Descanso semanal)\n\n` +
        `💳 *Formas de Pagamento:*\n` +
        `• PIX (Chave: \`${pix}\`)\n` +
        `• Cartão de Débito e Crédito\n` +
        `• Dinheiro\n\n` +
        `📱 *Contato:* ${contato}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👉 _Digite *1* para agendar ou *MENU* para voltar._`
    );
}

async function tratarOpcaoMenuPrincipal({
    numOpcao,
    mensagemLower,
    responder,
    actions,
    config
}) {
    if (mensagemLower.match(/(agendar|agendamento|horario|horário|marcar|corte|cortar|barba|degrade|fade|fazer agendamento)/i)) {
        return await actions.iniciarFluxoPedido();
    }

    if (mensagemLower.match(/(preco|preço|precos|preços|valor|valores|tabela|servico|serviço|servicos|serviços)/i)) {
        return await responder(obterTabelaServicos());
    }

    if (mensagemLower.match(/(onde|local|localizacao|localização|endereco|endereço|horario de funcionamento|horarios)/i)) {
        return await responder(obterInfoBarbearia(config));
    }

    switch (numOpcao) {
        case 1:
            return await actions.iniciarFluxoPedido();

        case 2:
            return await responder(obterTabelaServicos());

        case 3:
            return await responder(obterInfoBarbearia(config));

        case 4:
            return await actions.consultarStatusPedido();

        case 5:
            return await actions.processarFluxoCancelamento();

        case 6: {
            const tel = config?.numeroDono ? config.numeroDono.replace('@c.us', '') : '';
            return await responder(
                `👤 *ATENDIMENTO BARBEARIA ESTILO* 💈\n\n` +
                `Para falar diretamente com um de nossos barbeiros ou tirar dúvidas especiais:\n` +
                (tel ? `📱 *WhatsApp Direto:* ${tel}\n\n` : `\n`) +
                `Aguarde um momento que nossa equipe responderá assim que possível!\n\n` +
                `_Caso deseje agendar seu horário automaticamente, digite *1* ou envie *MENU*._`
            );
        }

        default:
            return await actions.enviarMenuPrincipal();
    }
}

module.exports = {
    id: 'barbearia_estilo',
    nome: 'Barbearia Estilo',
    niche: 'barbershop',
    menuPrincipal: MENU_PRINCIPAL_TEMPLATE,
    getMenuPrincipal,
    tratarOpcaoMenuPrincipal,
    obterTabelaServicos,
    obterInfoBarbearia
};
