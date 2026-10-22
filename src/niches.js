// =====================================================================
// src/niches.js — Registro genérico de nichos (Motor Único)
// ---------------------------------------------------------------------
// Cada nicho define:
//   - label: nome exibido no WhatsApp
//   - flow: 'order' (delivery) ou 'appointment' (agendamento)
//   - terms: labels dinâmicos usados nas mensagens
//   - itemSource: de onde vêm os itens (sempre 'cardapio' por enquanto)
//   - orderType: tipo salvo em pedidos.metadata.tipo
// =====================================================================

const NICHE_REGISTRY = {

    // ── DELIVERY — Restaurantes, Marmiterias, Pizzarias ──────────
    delivery: {
        label: 'Delivery',
        flow: 'order',
        itemSource: 'cardapio',
        orderType: 'delivery',
        terms: {
            business: 'Restaurante',
            order: 'Pedido',
            orders: 'Pedidos',
            item: 'Item',
            items: 'Itens',
            category: 'Categoria',
            categories: 'Categorias',
            service: 'Serviço',
            makeOrder: 'Fazer Pedido',
            viewCardapio: 'Ver Cardápio',
            orderStatus: 'Status do Pedido',
            infoHours: 'Informações & Horários',
            cancelOrder: 'Cancelar Pedido',
            chooseCategory: 'Escolha uma das categorias:',
            chooseItem: 'Digite o número da opção desejada:',
            howToReceive: 'COMO DESEJA RECEBER?',
            delivery: 'Delivery',
            pickup: 'Retirada no Balcão',
            address: 'ENDEREÇO DE ENTREGA:',
            paymentMethod: 'Escolha a Forma de Pagamento:',
            orderReceived: 'PEDIDO RECEBIDO COM SUCESSO!',
            yourOrder: 'SEU PEDIDO ATUAL:',
            addMore: 'Adicionar mais itens',
            finish: 'Concluir pedido',
            kitchen: 'Cozinha',
            newOrder: 'NOVO PEDIDO CHEGOU!',
            orderCancelled: 'PEDIDO CANCELADO PELO CLIENTE',
            noOrders: 'Você não possui nenhum pedido em andamento no momento.',
            noOrdersToCancel: 'Você não possui pedidos ativos para cancelar no momento.',
            activeOrders: 'SEUS PEDIDOS ATIVOS:',
            status: {
                pendente: '🟡 *Recebido na Cozinha* (Aguardando forno/fogão)',
                em_preparo: '👨‍🍳 *Em Preparo* (No fogo/forno com todo capricho!)',
                saiu_entrega: '🛵 *Saiu para Entrega / Pronto para Retirada* (A caminho!)',
                concluido: '✅ *Entregue / Concluído*',
                cancelado: '❌ *Cancelado*'
            }
        }
    },

    // ── BARBERSHOP — Barbearias e Salões Masculinos ───────────────
    barbershop: {
        label: 'Barbearia',
        flow: 'appointment',
        itemSource: 'cardapio',
        orderType: 'barbershop',
        terms: {
            business: 'Barbearia',
            order: 'Agendamento',
            orders: 'Agendamentos',
            item: 'Serviço',
            items: 'Serviços',
            category: 'Categoria',
            categories: 'Categorias',
            service: 'Serviço',
            makeOrder: 'Agendar Horário',
            viewCardapio: 'Ver Serviços',
            orderStatus: 'Meu Agendamento',
            infoHours: 'Informações & Horários',
            cancelOrder: 'Cancelar Agendamento',
            chooseCategory: 'Escolha uma das categorias:',
            chooseItem: 'Digite o número do serviço desejado:',
            howToReceive: 'COMO DESEJA AGENDAR?',
            delivery: 'Horário',
            pickup: 'Profissional',
            address: 'DATA DESEJADA:',
            paymentMethod: 'Escolha o horário:',
            orderReceived: 'AGENDAMENTO CONFIRMADO!',
            yourOrder: 'RESUMO DO AGENDAMENTO:',
            addMore: 'Adicionar mais serviços',
            finish: 'Confirmar agendamento',
            kitchen: 'Barbearia',
            newOrder: 'NOVO AGENDAMENTO!',
            orderCancelled: 'AGENDAMENTO CANCELADO',
            noOrders: 'Você não possui nenhum agendamento em andamento.',
            noOrdersToCancel: 'Você não possui agendamentos ativos para cancelar.',
            activeOrders: 'SEUS AGENDAMENTOS ATIVOS:',
            status: {
                pendente: '🟡 *Aguardando Confirmação*',
                em_preparo: '💈 *Em Atendimento*',
                saiu_entrega: '✅ *Pronto / A Caminho*',
                concluido: '✅ *Concluído*',
                cancelado: '❌ *Cancelado*'
            }
        }
    },

    // ── CLINIC — Clínicas e Consultórios ─────────────────────────
    clinic: {
        label: 'Clínica',
        flow: 'appointment',
        itemSource: 'cardapio',
        orderType: 'clinic',
        terms: {
            business: 'Clínica',
            order: 'Consulta',
            orders: 'Consultas',
            item: 'Especialidade',
            items: 'Especialidades',
            category: 'Categoria',
            categories: 'Categorias',
            service: 'Especialidade',
            makeOrder: 'Agendar Consulta',
            viewCardapio: 'Ver Especialidades',
            orderStatus: 'Minha Consulta',
            infoHours: 'Informações & Horários',
            cancelOrder: 'Cancelar Consulta',
            chooseCategory: 'Escolha uma especialidade:',
            chooseItem: 'Digite o número da especialidade desejada:',
            howToReceive: 'COMO DESEJA AGENDAR?',
            delivery: 'Data',
            pickup: 'Profissional',
            address: 'DATA DESEJADA:',
            paymentMethod: 'Escolha o horário:',
            orderReceived: 'CONSULTA AGENDADA!',
            yourOrder: 'RESUMO DA CONSULTA:',
            addMore: 'Adicionar mais especialidades',
            finish: 'Confirmar agendamento',
            kitchen: 'Clínica',
            newOrder: 'NOVA CONSULTA AGENDADA!',
            orderCancelled: 'CONSULTA CANCELADA',
            noOrders: 'Você não possui nenhuma consulta em andamento.',
            noOrdersToCancel: 'Você não possui consultas ativas para cancelar.',
            activeOrders: 'SUAS CONSULTAS ATIVAS:',
            status: {
                pendente: '🟡 *Aguardando Confirmação*',
                em_preparo: '🩺 *Em Atendimento*',
                saiu_entrega: '✅ *Pronto / A Caminho*',
                concluido: '✅ *Concluída*',
                cancelado: '❌ *Cancelada*'
            }
        }
    },

    // ── PETSHOP ──────────────────────────────────────────────────
    petshop: {
        label: 'PetShop',
        flow: 'appointment',
        itemSource: 'cardapio',
        orderType: 'petshop',
        terms: {
            business: 'PetShop',
            order: 'Agendamento',
            orders: 'Agendamentos',
            item: 'Serviço',
            items: 'Serviços',
            category: 'Categoria',
            categories: 'Categorias',
            service: 'Serviço',
            makeOrder: 'Agendar Horário',
            viewCardapio: 'Ver Serviços',
            orderStatus: 'Meu Agendamento',
            infoHours: 'Informações & Horários',
            cancelOrder: 'Cancelar Agendamento',
            chooseCategory: 'Escolha uma das categorias:',
            chooseItem: 'Digite o número do serviço desejado:',
            howToReceive: 'COMO DESEJA AGENDAR?',
            delivery: 'Horário',
            pickup: 'Profissional',
            address: 'DATA DESEJADA:',
            paymentMethod: 'Escolha o horário:',
            orderReceived: 'AGENDAMENTO CONFIRMADO!',
            yourOrder: 'RESUMO DO AGENDAMENTO:',
            addMore: 'Adicionar mais serviços',
            finish: 'Confirmar agendamento',
            kitchen: 'PetShop',
            newOrder: 'NOVO AGENDAMENTO!',
            orderCancelled: 'AGENDAMENTO CANCELADO',
            noOrders: 'Você não possui nenhum agendamento em andamento.',
            noOrdersToCancel: 'Você não possui agendamentos ativos para cancelar.',
            activeOrders: 'SEUS AGENDAMENTOS ATIVOS:',
            status: {
                pendente: '🟡 *Aguardando Confirmação*',
                em_preparo: '🐾 *Em Atendimento*',
                saiu_entrega: '✅ *Pronto / A Caminho*',
                concluido: '✅ *Concluído*',
                cancelado: '❌ *Cancelado*'
            }
        }
    },

    // ── SALON — Salões de Beleza ──────────────────────────────────
    salon: {
        label: 'Salão',
        flow: 'appointment',
        itemSource: 'cardapio',
        orderType: 'salon',
        terms: {
            business: 'Salão',
            order: 'Agendamento',
            orders: 'Agendamentos',
            item: 'Serviço',
            items: 'Serviços',
            category: 'Categoria',
            categories: 'Categorias',
            service: 'Serviço',
            makeOrder: 'Agendar Horário',
            viewCardapio: 'Ver Serviços',
            orderStatus: 'Meu Agendamento',
            infoHours: 'Informações & Horários',
            cancelOrder: 'Cancelar Agendamento',
            chooseCategory: 'Escolha uma das categorias:',
            chooseItem: 'Digite o número do serviço desejado:',
            howToReceive: 'COMO DESEJA AGENDAR?',
            delivery: 'Horário',
            pickup: 'Profissional',
            address: 'DATA DESEJADA:',
            paymentMethod: 'Escolha o horário:',
            orderReceived: 'AGENDAMENTO CONFIRMEDO!',
            yourOrder: 'RESUMO DO AGENDAMENTO:',
            addMore: 'Adicionar mais serviços',
            finish: 'Confirmar agendamento',
            kitchen: 'Salão',
            newOrder: 'NOVO AGENDAMENTO!',
            orderCancelled: 'AGENDAMENTO CANCELADO',
            noOrders: 'Você não possui nenhum agendamento em andamento.',
            noOrdersToCancel: 'Você não possui agendamentos ativos para cancelar.',
            activeOrders: 'SEUS AGENDAMENTOS ATIVOS:',
            status: {
                pendente: '🟡 *Aguardando Confirmação*',
                em_preparo: '💅 *Em Atendimento*',
                saiu_entrega: '✅ *Pronto / A Caminho*',
                concluido: '✅ *Concluído*',
                cancelado: '❌ *Cancelado*'
            }
        }
    },

    // ── CORRETORES — Imóveis, Visitas & Consultoria Imobiliária ───
    corretores: {
        label: 'Corretores / Imóveis',
        flow: 'corretores',
        itemSource: 'imoveis',
        orderType: 'corretores',
        terms: {
            business: 'Imobiliária',
            order: 'Visita',
            orders: 'Visitas',
            item: 'Imóvel',
            items: 'Imóveis',
            category: 'Tipo',
            categories: 'Tipos',
            service: 'Visita / Consultoria',
            makeOrder: 'Agendar Visita',
            viewCardapio: 'Ver Imóveis',
            orderStatus: 'Minha Visita',
            infoHours: 'Informações & Atendimento',
            cancelOrder: 'Cancelar Visita',
            chooseCategory: 'Escolha o tipo de imóvel:',
            chooseItem: 'Digite o número do imóvel desejado:',
            howToReceive: 'TIPO DE AGENDAMENTO:',
            delivery: 'Presencial no Imóvel',
            pickup: 'Reunião no Escritório',
            address: 'DATA DESEJADA:',
            paymentMethod: 'Escolha o horário:',
            orderReceived: 'VISITA AGENDADA COM SUCESSO!',
            yourOrder: 'RESUMO DA VISITA:',
            addMore: 'Ver outros imóveis',
            finish: 'Confirmar visita',
            kitchen: 'Imobiliária',
            newOrder: 'NOVA VISITA AGENDADA!',
            orderCancelled: 'VISITA CANCELADA',
            noOrders: 'Você não possui nenhuma visita agendada em andamento.',
            noOrdersToCancel: 'Você não possui agendamentos ativos para cancelar.',
            activeOrders: 'SUAS VISITAS AGENDADAS:',
            status: {
                pendente: '🟡 *Aguardando Visita*',
                em_preparo: '🏡 *Em Visita / Reunião*',
                saiu_entrega: '✅ *Confirmada*',
                concluido: '✅ *Visita Realizada*',
                cancelado: '❌ *Cancelada*'
            }
        }
    }
};

