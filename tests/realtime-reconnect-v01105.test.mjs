import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const start=source.indexOf("function watch() {");
const end=source.indexOf("async function restoreLastRoom(",start);
assert.ok(start>=0&&end>start,"watch() boundaries must remain available");

function harness(){
 let now=1000;
 const channels=[], timers=[], warnings=[];
 const ctx={
  room:{id:"room-A"},viewGeneration:7,userId:"guest",poll:null,liveChannel:null,
  realtimeRetryPending:false,realtimeRetryAfter:0,
  refreshInFlight:null,document:{hidden:false},navigator:{onLine:true},
  Date:{now:()=>now},
  $:id=>id==="lobby-current"?{}:{style:{display:"flex"}},
  console:{warn:message=>warnings.push(message)},note:()=>{},
  refreshRoom:async()=>{},
  halt(){
   ctx.poll=null;
   ctx.liveChannel=null;
   ctx.realtimeRetryPending=false;
  },
  api:{channel(name){
   const ch={name,on(){return this;},subscribe(handler){this.emit=handler;return this;}};
   channels.push(ch);
   return ch;
  }},
  setInterval(fn){timers.push(fn);return timers.length;}
 };
 const watch=vm.runInNewContext("("+source.slice(start,end).trim()+")",ctx);
 return {ctx,watch,channels,timers,warnings,setTime:v=>{now=v;},tick:()=>timers.at(-1)()};
}
test("v0.1.105: Realtime error keeps read-only polling and throttles reconnect for 30 seconds",()=>{
 const f=harness();
 f.watch();
 const old=f.channels[0];
 old.emit("CHANNEL_ERROR");
 assert.equal(f.ctx.realtimeRetryPending,true);
 assert.equal(f.ctx.realtimeRetryAfter,31000);
 f.setTime(30999);
 f.tick();
 assert.equal(f.channels.length,1);
 f.setTime(31000);
 f.tick();
 assert.equal(f.channels.length,2);
 assert.equal(f.ctx.liveChannel,f.channels[1]);
 assert.equal(f.ctx.realtimeRetryPending,false);
 assert.equal(f.ctx.poll,2);
 assert.match(f.warnings.join(" "),/reconexão programada/i);
});
test("v0.1.105: subscribed channel clears retry; stale channel failure cannot override new channel",()=>{
 const f=harness();
 f.watch();
 const first=f.channels[0];
 first.emit("TIMED_OUT");
 assert.equal(f.ctx.realtimeRetryPending,true);
 first.emit("SUBSCRIBED");
 assert.equal(f.ctx.realtimeRetryPending,false);
 f.setTime(50000);
 f.tick();
 assert.equal(f.channels.length,1,"healthy subscription does not reconnect");
 first.emit("CHANNEL_ERROR");
 f.setTime(81000);
 f.tick();
 assert.equal(f.channels.length,2);
 first.emit("CHANNEL_ERROR");
 assert.equal(f.ctx.realtimeRetryPending,false,"obsolete subscription cannot schedule retry");
});
test("v0.1.105: old-room channel notifications do not touch new-room retry state",()=>{
 const f=harness();
 f.watch();
 const previous=f.channels[0];
 f.ctx.room={id:"room-B"};f.ctx.viewGeneration++;
 previous.emit("CLOSED");
 assert.equal(f.ctx.realtimeRetryPending,false);
 assert.equal(f.channels.length,1);
 f.watch();
 f.channels[1].emit("CLOSED");
 assert.equal(f.ctx.realtimeRetryPending,true);
 assert.equal(f.ctx.realtimeRetryAfter,31000);
});
test("v0.1.105: repeated channel errors cannot postpone an already scheduled retry",()=>{
 const f=harness();
 f.watch();
 const channel=f.channels[0];
 channel.emit("TIMED_OUT");
 f.setTime(20000);
 channel.emit("CHANNEL_ERROR");
 assert.equal(f.ctx.realtimeRetryAfter,31000);
 f.setTime(31000);
 f.tick();
 assert.equal(f.channels.length,2);
});
