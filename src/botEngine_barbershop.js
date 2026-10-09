// ================================================================
// src/botEngine_barbershop.js — Motor de Atendimento: Barbearia ✂️
// Fluxo: Saudação → Serviço → Barbeiro → Data → Horário → Confirmação
// Salva agendamento na tabela `pedidos` com tipo 'agendamento_barbershop'
// ================================================================

const db = require('./database');
const { createClient } = require('@supabase/supabase-js');

// ── Supabase (para salvar agendamentos) ──────────────────────────
function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
}

// ── Dados Estáticos da Barbearia (podem vir do Supabase futuramente) ──
const SERVICOS = [
    { id: 1, nome: 'Corte de Cabelo',   preco: 35,  emoji: '✂️',  duracao: 30 },
    { id: 2, nome: 'Barba Completa',    preco: 25,  emoji: '🪒',  duracao: 20 },
    { id: 3, nome: 'Combo (Corte+Barba)', preco: 55, emoji: '💈', duracao: 45 },
    { id: 4, nome: 'Sobrancelha',       preco: 15,  emoji: '✨',  duracao: 15 },
    { id: 5, nome: 'Pigmentação',       preco: 80,  emoji: '🎨',  duracao: 60 },
    { id: 6, nome: 'Hidratação Capilar',preco: 40,  emoji: '💧',  duracao: 30 },
];

const BARBEIROS = [
    { id: 1, nome: 'Carlos',  emoji: '💈', especialidade: 'Corte Degradê' },
    { id: 2, nome: 'Ricardo', emoji: '✂️', especialidade: 'Barba & Acabamento' },
    { id: 3, nome: 'Felipe',  emoji: '🎨', especialidade: 'Pigmentação & Coloração' },
];

// Próximos 7 dias úteis disponíveis
function getProximosDias() {
    const dias = [];
    const hoje = new Date();
    let i = 0;
    while (dias.length < 7) {
        i++;
        const d = new Date(hoje);
        d.setDate(hoje.getDate() + i);
        const dow = d.getDay();
        if (dow !== 0) { // Sem domingo
            const dd = String(d.getDate()).padStart(2,'0');
            const mm = String(d.getMonth()+1).padStart(2,'0');
            const yyyy = d.getFullYear();
            const label = dow === 6 ? 'Sábado' : ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dow];
            dias.push({ iso: `${yyyy}-${mm}-${dd}`, label: `${label} ${dd}/${mm}` });
        }
    }
    return dias;
}

const HORARIOS = ['09:00','09:30','10:00','10:30','11:00','11:30',
                  '13:30','14:00','14:30','15:00','15:30','16:00',
                  '16:30','17:00','17:30','18:00','18:30','19:00'];

