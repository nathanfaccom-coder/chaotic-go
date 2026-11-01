import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const start=source.indexOf("async function refresh3x3Allies(){");
const end=source.indexOf("function updateRoomUI()",start);
assert.ok(start>=0&&end>start,"expected 3x3 state refresh boundaries");
function extract(ctx){
 return vm.runInNewContext("("+source.slice(start,end).trim()+")",ctx);
}
function deferred(){
 let resolve;
 const promise=new Promise(done=>{resolve=done;});
 return {resolve,promise};
}
function tick(){return new Promise(resolve=>setImmediate(resolve));}
function createHarness({safeStates=[],contacts=[]}={}){
 let safeReads=0,contactReads=0;
 const ctx={
  room:{id:"same-room",mode:"3x3",status:"ready"},
  match:{turn_no:8,status:"active"},
  viewGeneration:3,refresh3x3ReadSerial:0,
  allies3x3:[{id:"initial"}],hp3x3:[],board3x3:[],
  $:id=>id==="lobby-3x3-allies-panel"?{}:null,
  rpc(name){
   assert.equal(name,"chaotic_get_preview_3x3_safe_state",
     "test must block before all later RPCs");
   return safeStates[safeReads++].promise;
  },
  api:{from(table){
   assert.equal(table,"chaotic_preview_3x3_contact_intents");
   const pending=contacts[contactReads++];
   assert.ok(pending,"contact response fixture");
   return {select(){return this;},eq(){return this;},order(){return this;},
    limit(){return pending.promise;}};
  }}
 };
 return {ctx,refresh:extract(ctx),counts:()=>({safeReads,contactReads})};
}
function state(id){return {allies:[{id}],hp_wallets:[],board_positions:[],move_events:[],token_transfers:[]};}

test("v0.1.109: an older same-turn safe-state reply cannot overwrite a newer read",async()=>{
 const old=deferred(),current=deferred(),contact=deferred();
 const f=createHarness({safeStates:[old,current],contacts:[contact]});
 const first=f.refresh(),second=f.refresh();
 old.resolve(state("old-result"));
 await first;
 assert.equal(f.ctx.allies3x3[0].id,"initial");
 assert.equal(f.counts().contactReads,0,"obsolete read must not request further private data");
 current.resolve(state("new-result"));
 await tick();
 assert.equal(f.ctx.allies3x3[0].id,"new-result");
 assert.equal(f.counts().contactReads,1);
 f.ctx.viewGeneration++;
 contact.resolve({data:[],error:null});
 await second;
});

test("v0.1.109: a partially applied older refresh cannot resume after newer same-turn refresh",async()=>{
 const oldContact=deferred(),newContact=deferred();
 const f=createHarness({safeStates:[
  {promise:Promise.resolve(state("old-partial"))},
  {promise:Promise.resolve(state("new-authoritative"))}
 ],contacts:[oldContact,newContact]});
 const first=f.refresh();
 await tick();
 assert.equal(f.ctx.allies3x3[0].id,"old-partial");
 const second=f.refresh();
 await tick();
 assert.equal(f.ctx.allies3x3[0].id,"new-authoritative");
 oldContact.resolve({data:[{turn_no:8,contact_status:"old"}],error:null});
 await first;
 assert.equal(f.ctx.allies3x3[0].id,"new-authoritative");
 assert.equal(f.ctx.refresh3x3ReadSerial,2);
 f.ctx.viewGeneration++;
 newContact.resolve({data:[],error:null});
 await second;
});

test("v0.1.109: a later read in the same room but a different turn rejects the old read",async()=>{
 const old=deferred(),newer=deferred(),contact=deferred();
 const f=createHarness({safeStates:[old,newer],contacts:[contact]});
 const first=f.refresh();
 f.ctx.match={turn_no:9,status:"active"};
 const second=f.refresh();
 old.resolve(state("stale-turn-eight"));
 await first;
 assert.equal(f.ctx.allies3x3[0].id,"initial");
 newer.resolve(state("turn-nine"));
 await tick();
 assert.equal(f.ctx.allies3x3[0].id,"turn-nine");
 f.ctx.viewGeneration++;
 contact.resolve({data:[],error:null});
 await second;
});

test("v0.1.109: only latest request may write the server-owned checkpoint",()=>{
 const code=source.slice(start,end);
 assert.match(code,/const readSerial=\+\+refresh3x3ReadSerial/);
 assert.match(code,/readSerial===refresh3x3ReadSerial/);
 assert.match(code,/if\(!isCurrent3x3Request\(\)\)return;/);
 assert.doesNotMatch(code,/chaotic_(?:pass_turn|spend_preview|open_preview_clash)\(/);
});
