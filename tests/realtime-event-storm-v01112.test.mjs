import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function isolate(start,end,ctx){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"function boundary "+start);
 return vm.runInNewContext("("+source.slice(a,b).trim()+")",ctx);
}
function deferred(){
 let resolve,reject;
 const promise=new Promise((a,b)=>{resolve=a;reject=b;});
 return {resolve,reject,promise};
}
const settle=()=>new Promise(done=>setImmediate(done));

function watchHarness(){
 const channels=[],timerFns=[],messages=[],requests=[];
 const ctx={
  room:{id:"A"},viewGeneration:4,userId:"guest",
  poll:null,liveChannel:null,realtimeRetryPending:false,realtimeRetryAfter:0,
  refreshInFlight:null,document:{hidden:false},navigator:{onLine:true},
  Date:{now:()=>1000},
  $:id=>id==="lobby-current"?{}:{style:{display:"flex"}},
  console:{warn:()=>{}},note:m=>messages.push(m),
  api:{channel(name){
   const channel={
    name,callbacks:[],on(type,filter,callback){this.callbacks.push(callback);return this;},
    subscribe(cb){this.status=cb;return this;}
   };
   channels.push(channel);return channel;
  }},
  halt(){ctx.liveChannel=null;ctx.poll=null;ctx.realtimeRetryPending=false;},
  setInterval(fn){timerFns.push(fn);return timerFns.length;},
  refreshRoom(){const pending=deferred();requests.push(pending);return pending.promise;}
 };
 const watch=isolate("function watch()","async function restoreLastRoom(",ctx);
 return {ctx,watch,channels,timerFns,messages,requests};
}
test("v0.1.112: stale Realtime channel cannot request another refresh after reconnect",async()=>{
 const f=watchHarness();f.watch();
 const old=f.channels[0];
 f.watch();
 old.callbacks[0]();
 assert.equal(f.requests.length,0);
 f.channels[1].callbacks[0]();
 assert.equal(f.requests.length,1);
 f.requests[0].resolve();await settle();
});
test("v0.1.112: stale channel failure cannot overwrite the new screen notice",async()=>{
 const f=watchHarness();f.watch();
 const old=f.channels[0];old.callbacks[0]();
 assert.equal(f.requests.length,1);
 f.watch();
 f.requests[0].reject(Error("old websocket"));
 await settle();
 assert.equal(f.messages.length,0);
 f.channels[1].callbacks[0]();
 f.requests[1].reject(Error("current websocket"));
 await settle();
 assert.equal(f.messages.length,1);
 assert.match(f.messages[0],/Erro ao sincronizar sala: current websocket/);
});
test("v0.1.112: a different room and view reject old Realtime notifications",async()=>{
 const f=watchHarness();f.watch();
 const old=f.channels[0];
 f.ctx.room={id:"B"};f.ctx.viewGeneration++;
 old.callbacks[0]();
 assert.equal(f.requests.length,0);
 f.watch();f.channels[1].callbacks[0]();
 assert.equal(f.requests.length,1);
 f.requests[0].resolve();await settle();
});
test("v0.1.112: event storm cannot trap refreshRoom in an unbounded loop",async()=>{
 let reads=0;
 const ctx={
  room:{id:"A"},viewGeneration:4,refreshInFlight:null,refreshQueued:false,
  $:id=>id==="lobby-current"?{}:null,
  refreshRoomOnce:async()=>{reads++;ctx.refreshQueued=true;}
 };
 const refresh=isolate("async function refreshRoom()","  // A complete 3x3 refresh reads many tables sequentially.",ctx);
 await refresh();
 assert.equal(reads,2,"a read and one coalesced catch-up, not endless");
 assert.equal(ctx.refreshInFlight,null);
 assert.equal(ctx.refreshQueued,false);
 await refresh();
 assert.equal(reads,4,"a new manual refresh must still work");
});
test("v0.1.112: repeated realtime events share one in-flight read and one catch-up",async()=>{
 const first=deferred(),second=deferred(),calls=[];
 const ctx={
  room:{id:"A"},viewGeneration:4,refreshInFlight:null,refreshQueued:false,
  $:()=>({}),
  refreshRoomOnce(){
   calls.push(calls.length+1);
   return calls.length===1?first.promise:second.promise;
  }
 };
 const refresh=isolate("async function refreshRoom()","  // A complete 3x3 refresh reads many tables sequentially.",ctx);
 const pending=refresh();
 for(let i=0;i<100;i++)refresh();
 assert.equal(calls.length,1);
 first.resolve();
 await settle();
 assert.equal(calls.length,2);
 second.resolve();
 await pending;
 assert.equal(calls.length,2);
 assert.equal(ctx.refreshInFlight,null);
});
test("v0.1.112: read storms cannot mutate HP, pass turn or replay paid attacks",()=>{
 const code=source.slice(source.indexOf("async function refreshRoom()"),
   source.indexOf("async function restoreLastRoom("));
 assert.doesNotMatch(code,/chaotic_(?:pass_turn|spend|apply_damage|attack|borrow)/);
 assert.match(code,/reads<2/);
 assert.match(code,/liveChannel!==subscribedChannel/);
});
