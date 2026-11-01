import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const begin=source.indexOf("async function refreshFinished3x3Receipt(");
const end=source.indexOf("async function refresh3x3Allies()",begin);
assert.ok(begin>=0&&end>begin,"finished receipt boundaries");
const code=source.slice(begin,end).trim();
const flush=()=>new Promise(done=>setImmediate(done));
function pending(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}
const ko=slot=>({
 turn_no:slot,attacker_id:"host",defender_id:"guest",defender_slot:slot,
 hp_before:5,hp_after:0,training_only:true,official_hp_changed:false,
 official_match_modified:false
});
const outcome={
 winner_id:"host",defeated_id:"guest",decided_turn:6,defeated_team_size:3,
 outcome_scope:"training_only_no_official_victory",official_match_ended:false,
 official_match_modified:false,experience_awarded:false,currency_awarded:false
};
function harness({checkpointPending=true,checkpointError=false,outcomes=[outcome],koError=false}={}){
 const deferred=pending(),events=[],messages=[],calls=[];
 let paintCount=0;
 const data={
  chaotic_preview_3x3_training_knockouts:[ko(4),ko(5),ko(6)],
  chaotic_preview_3x3_borrowed_105_knockouts:[],
  chaotic_preview_3x3_training_outcomes:outcomes
 };
 const ctx={
  room:{id:"room-1",code:"ABCD",mode:"3x3",status:"ready",host_id:"host",guest_id:"guest"},
  match:{status:"finished",turn_no:6},viewGeneration:7,
  trainingKnockouts3x3:[],trainingOutcomes3x3:[],
  playerPresence3x3:{peer_active:true},resumePhase3x3:{phase:"awaiting_damage",turn_no:6},
  api:{from(name){
   calls.push(name);
   assert.ok(name in data,"unexpected table "+name);
   return {
    select(){return this;},eq(){return this;},order(){return this;},
    limit(){return Promise.resolve({data:data[name],error:koError && name.endsWith("training_knockouts")?{message:"KO query error"}:null});}
   };
  }},
  rpc:async(name)=>{
   calls.push(name);
   if(checkpointError)throw Error("checkpoint failed");
   return checkpointPending?deferred.promise:{phase:"training_finished",turn_no:6,training_finished:true};
  },
  note:text=>messages.push(text),
  updateMatchUI:()=>{
   paintCount++;
   events.push({
    room:ctx.room.id,
    outcomes:ctx.trainingOutcomes3x3.length,
    knockouts:ctx.trainingKnockouts3x3.length,
    presence:ctx.playerPresence3x3,
    checkpoint:ctx.resumePhase3x3
   });
  }
 };
 const refresh=vm.runInNewContext("("+code+")",ctx);
 const guard=()=>ctx.room?.id==="room-1" && ctx.viewGeneration===7&&ctx.match?.turn_no===6;
 return {ctx,refresh:()=>refresh("room-1",guard),events,messages,calls,
  release:()=>deferred.resolve({phase:"training_finished",turn_no:6,training_finished:true}),
  reject:()=>deferred.reject(Error("unavailable")),
  paints:()=>paintCount};
}
test("v0.1.120: proven winner and 3 KOs paint before a stalled checkpoint responds",async()=>{
 const f=harness();
 const request=f.refresh();await flush();
 assert.equal(f.paints(),1);
 assert.equal(f.events[0].outcomes,1);
 assert.equal(f.events[0].knockouts,3);
 assert.equal(f.events[0].presence,null);
 assert.equal(f.events[0].checkpoint,null,"stale attack checkpoint is never shown as final");
 f.release();await request;
 assert.equal(f.paints(),2);
 assert.equal(f.events[1].checkpoint.phase,"training_finished");
});
test("v0.1.120: a permanently pending checkpoint cannot stop initial receipt rendering",async()=>{
 const f=harness();
 f.refresh();await flush();
 assert.equal(f.paints(),1);
 assert.ok(f.calls.includes("chaotic_get_preview_3x3_resume_status"));
 // Do not await the intentionally blocked supplemental request.
});
test("v0.1.120: checkpoint rejection leaves already-painted receipt visible",async()=>{
 const f=harness(),request=f.refresh();await flush();
 f.reject();await request;
 assert.equal(f.paints(),1);
 assert.equal(f.ctx.trainingOutcomes3x3.length,1);
 assert.equal(f.ctx.trainingKnockouts3x3.length,3);
 assert.match(f.messages.join(" "),/Comprovante disponível/);
});
test("v0.1.120: immediate checkpoint error does not hide receipt",async()=>{
 const f=harness({checkpointError:true}),request=f.refresh();
 await request;
 assert.equal(f.paints(),1);
 assert.equal(f.ctx.resumePhase3x3,null);
 assert.equal(f.events[0].outcomes,1);
});
test("v0.1.120: a late supplemental response cannot paint the next lobby",async()=>{
 const f=harness(),request=f.refresh();await flush();
 f.ctx.room={id:"room-2",mode:"3x3"};
 f.ctx.viewGeneration++;
 f.release();await request;
 assert.equal(f.paints(),1);
 assert.equal(f.events[0].room,"room-1");
 assert.equal(f.messages.length,0);
});
test("v0.1.120: a new turn cannot be overwritten by an old finished checkpoint",async()=>{
 const f=harness(),request=f.refresh();await flush();
 f.ctx.match={turn_no:7,status:"active"};
 f.release();await request;
 assert.equal(f.paints(),1);
 assert.equal(f.ctx.resumePhase3x3,null);
});
test("v0.1.120: no victory is declared if there is no server outcome row",async()=>{
 const f=harness({outcomes:[],checkpointPending:false});
 await f.refresh();
 assert.equal(f.events[0].outcomes,0);
 assert.equal(f.events[0].knockouts,3);
 assert.equal(f.paints(),2);
});
test("v0.1.120: failure reading knockout evidence must not show a victory",async()=>{
 const f=harness({koError:true,checkpointPending:false});
 await assert.rejects(f.refresh(),/KO query error/);
 assert.equal(f.paints(),0);
 assert.equal(f.ctx.trainingOutcomes3x3.length,0);
});
test("v0.1.120: early paint and supplemental read have no combat mutations",()=>{
 const first=code.indexOf("trainingOutcomes3x3=outcome.data||[];");
 const paint=code.indexOf("updateMatchUI();",first);
 const checkpoint=code.indexOf('rpc("chaotic_get_preview_3x3_resume_status"',first);
 assert.ok(first>=0&&paint>first&&checkpoint>paint,"paint must precede checkpoint");
 assert.doesNotMatch(code,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
 assert.doesNotMatch(code,/chaotic_(?:pay|pass|attack|spend|borrow|apply)_/);
});
