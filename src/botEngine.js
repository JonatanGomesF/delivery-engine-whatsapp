// =====================================================================
// src/botEngine.js — Motor Único Genérico (Multi-Nicho)
// ---------------------------------------------------------------------
// Lê o niche do tenant em tempo de execução (via database.js) e adapta
// o fluxo e as mensagens dinamicamente:
//   - flow 'order'       → delivery (cardápio → item → carrinho → entrega)
//   - flow 'appointment' → barbershop/clinic/petshop/salon (serviço → data → horário)
// Usa as tabelas existentes: cardapio (itens) e pedidos (transações).
// =====================================================================

const db = require('./database');
const { getNicheConfig, getNicheTerms, getNicheFlow } = require('./niches');

// ── Cache de niche (lido do Supabase, atualizado a cada 5 min) ──────
let _cachedNiche = null;
let _nicheTimestamp = 0;
const NICHE_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function getNiche() {
    const now = Date.now();
    if (_cachedNiche && (now - _nicheTimestamp) < NICHE_CACHE_TTL) {
        return _cachedNiche;
    }
    _cachedNiche = db.getNiche() || 'delivery';
    _nicheTimestamp = now;
    return _cachedNiche;
}

// Força atualização do cache (útil após sincronização)
function refreshNicheCache() {
    _nicheTimestamp = 0;
    return getNiche();
}

// Interpolação flexível de variáveis em templates de texto (ex: {nome}, {codigo}, {total})
function formatarTexto(template, vars = {}) {
    if (!template) return '';
    let resultado = String(template);
    for (const [chave, valor] of Object.entries(vars)) {
        const regex = new RegExp(`\\{${chave}\\}`, 'g');
        resultado = resultado.replace(regex, valor !== undefined && valor !== null ? valor : '');
    }
    return resultado;
}

// Extrai número de opção de forma tolerante (ex: "1", "1️⃣", "1.", "opcao 1", "opção 1")
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

// Formata valor em moeda BRL (R$ 22,00)
function formatarMoeda(valor) {
    return `R$ ${(Number(valor) || 0).toFixed(2).replace('.', ',')}`;
}

// =====================================================================
// PROCESSADOR PRINCIPAL — exportado e usado pelo whatsappClient.js
// =====================================================================
async function processarMensagem({ from, nome, texto, sendMessage, sendTyping, emitEvent }) {
    const nomeCliente = (nome || 'Cliente').split(' ')[0];
    const mensagemLimpa = (texto || '').trim();
    const mensagemLower = mensagemLimpa.toLowerCase();
    const mensagemSemPontuacao = mensagemLower.replace(/[!?.,;]/g, '').trim();

    const config = db.getConfig();
    const mensagens = config.mensagens || {};
    const estado = db.getEstadoConversa(from);

    // ── Nicho em tempo de execução ─────────────────────────────────
    const niche = getNiche();
    const nicheConfig = getNicheConfig(niche);
    const terms = getNicheTerms(niche);
    const flow = getNicheFlow(niche);

    const logEvento = (tipo, detalhe) => {
        if (emitEvent) {
            emitEvent('bot_log', {
                hora: new Date().toLocaleTimeString('pt-BR'),
                cliente: nome,
                telefone: from,
                tipo,
                detalhe
            });
        }
    };

    const responder = async (textoResposta) => {
        if (sendTyping) {
            try { await sendTyping(); } catch(e){}
        }
        await sendMessage(from, textoResposta);
        logEvento('saida', textoResposta);
    };

    const notificarDono = async (mensagemNotificacao) => {
        if (config.numeroDono && sendMessage) {
            try {
                await sendMessage(config.numeroDono, mensagemNotificacao);
            } catch (err) {
                console.error("⚠️ Erro ao notificar estabelecimento via WhatsApp:", err.message);
            }
        }
    };

    logEvento('entrada', mensagemLimpa);

    // 1. Comandos Globais de Interrupção / Menu / Início / Saudação
    if (mensagemSemPontuacao === 'menu' || mensagemSemPontuacao === 'voltar' ||
        mensagemSemPontuacao === 'inicio' || mensagemSemPontuacao === 'início' ||
        mensagemSemPontuacao === 'zerar' || mensagemSemPontuacao === 'recomecar' ||
        mensagemSemPontuacao.match(/^(oi|olá|ola|bom dia|boa tarde|boa noite|opa|eai|eae|start|comecar|começar|oie|salve|fome|pedir|agendar)$/i)) {
        db.limparEstadoConversa(from);
        return await enviarMenuPrincipal(responder, nomeCliente, config, terms);
    }

    if (mensagemSemPontuacao === 'cancelar' || mensagemSemPontuacao === 'desistir') {
        return await processarFluxoCancelamento(responder, from, nomeCliente, config, terms, emitEvent, notificarDono);
    }

    if (mensagemSemPontuacao === 'status' || mensagemSemPontuacao === 'rastrear' || mensagemSemPontuacao === 'meu pedido' || mensagemSemPontuacao === 'meu agendamento') {
        return await consultarStatusPedido(responder, from, nomeCliente, config, terms);
    }

    if (mensagemSemPontuacao === 'cardapio' || mensagemSemPontuacao === 'cardápio' || mensagemSemPontuacao === 'servicos' || mensagemSemPontuacao === 'serviços') {
        return await enviarCardapioCompleto(responder, config, terms);
    }

    const numOpcao = extrairNumeroOpcao(mensagemLimpa);

    // 2. Se o cliente estiver sem estado ativo (idle)
    if (!estado || estado.status === 'idle' || !estado.status) {
        const triggerRegex = flow === 'order'
            ? /(pedir|pedido|marmita|marmitex|pizza|comida|fazer pedido|delivery|lanche)/i
            : /(agendar|agendamento|horario|horário|marcar|consulta|servico|serviço|corte|barba)/i;

        if (mensagemLower.match(triggerRegex)) {
            return flow === 'order'
                ? await iniciarFluxoPedido(responder, from, config, terms)
                : await iniciarFluxoAgendamento(responder, from, config, terms);
        }

        if (numOpcao === 1) {
            return flow === 'order'
                ? await iniciarFluxoPedido(responder, from, config, terms)
                : await iniciarFluxoAgendamento(responder, from, config, terms);
        } else if (numOpcao === 2) {
            return await enviarCardapioCompleto(responder, config, terms);
        } else if (numOpcao === 3) {
            return await consultarStatusPedido(responder, from, nomeCliente, config, terms);
        } else if (numOpcao === 4) {
            return await enviarInfoEstabelecimento(responder, config, terms);
        } else if (numOpcao === 5) {
            return await processarFluxoCancelamento(responder, from, nomeCliente, config, terms, emitEvent, notificarDono);
        } else {
            return await enviarMenuPrincipal(responder, nomeCliente, config, terms);
        }
    }

    // 3. Máquina de Estados da Conversa
    if (flow === 'order') {
        return await processarFluxoOrder({ responder, from, nomeCliente, estado, config, mensagens, terms, numOpcao, mensagemLimpa, mensagemLower, emitEvent, notificarDono });
    } else {
        return await processarFluxoAppointment({ responder, from, nomeCliente, estado, config, mensagens, terms, numOpcao, mensagemLimpa, mensagemLower, emitEvent, notificarDono, niche });
    }
}

