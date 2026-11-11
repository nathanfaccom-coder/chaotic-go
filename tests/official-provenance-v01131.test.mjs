import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const rewardSource=await readFile(new URL("../official-rewards.js",import.meta.url),"utf8");
const lobbySource=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const schema=await readFile(new URL("../supabase/chaotic-official-provenance-v01131.sql",import.meta.url),"utf8");
const me="current-player";
function element(id){
 return {id,children:[],textContent:"",style:{},className:"",
  replaceChildren(){this.children=[];},
  appendChild(el){this.children.push(el);}
 };
}
const entry=(id=me)=>({player_id:id,award_kind:"official_victory",
 xp_awarded:120,coins_awarded:30,
 awarded_at:"2026-11-11T13:00:00Z",reward_scope:"official_verified_only"});
function deferred(){
 let resolve,reject;
 const promise=new Promise((a,b)=>{resolve=a;reject=b});
 return {promise,resolve,reject};
}
function fixture({receipts=[],totals=null,totalsError=null,defer=false}={}){
 const elems=new Map(["lobby-rewards-status","lobby-rewards-summary",
   "lobby-rewards-list"].map(id=>[id,element(id)]));
 let reads=0,writes=0,rpcs=0;
 const held=deferred();
 const client={
  from(name){
   assert.equal(name,"chaotic_official_reward_ledger");
   reads++;
   return {select(){return this;},eq(col,val){assert.equal(col,"player_id");assert.equal(val,me);return this;},
    order(){return this;},
    limit(count){assert.equal(count,20);return Promise.resolve({data:receipts,error:null});},
    insert(){writes++;throw Error("Unexpected mutation");}
   };
  },
  rpc(name){assert.equal(name,"chaotic_my_official_reward_totals");rpcs++;
   return defer?held.promise:Promise.resolve({data:[totals],error:totalsError});
  }
 };
 const window={ChaoticAuthUser:{id:me},ChaoticAuth:{getClient:()=>client}};
 const document={getElementById(id){return elems.get(id)||null},createElement:element};
 vm.runInNewContext(rewardSource,{window,document,Date,Number});
 return {window,elems,held,
  refresh:()=>window.ChaoticOfficialRewards.refresh(),
  reads:()=>reads,writes:()=>writes,rpcs:()=>rpcs};
}
const stable=async()=>new Promise(resolve=>setImmediate(resolve));
test("v0.1.131: lifetime totals include receipts beyond the 20-row page",async()=>{
 const h=fixture({receipts:[entry()],totals:{total_xp:"12000",total_coins:"3456",settled_matches:"91"}});
 await h.refresh();await stable();
 assert.match(h.elems.get("lobby-rewards-summary").textContent,/Total oficial registrado no servidor: 12\.000 XP e 3\.456 moedas em 91 lançamento\(s\)/);
 assert.match(h.elems.get("lobby-rewards-summary").textContent,/Somente os últimos 1 lançamentos/);
 assert.equal(h.elems.get("lobby-rewards-list").children.length,1);
});
test("v0.1.131: real empty history can show server-calculated zero, not invented payouts",async()=>{
 const h=fixture({receipts:[],totals:{total_xp:0,total_coins:0,settled_matches:0}});
 await h.refresh();await stable();
 assert.match(h.elems.get("lobby-rewards-summary").textContent,/0 XP e 0 moedas em 0 lançamento\(s\)/);
 assert.match(h.elems.get("lobby-rewards-status").textContent,/Nenhuma recompensa oficial/);
 assert.equal(h.writes(),0);
});
test("v0.1.131: RPC failure leaves the already validated receipts alone",async()=>{
 const h=fixture({receipts:[entry()],totalsError:{message:"offline"}});
 await h.refresh();await stable();
 assert.match(h.elems.get("lobby-rewards-summary").textContent,/Somente os últimos 1 lançamentos/);
 assert.doesNotMatch(h.elems.get("lobby-rewards-summary").textContent,/Total oficial registrado/);
});
test("v0.1.131: invalid or inconsistent numeric totals are never published",async()=>{
 for(const totals of [
  {total_xp:"1e100",total_coins:0,settled_matches:1},
  {total_xp:-50,total_coins:5,settled_matches:1},
  {total_xp:1,total_coins:null,settled_matches:1.5}
 ]){
  const h=fixture({receipts:[entry()],totals});
  await h.refresh();await stable();
  assert.doesNotMatch(h.elems.get("lobby-rewards-summary").textContent,/Total oficial registrado/);
 }
});
test("v0.1.131: old screen's delayed RPC cannot write to a new DROME view",async()=>{
 const h=fixture({receipts:[entry()],defer:true});
 await h.refresh();
 h.elems.set("lobby-rewards-list",element("lobby-rewards-list"));
 h.held.resolve({data:[{total_xp:500,total_coins:99,settled_matches:2}],error:null});
 await stable();
 assert.doesNotMatch(h.elems.get("lobby-rewards-summary").textContent,/Total oficial registrado/);
});
test("v0.1.131: refresh serial fences late replies in same mounted panel",async()=>{
 const h=fixture({receipts:[entry()],defer:true});
 await h.refresh();
 await h.refresh();
 h.held.resolve({data:[{total_xp:10,total_coins:20,settled_matches:1}],error:null});
 await stable();
 assert.equal((h.elems.get("lobby-rewards-summary").textContent.match(/Total oficial registrado/g)||[]).length,1);
 assert.equal(h.rpcs(),2);
});
test("v0.1.131: browser reads receipts and lifetime RPC, never pays out",()=>{
 assert.doesNotMatch(rewardSource,/\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
 assert.match(rewardSource,/api\.rpc\("chaotic_my_official_reward_totals"\)/);
 assert.match(lobbySource,/id="lobby-rewards-summary" role="status" aria-live="polite"/);
});
test("v0.1.131: official match sources have RLS, no browser INSERT and strict verification",()=>{
 for(const frag of [
  "create table if not exists public.chaotic_official_match_results",
  "result_state='pending_engine_verification'",
  "verification_source='official_engine_v1'",
  "alter table public.chaotic_official_match_results enable row level security",
  "revoke all on table public.chaotic_official_match_results from public,anon,authenticated",
  "(select auth.uid())=host_id or (select auth.uid())=guest_id",
  "foreign key(source_match_id)",
  "references public.chaotic_official_match_results(id)",
  "source.result_state<>'verified'",
  "new.player_id is distinct from source.winner_id",
  "new.player_id is not distinct from source.winner_id"
 ])assert.ok(schema.includes(frag),frag);
});
test("v0.1.131: lifetime totals are SECURITY INVOKER and private",()=>{
 for(const frag of [
  "function public.chaotic_my_official_reward_totals()",
  "security invoker set search_path=''",
  "from public.chaotic_official_reward_ledger",
  "player_id=(select auth.uid())",
  "revoke all on function public.chaotic_my_official_reward_totals()",
  "to authenticated;"
 ])assert.ok(schema.includes(frag),frag);
 assert.doesNotMatch(schema,/grant insert on public\.chaotic_official_match_results/i);
});
test("v0.1.131: training evidence never counts as an official payout source",()=>{
 assert.match(schema,/public\.chaotic_match_turns[\s\S]*?lobby_id=new\.source_match_id/);
 assert.match(schema,/public\.chaotic_training_match_history[\s\S]*?lobby_id=new\.source_match_id/);
 assert.match(schema,/Treino DROME não pode conceder recompensa oficial/);
});
