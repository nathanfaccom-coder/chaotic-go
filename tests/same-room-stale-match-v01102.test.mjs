import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const script=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function extract(start,end,context){
  const a=script.indexOf(start),b=script.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,"missing function boundaries "+start);
  return vm.runInNewContext("("+script.slice(a,b).trim()+")",context);
}
function deferred(){
 let resolve,reject;
 const promise=new Promise((r,j)=>{resolve=r;reject=j;});
 return {promise,resolve,reject};
}
function env(){
  const room={id:"same-room",mode:"3x3",status:"ready"},queries=[];
  let rendered=0,downstream=0;
  const ctx={
    room,viewGeneration:8,match:{turn_no:4,status:"active"},playerPresence3x3:null,
    api:{from:()=>({select:()=>({eq:()=>({maybeSingle:()=>{const p=deferred();queries.push(p);return p.promise;}})})})},
    rpc:async()=>({self_ready:true}),
    note:()=>{},
    updateMatchUI:()=>{rendered++;},update3x3UI:()=>{rendered++;}
  };
  const fn=script.slice(script.indexOf("async function refreshMatch()"),
    script.indexOf("  // Guidance only: the server checkpoint remains authoritative."));
  const awaits=[...fn.matchAll(/await (refresh[A-Za-z0-9]+)\(\)/g)].map(x=>x[1]);
  for(const name of new Set(awaits))ctx[name]=async()=>{downstream++;};
  return {ctx,queries,metrics:()=>({rendered,downstream}),refresh:extract("async function refreshMatch()","  // Guidance only: the server checkpoint remains authoritative.",ctx)};
}
test("v0.1.102: stale read in the SAME room cannot roll turn 5 back to turn 4",async()=>{
 const f=env();
 const request=f.refresh();
 assert.equal(f.queries.length,1);
 const latest={turn_no:5,status:"active",current_player:"guest"};
 f.ctx.match=latest;
 f.queries[0].resolve({data:{turn_no:4,status:"active"},error:null});
 await request;
 assert.equal(f.ctx.match,latest);
 assert.deepEqual(f.metrics(),{rendered:0,downstream:0});
});
test("v0.1.102: a newer match refresh wins over an earlier delayed match refresh",async()=>{
 const f=env();
 const earlier=f.refresh();
 const later=f.refresh();
 f.queries[1].resolve({data:{turn_no:6,status:"finished"},error:null});
 await later;
 const winning=f.ctx.match;
 f.queries[0].resolve({data:{turn_no:5,status:"active"},error:null});
 await earlier;
 assert.equal(f.ctx.match,winning);
 assert.equal(f.ctx.match.turn_no,6);
});
test("v0.1.102: heartbeat returned after passing turn cannot change presence or downstream state",async()=>{
 const f=env(),started=deferred(),heartbeat=deferred();
 f.ctx.match={turn_no:4,status:"active"};
 f.ctx.rpc=()=>{started.resolve();return heartbeat.promise;};
 const request=f.refresh();
 f.queries[0].resolve({data:{turn_no:4,status:"active"},error:null});
 await started.promise;
 const accepted=f.ctx.match;
 assert.equal(accepted.turn_no,4);
 f.ctx.match={turn_no:5,status:"active",current_player:"guest"};
 const presence={new_turn:true};
 f.ctx.playerPresence3x3=presence;
 heartbeat.resolve({old_turn:true});
 await request;
 assert.equal(f.ctx.match.turn_no,5);
 assert.equal(f.ctx.playerPresence3x3,presence);
 assert.equal(f.metrics().downstream,0);
});
test("v0.1.102: normal server turn refresh still updates the active room",async()=>{
 const f=env(),request=f.refresh();
 f.queries[0].resolve({data:{turn_no:5,status:"finished"},error:null});
 await request;
 assert.equal(f.ctx.match.turn_no,5);
 assert.equal(f.metrics().rendered,1);
 assert.ok(f.metrics().downstream>=1);
});
function backContext(room){
 const button={};
 const notices=[],ctx={
   room,$:()=>button,halt:()=>{ctx.stops++;},
   stops:0,window:{abrirEntradaDrome:()=>{ctx.nav++;}},nav:0,
   note:(msg,err)=>notices.push({msg,err})
 };
 const a=script.indexOf('$("lobby-back").onclick');
 const b=script.indexOf("\n    };",a);
 assert.ok(a>=0&&b>a);
 vm.runInNewContext(script.slice(a,b+7),ctx);
 ctx.getNotices=()=>notices;
 return ctx;
}
test("v0.1.102: pressing Back in a live room must preserve its active sync watcher",()=>{
 const f=backContext({id:"room",status:"ready"});
 f.$("lobby-back").onclick();
 assert.equal(f.stops,0,"must not stop Realtime and polling when navigation is denied");
 assert.equal(f.nav,0);
 assert.match(f.getNotices()[0].msg,/Encerrar\/Sair/);
});
test("v0.1.102: Back really stops watching after room is absent or already cancelled",()=>{
 for(const room of [null,{id:"old",status:"cancelled"}]){
  const f=backContext(room);
  f.$("lobby-back").onclick();
  assert.equal(f.stops,1);
  assert.equal(f.nav,1);
 }
});
