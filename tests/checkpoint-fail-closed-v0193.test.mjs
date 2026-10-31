import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const src=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function extract(start,end,ctx) {
  const a=src.indexOf(start),b=src.indexOf(end,a);
  assert.ok(a>=0&&b>a,"expected function boundaries for "+start);
  return vm.runInNewContext("("+src.slice(a,b).trim()+")",ctx);
}
function fakeContext() {
  const elements=new Map();
  const $=id=>{
    if(!elements.has(id))elements.set(id,{hidden:false,textContent:"",style:{},value:""});
    return elements.get(id);
  };
  const ctx={
    $,room:{id:"room-a",mode:"3x3",status:"ready",host_id:"host",guest_id:"guest",expires_at:"2099-01-01T00:00:00Z"},
    match:{status:"active",turn_no:7,current_player:"host",host_id:"host",guest_id:"guest"},
    userId:"host",trainingOutcomes3x3:[],declarations:[],contacts3x3:[],
    attackSpends3x3:[],attackProjections3x3:[],defenseWindows3x3:[],
    trainingDamage3x3:[],burstWindows:[],burstPriority:[],burstOrderPlans:[],
    updateBoardUI:()=>{},updateLoadoutUI:()=>{},updateAttackInstanceUI:()=>{},
    updateClashUI:()=>{},update3x3UI:()=>{},Date
  };
  return {ctx,$};
}
test("v0.1.93: without a verified checkpoint the 3x3 pass button stays hidden",()=>{
  const {ctx,$}=fakeContext();
  const update=extract("function updateMatchUI()","// Conexões entre lados",ctx);
  ctx.resumePhase3x3=null;update();
  assert.equal($("lobby-turn-pass").hidden,true);
  ctx.resumePhase3x3={turn_no:7,phase:"ready",training_finished:false};update();
  assert.equal($("lobby-turn-pass").hidden,false);
  ctx.resumePhase3x3={turn_no:6,phase:"ready",training_finished:false};update();
  assert.equal($("lobby-turn-pass").hidden,true);
  ctx.resumePhase3x3={turn_no:7,phase:"awaiting_payment",training_finished:false};update();
  assert.equal($("lobby-turn-pass").hidden,true);
  ctx.resumePhase3x3={turn_no:7,phase:"damage_settled",training_finished:false};update();
  assert.equal($("lobby-turn-pass").hidden,false);
  ctx.resumePhase3x3={turn_no:7,phase:"damage_settled",training_finished:true};update();
  assert.equal($("lobby-turn-pass").hidden,true);
});
test("v0.1.93: 3x3 attacker actions fail closed when checkpoint is unavailable",()=>{
  assert.ok(src.includes("&&!!checkpoint&&checkpointForTurn&&!checkpoint.training_finished"));
  assert.ok(!src.includes("&&(!checkpoint||checkpointForTurn)"));
  assert.match(src,/Etapa do ataque ainda não confirmada\. Ações bloqueadas/);
});
test("v0.1.93: defender buttons require the confirmed defender phase",()=>{
  assert.ok(src.includes('checkpoint.phase==="awaiting_defender"&&checkpoint.your_action_required'));
  for(const button of ["defense-pass","element-review","creature-elements","dynamic-elements","private-equipment"])
    assert.ok(src.includes('$("lobby-3x3-'+button+'").hidden=!(verifiedDefense&&!!defenseWindowThisTurn'),button);
});
test("v0.1.93: authoritative RPC phase validation still precedes pass and defense mutations",()=>{
  assert.ok(src.includes('await require3x3Phase(expectedTurn,["ready","damage_settled"])'));
  assert.ok(src.includes('await require3x3Phase(expectedTurn,["awaiting_defender"],true)'));
  assert.ok(src.includes("sem reenviar ataques automaticamente"));
});

test("v0.1.93: match start loads authoritative first-turn phase before enabling attacker controls",()=>{
  const start=src.slice(src.indexOf('$("lobby-turn-start").onclick'),src.indexOf('$("lobby-turn-pass").onclick'));
  assert.ok(start.includes('const started=await rpc("chaotic_start_match"'));
  assert.ok(start.includes('const firstPhase=await rpc("chaotic_get_preview_3x3_resume_status"'));
  assert.ok(start.includes('resumePhase3x3=firstPhase'));
  assert.ok(start.indexOf('resumePhase3x3=firstPhase')<start.indexOf('updateMatchUI()'));
  assert.ok(start.includes('isActionContextCurrent(expectedRoomId,started.turn_no,expectedView)'));
});