// Aliases em português para compatibilidade total com os selects do Painel Master
NICHE_REGISTRY['barbearia']   = NICHE_REGISTRY['barbershop'];
NICHE_REGISTRY['clinica']     = NICHE_REGISTRY['clinic'];
NICHE_REGISTRY['imoveis']     = NICHE_REGISTRY['corretores'];
NICHE_REGISTRY['imobiliaria'] = NICHE_REGISTRY['corretores'];
NICHE_REGISTRY['corretor']    = NICHE_REGISTRY['corretores'];

// Retorna a configuração do niche (sem fallback para delivery)
function getNicheConfig(niche) {
    if (!niche || !NICHE_REGISTRY[niche]) return null;
    return NICHE_REGISTRY[niche];
}

// Retorna os termos do niche
function getNicheTerms(niche) {
    const config = getNicheConfig(niche);
    return config ? config.terms : null;
}

// Retorna o fluxo do niche: 'order' ou 'appointment'
function getNicheFlow(niche) {
    const config = getNicheConfig(niche);
    return config ? config.flow : null;
}

// Lista de nichos válidos
function getValidNiches() {
    return Object.keys(NICHE_REGISTRY);
}

// =====================================================================
// MENSAGENS PADRÃO POR NICHO (termos dinâmicos)
// ---------------------------------------------------------------------
// A engine usa estas mensagens SOMENTE quando o cliente NÃO possui
// mensagens customizadas no Supabase (tabela relacional mensagens_bot:
// id, cliente_id, chave, conteudo — sem JSONs empacotados).
//
// Precedência resolvida em database.js#sincronizarComSupabase:
//   custom (Supabase) > nicho (este arquivo)
//
// A engine do Motor Único ainda usa config.mensagens com fallback
// embutido (botEngine.js), então aqui garantimos que BR mensagens
// existam a partir da 1ª sincronização — ajustadas ao nicho.
// =====================================================================

