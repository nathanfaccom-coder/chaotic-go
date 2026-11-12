import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../batalha.js",import.meta.url),"utf8");
const mini=source.slice(source.indexOf("function desenharMiniCarta("),source.indexOf("// SISTEMA DE CONTADOR INTELIGENTE"));
const context={};
vm.runInNewContext("const URL_FUNDO_CARTA = 'cartas/verso.jpg';\n"+mini+"\nthis.renderMini=desenharMiniCarta;",context);

test("combat mini-card: zero max HP never emits NaN or Infinity in HP width",()=>{
 const html=context.renderMini({nome:"Teste",hpMax:0,hpAtual:0,revelada:true});
 assert.match(html,/class="mini-hp-fill" style="width: 0%;/);
 assert.doesNotMatch(html,/NaN%|Infinity%/);
});
test("combat mini-card: negative and overflowing HP are visually clamped",()=>{
 for(const [hp,expected] of [[-10,0],[250,100],[25,25]]){
  const html=context.renderMini({nome:"Teste",hpMax:100,hpAtual:hp,revelada:true});
  assert.ok(html.includes('style="width: '+expected+'%;'),"HP "+hp);
 }
});
test("combat mini-card: hidden creature still conceals HP and attributes",()=>{
 const html=context.renderMini({nome:"Teste",hpMax:100,hpAtual:25,coragem:75,revelada:false});
 assert.match(html,/mini-hp-text">\?\?\?</);
 assert.doesNotMatch(html,/mini-hp-text">25</);
});

test("combat mini-card: explicit zero maximum overrides fallback stats",()=>{
 const html=context.renderMini({nome:"Teste",hpMax:0,statsMax:{energia:100},hpAtual:25,revelada:true});
 assert.ok(html.includes('style="width: 0%;'));
});
test("combat mini-card: invalid current HP never appears as NaN or Infinity label",()=>{
 for(const hp of [NaN,Infinity,-Infinity]){
  const html=context.renderMini({nome:"Teste",hpMax:100,hpAtual:hp,revelada:true});
  assert.doesNotMatch(html,/mini-hp-text">(?:NaN|Infinity|-Infinity)</);
  assert.ok(html.includes('style="width: 0%;'));
 }
});

test("combat mini-card: explicit zero attributes override printed base stats",()=>{
 const html=context.renderMini({nome:"Teste",hpMax:100,hpAtual:80,revelada:true,
  coragem:0,poder:0,sabedoria:0,velocidade:0,
  statsMax:{coragem:75,poder:80,sabedoria:85,velocidade:90}});
 assert.equal((html.match(/<b>0<\/b>/g)||[]).length,4);
 for(const base of [75,80,85,90])assert.doesNotMatch(html,new RegExp("<b>"+base+"</b>"));
});
test("combat mini-card: absent attributes still use original card stats",()=>{
 const html=context.renderMini({nome:"Teste",hpMax:100,hpAtual:80,revelada:true,
  statsMax:{coragem:75,poder:80,sabedoria:85,velocidade:90}});
 for(const base of [75,80,85,90])assert.ok(html.includes("<b>"+base+"</b>"));
});

test("combat mini-card: visible HP label cannot exceed maximum after stale refresh",()=>{
 const html=context.renderMini({nome:"Teste",hpMax:100,hpAtual:250,revelada:true});
 assert.match(html,/mini-hp-text">100<\/span>/);
 assert.doesNotMatch(html,/mini-hp-text">250<\/span>/);
});

test("combat mini-card: invalid snapshot attributes show unknown instead of NaN or Infinity",()=>{
 const html=context.renderMini({nome:"Teste",hpMax:100,hpAtual:70,revelada:true,
  coragem:NaN,poder:Infinity,sabedoria:-Infinity,velocidade:"invalid"});
 assert.equal((html.match(/<b>\?<\/b>/g)||[]).length,4);
 assert.doesNotMatch(html,/<b>(?:NaN|Infinity|-Infinity)<\/b>/);
});

test("combat mini-card: only whole elemental tokens activate icons",()=>{
 const html=context.renderMini({nome:"Teste",hpMax:100,hpAtual:80,revelada:true,elementos:["Armadura","Mar","Terra"]});
 assert.match(html,/mini-el terra ativo/);
 assert.doesNotMatch(html,/mini-el ar ativo/);
 assert.doesNotMatch(html,/mini-el agua ativo/);
});
test("combat mini-card: wind alias and accented water work in elemental list",()=>{
 const html=context.renderMini({nome:"Teste",hpMax:100,hpAtual:80,revelada:true,elementos:["Vento","Água"]});
 assert.match(html,/mini-el ar ativo/);
 assert.match(html,/mini-el agua ativo/);
});