// ── Helpers ──────────────────────────────────────────────────────
function extrairNumeroOpcao(texto) {
    if (!texto) return null;
    const limpo = String(texto).trim();
    const matchEmoji = limpo.match(/^([1-9]|1[0-9]|20)\uFE0F?\u20E3/);
    if (matchEmoji) return parseInt(matchEmoji[1]);
    const matchNum = limpo.match(/^(?:opç[aã]o|opcao|n[uú]mero|num|#)?\s*([1-9][0-9]?)(?:[.)\s-]|$)/i);
    if (matchNum) return parseInt(matchNum[1]);
    const num = parseInt(limpo);
    return isNaN(num) ? null : num;
}

function formatarMoeda(valor) {
    return `R$ ${(Number(valor)||0).toFixed(2).replace('.',',')}`;
}

// ── Salvar Agendamento no Supabase ────────────────────────────────
async function salvarAgendamento({ telefone, nome, servico, barbeiro, data, horario, preco }) {
    const sb = getSupabase();
    if (!sb) return null;

    const clienteId = process.env.CLIENTE_ID || 'barbearia_estilo';
    const codigo    = `BARB-${Date.now().toString(36).toUpperCase()}`;
    const hoje      = new Date().toISOString().split('T')[0];
    const horaBr    = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

    try {
        const { data: row, error } = await sb.from('pedidos').insert({
            cliente_id:      clienteId,
            codigo,
            nome_cliente:    nome,
            cliente:         nome,
            telefone,
            servico:         `${servico.emoji} ${servico.nome} c/ ${barbeiro.nome}`,
            preco,
            total:           preco,
            forma_pagamento: 'a_confirmar',
            tipo_entrega:    'agendamento',
            status:          'pendente',
            data:            hoje,
            horario:         horaBr,
            origem:          'whatsapp',
            observacoes:     `Agendamento: ${data.label} às ${horario} | Barbeiro: ${barbeiro.nome} | Serviço: ${servico.nome}`,
            metadata: JSON.stringify({
                tipo:       'barbershop',
                servico_id: servico.id,
                barbeiro_id: barbeiro.id,
                data_agendada: data.iso,
                horario_agendado: horario,
            })
        }).select().single();

        if (error) throw error;
        return { codigo, id: row?.id };
    } catch(err) {
        console.error('[BARBER] Erro ao salvar agendamento:', err.message);
        return { codigo, id: null };
    }
}

// ================================================================
// PROCESSADOR PRINCIPAL — exportado e usado pelo whatsappClient.js
// ================================================================
async function processarMensagem({ from, nome, texto, sendMessage, sendTyping, emitEvent }) {
    const nomeCliente    = (nome || 'Cliente').split(' ')[0];
    const mensagemLimpa  = (texto || '').trim();
    const mensagemLower  = mensagemLimpa.toLowerCase().replace(/[!?.,;]/g,'').trim();
    const numOpcao       = extrairNumeroOpcao(mensagemLimpa);
    const estado         = db.getEstadoConversa(from) || {};

    const logEvento = (tipo, detalhe) => {
        if (emitEvent) emitEvent('bot_log', {
            hora: new Date().toLocaleTimeString('pt-BR'),
            cliente: nome, telefone: from, tipo, detalhe
        });
    };

    const responder = async (textoResposta) => {
        if (sendTyping) { try { await sendTyping(); } catch(e){} }
        await sendMessage(from, textoResposta);
        logEvento('saida', textoResposta);
    };

    const notificarDono = async (msg) => {
        const config = db.getConfig();
        if (config.numeroDono && sendMessage) {
            try { await sendMessage(config.numeroDono, msg); } catch(e){}
        }
    };

    logEvento('entrada', mensagemLimpa);

    // ── Comandos globais ─────────────────────────────────────────
    const isReset = mensagemLower.match(/^(menu|voltar|inicio|início|zerar|oi|olá|ola|bom dia|boa tarde|boa noite|opa|eai|salve|agendar|agendamento|corte|barba|start|comecar|começar|oie)$/i);
    if (isReset) {
        db.limparEstadoConversa(from);
        return await enviarMenuPrincipal(responder, nomeCliente);
    }

    if (mensagemLower === 'cancelar' || mensagemLower === 'desistir') {
        db.limparEstadoConversa(from);
        return await responder(`❌ Agendamento cancelado. Quando quiser marcar, é só enviar *oi*! ✂️`);
    }

    if (mensagemLower === 'meu agendamento' || mensagemLower === 'status' || mensagemLower === 'meus horários') {
        return await consultarAgendamento(responder, from, nomeCliente);
    }

    // ── Máquina de estados ───────────────────────────────────────
    switch (estado.status) {

        // ══ ETAPA 1: Escolha do serviço ══════════════════════════
        case 'waiting_servico': {
            if (numOpcao !== null && numOpcao >= 1 && numOpcao <= SERVICOS.length) {
                const servico = SERVICOS[numOpcao - 1];
                db.setEstadoConversa(from, { ...estado, status: 'waiting_barbeiro', servico });

                const lista = BARBEIROS.map((b,i) =>
                    `${i+1}. ${b.emoji} *${b.nome}* — _${b.especialidade}_`
                ).join('\n');

                return await responder(
                    `${servico.emoji} *${servico.nome}* — ${formatarMoeda(servico.preco)}\n\n` +
                    `✂️ *Escolha o barbeiro:*\n\n${lista}\n\n` +
                    `_Digite o número ou envie *MENU* para voltar._`
                );
            }
            return await responder(
                `⚠️ Opção inválida. Digite um número de *1 a ${SERVICOS.length}* ou envie *MENU* para recomeçar.`
            );
        }

        // ══ ETAPA 2: Escolha do barbeiro ═════════════════════════
        case 'waiting_barbeiro': {
            // Tenta por número ou por nome
            let barbeiro = null;
            if (numOpcao !== null && numOpcao >= 1 && numOpcao <= BARBEIROS.length) {
                barbeiro = BARBEIROS[numOpcao - 1];
            } else {
                barbeiro = BARBEIROS.find(b => mensagemLower.includes(b.nome.toLowerCase()));
            }

            if (!barbeiro) {
                const lista = BARBEIROS.map((b,i) => `${i+1}. ${b.emoji} *${b.nome}*`).join('\n');
                return await responder(`⚠️ Barbeiro não encontrado. Escolha:\n\n${lista}`);
            }

            const dias = getProximosDias();
            db.setEstadoConversa(from, { ...estado, status: 'waiting_data', barbeiro, diasDisponiveis: dias });

            const listaDias = dias.map((d,i) => `${i+1}. 📅 ${d.label}`).join('\n');
            return await responder(
                `💈 Barbeiro escolhido: *${barbeiro.nome}* (${barbeiro.especialidade})\n\n` +
                `📅 *Escolha a data:*\n\n${listaDias}\n\n` +
                `_Digite o número do dia desejado:_`
            );
        }

        // ══ ETAPA 3: Escolha da data ══════════════════════════════
        case 'waiting_data': {
            const dias = estado.diasDisponiveis || getProximosDias();
            if (numOpcao !== null && numOpcao >= 1 && numOpcao <= dias.length) {
                const data = dias[numOpcao - 1];
                db.setEstadoConversa(from, { ...estado, status: 'waiting_horario', data });

                const listaHoras = HORARIOS.map((h,i) => `${i+1}. 🕐 ${h}`).join('\n');
                return await responder(
                    `📅 Data: *${data.label}*\n\n` +
                    `⏰ *Escolha o horário:*\n\n${listaHoras}\n\n` +
                    `_Digite o número do horário desejado:_`
                );
            }
            const listaDias = dias.map((d,i) => `${i+1}. 📅 ${d.label}`).join('\n');
            return await responder(`⚠️ Dia inválido. Escolha:\n\n${listaDias}`);
        }

        // ══ ETAPA 4: Escolha do horário ═══════════════════════════
        case 'waiting_horario': {
            let horario = null;
            if (numOpcao !== null && numOpcao >= 1 && numOpcao <= HORARIOS.length) {
                horario = HORARIOS[numOpcao - 1];
            } else {
                // Tenta casar "09:00" ou "9h" no texto
                const match = mensagemLimpa.match(/^(\d{1,2})[:h]?(\d{0,2})/);
                if (match) {
                    const hStr = `${match[1].padStart(2,'0')}:${(match[2]||'00').padStart(2,'0')}`;
                    horario = HORARIOS.find(h => h === hStr);
                }
            }

            if (!horario) {
                const listaHoras = HORARIOS.map((h,i) => `${i+1}. 🕐 ${h}`).join('\n');
                return await responder(`⚠️ Horário inválido. Escolha:\n\n${listaHoras}`);
            }

            const { servico, barbeiro, data } = estado;

            // Guarda para confirmação
            db.setEstadoConversa(from, { ...estado, status: 'waiting_confirmacao', horario });

            return await responder(
                `✅ *Resumo do Agendamento:*\n\n` +
                `${servico.emoji} Serviço: *${servico.nome}*\n` +
                `💈 Barbeiro: *${barbeiro.nome}*\n` +
                `📅 Data: *${data.label}*\n` +
                `⏰ Horário: *${horario}*\n` +
                `💰 Valor: *${formatarMoeda(servico.preco)}*\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `*1.* ✅ Confirmar Agendamento\n` +
                `*2.* ❌ Cancelar\n\n` +
                `_Digite 1 para confirmar ou 2 para cancelar._`
            );
        }

        // ══ ETAPA 5: Confirmação final ════════════════════════════
        case 'waiting_confirmacao': {
            if (numOpcao === 2 || mensagemLower.includes('cancel') || mensagemLower.includes('não') || mensagemLower === 'nao') {
                db.limparEstadoConversa(from);
                return await responder(`❌ Agendamento cancelado. Quando quiser marcar, é só enviar *oi*! ✂️`);
            }

            if (numOpcao === 1 || mensagemLower.includes('confirm') || mensagemLower.includes('sim') || mensagemLower.includes('ok')) {
                const { servico, barbeiro, data, horario } = estado;
                db.limparEstadoConversa(from);

                const result = await salvarAgendamento({
                    telefone: from, nome: nomeCliente,
                    servico, barbeiro, data, horario,
                    preco: servico.preco
                });

                const codigo = result?.codigo || `BARB-${Date.now()}`;

                // Notifica o dono da barbearia
                await notificarDono(
                    `🔔 *Novo Agendamento!*\n\n` +
                    `👤 Cliente: ${nomeCliente}\n` +
                    `📱 Tel: ${from.replace('@c.us','')}\n` +
                    `${servico.emoji} Serviço: ${servico.nome}\n` +
                    `💈 Barbeiro: ${barbeiro.nome}\n` +
                    `📅 Data: ${data.label} às ${horario}\n` +
                    `💰 Valor: ${formatarMoeda(servico.preco)}\n` +
                    `🔖 Código: ${codigo}`
                );

                return await responder(
                    `🎉 *Agendamento Confirmado!*\n\n` +
                    `${servico.emoji} *${servico.nome}*\n` +
                    `💈 Barbeiro: *${barbeiro.nome}*\n` +
                    `📅 *${data.label}* às *${horario}*\n` +
                    `💰 Valor: *${formatarMoeda(servico.preco)}*\n\n` +
                    `🔖 Código: *${codigo}*\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `📍 Apareça com 5 minutos de antecedência.\n` +
                    `⚠️ Cancelamentos com menos de 2h de antecedência podem ser cobrados.\n\n` +
                    `_Nos vemos em breve! Obrigado, ${nomeCliente}_ ✂️`
                );
            }

            // Resposta ambígua
            return await responder(
                `Por favor, confirme:\n\n*1.* ✅ Confirmar\n*2.* ❌ Cancelar`
            );
        }

        // ══ Estado idle / sem estado ══════════════════════════════
        default:
        return await enviarMenuPrincipal(responder, nomeCliente, from);
    }
}

// ── Menu Principal ───────────────────────────────────────────────
async function enviarMenuPrincipal(responder, nomeCliente, from) {
    const config = db.getConfig();
    const nome = config.nomeRestaurante || 'Barbearia Estilo';

    const listaServicos = SERVICOS.map((s,i) =>
        `${i+1}. ${s.emoji} *${s.nome}* — ${formatarMoeda(s.preco)}`
    ).join('\n');

    // Avança para espera da escolha do serviço ANTES de responder
    if (from) db.setEstadoConversa(from, { status: 'waiting_servico' });

    await responder(
        `✂️ *${nome}*\n` +
        `Olá, *${nomeCliente}*! Bem-vindo(a)! 💈\n\n` +
        `*Nossos Serviços:*\n\n` +
        `${listaServicos}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👉 Digite o *número* do serviço para agendar!\n\n` +
        `_Ou envie *meu agendamento* para consultar seu horário._`
    );
}

// Consulta agendamentos do cliente
async function consultarAgendamento(responder, from, nomeCliente) {
    db.setEstadoConversa(from, { status: 'waiting_servico' });
    return await responder(
        `📋 *Seus Agendamentos, ${nomeCliente}!*\n\n` +
        `Para consultar, acesse o app ou entre em contato diretamente.\n\n` +
        `_Envie *oi* para fazer um novo agendamento._ ✂️`
    );
}

module.exports = { processarMensagem };