// ── DELIVERY — restaurantes, marmitarias, pizzarias ─────────────────
const MENSAGENS_DELIVERY = {
    menuPrincipal: `🍽️ *BEM-VINDO AO {restaurante}* 🍽️\n\nOlá, *{nome}*! Como prefere fazer o seu pedido hoje?\n\n1️⃣ 🛒 *Fazer Pedido por aqui (WhatsApp)*\n2️⃣ 📋 *Ver Cardápio Completo no Chat*\n3️⃣ 🛵 *Acompanhar Meu Pedido (Status)*\n4️⃣ 📍 *Horários, Endereço & Formas de Pagamento*\n5️⃣ ❌ *Cancelar Pedido*\n\n👉 _Digite o número da opção desejada (Ex: 1):_`,
    fechadoAviso: `🛑 *AVISO:* O restaurante está fechado hoje ({motivo}).`,
    escolhaCategoria: `🛒 *FAZER PEDIDO — {restaurante}* 🍽️\n\nEscolha a categoria desejada:\n\n{listaCategorias}\n\n_Digite o número da categoria desejada (Ex: 1):_`,
    escolhaItem: `{tituloCategoria}\n━━━━━━━━━━━━━━━━━━━━\n\n{listaItens}\n\n👉 *Digite o número da opção que deseja adicionar:* (Ex: 1)\n_Envie *MENU* para voltar ao início._`,
    escolhaModoPizza: `🍕 Você escolheu: *{item}* ({preco})\n\nComo deseja montar a sua pizza?\n\n1️⃣ 🍕 *Pizza Inteira (Apenas {item})*\n2️⃣ 🌓 *Pizza Meio a Meio (Escolher 2º sabor)*\n\n_Digite *1* para Inteira ou *2* para Meio a Meio:_`,
    escolhaSegundaMetade: `🌓 *ESCOLHA O 2º SABOR DA SUA PIZZA:*\n━━━━━━━━━━━━━━━━━━━━\n1º Sabor: *{primeiroSabor}* ({precoPrimeiro})\n━━━━━━━━━━━━━━━━━━━━\n\n{listaSabores}\n\n👉 *Digite o número do 2º sabor desejado:*\n_(O valor da pizza será calculado pelo sabor de maior valor)_`,
    escolhaCarne: `🍱 Você escolheu: *{item}* ({preco})\n\n🥩 *Escolha a opção de carne principal:*\n\n{listaCarnes}\n\n_Digite o número da carne desejada (Ex: 1) ou digite sua preferência / observações:_`,
    escolhaBorda: `🍕 Você escolheu: *{item}* ({preco})\n\n🧀 *Deseja adicionar Borda Recheada ou alguma observação?*\n\n{listaBordas}\n\n_Digite o número ou escreva sua observação (Ex: 'Sem cebola'):_`,
    carrinhoResumo: `🛒 *SEU PEDIDO ATUAL:*\n━━━━━━━━━━━━━━━━━━━━\n{resumoCarrinho}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Subtotal Parcial:* {subtotal}\n\n👉 *O que deseja fazer agora?*\n\n1️⃣ ➕ *Adicionar mais itens ao pedido*\n2️⃣ 🛵 *Concluir pedido e informar endereço de entrega*\n\n_Digite *1* para continuar comprando ou *2* para finalizar._`,
    tipoEntrega: `🛵 *COMO DESEJA RECEBER SEU PEDIDO?*\n\n1️⃣ 🛵 *Delivery* (Entregar em casa / Taxa {taxa})\n2️⃣ 🛍️ *Retirada no Balcão* (Buscar no Restaurante sem taxa)\n\n_Digite *1* para Entrega ou *2* para Retirada no Restaurante:_`,
    solicitarEndereco: `📍 *ENDEREÇO DE ENTREGA:*\n\nPor favor, digite seu endereço completo:\n_(Rua, Número, Bairro, Complemento e Ponto de Referência)_\n\n*Exemplo:* Rua das Flores, 142, Bairro Centro, Apto 23 (próximo à praça).`,
    formaPagamento: `📍 Endereço registrado com sucesso:\n*{endereco}*\n\n💳 *Escolha a Forma de Pagamento:*\n\n1️⃣ 🔑 *PIX* (Chave instantânea)\n2️⃣ 💳 *Cartão (Maquininha na Entrega)*\n3️⃣ 💵 *Dinheiro*\n\n_Digite o número da opção (1, 2 ou 3):_`,
    trocoDinheiro: `💵 *PAGAMENTO EM DINHEIRO:*\n\nVocê precisa de troco?\n_Digite o valor para o troco (Ex: *Troco para 50*) ou envie *NÃO* caso tenha o valor exato._`,
    pedidoConfirmadoCliente: `🎉 *PEDIDO RECEBIDO COM SUCESSO!* 🎉\n\n🍽️ *{restaurante}*\n━━━━━━━━━━━━━━━━━━━━\n🎫 *Número do Pedido:* *{codigo}*\n👤 *Cliente:* {nome}\n{localEntrega}\n💳 *Forma de Pagamento:* {formaPagamento}\n{pixInfo}\n━━━━━━━━━━━━━━━━━━━━\n📋 *ITENS:*\n{itens}\n\n💵 *Subtotal:* {subtotal}\n{taxaInfo}💰 *TOTAL A PAGAR: {total}*\n━━━━━━━━━━━━━━━━━━━━\n⏳ *Tempo Estimado:* {tempo}\n👨‍🍳 *Status Atual:* 🟡 _Recebido na cozinha e entrando em preparo!_\n\n💡 *Dica:* A qualquer momento você pode enviar *STATUS* para acompanhar seu pedido!\n\n_Bom apetite e muito obrigado pela preferência!_ 😋🍲🍕`,
    notificacaoCozinha: `🚨 *NOVO PEDIDO CHEGOU!* [{codigo}]\n━━━━━━━━━━━━━━━━━━━━\n👤 *Cliente:* {nome}\n📱 *WhatsApp:* {telefone}\n{localEntrega}\n💳 *Pagamento:* {formaPagamento}\n\n📝 *ITENS DO PEDIDO:*\n{itens}\n\n💵 *Subtotal:* {subtotal}\n🛵 *Taxa Entrega:* {taxa}\n💰 *TOTAL GERAL: {total}*\n━━━━━━━━━━━━━━━━━━━━\n⏰ *Hora:* {hora} | 🆔 *ID:* {id}`,
    pedidoEmPreparo:      `👨‍🍳 *Seu pedido [{codigo}] já está no fogo/forno sendo preparado no capricho!*`,
    pedidoSaiuEntrega:    `🛵 *Oba! Seu pedido [{codigo}] acabou de sair para entrega e está a caminho!*`,
    pedidoProntoRetirada: `🛍️ *Seu pedido [{codigo}] está prontinho para retirada no balcão!*`,
    pedidoConcluido:      `✅ *Pedido [{codigo}] entregue com sucesso! Bom apetite e volte sempre!* 😋❤️`,
    pedidoCancelado:      `✅ Seu pedido *{codigo}* foi cancelado com sucesso!\n\nCaso queira fazer um novo pedido, basta enviar *MENU*.`,
    infoRestaurante:      `📍 *INFORMAÇÕES & ATENDIMENTO — {restaurante}* 🍽️\n\n🏠 *Endereço:* {endereco}\n🍱 *Horário do Almoço (Marmitex):* {horarioAlmoco}\n🍕 *Horário da Noite (Pizzaria):* {horarioJantar}\n🛵 *Taxa de Entrega:* {taxa}\n🔑 *Chave PIX:* \`{pix}\`\n📅 *Status Hoje:* {statusHoje}\n📱 *Contato / WhatsApp:* {telefoneDono}\n\n_Envie *1* para fazer seu pedido ou *MENU* para ver as opções._`
};

