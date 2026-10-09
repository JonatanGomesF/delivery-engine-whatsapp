// =====================================================================
// seed-clinica.js — Popula especialidades da clínica na tabela cardapio
// Uso: node seed-clinica.js
// =====================================================================
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
);

const CLIENTE_ID = 'clinicamedica'; // tenant clínica existente

// Categorias da clínica
const CATEGORIAS = [
    { id: 'clinico_geral', nome: 'Clínico Geral', icone: '🩺', turno: 'todos', ordem: 1, ativo: true },
    { id: 'dermatologia', nome: 'Dermatologia', icone: '🌿', turno: 'todos', ordem: 2, ativo: true },
    { id: 'pediatria', nome: 'Pediatria', icone: '👶', turno: 'todos', ordem: 3, ativo: true },
    { id: 'cardiologia', nome: 'Cardiologia', icone: '❤️', turno: 'todos', ordem: 4, ativo: true },
    { id: 'ortopedia', nome: 'Ortopedia', icone: '🦴', turno: 'todos', ordem: 5, ativo: true },
    { id: 'ginecologia', nome: 'Ginecologia', icone: '🌸', turno: 'todos', ordem: 6, ativo: true },
    { id: 'psiquiatria', nome: 'Psiquiatria', icone: '🧠', turno: 'todos', ordem: 7, ativo: true },
    { id: 'exames', nome: 'Exames & Check-ups', icone: '🧪', turno: 'todos', ordem: 8, ativo: true }
];

// Especialidades/serviços da clínica
const ESPECIALIDADES = [
    { id: 1, categoria: 'clinico_geral', nome: 'Consulta Clínico Geral', descricao: 'Avaliação médica completa e orientação de saúde', preco: 150, turno: 'todos', icone: '🩺', ativo: true },
    { id: 2, categoria: 'clinico_geral', nome: 'Retorno Clínico Geral', descricao: 'Consulta de retorno em até 30 dias', preco: 80, turno: 'todos', icone: '🩺', ativo: true },
    { id: 3, categoria: 'dermatologia', nome: 'Consulta Dermatologia', descricao: 'Avaliação de pele, cabelos e unhas', preco: 200, turno: 'todos', icone: '🌿', ativo: true },
    { id: 4, categoria: 'dermatologia', nome: 'Retorno Dermatologia', descricao: 'Consulta de retorno em até 30 dias', preco: 100, turno: 'todos', icone: '🌿', ativo: true },
    { id: 5, categoria: 'dermatologia', nome: 'Procedimento Estético', descricao: 'Peeling, laser, preenchimento (avaliação prévia)', preco: 350, turno: 'todos', icone: '✨', ativo: true },
    { id: 6, categoria: 'pediatria', nome: 'Consulta Pediatria', descricao: 'Acompanhamento infantil e vacinação', preco: 180, turno: 'todos', icone: '👶', ativo: true },
    { id: 7, categoria: 'pediatria', nome: 'Retorno Pediatria', descricao: 'Consulta de retorno em até 30 dias', preco: 90, turno: 'todos', icone: '👶', ativo: true },
    { id: 8, categoria: 'cardiologia', nome: 'Consulta Cardiologia', descricao: 'Avaliação cardíaca, ECG e eco', preco: 220, turno: 'todos', icone: '❤️', ativo: true },
    { id: 9, categoria: 'cardiologia', nome: 'Retorno Cardiologia', descricao: 'Consulta de retorno com exames', preco: 110, turno: 'todos', icone: '❤️', ativo: true },
    { id: 10, categoria: 'ortopedia', nome: 'Consulta Ortopedia', descricao: 'Avaliação ortopédica e traumatologia', preco: 200, turno: 'todos', icone: '🦴', ativo: true },
    { id: 11, categoria: 'ortopedia', nome: 'Retorno Ortopedia', descricao: 'Consulta de retorno com exames de imagem', preco: 100, turno: 'todos', icone: '🦴', ativo: true },
    { id: 12, categoria: 'ginecologia', nome: 'Consulta Ginecologia', descricao: 'Preventivo, orientação contraceptiva', preco: 180, turno: 'todos', icone: '🌸', ativo: true },
    { id: 13, categoria: 'ginecologia', nome: 'Retorno Ginecologia', descricao: 'Consulta de retorno', preco: 90, turno: 'todos', icone: '🌸', ativo: true },
    { id: 14, categoria: 'psiquiatria', nome: 'Consulta Psiquiatria', descricao: 'Avaliação psiquiátrica e acompanhamento', preco: 220, turno: 'todos', icone: '🧠', ativo: true },
    { id: 15, categoria: 'psiquiatria', nome: 'Retorno Psiquiatria', descricao: 'Consulta de retorno e ajuste de medicação', preco: 110, turno: 'todos', icone: '🧠', ativo: true },
    { id: 16, categoria: 'exames', nome: 'Check-up Completo', descricao: 'Hemograma, bioquímica, lipídico, tireoide', preco: 180, turno: 'todos', icone: '🧪', ativo: true },
    { id: 17, categoria: 'exames', nome: 'Exames de Imagem', descricao: 'Ultrassom, raio-X, mamografia (por região)', preco: 120, turno: 'todos', icone: '📷', ativo: true },
    { id: 18, categoria: 'exames', nome: 'Teste Ergométrico', descricao: 'Teste de esforço com laudo', preco: 150, turno: 'todos', icone: '🏃', ativo: true }
];