// =====================================================================
// FLUXO ORDER — Delivery (cardápio → item → carrinho → entrega)
// =====================================================================
async function processarFluxoOrder({ responder, from, nomeCliente, estado, config, mensagens, terms, numOpcao, mensagemLimpa, mensagemLower, emitEvent, notificarDono }) {
    switch (estado.status) {

        // ---- ETAPA 1: ESCOLHA DA CATEGORIA DO CARDÁPIO ----
        case 'waiting_category': {
            const categorias = db.getCategorias(true);
            let categoriaEscolhida = null;

            if (numOpcao !== null && numOpcao >= 1 && numOpcao <= categorias.length) {
                categoriaEscolhida = categorias[numOpcao - 1];
            } else {
                categoriaEscolhida = categorias.find(c => mensagemLower.includes(c.id.toLowerCase()) || mensagemLower.includes(c.nome.toLowerCase()));
            }

            if (!categoriaEscolhida) {
                let listaCats = categorias.map((c, i) => `${i + 1}. ${c.icone || '🍽️'} *${c.nome}*`).join('\n');
                return await responder(
                    formatarTexto(mensagens.escolhaCategoria || `Por favor, escolha uma das categorias:\n\n{listaCategorias}\n\n_Ou envie *MENU* para voltar._`, {
                        restaurante: config.nomeRestaurante,
                        listaCategorias: listaCats
                    })
                );
            }

            const itensCategoria = db.getCardapio({ categoria: categoriaEscolhida.id });
            if (itensCategoria.length === 0) {
                return await responder(`Nenhum item disponível nesta categoria no momento. Digite *MENU* para voltar.`);
            }

            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_item',
                categoriaAtual: categoriaEscolhida,
                itensExibidos: itensCategoria
            });

            let tituloCat = `${categoriaEscolhida.icone || '🍽️'} *${categoriaEscolhida.nome.toUpperCase()}*`;
            let listaTexto = itensCategoria.map((it, idx) => {
                const desc = it.descricao ? `\n   _${it.descricao}_` : '';
                return `${idx + 1}. ${it.icone || '🍽️'} *${it.nome}* — ${formatarMoeda(it.preco)}${desc}`;
            }).join('\n\n');

            return await responder(
                formatarTexto(mensagens.escolhaItem || `{tituloCategoria}\n━━━━━━━━━━━━━━━━━━━━\n\n{listaItens}\n\n👉 *Digite o número da opção desejada:*`, {
                    tituloCategoria: tituloCat,
                    listaItens: listaTexto
                })
            );
        }

        // ---- ETAPA 2: ESCOLHA DO ITEM ----
        case 'waiting_item': {
            const itens = estado.itensExibidos || [];
            const index = numOpcao !== null ? numOpcao - 1 : -1;

            if (index < 0 || index >= itens.length) {
                return await responder(
                    `⚠️ Opção inválida! Digite um número de *1 a ${itens.length}* correspondente ao item desejado, ou envie *MENU* para reiniciar.`
                );
            }

            const itemEscolhido = itens[index];

            // Se o item for da categoria Marmitex, pergunta a carne/acompanhamento
            if (itemEscolhido.categoria === 'marmitex') {
                const carnesRaw = config.opcoesCarnes || [];
                const carnes = carnesRaw.filter(c => c.ativo !== false).map(c => typeof c === 'string' ? c : c.nome);

                if (carnes.length > 0) {
                    db.setEstadoConversa(from, {
                        ...estado,
                        status: 'waiting_customization_meat',
                        itemEmEdicao: itemEscolhido,
                        carnesDisponiveis: carnes
                    });

                    let carnesTexto = carnes.map((c, i) => `${i + 1}. ${c}`).join('\n');

                    return await responder(
                        formatarTexto(mensagens.escolhaCarne || `🍱 Você escolheu: *{item}* ({preco})\n\n🥩 *Escolha a opção de carne principal:*\n\n{listaCarnes}\n\n_Digite o número da carne desejada:_`, {
                            item: itemEscolhido.nome,
                            preco: formatarMoeda(itemEscolhido.preco),
                            listaCarnes: carnesTexto
                        })
                    );
                }
            }

            // Se for Pizza, pergunta se quer Inteira ou Meio a Meio (2 Sabores)
            if (itemEscolhido.categoria === 'pizza') {
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_pizza_mode',
                    primeiroSabor: itemEscolhido
                });

                return await responder(
                    formatarTexto(mensagens.escolhaModoPizza || `🍕 Você escolheu: *{item}* ({preco})\n\nComo deseja montar a sua pizza?\n\n1️⃣ 🍕 *Pizza Inteira (Apenas {item})*\n2️⃣ 🌓 *Pizza Meio a Meio (Escolher 2º sabor)*\n\n_Digite *1* para Inteira ou *2* para Meio a Meio:_`, {
                        item: itemEscolhido.nome,
                        preco: formatarMoeda(itemEscolhido.preco)
                    })
                );
            }

            // Bebidas ou itens sem customização
            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_quantity',
                itemEmEdicao: itemEscolhido,
                customizacao: ''
            });

            return await responder(
                `🥤 *${itemEscolhido.nome}* (${formatarMoeda(itemEscolhido.preco)})\n\n` +
                `Quantas unidades você deseja?\n` +
                `_Digite a quantidade (Ex: 1, 2, 3...):_`
            );
        }

        // ---- ETAPA 2.1: MODO PIZZA (INTEIRA OU MEIO A MEIO) ----
        case 'waiting_pizza_mode': {
            const primeiroSabor = estado.primeiroSabor;

            if (numOpcao === 1 || mensagemLower.includes('inteira') || mensagemLower === '1') {
                return await avancarParaBordasPizza(responder, from, estado, config, primeiroSabor);
            } else if (numOpcao === 2 || mensagemLower.includes('meio') || mensagemLower.includes('2') || mensagemLower.includes('segundo')) {
                const todasPizzas = db.getCardapio({ categoria: 'pizza' });
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_pizza_second_half',
                    pizzasDisponiveis: todasPizzas
                });

                let listaSabores = todasPizzas.map((p, i) => {
                    const desc = p.descricao ? `\n   _${p.descricao}_` : '';
                    return `${i + 1}. 🍕 *${p.nome}* — ${formatarMoeda(p.preco)}${desc}`;
                }).join('\n\n');

                return await responder(
                    formatarTexto(mensagens.escolhaSegundaMetade || `🌓 *ESCOLHA O 2º SABOR DA SUA PIZZA:*\n━━━━━━━━━━━━━━━━━━━━\n1º Sabor: *{primeiroSabor}* ({precoPrimeiro})\n━━━━━━━━━━━━━━━━━━━━\n\n{listaSabores}\n\n👉 *Digite o número do 2º sabor desejado:*\n_(O valor total da pizza será o do sabor mais caro)_`, {
                        primeiroSabor: primeiroSabor.nome,
                        precoPrimeiro: formatarMoeda(primeiroSabor.preco),
                        listaSabores: listaSabores
                    })
                );
            } else {
                return await responder(`⚠️ Por favor, digite *1* para Pizza Inteira ou *2* para Pizza Meio a Meio.`);
            }
        }

        // ---- ETAPA 2.2: ESCOLHA DO SEGUNDO SABOR DA PIZZA ----
        case 'waiting_pizza_second_half': {
            const todasPizzas = estado.pizzasDisponiveis || db.getCardapio({ categoria: 'pizza' });
            const index = numOpcao !== null ? numOpcao - 1 : -1;

            if (index < 0 || index >= todasPizzas.length) {
                return await responder(
                    `⚠️ Opção inválida! Digite um número de *1 a ${todasPizzas.length}* correspondente ao 2º sabor desejado, ou envie *MENU* para reiniciar.`
                );
            }

            const sabor1 = estado.primeiroSabor;
            const sabor2 = todasPizzas[index];

            const precoFinalPizza = Math.max(Number(sabor1.preco), Number(sabor2.preco));

            const nomeS1 = sabor1.nome.replace(/^Pizza\s+/i, '');
            const nomeS2 = sabor2.nome.replace(/^Pizza\s+/i, '');
            const nomePizzaCombinada = `Pizza 1/2 ${nomeS1} + 1/2 ${nomeS2}`;

            const itemPizzaCombinado = {
                id: `pizza_${sabor1.id}_${sabor2.id}`,
                nome: nomePizzaCombinada,
                preco: precoFinalPizza,
                categoria: 'pizza',
                icone: '🍕',
                descricao: `1/2 ${sabor1.nome} e 1/2 ${sabor2.nome} (Cobrado maior valor: ${formatarMoeda(precoFinalPizza)})`
            };

            return await avancarParaBordasPizza(responder, from, estado, config, itemPizzaCombinado);
        }

        // ---- ETAPA 2.1: CUSTOMIZAÇÃO MARMITEX (CARNE) ----
        case 'waiting_customization_meat': {
            const carnes = estado.carnesDisponiveis || [];
            let carneEscolhida = '';

            if (numOpcao !== null && numOpcao >= 1 && numOpcao <= carnes.length) {
                carneEscolhida = carnes[numOpcao - 1];
            } else {
                carneEscolhida = mensagemLimpa;
            }

            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_quantity',
                customizacao: `Carne: ${carneEscolhida}`
            });

            return await responder(
                `✅ Opção anotada: *${carneEscolhida}*\n\n` +
                `Quantas marmitex dessa você deseja?\n` +
                `_Digite a quantidade (Ex: 1, 2, 3):_`
            );
        }

        // ---- ETAPA 2.2: CUSTOMIZAÇÃO PIZZA (BORDA / OBS) ----
        case 'waiting_customization_pizza': {
            const bordas = estado.bordasDisponiveis || [];
            let bordaObs = 'Sem borda extra';
            let acrescimo = 0;

            if (numOpcao !== null && numOpcao >= 1 && numOpcao <= bordas.length) {
                const b = bordas[numOpcao - 1];
                bordaObs = b.nome;
                acrescimo = Number(b.preco) || 0;
            } else {
                bordaObs = mensagemLimpa;
            }

            const itemComAcrescimo = {
                ...estado.itemEmEdicao,
                preco: estado.itemEmEdicao.preco + acrescimo
            };

            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_quantity',
                itemEmEdicao: itemComAcrescimo,
                customizacao: bordaObs
            });

            return await responder(
                `✅ Preferência anotada: *${bordaObs}*\n\n` +
                `Quantas pizzas dessa você deseja?\n` +
                `_Digite a quantidade (Ex: 1, 2):_`
            );
        }

        // ---- ETAPA 3: QUANTIDADE E CARRINHO ----
        case 'waiting_quantity': {
            let qtd = extrairNumeroOpcao(mensagemLimpa) || 1;
            if (qtd < 1) qtd = 1;
            if (qtd > 50) qtd = 50;

            const item = estado.itemEmEdicao;
            const customizacao = estado.customizacao || '';

            const itemCarrinho = {
                id: item.id,
                nome: item.nome,
                preco: item.preco,
                qtd: qtd,
                observacao: customizacao,
                totalItem: item.preco * qtd
            };

            const carrinhoAtual = Array.isArray(estado.carrinho) ? [...estado.carrinho] : [];
            carrinhoAtual.push(itemCarrinho);

            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_more_or_finish',
                carrinho: carrinhoAtual,
                itemEmEdicao: null,
                customizacao: null
            });

            let subtotal = 0;
            let resumoCarrinho = carrinhoAtual.map((c) => {
                subtotal += c.totalItem;
                const obsTxt = c.observacao ? `\n      ↳ _${c.observacao}_` : '';
                return `🔹 *${c.qtd}x ${c.nome}* — ${formatarMoeda(c.totalItem)}${obsTxt}`;
            }).join('\n');

            return await responder(
                formatarTexto(mensagens.carrinhoResumo || `🛒 *SEU PEDIDO ATUAL:*\n━━━━━━━━━━━━━━━━━━━━\n{resumoCarrinho}\n━━━━━━━━━━━━━━━━━━━━\n💰 *Subtotal:* {subtotal}\n\n1️⃣ ➕ Adicionar mais itens\n2️⃣ 🛵 Concluir pedido`, {
                    resumoCarrinho: resumoCarrinho,
                    subtotal: formatarMoeda(subtotal)
                })
            );
        }

        // ---- ETAPA 4: ADICIONAR MAIS OU FINALIZAR ----
        case 'waiting_more_or_finish': {
            if (numOpcao === 1 || mensagemLower.includes('adicionar') || mensagemLower.includes('mais')) {
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_category'
                });

                const categorias = db.getCategorias(true);
                let listaCats = categorias.map((c, i) => `${i + 1}. ${c.icone || '🍽️'} *${c.nome}*`).join('\n');

                return await responder(
                    formatarTexto(mensagens.escolhaCategoria || `🍽️ *ESCOLHA UMA CATEGORIA:*\n\n{listaCategorias}\n\n_Digite o número desejado:_`, {
                        restaurante: config.nomeRestaurante,
                        listaCategorias: listaCats
                    })
                );
            } else if (numOpcao === 2 || mensagemLower.includes('concluir') || mensagemLower.includes('finalizar') || mensagemLower.includes('entrega')) {
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_delivery_type'
                });

                return await responder(
                    formatarTexto(mensagens.tipoEntrega || `🛵 *COMO DESEJA RECEBER?*\n\n1️⃣ 🛵 Delivery (Taxa {taxa})\n2️⃣ 🛍️ Retirada no Balcão\n\n_Digite 1 ou 2:_`, {
                        taxa: formatarMoeda(config.taxaEntregaPadrao || 5.00)
                    })
                );
            } else {
                return await responder(
                    `⚠️ Digite *1* para adicionar mais itens ou *2* para concluir seu pedido.`
                );
            }
        }

        // ---- ETAPA 5: TIPO DE ENTREGA (DELIVERY / RETIRADA) ----
        case 'waiting_delivery_type': {
            if (numOpcao === 1 || mensagemLower.includes('delivery') || mensagemLower.includes('entrega') || mensagemLower.includes('casa')) {
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_address',
                    tipoEntrega: 'delivery',
                    taxaEntrega: Number(config.taxaEntregaPadrao) || 5.00
                });

                return await responder(
                    formatarTexto(mensagens.solicitarEndereco || `📍 *ENDEREÇO DE ENTREGA:*\n\nPor favor, digite seu endereço completo com rua, número e bairro:`)
                );
            } else if (numOpcao === 2 || mensagemLower.includes('retirada') || mensagemLower.includes('balcão') || mensagemLower.includes('buscar')) {
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_payment_method',
                    tipoEntrega: 'retirada',
                    taxaEntrega: 0,
                    enderecoEntrega: 'Retirada no Balcão'
                });

                return await responder(
                    `🛍️ *RETIRADA NO BALCÃO SELECIONADA!*\n\n` +
                    `Nosso endereço: *${config.endereco}*\n\n` +
                    formatarTexto(mensagens.formaPagamento || `💳 *Escolha a Forma de Pagamento:*\n\n1️⃣ 🔑 PIX\n2️⃣ 💳 Cartão\n3️⃣ 💵 Dinheiro`, {
                        endereco: 'Retirada no Balcão'
                    })
                );
            } else {
                return await responder(`⚠️ Por favor, digite *1* para Delivery ou *2* para Retirada.`);
            }
        }

        // ---- ETAPA 6: ENDEREÇO DE ENTREGA ----
        case 'waiting_address': {
            if (mensagemLimpa.length < 5) {
                return await responder(`⚠️ Por favor, informe um endereço completo com rua, número e bairro para realizarmos a entrega com precisão!`);
            }

            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_payment_method',
                enderecoEntrega: mensagemLimpa
            });

            return await responder(
                formatarTexto(mensagens.formaPagamento || `📍 Endereço registrado:\n*{endereco}*\n\n💳 *Escolha a Forma de Pagamento:*\n1️⃣ 🔑 PIX\n2️⃣ 💳 Cartão\n3️⃣ 💵 Dinheiro`, {
                    endereco: mensagemLimpa
                })
            );
        }

        // ---- ETAPA 7: FORMA DE PAGAMENTO ----
        case 'waiting_payment_method': {
            if (numOpcao === 1 || mensagemLower.includes('pix')) {
                return await finalizarEConfirmarPedido({ responder, from, nomeCliente, estado, config, formaPagamento: 'PIX', trocoPara: null, emitEvent, notificarDono, terms });
            } else if (numOpcao === 2 || mensagemLower.includes('cartao') || mensagemLower.includes('cartão')) {
                return await finalizarEConfirmarPedido({ responder, from, nomeCliente, estado, config, formaPagamento: 'Cartão (Maquininha na Entrega)', trocoPara: null, emitEvent, notificarDono, terms });
            } else if (numOpcao === 3 || mensagemLower.includes('dinheiro')) {
                db.setEstadoConversa(from, {
                    ...estado,
                    status: 'waiting_change',
                    formaPagamento: 'Dinheiro'
                });

                return await responder(
                    formatarTexto(mensagens.trocoDinheiro || `💵 *PAGAMENTO EM DINHEIRO:*\n\nVocê precisa de troco?\n_Digite o valor (Ex: Troco para 50) ou NÃO:_`)
                );
            } else {
                return await responder(
                    `⚠️ Por favor, digite o número da forma de pagamento:\n1️⃣ PIX\n2️⃣ Cartão\n3️⃣ Dinheiro`
                );
            }
        }

        // ---- ETAPA 7.1: TROCO PARA DINHEIRO ----
        case 'waiting_change': {
            let trocoPara = null;
            if (!mensagemLower.includes('nao') && !mensagemLower.includes('não') && !mensagemLower.includes('exato')) {
                const numTroco = mensagemLimpa.match(/(\d+(?:[.,]\d+)?)/);
                if (numTroco) {
                    trocoPara = parseFloat(numTroco[1].replace(',', '.'));
                }
            }

            return await finalizarEConfirmarPedido({
                responder,
                from,
                nomeCliente,
                estado,
                config,
                formaPagamento: 'Dinheiro',
                trocoPara,
                emitEvent,
                notificarDono,
                terms
            });
        }

        // ---- ETAPA 8: CANCELAMENTO SELECIONADO ----
        case 'waiting_cancel_order_selection': {
            const pedidos = db.getPedidosCliente(from);
            const index = numOpcao !== null ? numOpcao - 1 : -1;

            if (index < 0 || index >= pedidos.length) {
                return await responder(`⚠️ Opção inválida. Digite o número correspondente ao pedido que deseja cancelar ou envie *MENU*.`);
            }

            const pedidoParaCancelar = pedidos[index];
            const cancelado = db.cancelarPedido(pedidoParaCancelar.id, from);
            db.limparEstadoConversa(from);

            if (cancelado.success) {
                if (emitEvent) emitEvent('agendamento_cancelado', cancelado.pedido);

                await notificarDono(
                    `⚠️ *PEDIDO CANCELADO PELO CLIENTE*\n\n` +
                    `🎫 *Código:* ${pedidoParaCancelar.codigo}\n` +
                    `👤 *Cliente:* ${pedidoParaCancelar.cliente}\n` +
                    `📱 *Contato:* ${pedidoParaCancelar.telefone.replace('@c.us', '')}\n` +
                    `🍽️ *Itens:* ${pedidoParaCancelar.servico}\n` +
                    `💰 *Valor Total:* ${formatarMoeda(pedidoParaCancelar.total)}`
                );

                return await responder(
                    formatarTexto(mensagens.pedidoCancelado || `✅ Seu pedido *{codigo}* foi cancelado com sucesso!`, {
                        codigo: pedidoParaCancelar.codigo
                    })
                );
            } else {
                return await responder(`⚠️ ${cancelado.error || 'Não foi possível cancelar o pedido.'}`);
            }
        }

        default:
            db.limparEstadoConversa(from);
            return await enviarMenuPrincipal(responder, nomeCliente, config, terms);
    }
}

