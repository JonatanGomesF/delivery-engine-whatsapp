// =====================================================================
// src/tenants/caoguarda.js — Configurações e Fluxos: Cão Guarda Pet Shop
// ---------------------------------------------------------------------
// Módulo isolado exclusivo para o CLIENTE_ID 'caoguarda'.
// Qualquer alteração neste arquivo afeta APENAS o Cão Guarda Pet Shop.
// =====================================================================

const MENU_PRINCIPAL_TEMPLATE = 
`🐾 *BEM-VINDO AO CÃO GUARDA PET SHOP* 🐾

Olá, *{nome}*! Como podemos cuidar do seu pet hoje?

1️⃣ 🛒 *Ver Produtos & Rações (Catálogo)*
2️⃣ ✂️ *Agendar Banho & Tosa / Serviços*
3️⃣ 📋 *Ver Todos os Serviços & Valores*
4️⃣ 🚚 *Acompanhar Meu Pedido / Entrega*
5️⃣ 📍 *Horários, Endereço & Atendimento*
6️⃣ ❌ *Cancelar Atendimento ou Pedido*

👉 _Digite o número da opção desejada (Ex: 1):_`;

/**
 * Monta o texto do menu principal exclusivo da loja Cão Guarda Pet Shop.
 */
function getMenuPrincipal({ nomeCliente, config, db, formatarTexto, avisoFechado = '' }) {
    let aviso = avisoFechado;
    if (!aviso && db && db.isFechadoHoje && db.isFechadoHoje()) {
        const motivo = config?.motivoFechado || 'Recesso/Feriado';
        aviso = `🛑 *AVISO:* O Pet Shop está fechado hoje (${motivo}).\n\n`;
    }

    const templateFinal = aviso ? `${aviso}${MENU_PRINCIPAL_TEMPLATE}` : MENU_PRINCIPAL_TEMPLATE;

    return formatarTexto(templateFinal, {
        nome: nomeCliente || 'Cliente',
        restaurante: 'CÃO GUARDA PET SHOP'
    });
}

/**
 * Trata o fluxo de opções do menu principal da loja Cão Guarda Pet Shop.
 */
async function tratarOpcaoMenuPrincipal({
    numOpcao,
    mensagemLower,
    responder,
    actions
}) {
    // Atalhos por palavras-chave adaptadas ao universo Pet Shop
    if (mensagemLower.match(/(racao|raçao|produto|produtos|petiscos|acessorios|comprar)/i)) {
        return await actions.iniciarFluxoPedido();
    } else if (mensagemLower.match(/(banho|tosa|agendar|agendamento|servico|servicos)/i)) {
        numOpcao = 2;
    }

    switch (numOpcao) {
        case 1:
            // 1️⃣ 🛒 Ver Produtos & Rações / Catalogo no WhatsApp
            return await actions.iniciarFluxoPedido();

        case 2:
            // 2️⃣ ✂️ Agendar Banho & Tosa / Serviços
            return await responder(
                `✂️ *AGENDAMENTO DE BANHO & TOSA* 🧼\n\n` +
                `Para agendar o banho do seu pet, por favor nos informe:\n\n` +
                `1. Nome do Pet e Raça\n` +
                `2. Serviço desejado (Somente Banho, Banho & Tosa, etc.)\n` +
                `3. Dia e horário de sua preferência\n\n` +
                ` Um de nossos atendentes irá confirmar o horário com você em instantes!`
            );

        case 3:
            // 3️⃣ 📋 Ver Todos os Serviços & Valores
            return await actions.enviarCardapioCompleto();

        case 4:
            // 4️⃣ 🚚 Acompanhar Meu Pedido / Entrega
            return await actions.consultarStatusPedido();

        case 5:
            // 5️⃣ 📍 Horários, Endereço & Atendimento
            return await actions.enviarInfoRestaurante();

        case 6:
            // 6️⃣ ❌ Cancelar Atendimento ou Pedido
            return await actions.processarFluxoCancelamento();

        default:
            // Opção desconhecida: reenvia o menu principal
            return await actions.enviarMenuPrincipal();
    }
}

module.exports = {
    id: 'caoguarda',
    nome: 'Cão Guarda Pet Shop',
    menuPrincipal: MENU_PRINCIPAL_TEMPLATE,
    getMenuPrincipal,
    tratarOpcaoMenuPrincipal
};
