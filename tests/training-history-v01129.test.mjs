import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../training-history.js",import.meta.url),"utf8");
const lobby=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/chaotic-training-history-v01129.sql",import.meta.url),"utf8");
const makeElement=id=>({
  id,textContent:"",children:[],style:{},className:"",
  appendChild(el){this.children.push(el);return el;},
  replaceChildren(){this.children=[];}
});
const me="player-me",other="player-other";
const result=(winner,loser,turn=9)=>({
 winner_id:winner,defeated_id:loser,decided_turn:turn,
 recorded_at:"2026-11-06T13:00:00.000Z",
 outcome_scope:"training_only_no_official_victory"
});
function harness(rows=[],failure=null){
 const elements=new Map(["lobby-history-status","lobby-history-stats","lobby-history-list"].map(id=>[id,makeElement(id)]));
 let selects=0,writes=0;
 const api={from(table){
   assert.equal(table,"chaotic_training_match_history");selects++;
   return {select(cols){assert.match(cols,/winner_id,defeated_id/);return this;},
     order(k,options){assert.equal(k,"recorded_at");assert.equal(options.ascending,false);return this;},
     limit(n){assert.equal(n,30);return Promise.resolve({data:rows,error:failure});},
     insert(){writes++;throw Error("never write");}
   };
 }};
 const document={getElementById(id){return elements.get(id)||null;},createElement(tag){return makeElement(tag);}};
 const context={document,window:{ChaoticAuthUser:{id:me},ChaoticAuth:{getClient:()=>api}},Date};
 vm.runInNewContext(source,context);
 return {refresh:()=>context.window.ChaoticTrainingHistory.refresh(),elements,
   count:()=>selects,writes:()=>writes,replaceView(){
     elements.set("lobby-history-list",makeElement("lobby-history-list"));
   }};
}
test("v0.1.129: the DROME includes accessible history controls",()=>{
 for(const id of ["lobby-history-panel","lobby-history-refresh","lobby-history-status","lobby-history-stats","lobby-history-list"])
  assert.ok(lobby.includes('id="'+id+'"'),id);
 assert.match(lobby,/ChaoticTrainingHistory/);
});
test("v0.1.129: reads only server data and labels wins and defeats as TRAINING",async()=>{
 const h=harness([result(me,other),result(other,me,11)]);
 await h.refresh();
 assert.match(h.elements.get("lobby-history-stats").textContent,/1 vitória\(s\) de treino e 1 derrota\(s\)/);
 assert.equal(h.elements.get("lobby-history-list").children.length,2);
 assert.match(h.elements.get("lobby-history-list").children[0].textContent,/Vitória de treino/);
 assert.match(h.elements.get("lobby-history-list").children[1].textContent,/Derrota de treino/);
 assert.equal(h.writes(),0);
});
test("v0.1.129: completed outcomes that are not mine never enter the view",async()=>{
 const h=harness([result(other,"stranger"),result(me,other,10)]);
 await h.refresh();
 assert.match(h.elements.get("lobby-history-stats").textContent,/Últimos 1 resultados/);
});
test("v0.1.129: no winner recorded yet is not called a defeat",async()=>{
 const h=harness([]);
 await h.refresh();
 assert.match(h.elements.get("lobby-history-status").textContent,/Nenhum resultado/);
 assert.match(h.elements.get("lobby-history-stats").textContent,/0 vitória/);
});
test("v0.1.129: connection errors do not pretend the player has zero results",async()=>{
 const h=harness([],{message:"offline"});
 await h.refresh();
 assert.match(h.elements.get("lobby-history-status").textContent,/Não foi possível consultar/);
 assert.equal(h.elements.get("lobby-history-stats").textContent,"");
});
test("v0.1.129: a stale old-view reply cannot repaint a new screen",async()=>{
 const h=harness([result(me,other)]);
 const pending=h.refresh();h.replaceView();await pending;
 assert.equal(h.elements.get("lobby-history-list").children.length,0);
});
test("v0.1.129: missing history panel makes no database request",async()=>{
 const h=harness([result(me,other)]);
 h.elements.delete("lobby-history-list");
 await h.refresh();
 assert.equal(h.count(),0);
});
test("v0.1.129: history is immutable to clients and archived once per lobby",()=>{
 for(const fragment of [
  "enable row level security",
  "grant select on public.chaotic_training_match_history to authenticated",
  "revoke all on table public.chaotic_training_match_history from public,anon,authenticated",
  "(select auth.uid())=winner_id or (select auth.uid())=defeated_id",
  "after insert on public.chaotic_preview_3x3_training_outcomes",
  "on conflict(lobby_id) do nothing",
  "not experience_awarded and not currency_awarded"
 ])assert.ok(migration.includes(fragment),fragment);
 assert.doesNotMatch(source,/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
 // The read-only career RPC is allowed; no reward/mutation RPC may be called.
 assert.match(source,/api\.rpc\("chaotic_my_training_stats"\)/);
});
