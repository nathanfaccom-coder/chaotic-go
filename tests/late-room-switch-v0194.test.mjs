import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const src=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const oldRoom={id:"room-old",mode:"3x3",status:"ready"};
const newRoom={id:"room-new",mode:"3x3",status:"ready"};
function extract(start,end,ctx){
 const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"function segment "+start);
 return vm.runInNewContext("("+src.slice(a,b).trim()+")",ctx);
}
function deferred(){
 let resolve;
 const promise=new Promise(r=>{resolve=r;});
 return {promise,resolve};
}
test("v0.1.94: old 3x3 safe-state response cannot repopulate another lobby",async()=>{
 const pending=deferred(),old=[{actor_id:"old-user"}];
 let further=0;
 const ctx={
  room:oldRoom,match:{turn_no:2,status:"active"},viewGeneration:2,
  allies3x3:old,hp3x3:old,trainingOutcomes3x3:old,playerPresence3x3:{self_active:true},
  $:id=>id==="lobby-3x3-allies-panel"?{}:null,
  rpc:()=>pending.promise,
  api:{from:()=>{further++;throw Error("stale query");}}
 };
 const read=extract("async function refresh3x3Allies(){","function updateRoomUI()",ctx);
 const running=read();
 ctx.room=newRoom;ctx.match={turn_no:1,status:"active"};ctx.viewGeneration=3;
 ctx.allies3x3=[];ctx.hp3x3=[];ctx.trainingOutcomes3x3=[];ctx.playerPresence3x3=null;
 pending.resolve({allies:[{actor_id:"old-user"}],hp_wallets:old});
 await running;
 assert.equal(further,0);
 assert.equal(ctx.allies3x3.length,0);
 assert.equal(ctx.hp3x3.length,0);
 assert.equal(ctx.trainingOutcomes3x3.length,0);
 assert.equal(ctx.playerPresence3x3,null);
});
test("v0.1.94: stale match heartbeat cannot update a newly opened lobby",async()=>{
 const pending=deferred();let updated=0,history=0,signalHeartbeat;
 // Await the actual heartbeat rather than guessing the event-loop timing.
 const heartbeatStarted=new Promise(resolve=>{signalHeartbeat=resolve;});
 const ctx={
  room:oldRoom,viewGeneration:9,match:null,playerPresence3x3:null,
  api:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{turn_no:3,status:"active"},error:null})})})})},
  rpc:()=>{signalHeartbeat();return pending.promise;},updateMatchUI:()=>{updated++;},update3x3UI:()=>{updated++;},
  refreshHistory:async()=>{history++;},note:()=>{}
 };
 const func=extract("async function refreshMatch()","  // Guidance only: the server checkpoint remains authoritative.",ctx);
 const running=func();
 await heartbeatStarted;
 ctx.room=newRoom;ctx.viewGeneration=10;ctx.match=null;
 pending.resolve({peer_active:true});
 await running;
 assert.equal(ctx.playerPresence3x3,null);
 assert.equal(ctx.match,null);
 assert.equal(history,0);
 assert.equal(updated,1);
});
test("v0.1.94: old match history never changes the new room history",async()=>{
 const pending=deferred();
 const element={textContent:"new-room-history"};
 const ctx={
  room:oldRoom,viewGeneration:5,match:{turn_no:4},
  $:id=>id==="lobby-events"?element:null,
  api:{from:()=>({select:()=>({eq:()=>({order:()=>({limit:()=>pending.promise})})})})}
 };
 const func=extract("async function refreshHistory()","async function refreshMatch()",ctx);
 const running=func();
 ctx.room=newRoom;ctx.viewGeneration=6;ctx.match={turn_no:1};
 pending.resolve({data:[{event_type:"stop",actor_id:"old"}],error:null});
 await running;
 assert.equal(element.textContent,"new-room-history");
});
test("v0.1.94: every awaited 3x3 query stops on room/turn change",()=>{
 const begin=src.indexOf("async function refresh3x3Allies(){");
 const end=src.indexOf("function updateRoomUI()",begin);
 const block=src.slice(begin,end);
 const awaits=(block.match(/\bawait\s+(?:api\.from|rpc)\(/g)||[]).length;
 const guards=(block.match(/if\(!isCurrent3x3Request\(\)\)return;/g)||[]).length;
 assert.ok(awaits>=17);
 assert.ok(guards>=awaits);
 assert.ok(block.includes(".eq(\"lobby_id\",requestedRoomId)"));
 assert.ok(block.includes("p_lobby_id:requestedRoomId"));
 assert.ok(block.includes("viewGeneration===requestedView && match?.turn_no===requestedTurn"));
});