// =====================================================================
// FLUXO APPOINTMENT — Barbearia/Clínica/PetShop/Salão
// (serviço → profissional → data → horário → confirmação)
// =====================================================================
async function processarFluxoAppointment({ responder, from, nomeCliente, estado, config, mensagens, terms, numOpcao, mensagemLimpa, mensagemLower, emitEvent, notificarDono, niche }) {
    switch (estado.status) {

        // ---- ETAPA 1: ESCOLHA DO SERVIÇO ----
        case 'waiting_service': {
            const servicos = db.getCardapio({ apenasAtivos: true });
            let servicoEscolhido = null;

            if (numOpcao !== null && numOpcao >= 1 && numOpcao <= servicos.length) {
                servicoEscolhido = servicos[numOpcao - 1];
            } else {
                servicoEscolhido = servicos.find(s => mensagemLower.includes(s.nome.toLowerCase()));
            }

            if (!servicoEscolhido) {
                let listaServicos = servicos.map((s, i) => `${i + 1}. ${s.icone || '✂️'} *${s.nome}* — ${formatarMoeda(s.preco)}`).join('\n');
                return await responder(
                    `⚠️ Opção inválida. Escolha um serviço:\n\n${listaServicos}\n\n_Ou envie *MENU* para voltar.`
                );
            }

            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_professional',
                servico: servicoEscolhido
            });

            // Lista de profissionais (genérico — pode ser customizado por nicho no futuro)
            const profissionais = getProfissionais(niche);
            let listaProfissionais = profissionais.map((p, i) => `${i + 1}. ${p.emoji || '👤'} *${p.nome}* — _${p.especialidade}_`).join('\n');

            return await responder(
                `${servicoEscolhido.icone || '✂️'} *${servicoEscolhido.nome}* — ${formatarMoeda(servicoEscolhido.preco)}\n\n` +
                `👤 *Escolha o profissional:*\n\n${listaProfissionais}\n\n` +
                `_Digite o número ou envie *MENU* para voltar._`
            );
        }

        // ---- ETAPA 2: ESCOLHA DO PROFISSIONAL ----
        case 'waiting_professional': {
            const profissionais = getProfissionais(niche);
            let profissionalEscolhido = null;

            if (numOpcao !== null && numOpcao >= 1 && numOpcao <= profissionais.length) {
                profissionalEscolhido = profissionais[numOpcao - 1];
            } else {
                profissionalEscolhido = profissionais.find(p => mensagemLower.includes(p.nome.toLowerCase()));
            }

            if (!profissionalEscolhido) {
                let listaProfissionais = profissionais.map((p, i) => `${i + 1}. ${p.emoji || '👤'} *${p.nome}*`).join('\n');
                return await responder(`⚠️ Profissional não encontrado. Escolha:\n\n${listaProfissionais}`);
            }

            const dias = getProximosDias();
            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_date',
                profissional: profissionalEscolhido,
                diasDisponiveis: dias
            });

            let listaDias = dias.map((d, i) => `${i + 1}. 📅 ${d.label}`).join('\n');
            return await responder(
                `👤 Profissional escolhido: *${profissionalEscolhido.nome}* (${profissionalEscolhido.especialidade})\n\n` +
                `📅 *Escolha a data:*\n\n${listaDias}\n\n` +
                `_Digite o número do dia desejado:_`
            );
        }

        // ---- ETAPA 3: ESCOLHA DA DATA ----
        case 'waiting_date': {
            const dias = estado.diasDisponiveis || getProximosDias();
            let dataEscolhida = null;

            if (numOpcao !== null && numOpcao >= 1 && numOpcao <= dias.length) {
                dataEscolhida = dias[numOpcao - 1];
            }

            if (!dataEscolhida) {
                let listaDias = dias.map((d, i) => `${i + 1}. 📅 ${d.label}`).join('\n');
                return await responder(`⚠️ Dia inválido. Escolha:\n\n${listaDias}`);
            }

            const horarios = getHorariosDisponiveis();
            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_time',
                data: dataEscolhida,
                horariosDisponiveis: horarios
            });

            let listaHorarios = horarios.map((h, i) => `${i + 1}. 🕐 ${h}`).join('\n');
            return await responder(
                `📅 Data: *${dataEscolhida.label}*\n\n` +
                `⏰ *Escolha o horário:*\n\n${listaHorarios}\n\n` +
                `_Digite o número do horário desejado:_`
            );
        }

        // ---- ETAPA 4: ESCOLHA DO HORÁRIO ----
        case 'waiting_time': {
            const horarios = estado.horariosDisponiveis || getHorariosDisponiveis();
            let horarioEscolhido = null;

            if (numOpcao !== null && numOpcao >= 1 && numOpcao <= horarios.length) {
                horarioEscolhido = horarios[numOpcao - 1];
            } else {
                const match = mensagemLimpa.match(/^(\d{1,2})[:h]?(\d{0,2})/);
                if (match) {
                    const hStr = `${match[1].padStart(2, '0')}:${(match[2] || '00').padStart(2, '0')}`;
                    horarioEscolhido = horarios.find(h => h === hStr);
                }
            }

            if (!horarioEscolhido) {
                let listaHorarios = horarios.map((h, i) => `${i + 1}. 🕐 ${h}`).join('\n');
                return await responder(`⚠️ Horário inválido. Escolha:\n\n${listaHorarios}`);
            }

            db.setEstadoConversa(from, {
                ...estado,
                status: 'waiting_confirmation',
                horario: horarioEscolhido
            });

            const { servico, profissional, data } = estado;
            return await responder(
                `✅ *Resumo do Agendamento:*\n\n` +
                `${servico.icone || '✂️'} Serviço: *${servico.nome}*\n` +
                `👤 Profissional: *${profissional.nome}*\n` +
                `📅 Data: *${data.label}*\n` +
                `⏰ Horário: *${horarioEscolhido}*\n` +
                `💰 Valor: *${formatarMoeda(servico.preco)}*\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `*1.* ✅ Confirmar Agendamento\n` +
                `*2.* ❌ Cancelar\n\n` +
                `_Digite 1 para confirmar ou 2 para cancelar._`
            );
        }

        // ---- ETAPA 5: CONFIRMAÇÃO FINAL ----
        case 'waiting_confirmation': {
            if (numOpcao === 2 || mensagemLower.includes('cancel') || mensagemLower.includes('não') || mensagemLower === 'nao') {
                db.limparEstadoConversa(from);
                return await responder(`❌ Agendamento cancelado. Quando quiser marcar, é só enviar *oi*!`);
            }

            if (numOpcao === 1 || mensagemLower.includes('confirm') || mensagemLower.includes('sim') || mensagemLower.includes('ok')) {
                const { servico, profissional, data, horario } = estado;
                db.limparEstadoConversa(from);

                const resultado = await salvarAgendamento({
                    telefone: from,
                    nome: nomeCliente,
                    servico,
                    profissional,
                    data,
                    horario,
                    preco: servico.preco,
                    niche
                });

                const codigo = resultado?.codigo || `AGD-${Date.now()}`;

                await notificarDono(
                    `🔔 *Novo Agendamento!*\n\n` +
                    `👤 Cliente: ${nomeCliente}\n` +
                    `📱 Tel: ${from.replace('@c.us', '')}\n` +
                    `${servico.icone || '✂️'} Serviço: ${servico.nome}\n` +
                    `👤 Profissional: ${profissional.nome}\n` +
                    `📅 Data: ${data.label} às ${horario}\n` +
                    `💰 Valor: ${formatarMoeda(servico.preco)}\n` +
                    `🔖 Código: ${codigo}`
                );

                return await responder(
                    `🎉 *Agendamento Confirmado!*\n\n` +
                    `${servico.icone || '✂️'} *${servico.nome}*\n` +
                    `👤 Profissional: *${profissional.nome}*\n` +
                    `📅 *${data.label}* às *${horario}*\n` +
                    `💰 Valor: *${formatarMoeda(servico.preco)}*\n\n` +
                    `🔖 Código: *${codigo}*\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `📍 Apareça com 5 minutos de antecedência.\n` +
                    `⚠️ Cancelamentos com menos de 2h de antecedência podem ser cobrados.\n\n` +
                    `_Obrigado, ${nomeCliente}_`
                );
            }

            return await responder(
                `Por favor, confirme:\n\n*1.* ✅ Confirmar\n*2.* ❌ Cancelar`
            );
        }

        default:
            db.limparEstadoConversa(from);
            return await enviarMenuPrincipal(responder, nomeCliente, config, terms);
    }
}

