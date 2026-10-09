// =====================================================================
// seed-climeditu2.js — Cria tenant climeditu2 e popula especialidades
// Uso: node seed-climeditu2.js
// =====================================================================
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
);

const CLIENTE_ID = 'climeditu2';
const NOME = 'Clínica Editu2';

const CATEGORIAS = [
    { id: 'clinico_geral', nome: 'Clínico Geral', icone: '🩺', ordem: 1 },
    { id: 'dermatologia', nome: 'Dermatologia', icone: '🌿', ordem: 2 },
    { id: 'pediatria', nome: 'Pediatria', icone: '👶', ordem: 3 },
    { id: 'cardiologia', nome: 'Cardiologia', icone: '❤️', ordem: 4 },
    { id: 'ortopedia', nome: 'Ortopedia', icone: '🦴', ordem: 5 },
    { id: 'ginecologia', nome: 'Ginecologia', icone: '🌸', ordem: 6 },
    { id: 'psiquiatria', nome: 'Psiquiatria', icone: '🧠', ordem: 7 },
    { id: 'exames', nome: 'Exames & Check-ups', icone: '🧪', ordem: 8 }
];

const ESPECIALIDADES = [
    { id: 1, categoria: 'clinico_geral', nome: 'Consulta Clínico Geral', descricao: 'Avaliação médica completa e orientação de saúde', preco: 150, icone: '🩺' },
    { id: 2, categoria: 'clinico_geral', nome: 'Retorno Clínico Geral', descricao: 'Consulta de retorno em até 30 dias', preco: 80, icone: '🩺' },
    { id: 3, categoria: 'dermatologia', nome: 'Consulta Dermatologia', descricao: 'Avaliação de pele, cabelos e unhas', preco: 200, icone: '🌿' },
    { id: 4, categoria: 'dermatologia', nome: 'Retorno Dermatologia', descricao: 'Consulta de retorno em até 30 dias', preco: 100, icone: '🌿' },
    { id: 5, categoria: 'dermatologia', nome: 'Procedimento Estético', descricao: 'Peeling, laser, preenchimento (avaliação prévia)', preco: 350, icone: '✨' },
    { id: 6, categoria: 'pediatria', nome: 'Consulta Pediatria', descricao: 'Acompanhamento infantil e vacinação', preco: 180, icone: '👶' },
    { id: 7, categoria: 'pediatria', nome: 'Retorno Pediatria', descricao: 'Consulta de retorno em até 30 dias', preco: 90, icone: '👶' },
    { id: 8, categoria: 'cardiologia', nome: 'Consulta Cardiologia', descricao: 'Avaliação cardíaca, ECG e eco', preco: 220, icone: '❤️' },
    { id: 9, categoria: 'cardiologia', nome: 'Retorno Cardiologia', descricao: 'Consulta de retorno com exames', preco: 110, icone: '❤️' },
    { id: 10, categoria: 'ortopedia', nome: 'Consulta Ortopedia', descricao: 'Avaliação ortopédica e traumatologia', preco: 200, icone: '🦴' },
    { id: 11, categoria: 'ortopedia', nome: 'Retorno Ortopedia', descricao: 'Consulta de retorno com exames de imagem', preco: 100, icone: '🦴' },
    { id: 12, categoria: 'ginecologia', nome: 'Consulta Ginecologia', descricao: 'Preventivo, orientação contraceptiva', preco: 180, icone: '🌸' },
    { id: 13, categoria: 'ginecologia', nome: 'Retorno Ginecologia', descricao: 'Consulta de retorno', preco: 90, icone: '🌸' },
    { id: 14, categoria: 'psiquiatria', nome: 'Consulta Psiquiatria', descricao: 'Avaliação psiquiátrica e acompanhamento', preco: 220, icone: '🧠' },
    { id: 15, categoria: 'psiquiatria', nome: 'Retorno Psiquiatria', descricao: 'Consulta de retorno e ajuste de medicação', preco: 110, icone: '🧠' },
    { id: 16, categoria: 'exames', nome: 'Check-up Completo', descricao: 'Hemograma, bioquímica, lipídico, tireoide', preco: 180, icone: '🧪' },
    { id: 17, categoria: 'exames', nome: 'Exames de Imagem', descricao: 'Ultrassom, raio-X, mamografia (por região)', preco: 120, icone: '📷' },
    { id: 18, categoria: 'exames', nome: 'Teste Ergométrico', descricao: 'Teste de esforço com laudo', preco: 150, icone: '🏃' }
];

async function main() {
    console.log(`=== SEED CLÍNICA (${CLIENTE_ID}) ===\n`);

    // 1. Cria/atualiza o tenant
    console.log('1. Tenant...');
    const { error: tenantError } = await sb.from('clientes').upsert({
        id: CLIENTE_ID,
        nome: NOME,
        niche: 'clinic',
        telefone_dono: '',
        chave_pix: '',
        endereco: 'Rua da Clínica, 123',
        taxa_entrega: 0,
        tempo_estimado_min: 30,
        tempo_estimado_max: 60,
        horario_almoco: '08:00 às 12:00',
        horario_jantar: '14:00 às 18:00',
        fechado_hoje: false,
        motivo_fechado: '',
        ativo: true,
        plano: 'basico',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });

    if (tenantError) {
        console.error('   ERRO ao criar tenant:', tenantError.message);
    } else {
        console.log(`   ✅ Tenant "${CLIENTE_ID}" criado/atualizado com niche=clinic`);
    }

    // 2. Categorias
    console.log('2. Categorias...');
    const catRows = CATEGORIAS.map(c => ({
        cliente_id: CLIENTE_ID, categoria_id: c.id, nome: c.nome, icone: c.icone, turno: 'todos', ordem: c.ordem, ativo: true
    }));
    const { error: catError } = await sb.from('categorias').upsert(catRows, { onConflict: 'cliente_id,categoria_id' });
    if (catError) console.error('   ERRO categorias:', catError.message);
    else console.log(`   ✅ ${catRows.length} categorias`);

    // 3. Especialidades
    console.log('3. Especialidades...');
    const espRows = ESPECIALIDADES.map(s => ({
        cliente_id: CLIENTE_ID, item_id: s.id, categoria: s.categoria, nome: s.nome, descricao: s.descricao,
        preco: s.preco, turno: 'todos', icone: s.icone, ativo: true, ordem: s.id, updated_at: new Date().toISOString()
    }));
    const { error: espError } = await sb.from('cardapio').upsert(espRows, { onConflict: 'cliente_id,item_id' });
    if (espError) console.error('   ERRO especialidades:', espError.message);
    else console.log(`   ✅ ${espRows.length} especialidades`);

    // Verificação
    const { data: itens } = await sb.from('cardapio').select('item_id, categoria, nome, preco').eq('cliente_id', CLIENTE_ID).order('item_id');
    console.log(`\n   Total: ${itens?.length || 0} itens no cardápio`);
    console.log('\n=== SEED CONCLUÍDO ===');
}

main().catch(err => { console.error('ERRO:', err); process.exit(1); });
