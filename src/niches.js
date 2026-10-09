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
    }
};

// Retorna a configuração do niche (fallback: delivery)
function getNicheConfig(niche) {
    return NICHE_REGISTRY[niche] || NICHE_REGISTRY['delivery'];
}

// Retorna os termos do niche (fallback: delivery)
function getNicheTerms(niche) {
    return getNicheConfig(niche).terms;
}

// Retorna o fluxo do niche: 'order' ou 'appointment'
function getNicheFlow(niche) {
    return getNicheConfig(niche).flow;
}

// Lista de nichos válidos
function getValidNiches() {
    return Object.keys(NICHE_REGISTRY);
}

module.exports = {
    NICHE_REGISTRY,
    getNicheConfig,
    getNicheTerms,
    getNicheFlow,
    getValidNiches
};