// =====================================================================
// HELPERS DO FLUXO APPOINTMENT
// =====================================================================

// Profissionais por nicho (pode ser customizado no futuro via Supabase)
function getProfissionais(niche) {
    const profissionaisPorNiche = {
        barbershop: [
            { id: 1, nome: 'Carlos', emoji: '💈', especialidade: 'Corte Degradê' },
            { id: 2, nome: 'Ricardo', emoji: '✂️', especialidade: 'Barba & Acabamento' },
            { id: 3, nome: 'Felipe', emoji: '🎨', especialidade: 'Pigmentação & Coloração' }
        ],
        clinic: [
            { id: 1, nome: 'Dr. Silva', emoji: '🩺', especialidade: 'Clínico Geral' },
            { id: 2, nome: 'Dra. Souza', emoji: '👩‍⚕️', especialidade: 'Dermatologia' },
            { id: 3, nome: 'Dr. Lima', emoji: '👨‍⚕️', especialidade: 'Pediatria' }
        ],
        petshop: [
            { id: 1, nome: 'Ana', emoji: '🐾', especialidade: 'Banho & Tosa' },
            { id: 2, nome: 'Pedro', emoji: '✂️', especialidade: 'Tosa Higiênica' },
            { id: 3, nome: 'Lucia', emoji: '💅', especialidade: 'Estética Animal' }
        ],
        salon: [
            { id: 1, nome: 'Mariana', emoji: '💅', especialidade: 'Corte & Coloração' },
            { id: 2, nome: 'Juliana', emoji: '✨', especialidade: 'Manicure & Pedicure' },
            { id: 3, nome: 'Camila', emoji: '💇‍♀️', especialidade: 'Penteados' }
        ]
    };
    return profissionaisPorNiche[niche] || profissionaisPorNiche['barbershop'];
}

