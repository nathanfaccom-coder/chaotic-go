import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../batalha.js', import.meta.url), 'utf8');
const mini = source.slice(source.indexOf('function desenharMiniCarta('), source.indexOf('// SISTEMA DE CONTADOR INTELIGENTE'));
const context = {};
vm.runInNewContext("const URL_FUNDO_CARTA='cartas/verso.jpg';\n" + mini + "\nthis.renderMini=desenharMiniCarta;", context);

test('malformed snapshot attributes fall back to catalog stats', () => {
  const html = context.renderMini({
    nome:'Teste', revelada:true, hpMax:100, hpAtual:80,
    coragem:' ', poder:'not-a-number', sabedoria:false, velocidade:Infinity,
    statsMax:{coragem:40,poder:50,sabedoria:60,velocidade:70}
  });
  for (const n of [40,50,60,70]) assert.match(html, new RegExp('<b>'+n+'</b>'));
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('explicit zero snapshot stat is preserved', () => {
  const html = context.renderMini({nome:'Teste',revelada:true,hpMax:100,hpAtual:80,
    coragem:0,statsMax:{coragem:50}});
  assert.match(html, /<b>0<\/b>/);
});

test('unavailable attributes stay unknown', () => {
  const html = context.renderMini({nome:'Teste',revelada:true,hpMax:100,hpAtual:80,
    coragem:' ',poder:null,sabedoria:'bad',velocidade:false});
  assert.equal((html.match(/<b>\?<\/b>/g)||[]).length,4);
});
