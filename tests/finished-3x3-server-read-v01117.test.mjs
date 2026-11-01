import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function isolate(a,b,ctx){
 const i=source.indexOf(a),j=source.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,"VM function boundaries "+a);
 return vm.runInNewContext("("+source.slice(i,j).trim()+")",ctx);
}
function deferred(){
 let resolve;
 const promise=new Promise(done=>resolve=done);
 return {promise,resolve};
}
const KO=(slot)=>({
 attacker_id:"host",defender_id:"guest",defender_slot:slot,
 turn_no:slot+1,hp_before:5,hp_after:0,training_only:true,
 official_hp_changed:false,official_match_modified:false
});
const outcome={
 winner_id:"host",defeated_id:"guest",decided_turn:7,defeated_team_size:3,
 outcome_scope:"training_only_no_official_victory",official_match_ended:false,
 official_match_modified:false,experience_awarded:false,currency_awarded:false
};
function harness({finalRows=[outcome],checkpointError=false,holdResults=false}={}){
 const calls=[],paint=[],messages=[];
 const rows={
  chaotic_preview_3x3_training_knockouts:[KO(4),KO(5),KO(6)],
  chaotic_preview_3x3_borrowed_105_knockouts:[],
  chaotic_preview_3x3_training_outcomes:finalRows
 };
 const waiting=deferred();
 const ctx={
  room:{id:"room-A",code:"ABC123",mode:"3x3",status:"ready",host_id:"host",guest_id:"guest"},
  match:{turn_no:7,status:"finished"},
  viewGeneration:9,refresh3x3ReadSerial:0,userId:"host",
  allies3x3:[],hp3x3:[],board3x3:[],moves3x3:[],transfers3x3:[],
  trainingKnockouts3x3:[],trainingOutcomes3x3:[],
  playerPresence3x3:{self_active:true,peer_active:true},resumePhase3x3:null,
  $:id=>id==="lobby-3x3-allies-panel"?{}:null,
  note:(m)=>messages.push(m),update3x3UI:()=>{},
  updateMatchUI:()=>paint.push({outcomes:ctx.trainingOutcomes3x3.length,
    knockouts:ctx.trainingKnockouts3x3.length, presence:ctx.playerPresence3x3}),
  rpc:async(name)=>{
   calls.push(name);
   if(name==="chaotic_get_preview_3x3_safe_state")
    return {allies:[],hp_wallets:[],board_positions:[],move_events:[],token_transfers:[]};
   if(name==="chaotic_get_preview_3x3_resume_status"){
    if(checkpointError)throw Error("temporary final checkpoint error");
    return {turn_no:7,phase:"training_finished",training_finished:true};
   }
   throw Error("active-only RPC unexpectedly called: "+name);
  },
  api:{from(table){
    calls.push(table);
    assert.ok(table in rows,"unexpected active-only table "+table);
    return {
      select(){return this;},eq(){return this;},order(){return this;},
      limit(){
       const result={data:rows[table],error:null};
       return holdResults?waiting.promise.then(()=>result):Promise.resolve(result);
      }
    };
  }}
 };
 ctx.refreshFinished3x3Receipt=isolate("async function refreshFinished3x3Receipt(","async function refresh3x3Allies()",ctx);
 const refresh=isolate("async function refresh3x3Allies()","function updateRoomUI()",ctx);
 return {ctx,refresh,calls,paint,messages,release:waiting.resolve};
}
test("v0.1.117: finished 3x3 match restores server outcome and exactly three KO receipts",async()=>{
 const f=harness();
 await f.refresh();
 assert.equal(f.ctx.trainingOutcomes3x3.length,1);
 assert.equal(f.ctx.trainingKnockouts3x3.length,3);
 assert.equal(f.ctx.playerPresence3x3,null);
 assert.equal(f.ctx.resumePhase3x3.phase,"training_finished");
 assert.equal(f.paint.length,2);
 assert.equal(f.paint[0].presence,null);
 assert.equal(f.paint[0].knockouts,3);
});
test("v0.1.117: finished match never calls presence or borrowed-card RPCs",async()=>{
 const f=harness();
 await f.refresh();
 assert.deepEqual(f.calls,[
  "chaotic_preview_3x3_training_knockouts",
  "chaotic_preview_3x3_borrowed_105_knockouts",
  "chaotic_preview_3x3_training_outcomes",
  "chaotic_get_preview_3x3_resume_status"
 ]);
});
test("v0.1.117: closing a 3x3 session without winner shows empty outcome rather than inventing one",async()=>{
 const f=harness({finalRows:[]});
 await f.refresh();
 assert.equal(f.ctx.trainingOutcomes3x3.length,0);
 assert.equal(f.paint.length,2);
 assert.equal(f.ctx.resumePhase3x3.training_finished,true);
});
test("v0.1.117: checkpoint failure must not hide an already fetched three-KO receipt",async()=>{
 const f=harness({checkpointError:true});
 await f.refresh();
 assert.equal(f.ctx.trainingOutcomes3x3.length,1);
 assert.equal(f.ctx.trainingKnockouts3x3.length,3);
 assert.equal(f.ctx.resumePhase3x3,null);
 assert.equal(f.paint.length,1);
 assert.match(f.messages[0],/Comprovante disponível/);
});
test("v0.1.117: a late response from the old DROME must not render the new room",async()=>{
 const f=harness({holdResults:true});
 const pending=f.refresh();
 await Promise.resolve();await Promise.resolve();
 f.ctx.room={...f.ctx.room,id:"room-new"};
 f.ctx.viewGeneration=10;
 f.release();
 await pending;
 assert.equal(f.paint.length,0);
 assert.equal(f.ctx.trainingKnockouts3x3.length,0);
 assert.equal(f.ctx.trainingOutcomes3x3.length,0);
});
test("v0.1.117: a match becoming active again must reject an older final receipt",async()=>{
 const f=harness({holdResults:true});
 const pending=f.refresh();
 await Promise.resolve();await Promise.resolve();
 f.ctx.match={turn_no:8,status:"active"};
 f.release();
 await pending;
 assert.equal(f.paint.length,0);
 assert.equal(f.ctx.trainingOutcomes3x3.length,0);
});
test("v0.1.117: final-report branch bypasses the active-only Supabase calls",()=>{
 const start=source.indexOf("async function refresh3x3Allies()");
 const safe=source.indexOf('const safeState=await rpc("chaotic_get_preview_3x3_safe_state"',start);
 const branch=source.indexOf('if(match?.status==="finished"){',start);
 const contact=source.indexOf('api.from("chaotic_preview_3x3_contact_intents")',safe);
 assert.ok(branch>start && branch<safe && contact>safe);
 const part=source.slice(branch,safe);
 assert.doesNotMatch(part,/chaotic_get_preview_3x3_safe_state/);
 assert.match(part,/await refreshFinished3x3Receipt\(requestedRoomId,isCurrent3x3Request\)/);
 assert.match(part,/return;/);
 const final=source.slice(source.indexOf("async function refreshFinished3x3Receipt("),start);
 assert.doesNotMatch(final,/chaotic_ping_preview_3x3_player|chaotic_get_preview_3x3_borrowed_attacks/);
});
test("v0.1.117: no final-result read mutates original Decks, HP, XP or server turns",()=>{
 const final=source.slice(source.indexOf("async function refreshFinished3x3Receipt("),
    source.indexOf("async function refresh3x3Allies()"));
 assert.doesNotMatch(final,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
 assert.doesNotMatch(final,/chaotic_(?:attack|spend|pass|apply|prepare|stop|borrow)_/);
 assert.match(final,/updateMatchUI\(\)/);
});