// Próximos 7 dias úteis disponíveis (sem domingo)
function getProximosDias() {
    const dias = [];
    const hoje = new Date();
    let i = 0;
    while (dias.length < 7) {
        i++;
        const d = new Date(hoje);
        d.setDate(hoje.getDate() + i);
        const dow = d.getDay();
        if (dow !== 0) {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            const label = dow === 6 ? 'Sábado' : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dow];
            dias.push({ iso: `${yyyy}-${mm}-${dd}`, label: `${label} ${dd}/${mm}` });
        }
    }
    return dias;
}

// Horários disponíveis (pode ser customizado por nicho no futuro)
function getHorariosDisponiveis() {
    return ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
            '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
            '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'];
}

// Salva o agendamento na tabela `pedidos` com metadata.tipo = niche
async function salvarAgendamento({ telefone, nome, servico, profissional, data, horario, preco, niche }) {
    const config = db.getConfig();
    const codigo = `AGD-${Date.now().toString(36).toUpperCase()}`;
    const hoje = new Date().toISOString().split('T')[0];
    const horaBr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const resultado = db.criarPedido({
        cliente: nome,
        telefone: telefone,
        itens: [{
            id: servico.id,
            nome: `${servico.icone || '✂️'} ${servico.nome} c/ ${profissional.nome}`,
            preco: preco,
            qtd: 1,
            observacao: `Agendamento: ${data.label} às ${horario}`,
            totalItem: preco
        }],
        tipoEntrega: 'agendamento',
        enderecoEntrega: '',
        formaPagamento: 'a_confirmar',
        taxaEntrega: 0,
        origem: 'whatsapp',
        observacoes: JSON.stringify({
            tipo: niche,
            servico_id: servico.id,
            profissional_id: profissional.id,
            profissional_nome: profissional.nome,
            data_agendada: data.iso,
            horario_agendado: horario
        })
    });

    if (resultado.success) {
        return { codigo, id: resultado.pedido.id };
    }
    return { codigo, id: null };
}

