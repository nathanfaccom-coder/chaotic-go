import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const a=source.indexOf("function refreshWhenVisible() {");
const b=source.indexOf("// Lightweight Node test harnesses",a);
assert.ok(a>=0&&b>a,"visible reconnect handler boundaries");

function harness({roomId="room-A",rememberedRoom="room-A",hidden=false,online=true}={}){
 const counters={watch:0,refresh:0,restore:0},messages=[];
 const ctx={
  room:roomId?{id:roomId}:null,
  offlineRealtimeRoomId:rememberedRoom,
  viewGeneration:9,busy:false,refreshInFlight:null,refreshQueued:false,
  document:{hidden},navigator:{onLine:online},
  $:id=>id==="tela-entrada-drome"?{style:{display:"flex"}}:null,
  watch:()=>{counters.watch++;},
  refreshRoom:async()=>{counters.refresh++;},
  restoreLastRoom:async()=>{counters.restore++;},
  note:(msg)=>messages.push(msg)
 };
 const resume=vm.runInNewContext("("+source.slice(a,b).trim()+")",ctx);
 return {resume,ctx,counters,messages};
}
test("v0.1.106: after mobile internet returns, rebuild only realtime subscription and refresh state",()=>{
 const f=harness();
 f.resume();
 assert.equal(f.counters.watch,1);
 assert.equal(f.counters.refresh,1);
 assert.equal(f.counters.restore,0);
 assert.equal(f.ctx.offlineRealtimeRoomId,null);
 f.resume();
 assert.equal(f.counters.watch,1,"subsequent visibility events do not rebuild healthy channel");
 assert.equal(f.counters.refresh,2);
});
test("v0.1.106: no network or hidden app cannot prematurely re-subscribe",()=>{
 const f=harness({online:false});
 f.resume();
 assert.equal(f.counters.watch,0);
 assert.equal(f.counters.refresh,0);
 assert.equal(f.ctx.offlineRealtimeRoomId,"room-A");
 f.ctx.navigator.onLine=true;
 f.ctx.document.hidden=true;
 f.resume();
 assert.equal(f.counters.watch,0);
 f.ctx.document.hidden=false;
 f.resume();
 assert.equal(f.counters.watch,1);
 assert.equal(f.counters.refresh,1);
});
test("v0.1.106: offline signal for old room cannot hijack new selected room",()=>{
 const f=harness({roomId:"new-room",rememberedRoom:"old-room"});
 f.resume();
 assert.equal(f.counters.watch,0);
 assert.equal(f.counters.refresh,1);
 assert.equal(f.ctx.room.id,"new-room");
});
test("v0.1.106: login without a selected room still restores saved lobby normally",()=>{
 const f=harness({roomId:null,rememberedRoom:"old-room"});
 f.resume();
 assert.equal(f.counters.watch,0);
 assert.equal(f.counters.refresh,0);
 assert.equal(f.counters.restore,1);
});
test("v0.1.106: offline event records current room only; no combat action is replayed",()=>{
 assert.match(source,/window\.addEventListener\("offline",\s*\(\)\s*=>\s*\{[\s\S]*?offlineRealtimeRoomId=room\.id/);
 const fn=source.slice(a,b);
 assert.doesNotMatch(fn,/chaotic_(?:spend|pass|attack|apply|open|prepare|settle)/);
 assert.match(fn,/watch\(\)/);
 assert.match(fn,/refreshRoom\(\)/);
});

test("v0.1.107: Android background/foreground without offline event re-subscribes once",()=>{
 const f=harness({rememberedRoom:null,hidden:true});
 f.resume();
 assert.equal(f.counters.watch,0);
 assert.equal(f.counters.refresh,0);
 assert.equal(f.ctx.offlineRealtimeRoomId,"room-A");
 f.ctx.document.hidden=false;
 f.resume();
 assert.equal(f.counters.watch,1);
 assert.equal(f.counters.refresh,1);
 assert.equal(f.ctx.offlineRealtimeRoomId,null);
 f.resume();
 assert.equal(f.counters.watch,1,"duplicate foreground event does not duplicate channel");
 assert.equal(f.counters.refresh,2);
});
test("v0.1.107: hidden DROME waits for internet before re-subscribing",()=>{
 const f=harness({rememberedRoom:null,hidden:true,online:false});
 f.resume();
 assert.equal(f.ctx.offlineRealtimeRoomId,"room-A");
 f.ctx.document.hidden=false;
 f.resume();
 assert.equal(f.counters.watch,0);
 assert.equal(f.counters.refresh,0);
 f.ctx.navigator.onLine=true;
 f.resume();
 assert.equal(f.counters.watch,1);
 assert.equal(f.counters.refresh,1);
});
test("v0.1.107: a hidden unrelated screen does not trigger DROME reconnection",()=>{
 const f=harness({rememberedRoom:null,hidden:true});
 f.ctx.$=()=>({style:{display:"none"}});
 f.resume();
 assert.equal(f.ctx.offlineRealtimeRoomId,null);
 f.ctx.document.hidden=false;
 f.resume();
 assert.equal(f.counters.watch,0);
 assert.equal(f.counters.refresh,0);
});