// ── BASE "AGENDA/SERVIÇOS" — barbershop, clinic, petshop, salon ─────
// Mesmas chaves da engine; redação neutra para agendamento.
function montarTemplatesAgendamento() {
    return {
        menuPrincipal: `👋 *BEM-VINDO AO {restaurante}* 👋\n\nOlá, *{nome}*! Como podemos ajudar hoje?\n\n{avisoTurno}\n{avisoFechado}\n1️⃣ 🛒 *Agendar / Contratar Serviço*\n2️⃣ 📋 *Ver Serviços & Preços*\n3️⃣ 📍 *Horários, Endereço & Pagamento*\n4️⃣ ❌ *Cancelar Agendamento*\n\n👉 _Digite o número da opção desejada (Ex: *1*):_`,
        fechadoAviso: `🛑 *AVISO:* O estabelecimento está fechado hoje ({motivo}).`,
        escolhaCategoria: `🛒 *AGENDAMENTO — {restaurante}* 📅\n\nEscolha a categoria desejada:\n\n{listaCategorias}\n\n_Digite o número da categoria desejada (Ex: 1):_`,
        escolhaItem: `{tituloCategoria}\n━━━━━━━━━━━━━━━━━━━━\n\n{listaItens}\n\n👉 *Digite o número do serviço que deseja contratar:* (Ex: 1)\n_Envie *MENU* para voltar ao início._`,
        escolhaModoPizza: `Você escolheu: *{item}* ({preco})\n\n_Digite *1* para confirmar este serviço._`,
        escolhaSegundaMetade: `Você escolheu: *{item}* ({preco})\n\n_Digite *1* para confirmar ou *2* para escolher outro serviço:_`,
        escolhaCarne: `Você escolheu: *{item}* ({preco})\n\n📝 *Alguma preferência ou observação?*\n_Digite sua observação ou envie *OK* para continuar:_`,
        escolhaBorda: `Você escolheu: *{item}* ({preco})\n\n📝 *Alguma observação adicional?*\n_Digite ou envie *OK* para continuar:_`,
        carrinhoResumo: `🛒 *SEU ATENDIMENTO ATUAL:*\n━━━━━━━━━━━━━━━━━━━━\n{resumoCarrinho}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Total:* {subtotal}\n\n👉 *O que deseja fazer agora?*\n\n1️⃣ ➕ *Adicionar outro serviço*\n2️⃣ ✅ *Confirmar e concluir agendamento*\n\n_Digite *1* para continuar ou *2* para finalizar._`,
        tipoEntrega: `📋 *COMO DESEJA CONCLUIR O AGENDAMENTO?*\n\n1️⃣ ✅ *Confirmar agendamento*\n2️⃣ ➕ *Adicionar outro serviço*\n\n_Digite *1* ou *2*:_`,
        solicitarEndereco: `📍 *ENDEREÇO:*\n\nSe necessário, informe um endereço / ponto de referência:\n\n*Exemplo:* Rua das Flores, 142, Bairro Centro.`,
        formaPagamento: `✅ Registrado!\n\n💳 *Escolha a Forma de Pagamento:*\n\n1️⃣ 🔑 *PIX*\n2️⃣ 💳 *Cartão*\n3️⃣ 💵 *Dinheiro*\n\n_Digite o número da opção (1, 2 ou 3):_`,
        trocoDinheiro: `💵 *PAGAMENTO EM DINHEIRO:*\n\nVocê precisa de troco?\n_Digite o valor (Ex: *Troco para 50*) ou envie *NÃO*._`,
        pedidoConfirmadoCliente: `🎉 *AGENDAMENTO CONFIRMADO COM SUCESSO!* 🎉\n\n🏪 *{restaurante}*\n━━━━━━━━━━━━━━━━━━━━\n🎫 *Número:* *{codigo}*\n👤 *Cliente:* {nome}\n{localEntrega}\n💳 *Forma de Pagamento:* {formaPagamento}\n{pixInfo}\n━━━━━━━━━━━━━━━━━━━━\n📋 *SERVIÇOS:*\n{itens}\n\n{taxaInfo}💰 *TOTAL: {total}*\n━━━━━━━━━━━━━━━━━━━━\n⏳ *Previsão:* {tempo}\n👨‍💼 *Status Atual:* 🟡 _Recebido e em análise._\n\n_Bom atendimento e muito obrigado pela preferência!_ 😊`,
        notificacaoCozinha: `🚨 *NOVO AGENDAMENTO!* [{codigo}]\n━━━━━━━━━━━━━━━━━━━━\n👤 *Cliente:* {nome}\n📱 *WhatsApp:* {telefone}\n{localEntrega}\n💳 *Pagamento:* {formaPagamento}\n\n📝 *SERVIÇOS:*\n{itens}\n\n💰 *TOTAL: {total}*\n━━━━━━━━━━━━━━━━━━━━\n⏰ *Hora:* {hora} | 🆔 *ID:* {id}`,
        pedidoEmPreparo:      `👨‍💼 *Seu atendimento [{codigo}] já está sendo providenciado!*`,
        pedidoSaiuEntrega:    `🚚 *Seu atendimento [{codigo}] está a caminho / em andamento!*`,
        pedidoProntoRetirada: `🛍️ *Seu atendimento [{codigo}] está pronto!*`,
        pedidoConcluido:      `✅ *Atendimento [{codigo}] concluído com sucesso! Volte sempre!* 😊`,
        pedidoCancelado:      `✅ Seu atendimento *{codigo}* foi cancelado com sucesso!\n\nCaso queira reagendar, basta enviar *MENU*.`,
        infoRestaurante:      `📍 *INFORMAÇÕES & ATENDIMENTO — {restaurante}* 🏪\n\n🏠 *Endereço:* {endereco}\n🗓️ *Horário de Funcionamento:* {horarioAlmoco} | {horarioJantar}\n🛵 *Taxa:* {taxa}\n🔑 *Chave PIX:* \`{pix}\`\n📅 *Status Hoje:* {statusHoje}\n📱 *Contato / WhatsApp:* {telefoneDono}\n\n_Envie *1* para agendar ou *MENU* para ver as opções._`
    };
}

