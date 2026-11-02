import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const source=await readFile(new URL("../entrada-drome.js",import.meta.url),"utf8");
const editor=await readFile(new URL("../script.js",import.meta.url),"utf8");
function isolate(start,end,ctx){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"missing code "+start);
 return vm.runInNewContext("("+source.slice(a,b).trim()+")",ctx);
}
const validator=isolate("function verificarIrregularidadeDeck(","\nfunction selecionarDeckDrome(",{});
const base=(n)=>({ataques:Array(20).fill(1),locais:Array(10).fill(1),
 criaturas:Array(n).fill("id")});
test("v0.1.126: one creature is valid only in 1x1",()=>{
 assert.equal(validator(base(1),"1x1"),null);
 assert.match(validator(base(1),"3x3"),/Criaturas: 1\/3/);
 assert.match(validator(base(1),"6x6"),/Criaturas: 1\/6/);
});
test("v0.1.126: exactly three creatures for 3x3, with invisible slots ignored",()=>{
 assert.equal(validator({...base(3),criaturas:["A",null,"B",null,"C"]},"3x3"),null);
 assert.match(validator(base(4),"3x3"),/4\/3/);
});
test("v0.1.126: full 6x6 requires six actual creatures",()=>{
 assert.equal(validator(base(6),"6x6"),null);
 assert.match(validator({...base(6),criaturas:["A",null,"B","","C","D"]},"6x6"),/4\/6/);
});
test("v0.1.126: 20 attacks and 10 locations are still required",()=>{
 assert.match(validator({...base(3),ataques:[1]},"3x3"),/Ataques: 1\/20/);
 assert.match(validator({...base(3),locais:[]},"3x3"),/Locais: 0\/10/);
});
function fixture(){
 let active={children:[],innerHTML:"loading",textContent:"",appendChild(node){this.children.push(node)}};
 let pendingResolve,pendingReject;
 const pending=new Promise((resolve,reject)=>{pendingResolve=resolve;pendingReject=reject});
 const document={
  getElementById(id){return id==="lista-decks-drome"?active:null},
  createElement(){const labels=new Map();return {
   className:"",style:{},innerHTML:"",onclick:null,
   querySelector(key){if(!labels.has(key))labels.set(key,{textContent:""});return labels.get(key)}
  }}
 };
 const ctx={document,window:{},localStorage:{getItem:()=>"player"},
  _dbGet:()=>pending,verificarIrregularidadeDeck:validator,
  selecionarDeckDrome:()=>{},console};
 const load=isolate("function carregarDecksParaEscolha(modo) {","\nfunction verificarIrregularidadeDeck(",ctx);
 return {document,load,pendingResolve,pendingReject,getActive:()=>active,
  replace(){active={children:[],textContent:"new",appendChild(node){this.children.push(node)}};}};
}
const valid={...base(3),nome:"safe",modo:"3x3"};
test("v0.1.126: user-controlled deck names and modes cannot inject HTML",async()=>{
 const f=fixture();f.load("3x3");
 f.pendingResolve({exists:()=>true,val:()=>({"3x3_slot_1":{
  ...valid,nome:'<img src=x onerror=alert(1)>',modo:'<script>evil()</script>'
 }})});
 await new Promise(resolve=>setImmediate(resolve));
 const child=f.getActive().children[0];
 assert.doesNotMatch(child.innerHTML,/<img|<script|onerror=/);
 assert.match(child.querySelector(".drome-saved-deck-name").textContent,/^<img/);
 assert.match(child.querySelector(".drome-saved-deck-detail").textContent,/<script>/);
});
test("v0.1.126: old async deck response cannot repaint the next mode",async()=>{
 const f=fixture();f.load("3x3");f.replace();
 f.pendingResolve({exists:()=>true,val:()=>({"3x3_slot_1":valid})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.getActive().children.length,0);
 assert.equal(f.getActive().textContent,"new");
});
test("v0.1.126: stale failed query cannot erase the next mode",async()=>{
 const f=fixture();f.load("3x3");f.replace();f.pendingReject(Error("timeout"));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.getActive().textContent,"new");
});
test("v0.1.126: empty collection shows a safe notice",async()=>{
 const f=fixture();f.load("3x3");f.pendingResolve({exists:()=>false,val:()=>null});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(f.getActive().textContent,/Crie um deck na Oficina/);
});
test("v0.1.126: editor's ready-for-battle flag uses mode creature count",()=>{
 assert.match(editor,/criaturasValidas\s*===\s*criaturasNecessarias/);
 assert.match(editor,/custoTotalAtaques\s*===\s*20/);
 assert.match(editor,/deckData\.locais\.length\s*===\s*10/);
});
