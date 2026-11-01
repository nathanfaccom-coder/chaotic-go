import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function extract(start,end,ctx){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"expected function boundary "+start);
 return vm.runInNewContext("("+source.slice(a,b).trim()+")",ctx);
}
function deferred(){
 let resolve,reject;
 const promise=new Promise((r,j)=>{resolve=r;reject=j;});
 return {promise,resolve,reject};
}
const room=id=>({
 id,code:"ABCDEF123456",host_id:"host",guest_id:"guest",mode:"3x3",
 status:"ready",expires_at:"2099-01-01T00:00:00Z"
});
function restoreCtx(){
 let activeRoom="room-old";
 const queries=new Map();
 const ctx={
   room:null,busy:false,viewGeneration:1,restoreInProgress:false,restoreOwner:null,
   userId:"host",savedRoomId:()=>activeRoom,
   api:{from:()=>({select:()=>({eq:(col,id)=>({
     maybeSingle:()=>{const d=deferred();queries.set(id,d);return d.promise;}
   })})})},
   $:()=>({style:{display:"flex"}}),note:()=>{},
   updateRoomUI:()=>{},watch:()=>{},refreshRoom:async()=>{},
   forgetLastRoom:()=>{},Date
 };
 return {ctx,queries,setRoomId:id=>activeRoom=id};
}
test("v0.1.99: reopen starts a new restore before old network request resolves",async()=>{
 const f=restoreCtx(),restore=extract("async function restoreLastRoom(generation)","function show()",f.ctx);
 const old=restore(1);
 assert.equal(f.ctx.restoreInProgress,true);
 assert.ok(f.queries.has("room-old"));
 // Mirrors the reset performed by show().
 f.ctx.viewGeneration=2;f.ctx.restoreInProgress=false;f.ctx.restoreOwner=null;
 f.setRoomId("room-new");
 const fresh=restore(2);
 assert.ok(f.queries.has("room-new"));
 assert.equal(f.ctx.restoreInProgress,true);
 f.queries.get("room-old").resolve({data:room("room-old"),error:null});
 await old;
 assert.equal(f.ctx.restoreInProgress,true);
 assert.equal(f.ctx.room,null);
 f.queries.get("room-new").resolve({data:room("room-new"),error:null});
 await fresh;
 assert.equal(f.ctx.room.id,"room-new");
 assert.equal(f.ctx.restoreInProgress,false);
 assert.equal(f.ctx.restoreOwner,null);
});
test("v0.1.99: old restore error does not unlock the current restore",async()=>{
 const f=restoreCtx(),restore=extract("async function restoreLastRoom(generation)","function show()",f.ctx);
 const old=restore(1);
 f.ctx.viewGeneration=2;f.ctx.restoreInProgress=false;f.ctx.restoreOwner=null;
 f.setRoomId("room-new");
 const fresh=restore(2);
 f.queries.get("room-old").reject(Error("old network failure"));
 await assert.rejects(old,/old network failure/);
 assert.equal(f.ctx.restoreInProgress,true);
 f.queries.get("room-new").resolve({data:room("room-new"),error:null});
 await fresh;
 assert.equal(f.ctx.room.id,"room-new");
 assert.equal(f.ctx.restoreInProgress,false);
});
test("v0.1.99: DROME resets the old restoration token on opening",()=>{
 const a=source.indexOf("function show() {"),b=source.indexOf('$("tela-menu").style.display = "none";',a);
 const code=source.slice(a,b);
 for(const phrase of ["restoreInProgress=false;","restoreOwner=null;"])assert.ok(code.includes(phrase));
 assert.ok(source.includes("if(restoreOwner===restoreTicket)"));
});
function wakeContext(){
 const old=deferred(),notes=[];
 const ctx={
  document:{hidden:false},navigator:{onLine:true},
  room:{id:"room-old"},viewGeneration:1,
  $:()=>({style:{display:"flex"}}),
  refreshRoom:()=>old.promise,restoreLastRoom:async()=>{},note:s=>notes.push(s)
 };
 return {ctx,old,notes};
}
test("v0.1.99: stale reconnection errors do not replace new room alerts",async()=>{
 const f=wakeContext(),wake=extract("function refreshWhenVisible()","// Lightweight Node test harnesses",f.ctx);
 wake();f.ctx.room={id:"room-new"};f.ctx.viewGeneration=2;
 f.old.reject(Error("previous room not accessible"));
 await Promise.resolve();await Promise.resolve();
 assert.deepEqual(f.notes,[]);
});
test("v0.1.99: active-room reconnect errors are still reported",async()=>{
 const f=wakeContext(),wake=extract("function refreshWhenVisible()","// Lightweight Node test harnesses",f.ctx);
 wake();f.old.reject(Error("temporary failure"));
 await Promise.resolve();await Promise.resolve();
 assert.equal(f.notes.length,1);
 assert.match(f.notes[0],/Falha na reconexão/);
});
