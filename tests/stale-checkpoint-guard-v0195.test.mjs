import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const src=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function isolate(start,end,context){
 const a=src.indexOf(start), b=src.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"function exists: "+start);
 return vm.runInNewContext("("+src.slice(a,b).trim()+")",context);
}
function deferred(){
 let resolve;
 const promise=new Promise(r=>{resolve=r;});
 return {promise,resolve};
}
const oldRoom={id:"old-room",mode:"3x3",status:"ready"};
const newRoom={id:"new-room",mode:"3x3",status:"ready"};
function fakeDatabase(contacts=[]){
 return {from(table){
   const data=table==="chaotic_preview_3x3_contact_intents"?contacts:[];
   const builder={
     select(){return this;},eq(){return this;},order(){return this;},
     limit(){return this;},
     then(onSuccess,onError){return Promise.resolve({data,error:null}).then(onSuccess,onError);}
   };
   return builder;
 }};
}
function context(target,resolveTarget,contactRows=[]){
 const pending=deferred();
 let reached;
 const requestStarted=new Promise(r=>{reached=r;});
 let laterCalls=0,painted=0;
 const ctx={
  room:oldRoom,match:{turn_no:7,status:"active"},viewGeneration:4,userId:"actor",
  refresh3x3ReadSerial:0,
  $:id=>id==="lobby-3x3-allies-panel"?{}:null,
  api:fakeDatabase(contactRows),
  updateMatchUI:()=>{painted++;},
  note:()=>{},
  resumePhase3x3:null,
  playerPresence3x3:null,
  borrowedPriority3x3:null,
  rpc(name){
   if(name===target){reached();return pending.promise;}
   if(name==="chaotic_get_preview_3x3_safe_state")return Promise.resolve({
     allies:[],hp_wallets:[],board_positions:[],move_events:[],token_transfers:[]
   });
   if(name==="chaotic_get_preview_3x3_borrowed_attacks")
     return Promise.resolve({borrowed_attacks:target.includes("borrowed_105_priority")
       ?[{custody_id:"old-custody"}]:[]});
   if(name==="chaotic_get_preview_3x3_safe_inspections")
     return Promise.resolve({creature_checks:[],dynamic_checks:[]});
   if(name==="chaotic_ping_preview_3x3_player")return Promise.resolve({peer_active:true});
   if(name==="chaotic_get_preview_3x3_resume_status")return Promise.resolve({turn_no:7,phase:"ready"});
   laterCalls++;
   return Promise.resolve(null);
  }
 };
 return {ctx,pending,requestStarted,painted:()=>painted,laterCalls:()=>laterCalls,resolveTarget};
}
function moveToNewRoom(ctx){
 ctx.room=newRoom;ctx.match={turn_no:1,status:"active"};
 ctx.viewGeneration=5;
}
test("v0.1.95: late presence result cannot overwrite current room",async()=>{
 const f=context("chaotic_ping_preview_3x3_player");
 const work=isolate("async function refresh3x3Allies(){","function updateRoomUI()",f.ctx)();
 await f.requestStarted;
 moveToNewRoom(f.ctx);
 const newPresence={peer_active:false,new_room:true};
 f.ctx.playerPresence3x3=newPresence;
 f.pending.resolve({peer_active:true,old_room:true});
 await work;
 assert.equal(f.ctx.playerPresence3x3,newPresence);
 assert.equal(f.ctx.resumePhase3x3,null);
 assert.equal(f.painted(),0);
});
test("v0.1.95: late resume checkpoint cannot unlock new room",async()=>{
 const f=context("chaotic_get_preview_3x3_resume_status");
 const work=isolate("async function refresh3x3Allies(){","function updateRoomUI()",f.ctx)();
 await f.requestStarted;
 moveToNewRoom(f.ctx);
 const newPhase={phase:"awaiting_payment",turn_no:1,new_room:true};
 f.ctx.resumePhase3x3=newPhase;
 f.pending.resolve({phase:"ready",turn_no:7,old_room:true});
 await work;
 assert.equal(f.ctx.resumePhase3x3,newPhase);
 assert.equal(f.painted(),0);
});
test("v0.1.95: late borrowed priority cannot overwrite new room plan",async()=>{
 const f=context("chaotic_get_preview_3x3_borrowed_105_priority",null,[{turn_no:7}]);
 const work=isolate("async function refresh3x3Allies(){","function updateRoomUI()",f.ctx)();
 await f.requestStarted;
 moveToNewRoom(f.ctx);
 const newPriority={new_room:true};
 f.ctx.borrowedPriority3x3=newPriority;
 f.pending.resolve({old_room:true});
 await work;
 assert.equal(f.ctx.borrowedPriority3x3,newPriority);
 assert.equal(f.painted(),0);
});
test("v0.1.95: a preflight already awaiting the server cannot authorize a new room",async()=>{
 const waiting=deferred();let started;
 const startedPromise=new Promise(resolve=>{started=resolve;});
 let updates=0;
 const ctx={
   room:oldRoom,match:{turn_no:7,status:"active"},viewGeneration:9,
   resumePhase3x3:null,
   rpc:()=>{started();return waiting.promise;},
   updateMatchUI:()=>{updates++;}
 };
 const preflight=isolate("async function require3x3Phase(","function updateMatchUI()",ctx);
 const work=preflight(7,["ready"],false);
 await startedPromise;
 ctx.room=newRoom;ctx.match={turn_no:7,status:"active"};ctx.viewGeneration=10;
 const latest={phase:"awaiting_defender",turn_no:7,new_room:true};
 ctx.resumePhase3x3=latest;
 waiting.resolve({phase:"ready",turn_no:7,training_finished:false});
 await assert.rejects(work,/sala ou o turno mudou/i);
 assert.equal(ctx.resumePhase3x3,latest);
 assert.equal(updates,0);
});
test("v0.1.95: no pending RPC writes its payload before room/turn verification",()=>{
 const body=src.slice(src.indexOf("async function refresh3x3Allies(){"),
                     src.indexOf("function updateRoomUI()"));
 for (const [local,field] of [
  ["latestPresence3x3","playerPresence3x3"],
  ["latestCheckpoint3x3","resumePhase3x3"],
  ["pendingBorrowedPriority","borrowedPriority3x3"]
 ]){
  const rx=new RegExp("const "+local+"=await rpc\\([\\s\\S]*?if\\(!isCurrent3x3Request\\(\\)\\)return;\\s*"+field+"="+local+";");
  assert.match(body,rx,field);
 }
});