// =====================================================================
// MENUS E HELPERS GERAIS
// =====================================================================

async function enviarMenuPrincipal(responder, nomeCliente, config, terms) {
    const mensagens = config.mensagens || {};
    const fechadoHoje = db.isFechadoHoje();
    let avisoFechado = '';
    if (fechadoHoje) {
        avisoFechado = formatarTexto(mensagens.fechadoAviso || `\n🛑 *AVISO:* O estabelecimento está fechado hoje ({motivo}).\n`, {
            motivo: config.motivoFechado || 'Recesso/Descanso'
        });
    }

    const turno = db.getTurnoAtual();
    let avisoTurno = `⏰ *Agora:* ${turno.icone} ${turno.nome} — _${turno.descricao}_\n`;

    const textoMenu = formatarTexto(mensagens.menuPrincipal || `🍽️ *BEM-VINDO AO {restaurante}* 🍽️\n\nOlá, *{nome}*!\n\n{avisoTurno}\n{avisoFechado}\n1️⃣ 🛒 *Fazer Pedido*\n2️⃣ 📋 *Ver Cardápio*\n3️⃣ 🛵 *Status do Pedido*\n4️⃣ 📍 *Informações & Horários*\n5️⃣ ❌ *Cancelar Pedido*\n\n👉 _Digite o número da opção desejada:_`, {
        restaurante: config.nomeRestaurante.toUpperCase(),
        nome: nomeCliente,
        avisoTurno: avisoTurno,
        avisoFechado: avisoFechado
    });

    return await responder(textoMenu);
}

async function iniciarFluxoPedido(responder, from, config, terms) {
    const mensagens = config.mensagens || {};
    db.setEstadoConversa(from, {
        status: 'waiting_category',
        carrinho: []
    });

    const categorias = db.getCategorias(true);
    let listaCats = categorias.map((c, i) => `${i + 1}. ${c.icone || '🍽️'} *${c.nome}*`).join('\n');

    return await responder(
        formatarTexto(mensagens.escolhaCategoria || `🛒 *FAZER PEDIDO — {restaurante}* 🍽️\n\nEscolha a categoria desejada:\n\n{listaCategorias}\n\n_Digite o número desejado:_`, {
            restaurante: config.nomeRestaurante.toUpperCase(),
            listaCategorias: listaCats
        })
    );
}

