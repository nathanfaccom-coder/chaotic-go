import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function isolate(start,end,ctx){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"expected boundaries for "+start);
 return vm.runInNewContext("("+source.slice(a,b).trim()+")",ctx);
}
function deferred(){
 let resolve,reject;
 const promise=new Promise((a,b)=>{resolve=a;reject=b;});
 return {promise,resolve,reject};
}
async function settle(){
 await new Promise(resolve=>setImmediate(resolve));
}
function context(){
 const requests=[],logs=[];
 let now=1000,draws=0;
 const ctx={
  room:{id:"room-A",mode:"3x3",status:"ready"},
  match:{turn_no:4,status:"active"},viewGeneration:8,refreshInFlight:{},
  slowRefreshPing:null,slowRefreshPingRoom:null,slowRefreshPingTime:0,
  playerPresence3x3:null,
  navigator:{onLine:true},document:{hidden:false},
  Date:{now:()=>now},
  update3x3UI:()=>{draws++;},
  console:{warn:(...parts)=>logs.push(parts)},
  rpc:(name,args)=>{const waiting=deferred();requests.push({name,args,waiting});return waiting.promise;}
 };
 const heartbeat=isolate("function keep3x3PresenceAliveDuringRefresh()","function watch()",ctx);
 return {ctx,heartbeat,requests,logs,setNow:n=>{now=n;},draws:()=>draws};
}
test("v0.1.108: long 3x3 refresh keeps real server presence alive, without replaying combat",async()=>{
 const f=context();f.heartbeat();
 assert.equal(f.requests.length,1);
 assert.equal(f.requests[0].name,"chaotic_ping_preview_3x3_player");
 assert.equal(f.requests[0].args.p_lobby_id,"room-A");
 assert.equal(f.requests[0].args.p_ready,null);
 f.requests[0].waiting.resolve({self_active:true,peer_active:true});
 await settle();
 assert.equal(f.ctx.playerPresence3x3.self_active,true);
 assert.equal(f.draws(),1);
 f.setNow(5000);f.heartbeat();
 assert.equal(f.requests.length,1,"10-second minimum between pings");
 f.setNow(11000);f.heartbeat();
 assert.equal(f.requests.length,2);
});
test("v0.1.108: a slow heartbeat cannot open duplicate server calls",async()=>{
 const f=context();f.heartbeat();f.setNow(16000);f.heartbeat();
 assert.equal(f.requests.length,1);
 f.requests[0].waiting.resolve({self_active:true});await settle();
 f.heartbeat();
 assert.equal(f.requests.length,2);
});
test("v0.1.108: previous room heartbeat cannot paint the next lobby",async()=>{
 const f=context();f.heartbeat();
 f.ctx.room={id:"room-B",mode:"3x3",status:"ready"};
 f.ctx.match={turn_no:1,status:"active"};
 f.ctx.viewGeneration=9;
 f.heartbeat();
 assert.equal(f.requests.length,2,"new room can ping while old RPC is still pending");
 f.requests[0].waiting.resolve({self_active:false,stale:true});await settle();
 assert.equal(f.ctx.playerPresence3x3,null,"old private state must be discarded");
 f.requests[1].waiting.resolve({self_active:true});await settle();
 assert.equal(f.ctx.playerPresence3x3.self_active,true);
 assert.equal(f.draws(),1);
});
test("v0.1.108: previous turn's heartbeat cannot overwrite newer server turn",async()=>{
 const f=context();f.heartbeat();
 f.ctx.match={turn_no:5,status:"active"};
 f.requests[0].waiting.resolve({self_active:false});await settle();
 assert.equal(f.ctx.playerPresence3x3,null);
 assert.equal(f.draws(),0);
});
test("v0.1.108: only active, ready and visible 3x3 uses heartbeat",()=>{
 for(const mutate of [
   ctx=>{ctx.room.mode="1x1";},
   ctx=>{ctx.room.status="cancelled";},
   ctx=>{ctx.match.status="finished";},
   ctx=>{ctx.document.hidden=true;},
   ctx=>{ctx.navigator.onLine=false;},
   ctx=>{ctx.refreshInFlight=null;}
 ]){
   const f=context();mutate(f.ctx);f.heartbeat();
   assert.equal(f.requests.length,0);
 }
});
test("v0.1.108: heartbeat failure is nonfatal and does not trigger a replay",async()=>{
 const f=context();f.heartbeat();
 f.requests[0].waiting.reject(Error("connection interrupted"));
 await settle();
 assert.equal(f.ctx.playerPresence3x3,null);
 assert.equal(f.logs.length,1);
 f.setNow(11000);f.heartbeat();
 assert.equal(f.requests.length,2);
});
test("v0.1.108: 6s watcher pings only when its full refresh is still in flight",async()=>{
 let pulse=0,refreshes=0;
 const timers=[];
 const ctx={
  room:{id:"room-A"},viewGeneration:3,userId:"u",poll:null,liveChannel:null,
  realtimeRetryPending:false,refreshInFlight:{},
  document:{hidden:false},navigator:{onLine:true},
  $:id=>id==="lobby-current"?{}:{style:{display:"flex"}},
  halt:()=>{},
  api:{},
  setInterval(fn){timers.push(fn);return timers.length;},
  keep3x3PresenceAliveDuringRefresh:()=>{pulse++;},
  refreshRoom:async()=>{refreshes++;}
 };
 const watch=isolate("function watch()","async function restoreLastRoom(",ctx);
 watch();assert.equal(timers.length,1);
 timers[0]();
 assert.equal(pulse,1);
 assert.equal(refreshes,0);
 ctx.refreshInFlight=null;
 timers[0]();
 assert.equal(refreshes,1);
 assert.equal(pulse,1);
 await settle();
});
