import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const a=source.indexOf("async function refreshMatch()");
const b=source.indexOf("  // Guidance only: the server checkpoint remains authoritative.",a);
assert.ok(a>=0&&b>a,"refreshMatch boundaries");
const code=source.slice(a,b).trim();
const nextTick=()=>new Promise(done=>setImmediate(done));
function deferred(){
 let resolve;
 const promise=new Promise(done=>{resolve=done;});
 return {promise,resolve};
}
function environment({mode="3x3",status="finished",historyPending=false}={}){
 const events=[],staged=deferred(),reads=deferred();
 const ctx={
  room:{id:"A",mode,status:"ready"},match:{status:"active",turn_no:3},
  viewGeneration:4,playerPresence3x3:null,
  api:{from(table){
   events.push("read:"+table);
   assert.equal(table,"chaotic_match_turns","final 3x3 path should not query obsolete live-combat tables");
   return {select(){return this;},eq(){return this;},
     maybeSingle(){return reads.promise;}};
  }},
  updateMatchUI(){events.push("ui");},
  update3x3UI(){events.push("presence-ui");},
  note(){events.push("notice");},
  rpc:async name=>{events.push("rpc:"+name);return {self_ready:true};},
  refreshHistory:async()=>{events.push("history");if(historyPending)await staged.promise;},
  refresh3x3Allies:async()=>{events.push("final-receipt");}
 };
 const functions=[...code.matchAll(/await (refresh[A-Za-z0-9]+)\(\)/g)].map(x=>x[1]);
 for(const f of new Set(functions)){
  if(f==="refreshHistory"||f==="refresh3x3Allies")continue;
  ctx[f]=async()=>{events.push("legacy:"+f);};
 }
 const refresh=vm.runInNewContext("("+code+")",ctx);
 const finish=(data={status,turn_no:5})=>reads.resolve({data,error:null});
 return {ctx,events,finish,releaseHistory:staged.resolve,refresh};
}
test("v0.1.118: finished 3x3 uses only history and final server receipt",async()=>{
 const f=environment();const pending=f.refresh();f.finish();await pending;
 assert.deepEqual(f.events,["read:chaotic_match_turns","ui","final-receipt","history"]);
 assert.equal(f.ctx.match.status,"finished");
});
test("v0.1.118: no active-only ping is attempted after the final server status",async()=>{
 const f=environment();const pending=f.refresh();f.finish();await pending;
 assert.equal(f.events.some(x=>x.startsWith("rpc:")),false);
 assert.equal(f.events.some(x=>x.startsWith("legacy:")),false);
});
test("v0.1.118: final receipt is consulted before history even when the room later switches",async()=>{
 const f=environment({historyPending:true}),pending=f.refresh();f.finish();
 await nextTick();
 assert.ok(f.events.includes("history"));
 f.ctx.room={id:"B",mode:"3x3",status:"ready"};f.ctx.viewGeneration++;
 f.releaseHistory();await pending;
 assert.equal(f.events.includes("final-receipt"),true);
 assert.equal(f.events.filter(x=>x==="final-receipt").length,1);
});
test("v0.1.118: an older final match cannot overwrite a newer active turn in the same room",async()=>{
 const f=environment(),pending=f.refresh();
 const current={turn_no:6,status:"active",current_player:"guest"};
 f.ctx.match=current;f.finish();await pending;
 assert.equal(f.ctx.match,current);
 assert.deepEqual(f.events,["read:chaotic_match_turns"]);
});
test("v0.1.118: final receipt is read first and history cannot extend old-match refresh",async()=>{
 const f=environment({historyPending:true}),pending=f.refresh();f.finish();
 await nextTick();f.ctx.match={turn_no:6,status:"active"};
 f.releaseHistory();await pending;
 assert.equal(f.events.includes("final-receipt"),true);
 assert.equal(f.events.filter(x=>x==="final-receipt").length,1);
});
test("v0.1.118: active 3x3 still uses server presence, regular refreshes and card state",async()=>{
 const f=environment({status:"active"}),pending=f.refresh();f.finish();await pending;
 assert.ok(f.events.includes("rpc:chaotic_ping_preview_3x3_player"));
 assert.ok(f.events.includes("presence-ui"));
 assert.ok(f.events.includes("final-receipt"),"active pipeline still refreshes 3x3 allies");
 assert.ok(f.events.some(x=>x.startsWith("legacy:")),"active battle pipeline must not be shortened");
});
test("v0.1.118: finished other modes retain their normal historical refresh flow",async()=>{
 const f=environment({mode:"1x1"}),pending=f.refresh();f.finish();await pending;
 assert.equal(f.events.some(x=>x.startsWith("rpc:")),false);
 assert.ok(f.events.some(x=>x.startsWith("legacy:")));
});
test("v0.1.118: fast final path cannot mutate cards, HP, points or official rewards",()=>{
 const start=code.indexOf('if(room.mode==="3x3" && match?.status==="finished")');
 const end=code.indexOf("    // Fast heartbeat",start);
 assert.ok(start>=0&&end>start);
 const branch=code.slice(start,end);
 assert.match(branch,/await refreshHistory\(\)/);
 assert.match(branch,/await refresh3x3Allies\(\)/);
 assert.match(branch,/return;/);
 assert.doesNotMatch(branch,/rpc\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(|chaotic_(?:pass|spend|apply|attack)/);
});
