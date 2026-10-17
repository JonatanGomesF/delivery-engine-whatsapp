// =====================================================================
// src/tenants/default.js — Configurações e Fluxos Padrão
// =====================================================================

const MENU_PRINCIPAL_TEMPLATE = 
`🍽️ *BEM-VINDO AO {restaurante}* 🍽️

Olá, *{nome}*! Como prefere fazer o seu pedido hoje?

1️⃣ 🛒 *Fazer Pedido por aqui (WhatsApp)*
2️⃣ 📋 *Ver Cardápio Completo no Chat*
3️⃣ 🛵 *Acompanhar Meu Pedido (Status)*
4️⃣ 📍 *Horários, Endereço & Formas de Pagamento*
5️⃣ ❌ *Cancelar Pedido*

👉 _Digite o número da opção desejada (Ex: 1):_`;

function getMenuPrincipal({ nomeCliente, config, db, formatarTexto }) {
    const template = (config && config.mensagens && config.mensagens.menuPrincipal) || MENU_PRINCIPAL_TEMPLATE;
    const nome = nomeCliente || 'Cliente';
    const restaurante = (config && config.nomeRestaurante ? config.nomeRestaurante : 'Meu Estabelecimento').toUpperCase();

    if (typeof formatarTexto === 'function') {
        return formatarTexto(template, {
            restaurante,
            nome
        });
    }

    return template.replace('{nome}', nome).replace('{restaurante}', restaurante);
}

async function tratarOpcaoMenuPrincipal({
    numOpcao,
    mensagemLower,
    responder,
    actions
}) {
    if (mensagemLower.match(/(pedir|pedido|lanche|comida|marmita|marmitex|pizza|delivery|fazer pedido)/i)) {
        return await actions.iniciarFluxoPedido();
    }

    switch (numOpcao) {
        case 1:
            return await actions.iniciarFluxoPedido();

        case 2:
            return await actions.enviarCardapioCompleto();

        case 3:
            return await actions.consultarStatusPedido();

        case 4:
            return await actions.enviarInfoRestaurante();

        case 5:
            return await actions.processarFluxoCancelamento();

        default:
            return await actions.enviarMenuPrincipal();
    }
}

module.exports = {
    id: 'default',
    nome: 'Delivery Padrão',
    menuPrincipal: MENU_PRINCIPAL_TEMPLATE,
    getMenuPrincipal,
    tratarOpcaoMenuPrincipal
};
