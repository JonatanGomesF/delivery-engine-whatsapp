// =====================================================================
// seed-barbearia.js — Popula serviços da barbearia na tabela cardapio
// Uso: node seed-barbearia.js
// =====================================================================
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
);

const CLIENTE_ID = 'barbearia_estilo';

// Categorias da barbearia
const CATEGORIAS = [
    { id: 'corte', nome: 'Cortes', icone: '✂️', turno: 'todos', ordem: 1, ativo: true },
    { id: 'barba', nome: 'Barbas', icone: '🪒', turno: 'todos', ordem: 2, ativo: true },
    { id: 'combo', nome: 'Combos', icone: '💈', turno: 'todos', ordem: 3, ativo: true },
    { id: 'estetica', nome: 'Estética', icone: '✨', turno: 'todos', ordem: 4, ativo: true }
];

// Serviços da barbearia
const SERVICOS = [
    { id: 1, categoria: 'corte', nome: 'Corte de Cabelo', descricao: 'Corte moderno ou clássico, finalizado com navalha', preco: 35, turno: 'todos', icone: '✂️', ativo: true },
    { id: 2, categoria: 'corte', nome: 'Corte Degradê', descricao: 'Degradê navalhado ou máquina, acabamento perfeito', preco: 40, turno: 'todos', icone: '✂️', ativo: true },
    { id: 3, categoria: 'corte', nome: 'Corte + Sobrancelha', descricao: 'Corte completo com design de sobrancelha', preco: 45, turno: 'todos', icone: '✂️', ativo: true },
    { id: 4, categoria: 'barba', nome: 'Barba Completa', descricao: 'Barba desenhada com navalha e toalha quente', preco: 25, turno: 'todos', icone: '🪒', ativo: true },
    { id: 5, categoria: 'barba', nome: 'Barba Simples', descricao: 'Aparação e contorno da barba', preco: 15, turno: 'todos', icone: '🪒', ativo: true },
    { id: 6, categoria: 'combo', nome: 'Combo Corte + Barba', descricao: 'O mais pedido! Corte completo + barba desenhada', preco: 55, turno: 'todos', icone: '💈', ativo: true },
    { id: 7, categoria: 'combo', nome: 'Combo Completo', descricao: 'Corte + barba + sobrancelha + hidratação', preco: 70, turno: 'todos', icone: '💈', ativo: true },
    { id: 8, categoria: 'estetica', nome: 'Sobrancelha', descricao: 'Design e limpeza de sobrancelha', preco: 15, turno: 'todos', icone: '✨', ativo: true },
    { id: 9, categoria: 'estetica', nome: 'Pigmentação', descricao: 'Pigmentação de barba ou sobrancelha', preco: 80, turno: 'todos', icone: '🎨', ativo: true },
    { id: 10, categoria: 'estetica', nome: 'Hidratação Capilar', descricao: 'Hidratação profunda com massagem relaxante', preco: 40, turno: 'todos', icone: '💧', ativo: true }
];

async function main() {
    console.log('=== SEED BARBEARIA_ESTILO ===\n');

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

    // 2. Insere/atualiza serviços
    console.log('2. Serviços...');
    const servicoRows = SERVICOS.map(s => ({
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

    const { error: servError } = await sb
        .from('cardapio')
        .upsert(servicoRows, { onConflict: 'cliente_id,item_id' });

    if (servError) {
        console.error('   ERRO ao inserir serviços:', servError.message);
    } else {
        console.log(`   ✅ ${servicoRows.length} serviços inseridos/atualizados`);
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
