import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const start=source.indexOf("function watch() {");
const end=source.indexOf("async function restoreLastRoom(",start);
assert.ok(start>=0&&end>start,"watch() boundaries");
const code=source.slice(start,end).trim();
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function harness(){
 const channels=[],refreshes=[],warnings=[],notes=[];
 const ctx={
  room:{id:"room-A"},viewGeneration:8,userId:"guest",
  poll:null,liveChannel:null,realtimeRetryPending:false,realtimeRetryAfter:0,
  refreshInFlight:null,document:{hidden:false},navigator:{onLine:true},
  Date:{now:()=>1000},
  $:id=>id==="lobby-current"?{}:
    id==="tela-entrada-drome"?{style:{display:"flex"}}:null,
  console:{warn:msg=>warnings.push(msg)},note:msg=>notes.push(msg),
  api:{channel(name){
   const channel={name,callbacks:[],on(_event,_options,cb){this.callbacks.push(cb);return this;},
    subscribe(cb){this.emit=cb;return this;}};
   channels.push(channel);return channel;
  }},
  halt(){ctx.poll=null;ctx.liveChannel=null;ctx.realtimeRetryPending=false;},
  setInterval:()=>1,
  refreshRoom(){refreshes.push({room:ctx.room?.id});return Promise.resolve();}
 };
 const watch=vm.runInNewContext("("+code+")",ctx);
 return {ctx,watch,channels,refreshes,warnings,notes};
}
test("v0.1.113: same Supabase channel instantly reads server after error and SUBSCRIBED",async()=>{
 const f=harness();f.watch();
 const ch=f.channels[0];
 ch.emit("CHANNEL_ERROR");
 assert.equal(f.ctx.realtimeRetryPending,true);
 assert.equal(f.refreshes.length,0);
 ch.emit("SUBSCRIBED");
 assert.equal(f.ctx.realtimeRetryPending,false);
 assert.equal(f.refreshes.length,1,"no 6-second polling delay");
 assert.equal(f.refreshes[0].room,"room-A");
 assert.equal(f.channels.length,1,"no duplicate channel");
 await flush();
});
test("v0.1.113: initial or repeated SUBSCRIBED status does not trigger an extra read",()=>{
 const f=harness();f.watch();
 f.channels[0].emit("SUBSCRIBED");
 f.channels[0].emit("SUBSCRIBED");
 assert.equal(f.refreshes.length,0);
 f.channels[0].emit("TIMED_OUT");
 f.channels[0].emit("SUBSCRIBED");
 f.channels[0].emit("SUBSCRIBED");
 assert.equal(f.refreshes.length,1);
});
test("v0.1.113: hidden page records recovery but does not read or mutate",()=>{
 const f=harness();f.watch();f.channels[0].emit("CHANNEL_ERROR");
 f.ctx.document.hidden=true;
 f.channels[0].emit("SUBSCRIBED");
 assert.equal(f.refreshes.length,0);
 assert.equal(f.ctx.realtimeRetryPending,false);
});
test("v0.1.113: offline or non-DROME page does not start a hidden catch-up",()=>{
 for(const skip of [
  f=>{f.ctx.navigator.onLine=false;},
  f=>{f.ctx.$=id=>id==="lobby-current"?{}:
    id==="tela-entrada-drome"?{style:{display:"none"}}:null;},
  f=>{f.ctx.$=()=>null;}
 ]){
  const f=harness();f.watch();f.channels[0].emit("TIMED_OUT");
  skip(f);f.channels[0].emit("SUBSCRIBED");
  assert.equal(f.refreshes.length,0);
 }
});
test("v0.1.113: callback from a replaced channel cannot read or cancel current retry",()=>{
 const f=harness();f.watch();
 const old=f.channels[0];
 f.watch();f.channels[1].emit("CHANNEL_ERROR");
 assert.equal(f.ctx.realtimeRetryPending,true);
 old.emit("SUBSCRIBED");
 assert.equal(f.ctx.realtimeRetryPending,true);
 assert.equal(f.refreshes.length,0);
 f.channels[1].emit("SUBSCRIBED");
 assert.equal(f.ctx.realtimeRetryPending,false);
 assert.equal(f.refreshes.length,1);
});
test("v0.1.113: a callback for an abandoned lobby cannot recover the new room",()=>{
 const f=harness();f.watch();const old=f.channels[0];
 f.ctx.room={id:"room-B"};f.ctx.viewGeneration++;
 old.emit("CHANNEL_ERROR");old.emit("SUBSCRIBED");
 assert.equal(f.refreshes.length,0);
 f.watch();const current=f.channels[1];
 current.emit("CHANNEL_ERROR");current.emit("SUBSCRIBED");
 assert.equal(f.refreshes.length,1);
 assert.equal(f.refreshes[0].room,"room-B");
});
test("v0.1.113: recovery is read-only; never auto pays, attacks, draws or passes",()=>{
 assert.match(code,/if\(recovering && !document\.hidden/);
 assert.match(code,/sync\(\)/);
 assert.doesNotMatch(code,/chaotic_(?:spend|pay|attack|pass|apply|draw|prepare|settle)/);
});
