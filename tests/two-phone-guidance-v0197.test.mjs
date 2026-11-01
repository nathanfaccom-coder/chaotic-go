import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const script=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function extract(start,end,context){
  const a=script.indexOf(start),b=script.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,"segment "+start);
  return vm.runInNewContext("("+script.slice(a,b).trim()+")",context);
}
function status(overrides={}){
  const state={room:{id:"old",mode:"3x3",status:"ready"},
    match:{turn_no:3,status:"active",current_player:"host"},
    checkpoint:{turn_no:3,phase:"ready",your_action_required:false},
    presence:{self_ready:true,peer_ready:true,peer_active:true},
    userId:"host",ownCount:3,ownHpCount:3,ownBoardCount:3,finished:false};
  return {...state,...overrides};
}
const guide=extract("function next3x3Instruction(state)","  // Server-only training receipt.",{});
test("v0.1.97: stage guidance covers both players without guessing actions",()=>{
  assert.match(guide(status({checkpoint:{turn_no:3,phase:"ready"}})),/mova um campeão/);
  assert.match(guide(status({match:{turn_no:3,status:"active",current_player:"guest"}})),/Vez do adversário/);
  assert.match(guide(status({checkpoint:{turn_no:3,phase:"awaiting_payment"}})),/Confira a carta/);
  assert.match(guide(status({checkpoint:{turn_no:3,phase:"awaiting_defender",your_action_required:true}})),/Sua reação/);
  assert.match(guide(status({checkpoint:{turn_no:3,phase:"awaiting_damage",your_action_required:true}})),/Resolva o dano/);
  assert.match(guide(status({checkpoint:{turn_no:3,phase:"damage_settled"}})),/não repita o golpe/);
});
test("v0.1.97: new player and reconnection instructions remain conservative",()=>{
  assert.match(guide(status({match:null})),/anfitrião deve iniciar/);
  assert.match(guide(status({presence:{self_ready:false}})),/Estou pronto/);
  assert.match(guide(status({presence:{self_ready:true,peer_ready:false,peer_active:false}})),/outro celular/);
  assert.match(guide(status({checkpoint:null})),/Não repita ataques/);
  assert.match(guide(status({checkpoint:{turn_no:2,phase:"ready"}})),/Sincronização pendente/);
  assert.match(guide(status({finished:true})),/Nenhum XP ou moeda oficial/);
});
test("v0.1.97: preparation and special-effect guidance follows verified data",()=>{
 for(const [counts,words] of [
  [{ownCount:0},"prepare suas três criaturas"],
  [{ownCount:3,ownHpCount:0},"prepare o HP"],
  [{ownCount:3,ownHpCount:3,ownBoardCount:0},"prepare os seis hexágonos"]
 ])assert.match(guide(status(counts)),new RegExp(words));
 for(const [phase,words] of [
  ["awaiting_optional_reveal","Vento Forte"],
  ["awaiting_sonar_search","SONAR"],
  ["contact_open","Contato aberto"]
 ])assert.match(guide(status({checkpoint:{turn_no:3,phase}})),new RegExp(words));
 assert.ok(script.includes('id="lobby-3x3-next-step"'));
 assert.ok(script.includes('instruction.textContent=next3x3Instruction'));
});
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function handler(id){
 const start=script.indexOf('$("'+id+'").onclick');
 const end=script.indexOf("\n    });",start);
 assert.ok(start>=0&&end>start,"handler "+id);
 return script.slice(start,end+7);
}
for(const id of ["lobby-create-btn","lobby-join-btn"]){
 test("v0.1.97: delayed "+id+" cannot reopen an abandoned room",async()=>{
  const pending=deferred(),started=deferred();
  const nodes=new Map(),$=key=>nodes.get(key)||nodes.set(key,{value:key==="lobby-input-code"?"ABCDEF123456":"3x3",onclick:null}).get(key);
  let recalls=0;
  const ctx={room:null,viewGeneration:5,$,action:fn=>fn(),
    rpc:()=>{started.resolve();return pending.promise;},
    note:()=>{},rememberLastRoom:()=>recalls++,
    setDefaultCreatureSlot:()=>recalls++,updateRoomUI:()=>recalls++,watch:()=>recalls++};
  vm.runInNewContext(handler(id),ctx);
  const call=$(id).onclick();
  await started.promise;
  ctx.viewGeneration=6;ctx.room={id:"new"};
  pending.resolve({id:"old"});
  await call;
  assert.equal(ctx.room.id,"new");
  assert.equal(recalls,0);
 });
}
test("v0.1.97: normal room creation still attaches the server-returned room",async()=>{
 const nodes=new Map(),$=k=>nodes.get(k)||nodes.set(k,{value:"3x3",onclick:null}).get(k);
 let watch=0,save=0;
 const ctx={room:null,viewGeneration:1,$,action:fn=>fn(),
  rpc:async()=>({id:"created",mode:"3x3"}),note:()=>{},
  rememberLastRoom:()=>save++,setDefaultCreatureSlot:()=>{},
  updateRoomUI:()=>{},watch:()=>watch++};
 vm.runInNewContext(handler("lobby-create-btn"),ctx);
 await $("lobby-create-btn").onclick();
 assert.equal(ctx.room.id,"created");
 assert.equal(save,1);assert.equal(watch,1);
});
