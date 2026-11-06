import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const rewardSource=await readFile(new URL("../official-rewards.js",import.meta.url),"utf8");
const historySource=await readFile(new URL("../training-history.js",import.meta.url),"utf8");
const ui=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const boot=await readFile(new URL("../full-game-bootstrap.js",import.meta.url),"utf8");
const sql=await readFile(new URL("../supabase/chaotic-official-rewards-v01130.sql",import.meta.url),"utf8");
const who="player-130";
function el(id){
 return {id,textContent:"",children:[],style:{},className:"",
  replaceChildren(){this.children=[];},
  appendChild(v){this.children.push(v);}
 };
}
function createHarness(rows=[],failure=null){
 const ids=new Map(["lobby-rewards-status","lobby-rewards-summary","lobby-rewards-list"].map(id=>[id,el(id)]));
 let calls=0;
 const api={from(table){
  assert.equal(table,"chaotic_official_reward_ledger");calls++;
  return {
   select(cols){assert.match(cols,/xp_awarded/);return this;},
   eq(column,value){assert.equal(column,"player_id");assert.equal(value,who);return this;},
   order(column,arg){assert.equal(column,"awarded_at");assert.equal(arg.ascending,false);return this;},
   limit(n){assert.equal(n,20);return Promise.resolve({data:rows,error:failure});}
  };
 }};
 const doc={getElementById:id=>ids.get(id)||null,createElement:el};
 const window={ChaoticAuthUser:{id:who},ChaoticAuth:{getClient:()=>api}};
 vm.runInNewContext(rewardSource,{window,document:doc,Date});
 return {ids,calls:()=>calls,refresh:()=>window.ChaoticOfficialRewards.refresh()};
}
const item=(id=who,kind="official_victory",xp=200,coins=50)=>({
 player_id:id,award_kind:kind,xp_awarded:xp,coins_awarded:coins,
 awarded_at:"2026-11-06T18:00:00Z",reward_scope:"official_verified_only"
});
test("v0.1.130: rewards controls and client module load with DROME",()=>{
 for(const id of ["lobby-official-rewards","lobby-rewards-refresh","lobby-rewards-status",
  "lobby-rewards-summary","lobby-rewards-list"])assert.ok(ui.includes('id="'+id+'"'),id);
 assert.match(boot,/official-rewards\.js\?v=release-130/);
});
test("v0.1.130: player sees signed receipts, NOT legacy wallet totals",async()=>{
 const h=createHarness([item(),item(who,"official_participation",70,0)]);
 await h.refresh();
 assert.match(h.ids.get("lobby-rewards-summary").textContent,/270 XP e 50 moedas/);
 assert.equal(h.ids.get("lobby-rewards-list").children.length,2);
 assert.match(h.ids.get("lobby-rewards-status").textContent,/não representam o saldo total legado/);
});
test("v0.1.130: unknown player, wrong scope or invalid reward is ignored",async()=>{
 const h=createHarness([item("other"),{...item(),reward_scope:"training_only_no_official_victory"},
  {...item(),xp_awarded:-1},{...item(),award_kind:"forged"}]);
 await h.refresh();
 assert.equal(h.ids.get("lobby-rewards-list").children.length,0);
 assert.match(h.ids.get("lobby-rewards-status").textContent,/Nenhuma recompensa oficial/);
});
test("v0.1.130: empty reward ledger never invents XP or coins",async()=>{
 const h=createHarness([]);
 await h.refresh();
 assert.equal(h.ids.get("lobby-rewards-summary").textContent,"");
 assert.match(h.ids.get("lobby-rewards-status").textContent,/Treinos 3×3 não geram XP/);
});
test("v0.1.130: connection error does not report no rewards",async()=>{
 const h=createHarness([],{message:"network"});
 await h.refresh();
 assert.match(h.ids.get("lobby-rewards-status").textContent,/Não foi possível acessar/);
 assert.doesNotMatch(h.ids.get("lobby-rewards-status").textContent,/Nenhuma recompensa oficial/);
});
test("v0.1.130: old screen response cannot overwrite the new screen",async()=>{
 const h=createHarness([item()]);
 const p=h.refresh();
 h.ids.set("lobby-rewards-list",el("lobby-rewards-list"));
 await p;
 assert.equal(h.ids.get("lobby-rewards-list").children.length,0);
});
test("v0.1.130: hidden history panel does not trigger DB read",async()=>{
 const h=createHarness([item()]);
 h.ids.delete("lobby-rewards-list");
 await h.refresh();
 assert.equal(h.calls(),0);
});
test("v0.1.130: official reward ledger and statistics have no browser writes",()=>{
 assert.doesNotMatch(rewardSource,/\.insert\(|\.upsert\(|\.update\(|\.delete\(|\.rpc\(/);
 assert.doesNotMatch(historySource,/\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
});
test("v0.1.130: SQL has immutable one-reward-per-match and participant-only RLS",()=>{
 for(const frag of ["unique(source_match_id,player_id)","enable row level security",
  "grant select on table public.chaotic_official_reward_ledger to authenticated",
  "revoke all on table public.chaotic_official_reward_ledger from public,anon,authenticated",
  "(select auth.uid())=player_id",
  "before insert on public.chaotic_official_reward_ledger",
  "public.chaotic_match_turns where lobby_id=new.source_match_id",
  "public.chaotic_training_match_history where lobby_id=new.source_match_id"])
  assert.ok(sql.includes(frag),frag);
});
test("v0.1.130: career stats RPC is invoker-only and cannot be called anonymously",()=>{
 for(const frag of ["security invoker set search_path=''",
  "revoke all on function public.chaotic_my_training_stats() from public,anon,authenticated",
  "grant execute on function public.chaotic_my_training_stats() to authenticated"])
  assert.ok(sql.includes(frag),frag);
});
function historyHarness(payload={total_matches:2,victories:1,defeats:1},error=null){
 const ids=new Map(["lobby-history-status","lobby-history-stats","lobby-history-list"].map(id=>[id,el(id)]));
 const player=who,other="rival";
 const api={
  from(table){
   assert.equal(table,"chaotic_training_match_history");
   return {select(){return this;},order(){return this;},
    limit(){return Promise.resolve({data:[
      {winner_id:player,defeated_id:other,decided_turn:8,
       recorded_at:"2026-11-06T12:00:00Z",outcome_scope:"training_only_no_official_victory"}
    ],error:null})}};
  },
  async rpc(name){
   assert.equal(name,"chaotic_my_training_stats");
   return {data:[payload],error};
  }
 };
 const window={ChaoticAuthUser:{id:who},ChaoticAuth:{getClient:()=>api}};
 const document={getElementById:id=>ids.get(id)||null,createElement:el};
 vm.runInNewContext(historySource,{window,document,Date});
 return {ids,refresh:()=>window.ChaoticTrainingHistory.refresh()};
}
test("v0.1.130: player can see server-authoritative ALL-TIME training totals",async()=>{
 const h=historyHarness({total_matches:17,victories:12,defeats:5});
 await h.refresh();
 await new Promise(resolve=>setImmediate(resolve));
 const s=h.ids.get("lobby-history-stats").textContent;
 assert.match(s,/Carreira inteira de TREINO: 17 partida\(s\), 12 vitória\(s\), 5 derrota\(s\)/);
 assert.match(s,/Últimos 1 resultados/);
});
test("v0.1.130: failed career RPC keeps the verified last-30 summary",async()=>{
 const h=historyHarness(null,{message:"offline"});
 await h.refresh();await new Promise(resolve=>setImmediate(resolve));
 const s=h.ids.get("lobby-history-stats").textContent;
 assert.match(s,/Últimos 1 resultados/);
 assert.doesNotMatch(s,/Carreira inteira/);
});
test("v0.1.130: an inconsistent server career total is not shown",async()=>{
 const h=historyHarness({total_matches:100,victories:2,defeats:1});
 await h.refresh();await new Promise(resolve=>setImmediate(resolve));
 assert.doesNotMatch(h.ids.get("lobby-history-stats").textContent,/Carreira inteira/);
});
