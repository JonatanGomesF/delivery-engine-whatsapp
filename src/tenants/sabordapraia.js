// =====================================================================
// src/tenants/sabordapraia.js — Configurações e Fluxos: Sabor da Praia
// ---------------------------------------------------------------------
// Módulo isolado exclusivo para o CLIENTE_ID 'sabordapraia'.
// Qualquer alteração neste arquivo afeta APENAS a loja Sabor da Praia,
// mantendo as outras lojas e o comportamento padrão totalmente blindados.
// =====================================================================

const MENU_PRINCIPAL_TEMPLATE = 
`🍽️ *BEM-VINDO AO SABOR DA PRAIA LANCHONETE & DELIVERY* 🍽️

Olá, *{nome}*! Como prefere fazer o seu pedido hoje?

1️⃣ 🌐 *Fazer Pedido Online (Cardápio Web):*
https://sabordapraia.vercel.app/

2️⃣ 🛒 *Fazer Pedido por aqui (WhatsApp)*
3️⃣ 📋 *Ver Cardápio Completo no Chat*
4️⃣ 🛵 *Acompanhar Meu Pedido (Status)*
5️⃣ 📍 *Horários, Endereço & Formas de Pagamento*
6️⃣ ❌ *Cancelar Pedido*

👉 _Digite o número da opção desejada (Ex: 1):_`;

/**
 * Monta o texto do menu principal exclusivo da loja Sabor da Praia.
 */
function getMenuPrincipal({ nomeCliente, config, db, formatarTexto, avisoFechado = '' }) {
    let aviso = avisoFechado;
    if (!aviso && db && db.isFechadoHoje && db.isFechadoHoje()) {
        const motivo = config?.motivoFechado || 'Recesso/Descanso';
        aviso = `🛑 *AVISO:* O restaurante está fechado hoje (${motivo}).\n\n`;
    }

    const templateFinal = aviso ? `${aviso}${MENU_PRINCIPAL_TEMPLATE}` : MENU_PRINCIPAL_TEMPLATE;

    if (typeof formatarTexto === 'function') {
        return formatarTexto(templateFinal, {
            nome: nomeCliente || 'Cliente',
            restaurante: 'SABOR DA PRAIA LANCHONETE & DELIVERY'
        });
    }

    return templateFinal.replace('{nome}', nomeCliente || 'Cliente');
}

/**
 * Trata o fluxo de opções do menu principal da loja Sabor da Praia.
 */
async function tratarOpcaoMenuPrincipal({
    numOpcao,
    mensagemLower,
    responder,
    actions
}) {
    // Atalhos por palavras-chave
    if (mensagemLower.match(/(online|cardapio web|cardápio web|site|link)/i)) {
        numOpcao = 1;
    } else if (mensagemLower.match(/(pedir|pedido|lanche|comida|marmita|marmitex|delivery|fazer pedido)/i)) {
        // Direciona intenção direta de compra para o fluxo de pedido no WhatsApp
        return await actions.iniciarFluxoPedido();
    }

    switch (numOpcao) {
        case 1:
            // 1️⃣ 🌐 Fazer Pedido Online (Cardápio Web)
            return await responder(
                `🌐 *CARDÁPIO ONLINE — SABOR DA PRAIA* 🍽️\n\n` +
                `Acesse o link do nosso cardápio digital para montar seu pedido com facilidade:\n` +
                `👉 https://sabordapraia.vercel.app/\n\n` +
                `💡 _Caso prefira fazer o pedido diretamente por aqui pelo WhatsApp, digite *2* ou envie *MENU*._`
            );

        case 2:
            // 2️⃣ 🛒 Fazer Pedido por aqui (WhatsApp) / Listar Categorias
            return await actions.iniciarFluxoPedido();

        case 3:
            // 3️⃣ 📋 Ver Cardápio Completo no Chat
            return await actions.enviarCardapioCompleto();

        case 4:
            // 4️⃣ 🛵 Acompanhar Meu Pedido (Status)
            return await actions.consultarStatusPedido();

        case 5:
            // 5️⃣ 📍 Horários, Endereço & Formas de Pagamento
            return await actions.enviarInfoRestaurante();

        case 6:
            // 6️⃣ ❌ Cancelar Pedido
            return await actions.processarFluxoCancelamento();

        default:
            // Opção desconhecida: reenvia o menu principal
            return await actions.enviarMenuPrincipal();
    }
}

