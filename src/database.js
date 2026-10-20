const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { getMensagensNicho } = require('./niches');
const { carregarTenant } = require('./tenants');

// =====================================================================
// Diretório base da aplicação (compatível com pkg .exe e modo dev)
// =====================================================================
const APP_DIR = process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');

// =====================================================================
// Credenciais do Banco Multi-Tenant (delivery_platform)
// Definidas via variáveis de ambiente OU hardcoded aqui como fallback
// =====================================================================
// Preferência: chave de serviço (engine multi-tenant) — aceita tanto
// SUPABASE_SERVICE_ROLE_KEY quanto SUPABASE_SERVICE_KEY; com fallback para
// SUPABASE_KEY e depois a publishable key usada nas instalações standalone
// (pkg / painel local).
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://errczksxtizgpmjzfhnv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
                  || process.env.SUPABASE_SERVICE_KEY
                  || process.env.SUPABASE_KEY
                  || 'sb_publishable_MmLNWGDwYO0fVxVUC8lCEA_pU113fNw';

// =====================================================================
// Identidade do tenant — resolvida na seguinte ordem:
//   1. process.env.CLIENTE_ID (PM2 / .env do ecosystem)  ← engines multi-tenant
//   2. config_delivery.json (instalações standalone / pkg)
// Nenhum dado de negócio é gravado em arquivo: o Supabase é a fonte.
// =====================================================================
let CLIENTE_ID    = '';
let NOME_CLIENTE  = 'Estabelecimento';
let NICHE_PADRAO  = null;

// Ambiente (PM2 / dotenv) — estrito em minúsculas
if (process.env.CLIENTE_ID) {
    CLIENTE_ID = String(process.env.CLIENTE_ID).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    process.env.CLIENTE_ID = CLIENTE_ID;
}
if (process.env.NICHE) {
    NICHE_PADRAO = String(process.env.NICHE).trim().toLowerCase() || null;
}

// =====================================================================
// TRAVA DE SEGURANÇA — impede iniciar sem identidade de tenant definida.
// Sem isso, cada instalação esquecida criaria um registro junk na tabela
// `clientes` do banco compartilhado. Na engine o CLIENTE_ID vem do env
// do PM2 (.env / ecosystem.config.js); em instalações standalone vem do
// config_delivery.json.
// =====================================================================
const CONFIG_EXEMPLO = 'troque_este_campo';
if (!CLIENTE_ID || CLIENTE_ID === CONFIG_EXEMPLO) {
    console.error('\n' + '='.repeat(70));
    console.error(' ERRO: CLIENTE_ID não configurado.');
    console.error('='.repeat(70));
    console.error(' Modo Engine (PM2): defina "CLIENTE_ID" no .env ou no env');
    console.error('   de cada app do ecosystem.config.js.');
    console.error(' Modo Standalone: abra o arquivo "config_delivery.json" e');
    console.error('   preencha "clienteId" e "nomeEstabelecimento".');
    console.error('');
    console.error(' Exemplo: "climeditu2" / "Clínica Editu"');
    console.error('='.repeat(70) + '\n');
    process.exit(1);
}

// =====================================================================
// Seeds de provisionamento — usados SOMENTE ao criar um cliente NOVO
// no Supabase. Não são mais persistidos em arquivo local nem enviados
// para a nuvem depois da criação (não sobrescrevem atualizações SaaS).
// =====================================================================
const DEFAULT_CATEGORIAS = [];

const DEFAULT_CARDAPIO = [];

const DEFAULT_OPCOES_CARNES = [];
const DEFAULT_OPCOES_BORDAS = [];