async function iniciarFluxoAgendamento(responder, from, config, terms) {
    const mensagens = config.mensagens || {};
    db.setEstadoConversa(from, {
        status: 'waiting_service',
        agendamento: {}
    });

    const servicos = db.getCardapio({ apenasAtivos: true });
    let listaServicos = servicos.map((s, i) => `${i + 1}. ${s.icone || '✂️'} *${s.nome}* — ${formatarMoeda(s.preco)}`).join('\n');

    return await responder(
        `✂️ *${config.nomeRestaurante}*\n` +
        `Olá! Escolha o serviço desejado:\n\n${listaServicos}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👉 Digite o *número* do serviço para agendar!\n\n` +
        `_Ou envie *MENU* para voltar._`
    );
}

async function enviarCardapioCompleto(responder, config, terms) {
    const cardapio = db.getCardapio();
    const categorias = db.getCategorias(true);

    let texto = `📜 *CARDÁPIO COMPLETO — ${config.nomeRestaurante.toUpperCase()}*\n\n`;

    for (const cat of categorias) {
        const itensCat = cardapio.filter(i => i.categoria === cat.id);
        if (itensCat.length > 0) {
            texto += `${cat.icone || '🍽️'} *${cat.nome.toUpperCase()}*\n`;
            texto += itensCat.map(it => `• *${it.nome}* — ${formatarMoeda(it.preco)}\n  _${it.descricao || ''}_`).join('\n');
            texto += `\n\n`;
        }
    }

    texto += `━━━━━━━━━━━━━━━━━━━━\n` +
        `🛵 *Taxa de Entrega Padrão:* ${formatarMoeda(config.taxaEntregaPadrao || 5.00)}\n` +
        `💳 *Pagamento:* PIX, Cartão e Dinheiro\n\n` +
        `_Envie *1* para fazer seu pedido agora mesmo!_`;

    return await responder(texto);
}

async function consultarStatusPedido(responder, from, nomeCliente, config, terms) {
    const pedidos = db.getPedidosCliente(from);

    if (pedidos.length === 0) {
        db.limparEstadoConversa(from);
        return await responder(
            `📋 Olá, *${nomeCliente}*!\n\n` +
            `Você não possui nenhum pedido em andamento no momento.\n\n` +
            `Deseja fazer um pedido delicioso agora? Envie *1* para pedir!`
        );
    }

    const mapaStatus = terms.status || {};

    let lista = pedidos.map(p => {
        const statusTexto = mapaStatus[p.status] || p.status;
        const tipoTxt = p.tipoEntrega === 'delivery' ? '🛵 Delivery' : '🛍️ Retirada';
        return `🎫 *Pedido ${p.codigo}*\n` +
            `🍽️ *Itens:* ${p.servico}\n` +
            `💰 *Total:* ${formatarMoeda(p.total)} (${tipoTxt})\n` +
            `⏳ *Previsão:* ${p.tempoEstimado}\n` +
            `📍 *Status:* ${statusTexto}\n`;
    }).join('\n━━━━━━━━━━━━━━━━━━━━\n\n');

    return await responder(
        `🛵 *STATUS DOS SEUS PEDIDOS:*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${lista}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `_Qualquer dúvida ou alteração, nossa equipe está à disposição!_`
    );
}

async function processarFluxoCancelamento(responder, from, nomeCliente, config, terms, emitEvent, notificarDono) {
    const mensagens = config.mensagens || {};
    const pedidos = db.getPedidosCliente(from);

    if (pedidos.length === 0) {
        db.limparEstadoConversa(from);
        return await responder(
            `📋 Olá, *${nomeCliente}*!\n\n` +
            `Você não possui pedidos ativos para cancelar no momento.\n\n` +
            `Envie *1* se desejar fazer um novo pedido.`
        );
    }

    if (pedidos.length === 1) {
        const ped = pedidos[0];
        const res = db.cancelarPedido(ped.id, from);
        db.limparEstadoConversa(from);

        if (res.success) {
            if (emitEvent) emitEvent('agendamento_cancelado', res.pedido);
            await notificarDono(
                `⚠️ *PEDIDO CANCELADO PELO CLIENTE*\n\n` +
                `🎫 *Código:* ${ped.codigo}\n` +
                `👤 *Cliente:* ${ped.cliente}\n` +
                `🍽️ *Itens:* ${ped.servico}\n` +
                `💰 *Valor:* ${formatarMoeda(ped.total)}`
            );

            return await responder(
                formatarTexto(mensagens.pedidoCancelado || `✅ Seu pedido *{codigo}* foi cancelado com sucesso!\n\nCaso queira fazer um novo pedido, envie *MENU*.`, {
                    codigo: ped.codigo
                })
            );
        } else {
            return await responder(`⚠️ ${res.error || 'Não foi possível cancelar o pedido.'}`);
        }
    }

    db.setEstadoConversa(from, { status: 'waiting_cancel_order_selection' });
    let lista = pedidos.map((p, i) => `${i + 1}. *Pedido ${p.codigo}* — ${p.servico} (${formatarMoeda(p.total)})`).join('\n');

    return await responder(
        `📋 *SEUS PEDIDOS ATIVOS:*\n\n` +
        `${lista}\n\n` +
        `_Digite o número do pedido que deseja cancelar (ou envie *MENU* para voltar):_`
    );
}

async function enviarInfoEstabelecimento(responder, config, terms) {
    const mensagens = config.mensagens || {};
    const fechadoHoje = db.isFechadoHoje();
    let statusHoje = fechadoHoje
        ? `🛑 *Hoje:* Fechado (${config.motivoFechado || 'Recesso'})`
        : `🟢 *Hoje:* Aberto para Almoço e Jantar`;

    const textoInfo = formatarTexto(mensagens.infoRestaurante || `📍 *INFORMAÇÕES & ATENDIMENTO — {restaurante}* 🍽️\n\n🏠 *Endereço:* {endereco}\n🍱 *Almoço:* {horarioAlmoco}\n🍕 *Jantar:* {horarioJantar}\n🛵 *Taxa:* {taxa}\n🔑 *PIX:* \`{pix}\`\n📅 *Status:* {statusHoje}\n📱 *Contato:* {telefoneDono}\n\n_Envie *1* para fazer seu pedido!_`, {
        restaurante: config.nomeRestaurante.toUpperCase(),
        endereco: config.endereco,
        horarioAlmoco: config.horarioAlmoco || '11:00 às 15:00',
        horarioJantar: config.horarioJantar || '18:00 às 23:30',
        taxa: formatarMoeda(config.taxaEntregaPadrao || 5.00),
        pix: config.chavePix || 'Não informada',
        statusHoje: statusHoje,
        telefoneDono: config.numeroDono ? config.numeroDono.replace('@c.us', '') : ''
    });

    return await responder(textoInfo);
}