const MENSAGENS_SABOR_DA_PRAIA = {
    menuPrincipal: MENU_PRINCIPAL_TEMPLATE,
    fechadoAviso: `🛑 *AVISO:* O Sabor da Praia está fechado hoje ({motivo}).\n\nAbriremos novamente no próximo horário de funcionamento!`,
    infoRestaurante: `📍 *INFORMAÇÕES & ATENDIMENTO — SABOR DA PRAIA* 🍽️\n\n🏠 *Endereço:* {endereco}\n🍱 *Horário Almoço:* {horarioAlmoco}\n🌙 *Horário Jantar:* {horarioJantar}\n🛵 *Taxa de Entrega:* {taxa}\n🔑 *Chave PIX:* \`{pix}\`\n📅 *Status Hoje:* {statusHoje}\n📱 *Contato / WhatsApp:* {telefoneDono}\n\n_Envie *1* para acessar o Cardápio Web ou *2* para pedir pelo WhatsApp._`,
    escolhaCategoria: `🛒 *FAZER PEDIDO — SABOR DA PRAIA* 🍽️\n\nEscolha a categoria desejada:\n\n{listaCategorias}\n\n_Digite o número da categoria desejada (Ex: 1):_`,
    escolhaItem: `{tituloCategoria}\n━━━━━━━━━━━━━━━━━━━━\n\n{listaItens}\n\n👉 *Digite o número da opção que deseja adicionar:* (Ex: 1)\n_Envie *MENU* para voltar ao início._`,
    carrinhoResumo: `🛒 *SEU PEDIDO ATUAL:*\n━━━━━━━━━━━━━━━━━━━━\n{resumoCarrinho}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Subtotal Parcial:* {subtotal}\n\n👉 *O que deseja fazer agora?*\n\n1️⃣ ➕ *Adicionar mais itens ao pedido*\n2️⃣ 🛵 *Concluir pedido e informar endereço de entrega*\n\n_Digite *1* para continuar comprando ou *2* para finalizar._`,
    tipoEntrega: `🛵 *COMO DESEJA RECEBER SEU PEDIDO?*\n\n1️⃣ 🛵 *Delivery* (Entregar em Mongaguá / Taxa {taxa})\n2️⃣ 🛍️ *Retirada no Balcão* (Buscar no Sabor da Praia sem taxa)\n\n_Digite *1* para Entrega ou *2* para Retirada no Restaurante:_`,
    solicitarEndereco: `📍 *ENDEREÇO DE ENTREGA:*\n\nPor favor, digite seu endereço completo em Mongaguá:\n_(Rua, Número, Bairro, Complemento e Ponto de Referência)_\n\n*Exemplo:* Av. Marina, 1775, Centro.`,
    formaPagamento: `📍 Endereço registrado com sucesso:\n*{endereco}*\n\n💳 *Escolha a Forma de Pagamento:*\n\n1️⃣ 🔑 *PIX* (Chave instantânea)\n2️⃣ 💳 *Cartão (Maquininha na Entrega)*\n3️⃣ 💵 *Dinheiro*\n\n_Digite o número da opção (1, 2 ou 3):_`,
    trocoDinheiro: `💵 *PAGAMENTO EM DINHEIRO:*\n\nVocê precisa de troco?\n_Digite o valor para o troco (Ex: *Troco para 50*) ou envie *NÃO* caso tenha o valor exato._`,
    pedidoConfirmadoCliente: `🎉 *PEDIDO RECEBIDO COM SUCESSO!* 🎉\n\n🍽️ *SABOR DA PRAIA LANCHONETE & DELIVERY*\n━━━━━━━━━━━━━━━━━━━━\n🎫 *Número do Pedido:* *{codigo}*\n👤 *Cliente:* {nome}\n{localEntrega}\n💳 *Forma de Pagamento:* {formaPagamento}\n{pixInfo}\n━━━━━━━━━━━━━━━━━━━━\n📋 *ITENS:*\n{itens}\n\n💵 *Subtotal:* {subtotal}\n{taxaInfo}💰 *TOTAL A PAGAR: {total}*\n━━━━━━━━━━━━━━━━━━━━\n⏳ *Tempo Estimado:* {tempo}\n👨‍🍳 *Status Atual:* 🟡 _Recebido na cozinha e entrando em preparo!_\n\n💡 *Dica:* A qualquer momento você pode enviar *STATUS* para acompanhar seu pedido!\n\n_Bom apetite e muito obrigado pela preferência!_ 😋🍔🥤`,
    pedidoEmPreparo: `👨‍🍳 *Seu pedido [{codigo}] já está sendo preparado no capricho na cozinha do Sabor da Praia!*`,
    pedidoSaiuEntrega: `🛵 *Oba! Seu pedido [{codigo}] acabou de sair para entrega e está a caminho!*`,
    pedidoProntoRetirada: `🛍️ *Seu pedido [{codigo}] está prontinho para retirada no balcão do Sabor da Praia!*`,
    pedidoConcluido: `✅ *Pedido [{codigo}] entregue com sucesso! Bom apetite e volte sempre ao Sabor da Praia!* 😋❤️`,
    pedidoCancelado: `✅ Seu pedido *{codigo}* foi cancelado com sucesso!\n\nCaso queira fazer um novo pedido, basta enviar *MENU*.`
};

module.exports = {
    id: 'sabordapraia',
    nome: 'Sabor da Praia Lanchonete & Delivery',
    hasPizzas: false,
    hasMeats: false,
    hasCrusts: false,
    menuPrincipal: MENU_PRINCIPAL_TEMPLATE,
    mensagens: MENSAGENS_SABOR_DA_PRAIA,
    getMenuPrincipal,
    tratarOpcaoMenuPrincipal
};