// ── BASE "CORRETORES / IMÓVEIS" ──────────────────────────────────────
const MENSAGENS_CORRETORES = {
    menuPrincipal: `🏡 *BEM-VINDO À {restaurante}* 🏡\n\nOlá, *{nome}*! Como podemos ajudar você hoje?\n\n{avisoFechado}1️⃣ 🏡 *Ver Imóveis Disponíveis*\n2️⃣ 📅 *Agendar Visita / Reunião*\n3️⃣ 💬 *Simulação / Financiamento / Informações*\n4️⃣ 👤 *Falar com Corretor*\n5️⃣ ❌ *Cancelar Agendamento*\n\n👉 _Digite o número da opção desejada (Ex: *1*):_`,
    fechadoAviso: `🛑 *AVISO:* O escritório está fechado hoje ({motivo}). Atendimentos de plantão disponíveis diretamente com nosso corretor.`,
    escolhaItem: `🏡 *IMÓVEIS DISPONÍVEIS — {restaurante}*\n━━━━━━━━━━━━━━━━━━━━\n\n{listaItens}\n\n👉 *Digite o número do imóvel para ver detalhes e agendar uma visita:* (Ex: 1)\n_Ou envie *MENU* para voltar._`,
    infoRestaurante: `📍 *INFORMAÇÕES & ATENDIMENTO — {restaurante}* 🏡\n\n🏠 *Endereço do Escritório:* {endereco}\n🗓️ *Horário de Atendimento:* {horarioAlmoco} às {horarioJantar}\n📱 *WhatsApp do Corretor:* {telefoneDono}\n\n_Envie *1* para ver imóveis ou *2* para agendar uma visita._`,
    pedidoConfirmadoCliente: `🎉 *VISITA AGENDADA COM SUCESSO!* 🎉\n\n🏡 *{restaurante}*\n━━━━━━━━━━━━━━━━━━━━\n🎫 *Código da Visita:* *{codigo}*\n👤 *Cliente:* {nome}\n{localEntrega}\n━━━━━━━━━━━━━━━━━━━━\n🏡 *IMÓVEL:*\n{itens}\n\n⏳ *Data e Horário:* {tempo}\n👨‍💼 *Status Atual:* 🟡 _Visita confirmada na agenda do corretor!_\n\n_Nosso corretor entrará em contato ou aguardará você no local e horário agendado!_ 🏡🔑`,
    notificacaoCozinha: `🚨 *NOVA VISITA AGENDADA!* [{codigo}]\n━━━━━━━━━━━━━━━━━━━━\n👤 *Cliente:* {nome}\n📱 *WhatsApp:* {telefone}\n{localEntrega}\n\n🏡 *IMÓVEL:* {itens}\n\n⏰ *Data/Horário:* {hora} | 🆔 *ID:* {id}`,
    pedidoEmPreparo: `🏡 *O corretor já está a caminho ou pronto para sua visita agendada [{codigo}]!*`,
    pedidoSaiuEntrega: `🔔 *Lembrete: Sua visita ao imóvel [{codigo}] está agendada para hoje!*`,
    pedidoProntoRetirada: `🏡 *Visita confirmada!*`,
    pedidoConcluido: `✅ *Visita [{codigo}] realizada com sucesso! Conte conosco para fechar o melhor negócio!* 🏡🔑`,
    pedidoCancelado: `✅ Sua visita *{codigo}* foi cancelada com sucesso!\n\nCaso queira agendar outro dia ou ver mais imóveis, basta enviar *MENU*.`
};

// Mapa nicho → mensagens padrão (fallback para delivery)
const MENSAGENS_NICHO = {
    delivery:    MENSAGENS_DELIVERY,
    barbershop:  montarTemplatesAgendamento(),
    barbearia:   montarTemplatesAgendamento(),
    clinic:      montarTemplatesAgendamento(),
    clinica:     montarTemplatesAgendamento(),
    petshop:     montarTemplatesAgendamento(),
    salon:       montarTemplatesAgendamento(),
    corretores:  MENSAGENS_CORRETORES,
    imoveis:     MENSAGENS_CORRETORES,
    imobiliaria: MENSAGENS_CORRETORES,
    corretor:    MENSAGENS_CORRETORES
};

// Resolve as mensagens padrão de um nicho (sem fallback para delivery)
function getMensagensNicho(niche) {
    if (!niche || !MENSAGENS_NICHO[niche]) return null;
    return MENSAGENS_NICHO[niche];
}

module.exports = {
    NICHE_REGISTRY,
    getNicheConfig,
    getNicheTerms,
    getNicheFlow,
    getValidNiches,
    MENSAGENS_NICHO,
    getMensagensNicho
};
