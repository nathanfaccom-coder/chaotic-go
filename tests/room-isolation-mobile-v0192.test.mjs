import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const code=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function extract(start,end,context) {
  const a=code.indexOf(start), b=code.indexOf(end,a);
  assert.ok(a>=0&&b>a,"function segment exists: "+start);
  return vm.runInNewContext("("+code.slice(a,b).trim()+")",context);
}
test("v0.1.92: opening a different lobby clears every private 3x3 result and diagnostic",()=>{
  const stale=[
    "creatureChecks3x3","privateEquipmentChecks3x3","dynamicElementChecks3x3",
    "trainingDamage3x3","trainingKnockouts3x3","trainingOutcomes3x3",
    "trainingAttackLocks3x3","sonarSearchEvents3x3","sonarSearchChoices3x3",
    "faceStates3x3","ventoRevealEvents3x3","borrowedRevealEvents3x3"
  ];
  const ctx={viewGeneration:3,room:{id:"old"},match:{turn_no:4},
    resumePhase3x3:{phase:"training_finished"},halt:()=>{}};
  for (const key of stale) ctx[key]=[{private:"previous-room"}];
  ctx.sonarChoiceKey3x3="old:4";
  ctx.playerPresence3x3={peer_ready:true,training_finished:true};
  const part=code.slice(code.indexOf("function show() {"),
    code.indexOf('const screen = $("tela-entrada-drome");',code.indexOf("function show() {")));
  assert.ok(part.includes("halt(); room = null"));
  const call=vm.runInNewContext("("+part+" return viewGeneration; })",ctx);
  assert.equal(call(),4);
  for(const key of stale) assert.deepEqual(Array.from(ctx[key]),[],key);
  assert.equal(ctx.playerPresence3x3,null);
  assert.equal(ctx.sonarChoiceKey3x3,"");
  assert.equal(ctx.room,null);assert.equal(ctx.match,null);assert.equal(ctx.resumePhase3x3,null);
});
test("v0.1.92: stale match read cannot replace match after opening a new lobby",async()=>{
  let settle;
  const pending=new Promise(resolve=>{settle=resolve;});
  let rendered=0,downstream=0;
  const ctx={room:{id:"old"},viewGeneration:6,match:null,
    api:{from:()=>({select:()=>({eq:()=>({maybeSingle:()=>pending})})})},
    updateMatchUI:()=>{rendered++;},
    refreshHistory:async()=>{downstream++;}
  };
  const refreshMatch=extract("async function refreshMatch()","function next3x3Instruction(state)",ctx);
  const reading=refreshMatch();
  ctx.room={id:"new"};ctx.viewGeneration=7;
  settle({data:{lobby_id:"old",turn_no:10,status:"active"},error:null});
  await reading;
  assert.equal(ctx.match,null);assert.equal(rendered,0);assert.equal(downstream,0);
});
test("v0.1.92: offline startup skips restoring a saved lobby until connection returns",async()=>{
  let reads=0;let notices=[];
  const ctx={restoreInProgress:false,room:null,busy:false,viewGeneration:5,
    navigator:{onLine:false},savedRoomId:()=>{reads++;return "old";},
    note:(x)=>notices.push(x)};
  const restore=extract("async function restoreLastRoom(generation)","function show()",ctx);
  await restore(5);
  assert.equal(reads,0);assert.equal(ctx.restoreInProgress,false);
  assert.match(notices[0],/Sem internet/);
});
test("v0.1.92: polling skips overlapping mobile refreshes",()=>{
  assert.match(code,/document\.hidden \|\| \(typeof navigator !== "undefined" && navigator\.onLine === false\)\s*\|\| refreshInFlight\) return/);
  assert.match(code,/if \(refreshInFlight\) \{ refreshQueued = true; return refreshInFlight; \}/);
});