const DEFAULT_CONFIG = {
    nomeRestaurante:    NOME_CLIENTE,
    nomeSalao:          NOME_CLIENTE,
    slogan:             '',
    numeroDono:         '',
    chavePix:           '',
    endereco:           '',
    taxaEntregaPadrao:  5.00,
    tempoEstimadoMin:   30,
    tempoEstimadoMax:   50,
    horarioAlmoco:      '',
    horarioJantar:      '',
    fechadoHoje:        false,
    motivoFechado:      '',
    dataFechadaManual:  null,
    diasSemana: { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' },
    categorias:    [],
    cardapio:      [],
    opcoesCarnes:  [],
    opcoesBordas:  [],
    mensagens:     {}
};

// =====================================================================
// Cliente Supabase — única fonte de verdade do sistema
// =====================================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

// Cache em memória (NÃO há mais arquivo local: agendamentos.json removido)
let cacheLocal = {
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    pedidos: [],
    agendamentos: [],
    conversa: {},
    niche: NICHE_PADRAO
};

// =====================================================================
// "Persistência" LOCAL agora é apenas memória.
// carregarDados/salvarDados continuam exportados para compatibilidade
// com a API antiga, mas NÃO escrevem nada em disco.
// =====================================================================
function carregarDados() {
    return cacheLocal;
}

function salvarDados(data) {
    cacheLocal = data;
    if (!cacheLocal.pedidos && cacheLocal.agendamentos) cacheLocal.pedidos = cacheLocal.agendamentos;
    if (!cacheLocal.agendamentos && cacheLocal.pedidos) cacheLocal.agendamentos = cacheLocal.pedidos;
    return true;
}

// =====================================================================
// AUTO-PROVISIONAMENTO: cria o cliente no Supabase na 1ª execução.
// IMPORTANTE (multi-tenant): se o cliente JÁ EXISTE, nada é sobrescrito.
// O Supabase (painel SaaS) é a fonte de verdade para dados editados.
// =====================================================================
async function provisionarCliente() {
    try {
        const { data: existe } = await supabase
            .from('clientes')
            .select('id, nome')
            .eq('id', CLIENTE_ID)
            .single();

        if (existe) {
            console.log(`✅ [SUPABASE] Cliente "${CLIENTE_ID}" já cadastrado. Nada a alterar.`);
            return true;
        }

        // Não existe — cria o registro do cliente (auto-provisioning)
        const cfg = cacheLocal.config;
        const { error } = await supabase.from('clientes').insert({
            id:                 CLIENTE_ID,
            nome:               NOME_CLIENTE,
            telefone_dono:      cfg.numeroDono       || '',
            chave_pix:          cfg.chavePix         || '',
            endereco:           cfg.endereco         || '',
            taxa_entrega:       cfg.taxaEntregaPadrao || 5.00,
            tempo_estimado_min: cfg.tempoEstimadoMin  || 30,
            tempo_estimado_max: cfg.tempoEstimadoMax  || 50,
            horario_almoco:     cfg.horarioAlmoco    || '11:00 às 15:00',
            horario_jantar:     cfg.horarioJantar    || '18:00 às 23:30',
            fechado_hoje:       false,
            motivo_fechado:     '',
            ativo:              true,
            plano:              'basico',
            niche:              NICHE_PADRAO,
            created_at:         new Date().toISOString(),
            updated_at:         new Date().toISOString()
        });

        if (error) throw error;
        console.log(`🎉 [SUPABASE] Cliente "${CLIENTE_ID}" criado com sucesso no banco!`);

        // Provisiona cardápio/categorias/opções apenas para cliente NOVO
        await provisionarCardapioPadrao();
        await provisionarCategoriasPadrao();
        await provisionarOpcoesPadrao();

        return true;
    } catch (err) {
        console.error('⚠️ [SUPABASE] Erro no provisionamento do cliente:', err.message);
        return false;
    }
}

async function provisionarCardapioPadrao() {
    try {
        const rows = DEFAULT_CARDAPIO.map(item => ({
            cliente_id: CLIENTE_ID,
            item_id:    item.id,
            categoria:  item.categoria,
            nome:       item.nome,
            descricao:  item.descricao || '',
            preco:      item.preco,
            turno:      item.turno || 'todos',
            icone:      item.icone || '🍽️',
            ativo:      item.ativo !== false,
            ordem:      item.id
        }));
        await supabase.from('cardapio').upsert(rows, { onConflict: 'cliente_id,item_id' });
        console.log(`📋 [SUPABASE] Cardápio padrão criado para "${CLIENTE_ID}".`);
    } catch (err) {
        console.warn('⚠️ [SUPABASE] Cardápio padrão não provisionado:', err.message);
    }
}

async function provisionarCategoriasPadrao() {
    try {
        const rows = DEFAULT_CATEGORIAS.map(cat => ({
            cliente_id:  CLIENTE_ID,
            categoria_id: cat.id,
            nome:        cat.nome,
            icone:       cat.icone || '🍽️',
            turno:       cat.turno || 'todos',
            ordem:       cat.ordem || 0,
            ativo:       cat.ativo !== false
        }));
        await supabase.from('categorias').upsert(rows, { onConflict: 'cliente_id,categoria_id' });
    } catch (err) {
        console.warn('⚠️ [SUPABASE] Categorias não provisionadas:', err.message);
    }
}

async function provisionarOpcoesPadrao() {
    try {
        const carnes = DEFAULT_OPCOES_CARNES.map(o => ({
            cliente_id: CLIENTE_ID, tipo: 'carne', opcao_id: o.id, nome: o.nome, preco: 0, ativo: o.ativo !== false
        }));
        const bordas = DEFAULT_OPCOES_BORDAS.map(o => ({
            cliente_id: CLIENTE_ID, tipo: 'borda', opcao_id: o.id, nome: o.nome, preco: o.preco || 0, ativo: o.ativo !== false
        }));
        await supabase.from('opcoes_extras').upsert([...carnes, ...bordas], { onConflict: 'cliente_id,tipo,opcao_id' });
    } catch (err) {
        console.warn('⚠️ [SUPABASE] Opções extras não provisionadas:', err.message);
    }
}

// =====================================================================
// =====================================================================
// Leitura das mensagens do bot com resolução estrita de precedência:
//   1. Base = Nicho (src/niches.js)
//   2. Componente Tenant (src/tenants/${clienteId}.js)
//   3. Tabela mensagens_bot no Supabase (personalizações salvas)
// Precedência de entrega final: Banco ➔ Componente Tenant ➔ Nicho
// =====================================================================
async function carregarMensagensDoNicho(niche, clienteId = CLIENTE_ID) {
    const resolvidas = await getMensagensResolvidas(clienteId, niche);
    return resolvidas.mensagens;
}

/**
 * Retorna as mensagens com o fallback completo:
 * 1. Base do Nicho
 * 2. Componente do Tenant (se existir em src/tenants/)
 * 3. Tabela mensagens_bot no Supabase (personalizações salvas)
 */
async function getMensagensResolvidas(clienteId = CLIENTE_ID, niche = null) {
    const resolvedClienteId = (clienteId || CLIENTE_ID || 'default').toLowerCase().trim();
    const nichoAlvo = niche || cacheLocal.niche || 'delivery';

    // 1. Nicho base
    const padraoNicho = { ...getMensagensNicho(nichoAlvo) };
    const padroes = { ...padraoNicho };

    // 2. Componente do Tenant
    try {
        const tenant = carregarTenant(resolvedClienteId);
        if (tenant) {
            if (tenant.menuPrincipal) {
                padroes.menuPrincipal = tenant.menuPrincipal;
            }
            if (tenant.mensagens && typeof tenant.mensagens === 'object') {
                Object.assign(padroes, tenant.mensagens);
            }
        }
    } catch (e) {
        console.warn('⚠️ [TENANT] Falha ao resolver componente tenant:', e.message);
    }

    const mensagens = { ...padroes };
    const customizadas = {};

    // 3. Supabase mensagens_bot (fonte da verdade de edições do cliente)
    try {
        const { data: rowsMen } = await supabase
            .from('mensagens_bot')
            .select('chave, conteudo')
            .eq('cliente_id', resolvedClienteId);

        (rowsMen || []).forEach(m => {
            if (m && m.chave) {
                const conteudoStr = String(m.conteudo !== undefined ? m.conteudo : '').trim();
                if (conteudoStr !== '') {
                    mensagens[m.chave] = m.conteudo;
                    customizadas[m.chave] = true;
                }
            }
        });
    } catch (e) {
        // Tabela pode estar indisponível ou offline
    }

    return {
        clienteId: resolvedClienteId,
        niche: nichoAlvo,
        mensagens,
        padroes,
        customizadas
    };
}

/**
 * Salva ou remove customizações de mensagens do cliente no Supabase
 */
async function salvarMensagensBot(payload, clienteId = CLIENTE_ID) {
    const resolvedClienteId = (clienteId || CLIENTE_ID || 'default').toLowerCase().trim();
    let lista = [];

    if (Array.isArray(payload)) {
        lista = payload;
    } else if (payload && Array.isArray(payload.mensagens)) {
        lista = payload.mensagens;
    } else if (payload && payload.mensagens && typeof payload.mensagens === 'object') {
        lista = Object.entries(payload.mensagens).map(([chave, conteudo]) => ({ chave, conteudo }));
    } else if (payload && typeof payload === 'object') {
        lista = Object.entries(payload).map(([chave, conteudo]) => ({ chave, conteudo }));
    }

    const salvar = [];
    const remover = [];

    for (const item of lista) {
        const chave = String(item.chave || '').trim();
        if (!chave) continue;

        const conteudo = String(item.conteudo !== undefined ? item.conteudo : '').trim();
        if (conteudo === '' || item.restaurar) {
            remover.push(chave);
        } else {
            salvar.push({ chave, conteudo: item.conteudo });
        }
    }

    try {
        if (remover.length > 0) {
            await supabase
                .from('mensagens_bot')
                .delete()
                .eq('cliente_id', resolvedClienteId)
                .in('chave', remover);
        }

        if (salvar.length > 0) {
            const rows = salvar.map(s => ({
                cliente_id: resolvedClienteId,
                chave: s.chave,
                conteudo: s.conteudo,
                updated_at: new Date().toISOString()
            }));
            await supabase
                .from('mensagens_bot')
                .upsert(rows, { onConflict: 'cliente_id,chave' });
        }
    } catch (err) {
        console.error('⚠️ [SUPABASE] Erro ao salvar mensagens_bot:', err.message);
        throw err;
    }

    const resolvidas = await getMensagensResolvidas(resolvedClienteId, cacheLocal.niche);
    if (resolvedClienteId === CLIENTE_ID) {
        cacheLocal.config.mensagens = resolvidas.mensagens;
    }

    return resolvidas;
}

// =====================================================================
// SINCRONIZAÇÃO: Supabase → cache (roda na inicialização e a cada 20s)
// FLUXO 100% READ-ONLY no boot: nada do cache local é enviado de volta
// para o banco aqui. Assim o boot NUNCA sobrescreve nem limpa registros
// atualizados no Supabase (cardápio, categoria, opções, mensagens).
// Escreve apenas o que é exclusivamente local (pedidos pendentes) e
// nunca apaga o que veio da nuvem.
// =====================================================================
async function sincronizarComSupabase() {
    try {
        // 1. Dados do cliente (fonte de verdade) + nicho + mensagens
        const { data: clienteData } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', CLIENTE_ID)
            .single();

        if (clienteData) {
            cacheLocal.config.nomeRestaurante  = clienteData.nome               || cacheLocal.config.nomeRestaurante;
            cacheLocal.config.nomeSalao        = cacheLocal.config.nomeRestaurante;
            cacheLocal.config.numeroDono       = clienteData.telefone_dono      || cacheLocal.config.numeroDono;
            cacheLocal.config.chavePix         = clienteData.chave_pix          || cacheLocal.config.chavePix;
            cacheLocal.config.endereco         = clienteData.endereco           || cacheLocal.config.endereco;
            cacheLocal.config.taxaEntregaPadrao = Number(clienteData.taxa_entrega) || cacheLocal.config.taxaEntregaPadrao;
            cacheLocal.config.tempoEstimadoMin  = clienteData.tempo_estimado_min  || cacheLocal.config.tempoEstimadoMin;
            cacheLocal.config.tempoEstimadoMax  = clienteData.tempo_estimado_max  || cacheLocal.config.tempoEstimadoMax;
            cacheLocal.config.horarioAlmoco     = clienteData.horario_almoco    || cacheLocal.config.horarioAlmoco;
            cacheLocal.config.horarioJantar     = clienteData.horario_jantar    || cacheLocal.config.horarioJantar;
            cacheLocal.config.fechadoHoje       = clienteData.fechado_hoje !== undefined ? clienteData.fechado_hoje : cacheLocal.config.fechadoHoje;
            cacheLocal.config.motivoFechado     = clienteData.motivo_fechado    || cacheLocal.config.motivoFechado;

            const niche = (clienteData.niche || cacheLocal.niche || NICHE_PADRAO);
            if (niche !== cacheLocal.niche) {
                cacheLocal.niche = niche;
                console.log(`[NICHE] Cliente "${CLIENTE_ID}" → nicho "${niche}".`);
            }
            // Compatibilidade com db.getNiche() do Motor Único
            cacheLocal.config.niche = niche;

            cacheLocal.config.mensagens = await carregarMensagensDoNicho(niche);
        }

        // 2. Cardápio do Supabase (nuvem manda; NÃO envia local de volta)
        const { data: cardapioData } = await supabase
            .from('cardapio')
            .select('*')
            .eq('cliente_id', CLIENTE_ID)
            .order('ordem', { ascending: true });

        if (cardapioData && cardapioData.length > 0) {
            cacheLocal.config.cardapio = cardapioData.map(r => ({
                id:        r.item_id,
                categoria: r.categoria,
                nome:      r.nome,
                descricao: r.descricao || '',
                preco:     Number(r.preco),
                turno:     r.turno || 'todos',
                icone:     r.icone || '🍽️',
                ativo:     r.ativo !== false
            }));
        } else {
            cacheLocal.config.cardapio = [];
        }

        // 3. Categorias do Supabase
        const { data: categoriasData } = await supabase
            .from('categorias')
            .select('*')
            .eq('cliente_id', CLIENTE_ID)
            .order('ordem', { ascending: true });

        if (categoriasData && categoriasData.length > 0) {
            cacheLocal.config.categorias = categoriasData.map(r => ({
                id:    r.categoria_id,
                nome:  r.nome,
                icone: r.icone || '🍽️',
                turno: r.turno || 'todos',
                ordem: r.ordem || 0,
                ativo: r.ativo !== false
            }));
        } else {
            cacheLocal.config.categorias = [];
        }

        // 4. Opções extras (carnes e bordas)
        const { data: opcoesData } = await supabase
            .from('opcoes_extras')
            .select('*')
            .eq('cliente_id', CLIENTE_ID);

        if (opcoesData && opcoesData.length > 0) {
            const carnes = opcoesData.filter(o => o.tipo === 'carne').map(o => ({ id: o.opcao_id, nome: o.nome, ativo: o.ativo }));
            const bordas = opcoesData.filter(o => o.tipo === 'borda').map(o => ({ id: o.opcao_id, nome: o.nome, preco: Number(o.preco), ativo: o.ativo }));
            if (carnes.length > 0) cacheLocal.config.opcoesCarnes = carnes;
            if (bordas.length > 0) cacheLocal.config.opcoesBordas = bordas;
        }

        // 5. Pedidos do Supabase (nuvem manda; mantém só os locais pendentes)
        const { data: pedData } = await supabase
            .from('pedidos')
            .select('*')
            .eq('cliente_id', CLIENTE_ID)
            .order('criado_em', { ascending: false })
            .limit(500);

        if (pedData && pedData.length > 0) {
            const mapped = pedData.map(p => ({
                id:              p.id,
                codigo:          p.codigo,
                cliente:         p.nome_cliente,
                telefone:        p.telefone,
                data:            p.data,
                horario:         p.horario,
                itens:           Array.isArray(p.itens) ? p.itens : [],
                servico:         p.servico || '',
                subtotal:        Number(p.subtotal) || 0,
                taxaEntrega:     Number(p.taxa_entrega) || 0,
                total:           Number(p.total) || 0,
                preco:           Number(p.total) || 0,
                tipoEntrega:     p.tipo_entrega || 'delivery',
                enderecoEntrega: p.endereco_entrega || '',
                bairro:          p.bairro || '',
                formaPagamento:  p.forma_pagamento || 'PIX',
                trocoPara:       p.troco_para ? Number(p.troco_para) : null,
                observacoes:     p.observacoes || '',
                status:          p.status || 'pendente',
                origem:          p.origem || 'whatsapp',
                tempoEstimado:   '',
                criadoEm:        p.criado_em,
                canceladoEm:     p.cancelado_em,
                concluidoEm:     p.concluido_em
            }));

            // Preserva apenas pedidos ainda não enviados à nuvem (offline)
            const idsNuvem = new Set(mapped.map(m => m.id));
            const apenasLocais = (cacheLocal.pedidos || []).filter(p => !idsNuvem.has(p.id));
            cacheLocal.pedidos      = [...mapped, ...apenasLocais];
            cacheLocal.agendamentos = cacheLocal.pedidos;
        }

        return true;
    } catch (err) {
        console.warn('⚠️ [SUPABASE] Erro na sincronização:', err.message);
        return false;
    }
}

// =====================================================================
// INICIALIZAÇÃO (chamada pelo server.js)
// =====================================================================
async function inicializarDatabase() {
    console.log(`\n🔌 [DELIVERY PLATFORM] Iniciando para o cliente: "${CLIENTE_ID}"`);
    console.log(`🏪 Estabelecimento: ${NOME_CLIENTE}`);
    console.log(`🌐 Banco: ${SUPABASE_URL}\n`);

    // 1ª passada: provisiona o cliente se ainda não existe no banco
    const provisionado = await provisionarCliente();

    // Sincroniza dados do Supabase → cache (read-only no boot)
    if (provisionado) {
        const ok = await sincronizarComSupabase();
        if (ok) {
            console.log(`✅ [NUVEM] Dados sincronizados com sucesso para "${CLIENTE_ID}"!`);
        } else {
            console.log(`ℹ️ [OFFLINE] Operando 100% em memória até a conexão voltar.`);
        }
    }

    // Sincroniza a cada 20 segundos
    setInterval(() => {
        sincronizarComSupabase().catch(() => {});
    }, 20000);
}

// =====================================================================
// Helpers de data / turno
// =====================================================================
function formatarDataLocal(d = new Date()) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function isFechadoHoje(dados = null) {
    if (!dados) dados = cacheLocal;
    const config  = dados.config || {};
    const hojeStr = formatarDataLocal(new Date());
    if (config.fechadoHoje === true) {
        if (!config.dataFechadaManual || config.dataFechadaManual === hojeStr) return true;
    }
    return false;
}

// Turno de comida é exclusivo do nicho delivery.
// Para nichos fora de delivery (agendamento: barbershop, clinic, petshop,
// salon) retorna null — o botEngine suprime totalmente a linha de turno.
function getTurnoAtual(niche) {
    if (niche && niche !== 'delivery') return null;

    const agora   = new Date();
    const minutos = agora.getHours() * 60 + agora.getMinutes();
    if (minutos >= 630 && minutos <= 930)  return { tipo: 'dia',   nome: 'Almoço (Marmitex)',   icone: '🍱', descricao: 'Marmitex fresquinhos saindo quentinhos do fogão!' };
    if (minutos >= 1050 || minutos <= 60)  return { tipo: 'noite', nome: 'Jantar & Pizzaria',    icone: '🍕', descricao: 'Pizzas artesanais quentinhas assadas no capricho!' };
    return { tipo: 'geral', nome: cacheLocal.config.nomeRestaurante || NOME_CLIENTE, icone: '🍽️', descricao: 'Almoço (Marmitex 11h às 15h) e Noite (Pizzas 18h às 23h30)' };
}

// Horário "normal" para nichos de agendamento (barbershop, clinic, petshop,
// salon). Exibe somente o que o tenant REALMENTE configurou — os valores
// padrão de delivery ('11:00 às 15:00' / '18:00 às 23:30') são ignorados,
// para não vazar horário de restaurante num menu de clínica/barbearia.
function getHorarioNormal() {
    const cfg = cacheLocal.config || {};
    const hAberto  = String(cfg.horarioAlmoco || '').trim();
    const hFecha   = String(cfg.horarioJantar || '').trim();
    const DEFAULT_ALMOCO = '11:00 às 15:00';
    const DEFAULT_JANTAR = '18:00 às 23:30';

    const partes = [];
    if (hAberto && hAberto !== DEFAULT_ALMOCO) partes.push(hAberto);
    if (hFecha && hFecha !== DEFAULT_JANTAR && hFecha !== hAberto) partes.push(hFecha);
    return partes.join(' / ');
}

// =====================================================================
// Cardápio & Categorias
// =====================================================================
function getCategorias(apenasAtivas = true) {
    let cats = cacheLocal.config.categorias || [];
    if (apenasAtivas) cats = cats.filter(c => c.ativo !== false);
    return cats.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}

function getCardapio(filtro = {}) {
    let cardapio = cacheLocal.config.cardapio || [];
    if (filtro.categoria)                            cardapio = cardapio.filter(i => i.categoria === filtro.categoria);
    if (filtro.turno && filtro.turno !== 'todos')    cardapio = cardapio.filter(i => i.turno === filtro.turno || i.turno === 'todos');
    if (filtro.apenasAtivos !== false)               cardapio = cardapio.filter(i => i.ativo !== false);
    return cardapio;
}

// =====================================================================
// CRIAR PEDIDO
// =====================================================================
function criarPedido({
    cliente, telefone, itens = [], tipoEntrega = 'delivery',
    enderecoEntrega = '', bairro = '', formaPagamento = 'PIX',
    trocoPara = null, taxaEntrega = 0, observacoes = '', origem = 'whatsapp',
    data = null, horario = null
}) {
    const dados   = cacheLocal;
    const agora   = new Date();
    const dataStr = data || formatarDataLocal(agora);
    const horaStr = horario || agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (isFechadoHoje(dados)) {
        return { success: false, error: `O restaurante está fechado no momento (${dados.config.motivoFechado || 'Atendimento pausado'}).`, codigo: 'RESTAURANTE_FECHADO' };
    }

    let subtotal = 0;
    const itensProcessados = itens.map((item, idx) => {
        const preco     = Number(item.preco) || 0;
        const qtd       = Number(item.qtd) || 1;
        const totalItem = preco * qtd;
        subtotal += totalItem;
        return { id: item.id || (idx + 1), nome: item.nome, qtd, preco, total: totalItem, observacao: item.observacao || '', opcoesCarne: item.opcoesCarne || null, borda: item.borda || null };
    });

    const taxa  = (tipoEntrega === 'delivery') ? (Number(taxaEntrega) || Number(dados.config.taxaEntregaPadrao) || 5.00) : 0;
    const total = subtotal + taxa;

    const numAleatorio     = Math.floor(1000 + Math.random() * 9000);
    const idGerado         = 'ped_' + Date.now() + '_' + numAleatorio;
    const codigoExibicao   = `#PED-${numAleatorio}`;
    const resumoItensTexto = itensProcessados.map(i => `${i.qtd}x ${i.nome}`).join(' + ');

    const novoPedido = {
        id: idGerado, codigo: codigoExibicao,
        cliente: cliente || 'Cliente WhatsApp', telefone,
        data: dataStr, horario: horaStr,
        itens: itensProcessados,
        servico: resumoItensTexto || 'Pedido',
        subtotal, taxaEntrega: taxa, total, preco: total,
        tipoEntrega, enderecoEntrega: enderecoEntrega || '', bairro: bairro || '',
        formaPagamento, trocoPara: trocoPara ? Number(trocoPara) : null,
        observacoes: observacoes || '', status: 'pendente', origem,
        tempoEstimado: `${dados.config.tempoEstimadoMin || 35} a ${dados.config.tempoEstimadoMax || 50} min`,
        criadoEm: agora.toISOString(), canceladoEm: null, concluidoEm: null
    };

    dados.pedidos.unshift(novoPedido);
    dados.agendamentos = dados.pedidos;
    if (dados.conversa && dados.conversa[telefone]) delete dados.conversa[telefone];
    salvarDados(dados);

    // Persiste no Supabase em segundo plano
    (async () => {
        try {
            await supabase.from('pedidos').insert({
                id:               novoPedido.id,
                cliente_id:       CLIENTE_ID,
                codigo:           novoPedido.codigo,
                nome_cliente:     novoPedido.cliente,
                telefone:         novoPedido.telefone,
                data:             novoPedido.data,
                horario:          novoPedido.horario,
                itens:            novoPedido.itens,
                servico:          novoPedido.servico,
                subtotal:         novoPedido.subtotal,
                taxa_entrega:     novoPedido.taxaEntrega,
                total:            novoPedido.total,
                tipo_entrega:     novoPedido.tipoEntrega,
                endereco_entrega: novoPedido.enderecoEntrega,
                bairro:           novoPedido.bairro,
                forma_pagamento:  novoPedido.formaPagamento,
                troco_para:       novoPedido.trocoPara,
                observacoes:      novoPedido.observacoes,
                status:           novoPedido.status,
                origem:           novoPedido.origem,
                criado_em:        novoPedido.criadoEm
            });
        } catch (err) {}
    })();

    return { success: true, pedido: novoPedido, agendamento: novoPedido };
}

// =====================================================================
// ATUALIZAR STATUS DO PEDIDO
// =====================================================================
function atualizarStatusPedido(id, novoStatus) {
    const dados  = cacheLocal;
    const pedido = dados.pedidos.find(p => p.id === id || p.codigo === id);
    if (!pedido) return { success: false, error: 'Pedido não encontrado.' };

    const agora     = new Date().toISOString();
    pedido.status   = novoStatus;
    if (novoStatus === 'concluido') pedido.concluidoEm = agora;
    if (novoStatus === 'cancelado') pedido.canceladoEm = agora;
    salvarDados(dados);

    (async () => {
        try {
            await supabase
                .from('pedidos')
                .update({
                    status:       novoStatus,
                    concluido_em: novoStatus === 'concluido' ? agora : null,
                    cancelado_em: novoStatus === 'cancelado' ? agora : null
                })
                .eq('id', pedido.id)
                .eq('cliente_id', CLIENTE_ID);
        } catch (err) {}
    })();

    return { success: true, pedido, agendamento: pedido };
}

function cancelarPedido(id, telefoneSolicitante = null) {
    const dados  = cacheLocal;
    const pedido = dados.pedidos.find(p =>
        (p.id === id || p.codigo === id) &&
        (!telefoneSolicitante || p.telefone === telefoneSolicitante)
    );
    if (!pedido) return { success: false, error: 'Pedido não encontrado ou não pertence a este número.' };
    if (pedido.status === 'concluido' || pedido.status === 'saiu_entrega') {
        return { success: false, error: 'Este pedido já saiu para entrega ou foi concluído e não pode ser cancelado automaticamente.' };
    }
    return atualizarStatusPedido(pedido.id, 'cancelado');
}

// =====================================================================
// BUSCA DE PEDIDOS
// =====================================================================
function getPedidosCliente(telefone) {
    return cacheLocal.pedidos.filter(p =>
        p.telefone === telefone && p.status !== 'cancelado' && p.status !== 'concluido'
    );
}

function getTodosPedidos(filtro = {}) {
    let lista = [...(cacheLocal.pedidos || [])];
    if (filtro.data)   lista = lista.filter(p => p.data === filtro.data);
    if (filtro.status) lista = lista.filter(p => p.status === filtro.status);
    if (filtro.busca) {
        const b = filtro.busca.toLowerCase();
        lista = lista.filter(p =>
            (p.cliente  && p.cliente.toLowerCase().includes(b)) ||
            (p.telefone && p.telefone.includes(b)) ||
            (p.codigo   && p.codigo.toLowerCase().includes(b)) ||
            (p.servico  && p.servico.toLowerCase().includes(b))
        );
    }
    return lista.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
}

// =====================================================================
// ESTATÍSTICAS
// =====================================================================
function getEstatisticas() {
    const dados         = cacheLocal;
    const hoje          = formatarDataLocal(new Date());
    const pedidosHoje   = dados.pedidos.filter(p => p.data === hoje && p.status !== 'cancelado');
    const pendentes     = pedidosHoje.filter(p => p.status === 'pendente' || p.status === 'em_preparo');
    const concluidos    = pedidosHoje.filter(p => p.status === 'concluido');
    const faturamento   = pedidosHoje.reduce((acc, curr) => acc + (curr.total || curr.preco || 0), 0);
    const totalGeral    = dados.pedidos.filter(p => p.status !== 'cancelado').length;

    return {
        pedidosHoje:        pedidosHoje.length,
        pedidosPendentes:   pendentes.length,
        pedidosConcluidos:  concluidos.length,
        faturamentoHoje:    faturamento,
        totalGeral,
        totalConfirmados:   pedidosHoje.length,
        totalConcluidos:    concluidos.length,
        faturamentoEstimado: faturamento,
        agendamentosHoje:   pedidosHoje.length
    };
}

// =====================================================================
// ESTADO DE CONVERSA (chatbot)
// =====================================================================
function getEstadoConversa(telefone) {
    return (cacheLocal.conversa && cacheLocal.conversa[telefone]) || { status: 'idle' };
}

function setEstadoConversa(telefone, estado) {
    if (!cacheLocal.conversa) cacheLocal.conversa = {};
    cacheLocal.conversa[telefone] = { ...estado, atualizadoEm: Date.now() };
    salvarDados(cacheLocal);

    (async () => {
        try {
            await supabase.from('conversas').upsert({
                cliente_id:   CLIENTE_ID,
                telefone,
                estado:       cacheLocal.conversa[telefone],
                atualizado_em: new Date().toISOString()
            });
        } catch (e) {}
    })();
}

function limparEstadoConversa(telefone) {
    if (cacheLocal.conversa && cacheLocal.conversa[telefone]) {
        delete cacheLocal.conversa[telefone];
        salvarDados(cacheLocal);
    }

    (async () => {
        try {
            await supabase
                .from('conversas')
                .delete()
                .eq('cliente_id', CLIENTE_ID)
                .eq('telefone', telefone);
        } catch (e) {}
    })();
}

// =====================================================================
// CONFIGURAÇÕES (getters e setters)
// =====================================================================
function getConfig() {
    // Garante que mensagens existam quando houver nicho configurado
    if ((!cacheLocal.config.mensagens || Object.keys(cacheLocal.config.mensagens).length === 0) && cacheLocal.niche) {
        cacheLocal.config.mensagens = getMensagensNicho(cacheLocal.niche) || {};
    }
    return cacheLocal.config;
}

// Retorna o nicho do tenant (lido do Supabase em tempo de execução)
function getNiche() {
    return cacheLocal.niche || cacheLocal.config.niche || null;
}

function salvarConfig(novaConfig) {
    cacheLocal.config = { ...cacheLocal.config, ...novaConfig };
    if (novaConfig.nomeRestaurante) cacheLocal.config.nomeSalao = novaConfig.nomeRestaurante;
    salvarDados(cacheLocal);

    const cfg = cacheLocal.config;

    // Persiste dados do cliente na tabela `clientes` (ação explícita do painel)
    (async () => {
        try {
            await supabase.from('clientes').upsert({
                id:                 CLIENTE_ID,
                nome:               cfg.nomeRestaurante || cfg.nomeSalao,
                telefone_dono:      cfg.numeroDono       || '',
                chave_pix:          cfg.chavePix         || '',
                endereco:           cfg.endereco         || '',
                taxa_entrega:       cfg.taxaEntregaPadrao || 5.00,
                tempo_estimado_min: cfg.tempoEstimadoMin  || 30,
                tempo_estimado_max: cfg.tempoEstimadoMax  || 50,
                horario_almoco:     cfg.horarioAlmoco    || '11:00 às 15:00',
                horario_jantar:     cfg.horarioJantar    || '18:00 às 23:30',
                fechado_hoje:       Boolean(cfg.fechadoHoje),
                motivo_fechado:     cfg.motivoFechado    || '',
                data_fechada_manual: cfg.dataFechadaManual || null,
                updated_at:         new Date().toISOString()
            });
        } catch (err) {}
    })();

    // Persiste cardápio atualizado
    if (novaConfig.cardapio) {
        (async () => {
            try {
                const rows = (novaConfig.cardapio || []).map(item => ({
                    cliente_id: CLIENTE_ID, item_id: item.id, categoria: item.categoria,
                    nome: item.nome, descricao: item.descricao || '', preco: item.preco,
                    turno: item.turno || 'todos', icone: item.icone || '🍽️',
                    ativo: item.ativo !== false, ordem: item.id, updated_at: new Date().toISOString()
                }));
                await supabase.from('cardapio').upsert(rows, { onConflict: 'cliente_id,item_id' });
            } catch (err) {}
        })();
    }

    // Persiste categorias atualizadas
    if (novaConfig.categorias) {
        (async () => {
            try {
                const rows = (novaConfig.categorias || []).map(cat => ({
                    cliente_id: CLIENTE_ID, categoria_id: cat.id, nome: cat.nome,
                    icone: cat.icone || '🍽️', turno: cat.turno || 'todos',
                    ordem: cat.ordem || 0, ativo: cat.ativo !== false
                }));
                await supabase.from('categorias').upsert(rows, { onConflict: 'cliente_id,categoria_id' });
            } catch (err) {}
        })();
    }

    // Persiste mensagens do bot na tabela mensagens_bot (padrão do painel SaaS)
    if (novaConfig.mensagens) {
        (async () => {
            try {
                const rows = Object.entries(novaConfig.mensagens || {}).map(([chave, conteudo]) => ({
                    cliente_id: CLIENTE_ID,
                    chave,
                    conteudo: conteudo || '',
                    updated_at: new Date().toISOString()
                }));
                if (rows.length > 0) {
                    await supabase.from('mensagens_bot').upsert(rows, { onConflict: 'cliente_id,chave' });
                }
            } catch (err) {}
        })();
    }

    return cacheLocal.config;
}

// =====================================================================
// Aliases de compatibilidade (mantém API existente inalterada)
// =====================================================================
const criarAgendamento = (params) => criarPedido({
    cliente: params.cliente, telefone: params.telefone,
    itens: [{ nome: params.servico || 'Refeição / Pedido', preco: params.preco || 25, qtd: 1 }],
    tipoEntrega: 'agendamento', formaPagamento: 'PIX', origem: params.origem || 'manual'
});
const cancelarAgendamento  = (id, tel)  => cancelarPedido(id, tel);
const concluirAgendamento  = (id)       => atualizarStatusPedido(id, 'concluido');
const getAgendamentosCliente = (tel)    => getPedidosCliente(tel);
const getTodosAgendamentos = (filtro)   => getTodosPedidos(filtro);
const getHorariosDisponiveis    = () => ['11:00', '12:00', '13:00', '14:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
const getProximosDiasDisponiveis = () => [];

async function carregarMensagensDoNicho(niche, clienteId = CLIENTE_ID) {
    const resolvidas = await getMensagensResolvidas(clienteId, niche);
    return resolvidas.mensagens;
}

async function getMensagensResolvidas(clienteId = CLIENTE_ID, niche = null) {
    const resolvedClienteId = (clienteId || CLIENTE_ID || 'default').toLowerCase().trim();
    const nichoAlvo = niche || cacheLocal.niche || 'delivery';

    // 1. Nicho base
    const padraoNicho = { ...getMensagensNicho(nichoAlvo) };
    const padroes = { ...padraoNicho };

    let hasPizzas = nichoAlvo === 'delivery';
    let hasMeats = false;
    let realCategories = [];

    // 2. Componente do Tenant (precedência sobre o nicho base)
    let tenantComponent = null;
    try {
        tenantComponent = carregarTenant(resolvedClienteId);
        if (tenantComponent) {
            if (tenantComponent.menuPrincipal) {
                padroes.menuPrincipal = tenantComponent.menuPrincipal;
            }
            if (tenantComponent.mensagens && typeof tenantComponent.mensagens === 'object') {
                Object.assign(padroes, tenantComponent.mensagens);
            }
            if (typeof tenantComponent.hasPizzas === 'boolean') {
                hasPizzas = tenantComponent.hasPizzas;
            }
            if (typeof tenantComponent.hasMeats === 'boolean') {
                hasMeats = tenantComponent.hasMeats;
            }
        }
    } catch (e) {
        console.warn('⚠️ [TENANT] Falha ao resolver componente tenant:', e.message);
    }

    // Consulta estrita das categorias reais do cardápio no Supabase para validar nicho
    try {
        const { data: rowsCard } = await supabase
            .from('cardapio')
            .select('categoria')
            .eq('cliente_id', resolvedClienteId);

        if (rowsCard && rowsCard.length > 0) {
            realCategories = [...new Set(rowsCard.map(r => r.categoria).filter(Boolean))];
            const temPizzaNaCategoria = realCategories.some(c => /pizza/i.test(c));
            if (!temPizzaNaCategoria && tenantComponent?.hasPizzas !== true) {
                hasPizzas = false;
            }
            if (realCategories.some(c => /marmit/i.test(c) || /prato/i.test(c) || /executivo/i.test(c))) {
                hasMeats = true;
            }
        }
    } catch (e) {
        if (cacheLocal.config?.cardapio && Array.isArray(cacheLocal.config.cardapio)) {
            realCategories = [...new Set(cacheLocal.config.cardapio.map(r => r.categoria).filter(Boolean))];
            if (!realCategories.some(c => /pizza/i.test(c)) && tenantComponent?.hasPizzas !== true) {
                hasPizzas = false;
            }
        }
    }

    // Força estritamente false para sabordapraia
    if (resolvedClienteId === 'sabordapraia') {
        hasPizzas = false;
        hasMeats = false;
    }

    // Se o estabelecimento NÃO vende pizza, remove chaves e referências a pizza dos padrões
    if (!hasPizzas || resolvedClienteId === 'sabordapraia') {
        hasPizzas = false;
        delete padroes.escolhaModoPizza;
        delete padroes.escolhaSegundaMetade;
        delete padroes.escolhaBorda;

        if (padroes.infoRestaurante) {
            padroes.infoRestaurante = padroes.infoRestaurante
                .replace(/🍕 \*Horário da Noite \(Pizzaria\):\* \{horarioJantar\}/g, '🌙 *Horário da Noite:* {horarioJantar}')
                .replace(/🍕 \*Horário da Noite:\* \{horarioJantar\}/g, '🌙 *Horário da Noite:* {horarioJantar}');
        }
    }

    const mensagens = { ...padroes };
    const customizadas = {};

    // 3. Supabase mensagens_bot (fonte da verdade de edições do cliente)
    try {
        const { data: rowsMen } = await supabase
            .from('mensagens_bot')
            .select('chave, conteudo')
            .eq('cliente_id', resolvedClienteId);

        (rowsMen || []).forEach(m => {
            if (m && m.chave) {
                if (!hasPizzas && (m.chave === 'escolhaModoPizza' || m.chave === 'escolhaSegundaMetade' || m.chave === 'escolhaBorda')) {
                    return;
                }
                const conteudoStr = String(m.conteudo !== undefined ? m.conteudo : '').trim();
                if (conteudoStr !== '') {
                    mensagens[m.chave] = m.conteudo;
                    customizadas[m.chave] = true;
                }
            }
        });
    } catch (e) {
        // Tabela pode estar indisponível ou offline
    }

    if (!hasPizzas) {
        delete mensagens.escolhaModoPizza;
        delete mensagens.escolhaSegundaMetade;
        delete mensagens.escolhaBorda;
    }

    return {
        clienteId: resolvedClienteId,
        niche: nichoAlvo,
        hasPizzas,
        hasMeats,
        realCategories,
        mensagens,
        padroes,
        customizadas
    };
}

async function salvarMensagensBot(payload, clienteId = CLIENTE_ID) {
    const resolvedClienteId = (clienteId || CLIENTE_ID || 'default').toLowerCase().trim();
    let lista = [];

    if (Array.isArray(payload)) {
        lista = payload;
    } else if (payload && Array.isArray(payload.mensagens)) {
        lista = payload.mensagens;
    } else if (payload && payload.mensagens && typeof payload.mensagens === 'object') {
        lista = Object.entries(payload.mensagens).map(([chave, conteudo]) => ({ chave, conteudo }));
    } else if (payload && typeof payload === 'object') {
        lista = Object.entries(payload).map(([chave, conteudo]) => ({ chave, conteudo }));
    }

    const salvar = [];
    const remover = [];

    lista.forEach(item => {
        const chave = String(item.chave || '').trim();
        if (!chave) return;
        const conteudo = String(item.conteudo !== undefined ? item.conteudo : '');
        const ehParaRestaurar = Boolean(item.restaurar) || conteudo.trim() === '';

        if (ehParaRestaurar) {
            remover.push(chave);
        } else {
            salvar.push({ chave, conteudo });
        }
    });

    try {
        if (remover.length > 0) {
            await supabase
                .from('mensagens_bot')
                .delete()
                .eq('cliente_id', resolvedClienteId)
                .in('chave', remover);
        }

        if (salvar.length > 0) {
            const rows = salvar.map(v => ({
                cliente_id: resolvedClienteId,
                chave: v.chave,
                conteudo: v.conteudo,
                updated_at: new Date().toISOString()
            }));

            await supabase
                .from('mensagens_bot')
                .upsert(rows, { onConflict: 'cliente_id,chave' });
        }
    } catch (err) {
        console.warn('⚠️ [SUPABASE] Erro ao sincronizar mensagens_bot:', err.message);
    }

    const resolvidas = await getMensagensResolvidas(resolvedClienteId, cacheLocal.niche);
    cacheLocal.config.mensagens = resolvidas.mensagens;

    return {
        success: true,
        salvas: salvar.length,
        removidas: remover.length,
        mensagens: resolvidas.mensagens,
        padroes: resolvidas.padroes,
        customizadas: resolvidas.customizadas
    };
}

module.exports = {
    inicializarDatabase,
    sincronizarComSupabase,
    carregarDados,
    salvarDados,
    formatarDataLocal,
    isFechadoHoje,
    getTurnoAtual,
    getHorarioNormal,
    getCategorias,
    getCardapio,
    criarPedido,
    atualizarStatusPedido,
    cancelarPedido,
    getPedidosCliente,
    getTodosPedidos,
    getEstatisticas,
    getEstadoConversa,
    setEstadoConversa,
    limparEstadoConversa,
    getConfig,
    getNiche,
    salvarConfig,
    criarAgendamento,
    cancelarAgendamento,
    concluirAgendamento,
    getAgendamentosCliente,
    getTodosAgendamentos,
    getHorariosDisponiveis,
    getProximosDiasDisponiveis,
    carregarMensagensDoNicho,
    getMensagensResolvidas,
    salvarMensagensBot
};