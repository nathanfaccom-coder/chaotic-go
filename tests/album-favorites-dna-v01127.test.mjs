import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const source=await readFile(new URL("../script.js",import.meta.url),"utf8");
const from=source.indexOf("function renderizarListaAlbum() {");
const to=source.indexOf("let btnVoltarAlbum",from);
assert.ok(from>=0&&to>from);
function node(tag){
 return {tag,children:[],style:{},events:{},attributes:{},textContent:"",src:"",
  appendChild(x){this.children.push(x);return x;},replaceChildren(){this.children=[];},
  addEventListener(t,f){this.events[t]=f;},setAttribute(k,v){this.attributes[k]=v;},
  trigger(type,event){this.events[type]?.(event)}};
}
function fixture(){
 const one={id:13,nome:"Dragão",tipoCarta:"Criatura",img:"cartas/dragao.jpg",stats:{e:40,c:2,p:3,s:4,v:5},favorito:false};
 const two={...one,stats:{e:90,c:8,p:9,s:10,v:11}};
 const attack={id:42,nome:'<img onerror=alert(1)>',tipoCarta:"Ataque",img:"javascript:alert(1)",quantidade:2};
 const cards=[one,two,attack],ids={
  "lista-cartas":node("div"),"contador-colecao":node("span"),
  "filtro-nome":{value:""},"filtro-tipo":{value:"Todas"},
  "filtro-tribo":{value:"Todas"},"filtro-favoritos":{checked:false},
  "ordenar-cartas":{value:"original"}};
 const document={getElementById:id=>ids[id]||null,createElement:node};
 let saved=0,details=[];
 const window={slotSelecionadoAtual:null,interceptarMontagemDeck(){}};
 const ctx={window,document,inventario:cards,
  salvarAlbumNaNuvem(){saved++},abrirDetalheCarta(...v){details.push(v)},
  cartaVisualizadaId:null};
 vm.runInNewContext(source.slice(from,to),ctx);
 return {cards,ids,window,ctx,details,render:()=>ctx.renderizarListaAlbum(),saved:()=>saved};
}
test("v0.1.127: mobile pages include favorite and sort inputs",async()=>{
 for(const p of ["scanner.html","scanner-completo.html"]){
  const h=await readFile(new URL("../"+p,import.meta.url),"utf8");
  for(const id of ["filtro-favoritos","ordenar-cartas","contador-colecao"])
    assert.ok(h.includes('id="'+id+'"'));
 }
});
test("v0.1.127: duplicate IDs retain individual DNA",()=>{
 const f=fixture();f.render();
 const children=f.ids["lista-cartas"].children;
 assert.match(children[0].children[2].children[1].textContent,/Energia: 40/);
 assert.match(children[1].children[2].children[1].textContent,/Energia: 90/);
});
test("v0.1.127: favoriting second DNA copy does not affect first",()=>{
 const f=fixture();f.render();
 f.ids["lista-cartas"].children[1].children[0].trigger("click",{stopPropagation(){}});
 assert.equal(f.cards[0].favorito,false);
 assert.equal(f.cards[1].favorito,true);
 assert.equal(f.saved(),1);
});
test("v0.1.127: favorite filter does not delete cards",()=>{
 const f=fixture();f.cards[1].favorito=true;f.ids["filtro-favoritos"].checked=true;f.render();
 assert.equal(f.ids["lista-cartas"].children.length,1);
 assert.match(f.ids["contador-colecao"].textContent,/1 de 3/);
 assert.equal(f.cards.length,3);
});
test("v0.1.127: view sorting keeps underlying original sequence",()=>{
 const f=fixture(),copy=f.cards.slice();f.ids["ordenar-cartas"].value="nome";f.render();
 assert.equal(f.cards[0],copy[0]);assert.equal(f.cards[1],copy[1]);
});
test("v0.1.127: card metadata is never interpolated into HTML",()=>{
 const f=fixture();f.render();const last=f.ids["lista-cartas"].children[2];
 assert.match(last.children[2].children[0].textContent,/<img/);
 assert.equal(last.children[1].src,"");
 assert.doesNotMatch(source.slice(from,source.indexOf("window.toggleFavorito = function(",from)),/\.innerHTML\s*=/);
});
test("v0.1.127: list invokes detailed view with exact saved instance index",()=>{
 const f=fixture();f.render();f.ids["lista-cartas"].children[1].children[2].trigger("click");
 assert.equal(f.details.length,1);
 assert.equal(f.ctx.cartaVisualizadaId,13);
});
test("v0.1.127: missing stats display placeholders instead of failing",()=>{
 const f=fixture();delete f.cards[0].stats;f.render();
 assert.match(f.ids["lista-cartas"].children[0].children[2].children[1].textContent,/Energia: —/);
});