// Helper para avançar para a etapa de bordas / quantidade da pizza
async function avancarParaBordasPizza(responder, from, estado, config, itemEmEdicao) {
    const mensagens = config.mensagens || {};
    const bordasRaw = config.opcoesBordas || [];
    const bordas = bordasRaw.filter(b => b.ativo !== false);

    if (bordas.length > 0) {
        db.setEstadoConversa(from, {
            ...estado,
            status: 'waiting_customization_pizza',
            itemEmEdicao: itemEmEdicao,
            bordasDisponiveis: bordas
        });

        let bordasTexto = bordas.map((b, i) => {
            const precoExtra = b.preco > 0 ? ` (+ ${formatarMoeda(b.preco)})` : '';
            return `${i + 1}. *${b.nome}*${precoExtra}`;
        }).join('\n');

        return await responder(
            formatarTexto(mensagens.escolhaBorda || `🍕 Você escolheu: *{item}* ({preco})\n\n🧀 *Deseja adicionar Borda Recheada ou alguma observação?*\n\n{listaBordas}\n\n_Digite o número ou observação:_`, {
                item: itemEmEdicao.nome,
                preco: formatarMoeda(itemEmEdicao.preco),
                listaBordas: bordasTexto
            })
        );
    } else {
        db.setEstadoConversa(from, {
            ...estado,
            status: 'waiting_quantity',
            itemEmEdicao: itemEmEdicao,
            customizacao: ''
        });

        return await responder(
            `🍕 *${itemEmEdicao.nome}* (${formatarMoeda(itemEmEdicao.preco)})\n\n` +
            `Quantas pizzas dessa você deseja?\n` +
            `_Digite a quantidade (Ex: 1, 2):_`
        );
    }
}

// ---------------------------------------------------------------------
// Finalização e Criação do Pedido
// ---------------------------------------------------------------------
async function finalizarEConfirmarPedido({ responder, from, nomeCliente, estado, config, formaPagamento, trocoPara, emitEvent, notificarDono, terms }) {
    const mensagens = config.mensagens || {};
    const carrinho = estado.carrinho || [];
    if (carrinho.length === 0) {
        db.limparEstadoConversa(from);
        return await responder(`Seu carrinho estava vazio. Digite *MENU* para iniciar um novo pedido!`);
    }

    const taxa = estado.tipoEntrega === 'delivery' ? (Number(estado.taxaEntrega) || Number(config.taxaEntregaPadrao) || 5.00) : 0;

    const resultado = db.criarPedido({
        cliente: nomeCliente,
        telefone: from,
        itens: carrinho,
        tipoEntrega: estado.tipoEntrega || 'delivery',
        enderecoEntrega: estado.enderecoEntrega || '',
        formaPagamento: formaPagamento,
        trocoPara: trocoPara,
        taxaEntrega: taxa,
        origem: 'whatsapp'
    });

    if (!resultado.success) {
        db.limparEstadoConversa(from);
        return await responder(`😔 ${resultado.error || 'Não foi possível processar seu pedido no momento.'}`);
    }

    const ped = resultado.pedido;
    db.limparEstadoConversa(from);

    if (emitEvent) {
        emitEvent('novo_agendamento', ped);
    }

    // Comandas formatadas
    let comandaItensDono = ped.itens.map(i => {
        const obs = i.observacao ? ` (${i.observacao})` : '';
        return `• ${i.qtd}x ${i.nome}${obs} = ${formatarMoeda(i.total)}`;
    }).join('\n');

    let entregaInfoDono = ped.tipoEntrega === 'delivery'
        ? `🛵 *DELIVERY:* ${ped.enderecoEntrega}`
        : `🛍️ *RETIRADA NO BALCÃO*`;

    let trocoTxt = ped.trocoPara ? ` (Troco para ${formatarMoeda(ped.trocoPara)})` : '';

    // Notificação Cozinha
    const msgCozinha = formatarTexto(mensagens.notificacaoCozinha || `🚨 *NOVO PEDIDO CHEGOU!* [{codigo}]\n\n👤 *Cliente:* {nome}\n📱 *WhatsApp:* {telefone}\n{localEntrega}\n💳 *Pagamento:* {formaPagamento}\n\n📝 *ITENS:*\n{itens}\n\n💵 *Subtotal:* {subtotal}\n🛵 *Taxa:* {taxa}\n💰 *TOTAL: {total}*`, {
        codigo: ped.codigo,
        nome: ped.cliente,
        telefone: ped.telefone.replace('@c.us', ''),
        localEntrega: entregaInfoDono,
        formaPagamento: `${ped.formaPagamento}${trocoTxt}`,
        itens: comandaItensDono,
        subtotal: formatarMoeda(ped.subtotal),
        taxa: formatarMoeda(ped.taxaEntrega),
        total: formatarMoeda(ped.total),
        hora: ped.horario,
        id: ped.id
    });
    await notificarDono(msgCozinha);

    // Mensagem VIP para o Cliente
    let comandaCliente = ped.itens.map(i => {
        const obs = i.observacao ? `\n   ↳ _${i.observacao}_` : '';
        return `🔹 *${i.qtd}x ${i.nome}* — ${formatarMoeda(i.total)}${obs}`;
    }).join('\n');

    let pixInfoCliente = '';
    if (formaPagamento === 'PIX' && config.chavePix) {
        pixInfoCliente = `\n🔑 *Chave PIX para pagamento:*\n\`${config.chavePix}\`\n_(Envie o comprovante aqui no chat se preferir)_\n`;
    }

    let localEntregaCliente = ped.tipoEntrega === 'delivery'
        ? `📍 *Endereço de Entrega:* ${ped.enderecoEntrega}`
        : `🛍️ *Retirar no Restaurante:* ${config.endereco}`;

    let taxaInfoCliente = ped.taxaEntrega > 0 ? `🛵 *Taxa de Entrega:* ${formatarMoeda(ped.taxaEntrega)}\n` : '';

    const msgCliente = formatarTexto(mensagens.pedidoConfirmadoCliente || `🎉 *PEDIDO RECEBIDO COM SUCESSO!* 🎉\n\n🍽️ *{restaurante}*\n🎫 *Pedido:* *{codigo}*\n👤 *Cliente:* {nome}\n{localEntrega}\n💳 *Pagamento:* {formaPagamento}\n{pixInfo}\n\n📋 *ITENS:*\n{itens}\n\n💵 *Subtotal:* {subtotal}\n{taxaInfo}💰 *TOTAL:* {total}\n⏳ *Previsão:* {tempo}`, {
        restaurante: config.nomeRestaurante.toUpperCase(),
        codigo: ped.codigo,
        nome: ped.cliente,
        localEntrega: localEntregaCliente,
        formaPagamento: `${ped.formaPagamento}${trocoTxt}`,
        pixInfo: pixInfoCliente,
        itens: comandaCliente,
        subtotal: formatarMoeda(ped.subtotal),
        taxaInfo: taxaInfoCliente,
        total: formatarMoeda(ped.total),
        tempo: ped.tempoEstimado
    });

    return await responder(msgCliente);
}

module.exports = {
    processarMensagem,
    getNiche,
    refreshNicheCache
};
