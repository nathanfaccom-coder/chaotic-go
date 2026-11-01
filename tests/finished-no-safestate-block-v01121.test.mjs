import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const start=source.indexOf("async function refresh3x3Allies()");
const live=source.indexOf('    const contact=await api.from("chaotic_preview_3x3_contact_intents")',start);
assert.ok(start>=0&&live>start,"3x3 state reader boundaries");
const prefix=source.slice(start,live);
const snippet=prefix+"\nreturn 'ACTIVE_SAFE_STATE_LOADED';\n}";
function pending(){
 let resolve;
 const promise=new Promise(done=>resolve=done);
 return {promise,resolve};
}
function harness({status="finished",safeStateMode="error",finishedMode="success"}={}){
 const requests=[],steps=[],deferred=pending();
 const ctx={
  room:{id:"room-1",mode:"3x3",status:"ready"},
  match:{status,turn_no:7},viewGeneration:14,refresh3x3ReadSerial:0,
  allies3x3:[{actor_id:"host"}],hp3x3:[],board3x3:[],
  moves3x3:[],transfers3x3:[],
  $:id=>id==="lobby-3x3-allies-panel"?{}:null,
  rpc:async(name,args)=>{
   requests.push({name,args});steps.push(name);
   if(name!=="chaotic_get_preview_3x3_safe_state")
    throw Error("unexpected RPC "+name);
   if(safeStateMode==="error")throw Error("safe-state unavailable");
   if(safeStateMode==="pending")return deferred.promise;
   return {allies:[{actor_id:"host"}],hp_wallets:[],
    board_positions:[],move_events:[],token_transfers:[]};
  },
  refreshFinished3x3Receipt:async(roomId,current)=>{
   requests.push({name:"finished-receipt",roomId});
   steps.push("finished-receipt");
   if(!current())return;
   if(finishedMode==="error")throw Error("final receipt unavailable");
   return "FINAL_READY";
  }
 };
 const refresh=vm.runInNewContext("("+snippet+")",ctx);
 return {ctx,refresh,requests,steps,release:deferred.resolve};
}
test("v0.1.121: finished match immediately reads receipt, bypassing obsolete safe-state RPC",async()=>{
 const f=harness();
 const result=await f.refresh();
 assert.equal(result,undefined);
 assert.deepEqual(f.steps,["finished-receipt"]);
 assert.equal(f.requests[0].roomId,"room-1");
});
test("v0.1.121: a safe-state RPC that would be suspended cannot block finished receipt",async()=>{
 const f=harness({safeStateMode:"pending"});
 await f.refresh();
 assert.deepEqual(f.steps,["finished-receipt"]);
});
test("v0.1.121: a failed safe-state RPC does not hide finished match result",async()=>{
 const f=harness({safeStateMode:"error"});
 await f.refresh();
 assert.deepEqual(f.steps,["finished-receipt"]);
});
test("v0.1.121: an actual final-receipt query error still propagates (no false success)",async()=>{
 const f=harness({finishedMode:"error"});
 await assert.rejects(f.refresh(),/final receipt unavailable/);
 assert.deepEqual(f.steps,["finished-receipt"]);
});
test("v0.1.121: active 3x3 still fetches server-masked formation and HP",async()=>{
 const f=harness({status:"active",safeStateMode:"success"});
 const result=await f.refresh();
 assert.equal(result,"ACTIVE_SAFE_STATE_LOADED");
 assert.deepEqual(f.steps,["chaotic_get_preview_3x3_safe_state"]);
 assert.equal(f.requests[0].args.p_lobby_id,"room-1");
});
test("v0.1.121: a late active read cannot paint another selected room",async()=>{
 const f=harness({status:"active",safeStateMode:"pending"});
 const task=f.refresh();
 assert.deepEqual(f.steps,["chaotic_get_preview_3x3_safe_state"]);
 const old=f.ctx.allies3x3;
 f.ctx.room={id:"room-2",mode:"3x3",status:"ready"};
 f.ctx.viewGeneration++;
 f.release({allies:[{actor_id:"guest"}],hp_wallets:[],board_positions:[],move_events:[],token_transfers:[]});
 await task;
 assert.equal(f.ctx.allies3x3,old);
});
test("v0.1.121: a late active turn read cannot paint a later combat turn",async()=>{
 const f=harness({status:"active",safeStateMode:"pending"});
 const task=f.refresh();
 f.ctx.match={status:"active",turn_no:8};
 f.release({allies:[{actor_id:"guest"}],hp_wallets:[],board_positions:[],move_events:[],token_transfers:[]});
 await task;
 assert.equal(f.ctx.allies3x3[0].actor_id,"host");
});
test("v0.1.121: finished fast path cannot mutate HP, Decks or official rewards",()=>{
 const branch=source.slice(start,source.indexOf('    const safeState=await rpc(',start));
 assert.match(branch,/if\(match\?\.status==="finished"\)/);
 assert.match(branch,/await refreshFinished3x3Receipt\(requestedRoomId,isCurrent3x3Request\)/);
 assert.doesNotMatch(branch,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
 assert.doesNotMatch(branch,/chaotic_(?:pass|attack|pay|spend|borrow|apply)_/);
});
