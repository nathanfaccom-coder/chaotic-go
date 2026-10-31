import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const expired={id:"expired",host_id:"host",guest_id:"guest",code:"TEST12345678",mode:"3x3",status:"cancelled",expires_at:"2026-10-31T00:00:00Z"};
const current={id:"new-room",host_id:"host",guest_id:"guest",code:"FRESH1234567",mode:"3x3",status:"ready",expires_at:"2099-01-01T00:00:00Z"};
function extract(start,end,context) {
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,"function boundaries: "+start);
 return vm.runInNewContext("("+source.slice(a,b).trim()+")",context);
}
function pendingResult(){
 let resolve;
 const promise=new Promise(r=>{resolve=r;});
 return {promise,finish:()=>resolve({restored_count:2})};
}
function fakeDb(){
 return {from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:expired,error:null})})})})};
}
test("v0.1.91: delayed recovery cannot close a freshly opened room",async()=>{
 const pending=pendingResult();let forgets=0,stops=0,updates=0,refreshes=0;
 const ctx={
  room:expired,viewGeneration:1,userId:"host",match:null,
  $:id=>id==="lobby-current"?{}:null,
  api:fakeDb(),rpc:()=>pending.promise,
  forgetLastRoom:()=>{forgets++;},halt:()=>{stops++;},
  updateRoomUI:()=>{updates++;},refreshMatch:async()=>{refreshes++;},note:()=>{}
 };
 const sync=extract("async function refreshRoomOnce()","async function refreshRoom()",ctx);
 const running=sync();
 await Promise.resolve();await Promise.resolve();
 ctx.room=current;ctx.viewGeneration=2;
 pending.finish();await running;
 assert.equal(ctx.room,current);assert.equal(ctx.match,null);
 assert.equal(forgets,0);assert.equal(stops,0);assert.equal(updates,0);assert.equal(refreshes,0);
});
test("v0.1.91: delayed restore cannot forget a newly chosen room",async()=>{
 const pending=pendingResult();let forgets=0;
 const ctx={
  room:null,restoreInProgress:false,viewGeneration:5,busy:false,
  savedRoomId:()=>"expired",api:fakeDb(),userId:"host",
  rpc:()=>pending.promise,forgetLastRoom:()=>{forgets++;},
  note:()=>{},$:()=>({style:{display:"flex"}})
 };
 const restore=extract("async function restoreLastRoom(generation)","function show()",ctx);
 const running=restore(5);
 await Promise.resolve();await Promise.resolve();
 ctx.room=current;ctx.viewGeneration=6;
 pending.finish();await running;
 assert.equal(ctx.room,current);assert.equal(ctx.restoreInProgress,false);assert.equal(forgets,0);
});
test("v0.1.91: offline resume waits for connectivity without replay",async()=>{
 let reads=0,restores=0;
 const ctx={
  room:current,viewGeneration:8,navigator:{onLine:false},document:{hidden:false},
  $:()=>({style:{display:"flex"}}),
  refreshRoom:async()=>{reads++;},restoreLastRoom:async()=>{restores++;},
  note:()=>{}
 };
 const handler=extract("function refreshWhenVisible()","// Lightweight Node test harnesses",ctx);
 handler();assert.equal(reads,0);assert.equal(restores,0);
 ctx.navigator.onLine=true;handler();await Promise.resolve();
 assert.equal(reads,1);assert.equal(restores,0);
 assert.ok(source.includes("sem reenviar ataques automaticamente"));
});
