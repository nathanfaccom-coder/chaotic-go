import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../batalha.js',import.meta.url),'utf8');
const mini=source.slice(source.indexOf('function desenharMiniCarta('),source.indexOf('// SISTEMA DE CONTADOR INTELIGENTE'));
const context={};
vm.runInNewContext("const URL_FUNDO_CARTA='cartas/verso.jpg';\n"+mini+"\nthis.renderMini=desenharMiniCarta;",context);

test('blank HP snapshot fields are unknown, not a confirmed KO',()=>{
 for(const hp of ['', '  ', null, undefined, false, 'invalid']){
  const html=context.renderMini({nome:'Teste',hpMax:100,hpAtual:hp,revelada:true});
  assert.match(html,/mini-hp-text">100<\/span>/);
 }
});
test('blank max HP without catalog fallback remains unknown',()=>{
 const html=context.renderMini({nome:'Teste',hpMax:'',hpAtual:'',revelada:true});
 assert.match(html,/mini-hp-text">\?<\/span>/);
 assert.doesNotMatch(html,/NaN%|Infinity%/);
});
test('explicit numeric zero remains zero',()=>{
 const html=context.renderMini({nome:'Teste',hpMax:100,hpAtual:0,revelada:true});
 assert.match(html,/mini-hp-text">0<\/span>/);
});
test('blank primary max HP uses known catalog energy',()=>{
 const html=context.renderMini({nome:'Teste',hpMax:' ',statsMax:{energia:80},hpAtual:40,revelada:true});
 assert.match(html,/mini-hp-text">40<\/span>/);
 assert.match(html,/width: 50%;/);
});
