import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const src=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function isolate(start,end,ctx){
 const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"function boundaries: "+start);
 return vm.runInNewContext("("+src.slice(a,b).trim()+")",ctx);
}
function deferred(){
 let resolve,reject;
 const promise=new Promise((a,b)=>{resolve=a;reject=b;});
 return {promise,resolve,reject};
}
const room=(mode="3x3",status="ready")=>({
 id:"old-room",code:"ABCDEF123456",mode,status,
 host_id:"host",guest_id:"guest",expires_at:"2099-01-01T00:00:00Z"
});
function harness(reply,mode="3x3"){
 const ctx={
  room:room(mode),match:{turn_no:7},viewGeneration:4,userId:"guest",
  playerPresence3x3:{old_room:true},trainingOutcomes3x3:[{decided_turn:7}],
  $:()=>({}),rememberLastRoom:()=>{ctx.remembers++;},
  forgetLastRoom:()=>{ctx.forgets++;},halt:()=>{ctx.halts++;},
  updateRoomUI:()=>{ctx.updates++;},
  refreshMatch:async()=>{ctx.matchReads++;},
  show:()=>{ctx.shows++;ctx.room=null;ctx.match=null;
    ctx.playerPresence3x3=null;ctx.trainingOutcomes3x3=[];ctx.viewGeneration++;},
  note:msg=>{ctx.messages.push(msg);},
  remembers:0,forgets:0,halts:0,updates:0,matchReads:0,shows:0,messages:[],
  api:{from:()=>({select:()=>({eq:()=>({maybeSingle:()=>Promise.resolve(reply)})})})},
  rpc:async(method,args)=>{ctx.rpcCalls.push([method,args]);return {restored_count:2};},
  rpcCalls:[],Date
 };
 const refresh=isolate("async function refreshRoomOnce()","async function refreshRoom()",ctx);
 return {ctx,refresh};
}
test("v0.1.104: host removal clears the guest's private cached match",async()=>{
 const f=harness({data:null,error:null});
 await f.refresh();
 assert.equal(f.ctx.shows,1);
 assert.equal(f.ctx.forgets,1);
 assert.equal(f.ctx.room,null);
 assert.equal(f.ctx.match,null);
 assert.equal(f.ctx.playerPresence3x3,null);
 assert.equal(f.ctx.trainingOutcomes3x3.length,0);
 assert.equal(f.ctx.matchReads,0);
 assert.match(f.ctx.messages.join(" "),/criar outra/i);
 assert.equal(f.ctx.rpcCalls.length,0);
});
test("v0.1.104: closed 3x3 recovers temporary loan cards BEFORE resetting",async()=>{
 const f=harness({data:room("3x3","cancelled"),error:null});
 let recoveryCalled=false;
 f.ctx.rpc=async(method,args)=>{
  recoveryCalled=true;
  assert.equal(method,"chaotic_restore_expired_preview_3x3_loans");
  assert.equal(args.p_lobby_id,"old-room");
  assert.equal(f.ctx.shows,0);
  return {restored_count:2};
 };
 await f.refresh();
 assert.ok(recoveryCalled);
 assert.equal(f.ctx.shows,1);
 assert.equal(f.ctx.forgets,1);
 assert.match(f.ctx.messages.join(" "),/2/);
 assert.equal(f.ctx.match,null);
});
test("v0.1.104: non-3x3 ended lobby can be replaced without loan RPC",async()=>{
 for(const mode of ["1x1","6x6"]){
  const expired={...room(mode),expires_at:"2020-01-01T00:00:00Z"};
  const f=harness({data:expired,error:null},mode);
  await f.refresh();
  assert.equal(f.ctx.shows,1);
  assert.equal(f.ctx.rpcCalls.length,0);
  assert.equal(f.ctx.room,null);
 }
});
test("v0.1.104: revoked membership is not accepted as a valid match",async()=>{
 const revoked={...room(),guest_id:"other-account"};
 const f=harness({data:revoked,error:null});
 await f.refresh();
 assert.equal(f.ctx.shows,1);
 assert.equal(f.ctx.matchReads,0);
 assert.equal(f.ctx.remembers,0);
});
test("v0.1.104: an old lobby response cannot close a newer chosen room",async()=>{
 const req=deferred(),ctx={
  room:room(),match:{turn_no:7},viewGeneration:4,userId:"guest",$:()=>({}),
  api:{from:()=>({select:()=>({eq:()=>({maybeSingle:()=>req.promise})})})},
  show:()=>{throw Error("old response closed new lobby");},
  forgetLastRoom:()=>{throw Error("old response deleted new room key");},
  Date
 };
 const work=isolate("async function refreshRoomOnce()","async function refreshRoom()",ctx)();
 ctx.room={...room(),id:"new-room"};ctx.viewGeneration=5;
 req.resolve({data:null,error:null});
 await work;
 assert.equal(ctx.room.id,"new-room");
});
test("v0.1.104: network error cannot falsely claim a lost room",async()=>{
 const f=harness({data:null,error:{message:"temporary network failure"}});
 await assert.rejects(f.refresh(),/temporary network failure/);
 assert.equal(f.ctx.shows,0);
 assert.equal(f.ctx.forgets,0);
 assert.equal(f.ctx.room.id,"old-room");
});
test("v0.1.104: active lobby still refreshes its real turn normally",async()=>{
 const f=harness({data:room(),error:null});
 await f.refresh();
 assert.equal(f.ctx.shows,0);
 assert.equal(f.ctx.matchReads,1);
 assert.equal(f.ctx.remembers,1);
});
function restoreHarness(){
 const messages=[],ctx={
  room:null,busy:false,restoreInProgress:false,restoreOwner:null,
  viewGeneration:2,userId:"guest",
  $:()=>({style:{display:"flex"}}),
  navigator:{onLine:true},Date,
  savedRoomId:()=>"old-room",forgetLastRoom:()=>{throw Error("must not forget valid room");},
  note:(msg,error)=>messages.push({msg,error}),
  updateRoomUI:()=>{},watch:()=>{},
  api:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:room(),error:null})})})})},
  refreshRoom:async()=>{throw Error("read temporarily unavailable");}
 };
 return {ctx,messages,restore:isolate("async function restoreLastRoom(generation)","function show()",ctx)};
}
test("v0.1.104: restored room with failed turn refresh reports retry and retains room",async()=>{
 const f=restoreHarness();
 await f.restore(2);
 assert.equal(f.ctx.room.id,"old-room");
 assert.equal(f.ctx.restoreInProgress,false);
 assert.match(f.messages.at(-1).msg,/turno ainda não sincronizou/);
 assert.match(f.messages.at(-1).msg,/Atualizar conexão e turno/);
 assert.equal(f.messages.at(-1).error,true);
});
test("v0.1.104: stale restored-room refresh error cannot overwrite a new room notice",async()=>{
 const f=restoreHarness(),d=deferred();
 f.ctx.refreshRoom=()=>d.promise;
 const pending=f.restore(2);
 await Promise.resolve();await Promise.resolve();
 f.ctx.viewGeneration=3;f.ctx.room={...room(),id:"new-room"};
 d.reject(Error("old connection"));
 await pending;
 assert.doesNotMatch(f.messages.join(" "),/turno ainda não sincronizou/);
});
