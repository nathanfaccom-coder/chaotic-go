import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function isolate(start,end,ctx){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"function boundaries "+start);
 return vm.runInNewContext("("+source.slice(a,b).trim()+")",ctx);
}
function deferred(){
 let resolve;
 const promise=new Promise(done=>{resolve=done;});
 return {promise,resolve};
}
function harness(){
 let watchCalls=0,refreshCalls=0;
 const ctx={
  room:{id:"room-A"},viewGeneration:8,
  offlineRealtimeRoomId:"room-A",busy:false,
  refreshInFlight:{pending:true},refreshQueued:true,
  document:{hidden:false},navigator:{onLine:true},
  $:id=>id==="tela-entrada-drome"?{style:{display:"flex"}}:
    id==="lobby-current"?{}:null,
  watch:()=>{watchCalls++;},
  refreshRoom:async()=>{refreshCalls++;},
  restoreLastRoom:async()=>{},
  note:()=>{}
 };
 const resume=isolate("function refreshWhenVisible()","  // Lightweight Node test harnesses",ctx);
 return {ctx,resume,counts:()=>({watchCalls,refreshCalls})};
}
test("v0.1.114: reconnect abandons a frozen read but preserves the selected DROME",()=>{
 const f=harness(),oldRoom=f.ctx.room;
 f.resume();
 assert.equal(f.ctx.room,oldRoom);
 assert.equal(f.ctx.viewGeneration,9);
 assert.equal(f.ctx.refreshInFlight,null);
 assert.equal(f.ctx.refreshQueued,false);
 assert.equal(f.ctx.offlineRealtimeRoomId,null);
 assert.deepEqual(f.counts(),{watchCalls:1,refreshCalls:1});
});
test("v0.1.114: repeat online/visibility events cannot repeatedly invalidate the same room",()=>{
 const f=harness();
 f.resume();f.resume();f.resume();
 assert.equal(f.ctx.viewGeneration,9);
 assert.equal(f.counts().watchCalls,1);
 assert.equal(f.counts().refreshCalls,3);
});
test("v0.1.114: a server mutation already in flight is never abandoned or replayed",()=>{
 const f=harness();
 const original=f.ctx.refreshInFlight;
 f.ctx.busy=true;
 f.resume();
 assert.equal(f.ctx.viewGeneration,8);
 assert.equal(f.ctx.refreshInFlight,original);
 assert.equal(f.ctx.busy,true);
 assert.equal(f.counts().watchCalls,1);
 assert.equal(f.counts().refreshCalls,1);
 assert.doesNotMatch(source.slice(source.indexOf("function refreshWhenVisible()")),
   /chaotic_(?:pass|attack|spend|apply|pay)/);
});
test("v0.1.114: offline or background callbacks never discard a frozen read",()=>{
 for(const alter of [
  f=>{f.ctx.navigator.onLine=false;},
  f=>{f.ctx.document.hidden=true;},
  f=>{f.ctx.$=()=>({style:{display:"none"}});}
 ]){
  const f=harness(),original=f.ctx.refreshInFlight;
  alter(f);f.resume();
  assert.equal(f.ctx.refreshInFlight,original);
  assert.equal(f.ctx.viewGeneration,8);
  assert.equal(f.counts().refreshCalls,0);
 }
});
test("v0.1.114: old suspended refresh cannot erase newer room's queued refresh",async()=>{
 const old=deferred(),current=deferred();
 const requests=[];
 const ctx={
  room:{id:"room-A"},viewGeneration:8,
  offlineRealtimeRoomId:"room-A",busy:false,
  refreshInFlight:null,refreshQueued:false,
  document:{hidden:false},navigator:{onLine:true},
  $:id=>id==="tela-entrada-drome"?{style:{display:"flex"}}:
    id==="lobby-current"?{}:null,
  watch:()=>{},note:()=>{},
  refreshRoomOnce:()=>{
   requests.push(ctx.viewGeneration);
   return requests.length===1?old.promise:
     requests.length===2?current.promise:Promise.resolve();
  }
 };
 const refresh=isolate("async function refreshRoom()","  // A complete 3x3 refresh reads many tables sequentially.",ctx);
 const resume=isolate("function refreshWhenVisible()","  // Lightweight Node test harnesses",ctx);
 ctx.refreshRoom=refresh;
 const abandoned=refresh();
 assert.equal(requests.length,1);
 const oldLock=ctx.refreshInFlight;
 assert.ok(oldLock);
 resume();
 assert.equal(ctx.viewGeneration,9);
 assert.equal(requests.length,2);
 assert.notEqual(ctx.refreshInFlight,oldLock);
 refresh(); // a new same-room event must still be delivered after current read
 assert.equal(ctx.refreshQueued,true);
 old.resolve();
 await abandoned;
 assert.equal(ctx.refreshQueued,true,"stale request cannot erase newest queued event");
 assert.notEqual(ctx.refreshInFlight,null);
 current.resolve();
 await ctx.refreshInFlight;
 assert.equal(requests.length,3,"newest queued read was not lost");
 assert.equal(ctx.refreshQueued,false);
 assert.equal(ctx.refreshInFlight,null);
});
test("v0.1.114: a late old-screen result is fenced from painting new 3x3 state",()=>{
 const code=source.slice(source.indexOf("async function refreshMatch()"),
   source.indexOf("function next3x3Instruction(state)"));
 assert.match(code,/viewGeneration===requestedView/);
 assert.match(code,/match===expectedMatchRef/);
 const roomCode=source.slice(source.indexOf("async function refreshRoomOnce()"),
   source.indexOf("async function refreshRoom()"));
 assert.match(roomCode,/requestedView!==viewGeneration/);
 const reconnect=source.slice(source.indexOf("function refreshWhenVisible()"),
   source.indexOf("  \/\/ Lightweight Node test harnesses"));
 assert.match(reconnect,/viewGeneration\+\+;/);
 assert.match(reconnect,/refreshInFlight=null;/);
});