async function main() {
    console.log(`=== SEED CLÍNICA (${CLIENTE_ID}) ===\n`);

    // 1. Insere/atualiza categorias
    console.log('1. Categorias...');
    const catRows = CATEGORIAS.map(c => ({
        cliente_id: CLIENTE_ID,
        categoria_id: c.id,
        nome: c.nome,
        icone: c.icone,
        turno: c.turno,
        ordem: c.ordem,
        ativo: c.ativo
    }));

    const { error: catError } = await sb
        .from('categorias')
        .upsert(catRows, { onConflict: 'cliente_id,categoria_id' });

    if (catError) {
        console.error('   ERRO ao inserir categorias:', catError.message);
    } else {
        console.log(`   ✅ ${catRows.length} categorias inseridas/atualizadas`);
    }

    // 2. Insere/atualiza especialidades
    console.log('2. Especialidades...');
    const espRows = ESPECIALIDADES.map(s => ({
        cliente_id: CLIENTE_ID,
        item_id: s.id,
        categoria: s.categoria,
        nome: s.nome,
        descricao: s.descricao,
        preco: s.preco,
        turno: s.turno,
        icone: s.icone,
        ativo: s.ativo,
        ordem: s.id,
        updated_at: new Date().toISOString()
    }));

    const { error: espError } = await sb
        .from('cardapio')
        .upsert(espRows, { onConflict: 'cliente_id,item_id' });

    if (espError) {
        console.error('   ERRO ao inserir especialidades:', espError.message);
    } else {
        console.log(`   ✅ ${espRows.length} especialidades inseridas/atualizadas`);
    }

    // 3. Verificação final
    console.log('\n3. Verificação...');
    const { data: itens, error: verifyError } = await sb
        .from('cardapio')
        .select('item_id, categoria, nome, preco, ativo')
        .eq('cliente_id', CLIENTE_ID)
        .order('item_id');

    if (verifyError) {
        console.error('   ERRO na verificação:', verifyError.message);
    } else {
        console.log(`   Total de itens no cardápio: ${itens.length}`);
        itens.forEach(i => console.log(`   - [${i.categoria}] ${i.nome} — R$ ${i.preco.toFixed(2)} (${i.ativo ? 'ativo' : 'inativo'})`));
    }

    console.log('\n=== SEED CONCLUÍDO ===');
}

main().catch(err => {
    console.error('ERRO FATAL:', err);
    process.exit(1);
});