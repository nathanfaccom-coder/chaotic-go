import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const a=source.indexOf("async function refreshMatch()");
const b=source.indexOf("  // Guidance only: the server checkpoint remains authoritative.",a);
assert.ok(a>=0&&b>a,"refreshMatch boundaries");
const matchCode=source.slice(a,b).trim();
const defer=()=>{
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function environment({historyPending=false,historyError=false,receiptPending=false,mode="3x3",status="finished"}={}){
 const events=[],history=defer(),receipt=defer(),response=defer(),notifications=[];
 const ctx={
  room:{id:"room-A",mode,status:"ready"},match:{status:"active",turn_no:4},
  viewGeneration:7,playerPresence3x3:null,
  api:{from(name){
   events.push("query:"+name);
   assert.equal(name,"chaotic_match_turns");
   return {select(){return this;},eq(){return this;},maybeSingle(){return response.promise;}};
  }},
  rpc:async name=>{events.push("rpc:"+name);return {};},
  updateMatchUI:()=>events.push("update-match"),
  update3x3UI:()=>events.push("update-3x3"),
  note:(text)=>notifications.push(text),
  refreshHistory:async()=>{
   events.push("history");
   if(historyPending)await history.promise;
   if(historyError)throw Error("histórico não autorizado");
  },
  refresh3x3Allies:async()=>{
   events.push("receipt");
   if(receiptPending)await receipt.promise;
  }
 };
 const refreshFuncs=[...matchCode.matchAll(/await (refresh[A-Za-z0-9]+)\(\)/g)].map(x=>x[1]);
 for(const fn of new Set(refreshFuncs)){
  if(fn==="refreshHistory"||fn==="refresh3x3Allies")continue;
  ctx[fn]=async()=>events.push("legacy:"+fn);
 }
 const refresh=vm.runInNewContext("("+matchCode+")",ctx);
 const confirm=(data={status,turn_no:6})=>response.resolve({data,error:null});
 return {ctx,events,notifications,refresh,confirm,releaseHistory:history.resolve,
   releaseReceipt:receipt.resolve};
}

test("v0.1.119: server receipt is rendered before optional match-event history",async()=>{
 const f=environment(),p=f.refresh();
 f.confirm();await p;
 assert.deepEqual(f.events,["query:chaotic_match_turns","update-match","receipt","history"]);
});
test("v0.1.119: failed event-history query does not hide a valid final receipt",async()=>{
 const f=environment({historyError:true}),p=f.refresh();
 f.confirm();await p;
 assert.equal(f.events.filter(x=>x==="receipt").length,1);
 assert.equal(f.notifications.length,1);
 assert.match(f.notifications[0],/Comprovante final disponível/);
 assert.match(f.notifications[0],/histórico de eventos indisponível/);
});
test("v0.1.119: very slow history cannot delay the initial final-receipt render",async()=>{
 const f=environment({historyPending:true}),p=f.refresh();
 f.confirm();await settle();
 assert.ok(f.events.includes("receipt"));
 assert.ok(f.events.includes("history"));
 f.releaseHistory();
 await p;
});
test("v0.1.119: abandoned final-receipt read does not launch history for another room",async()=>{
 const f=environment({receiptPending:true}),p=f.refresh();
 f.confirm();await settle();
 assert.ok(f.events.includes("receipt"));
 f.ctx.room={...f.ctx.room,id:"room-B"};
 f.ctx.viewGeneration++;
 f.releaseReceipt();await p;
 assert.equal(f.events.includes("history"),false);
});
test("v0.1.119: history failure after changing rooms does not create a wrong-room notice",async()=>{
 const f=environment({historyPending:true,historyError:true}),p=f.refresh();
 f.confirm();await settle();
 f.ctx.room={...f.ctx.room,id:"room-B"};
 f.ctx.viewGeneration++;
 f.releaseHistory();await p;
 assert.equal(f.notifications.length,0);
});
test("v0.1.119: active match still uses full combat refresh and presence RPC",async()=>{
 const f=environment({status:"active"}),p=f.refresh();
 f.confirm();await p;
 assert.ok(f.events.includes("rpc:chaotic_ping_preview_3x3_player"));
 assert.ok(f.events.some(x=>x.startsWith("legacy:")));
});
test("v0.1.119: other game modes remain on the original refresh pipeline",async()=>{
 const f=environment({mode:"1x1"}),p=f.refresh();
 f.confirm();await p;
 assert.ok(f.events.some(x=>x.startsWith("legacy:")));
 assert.equal(f.events.includes("receipt"),true);
});
test("v0.1.119: finished match should not display an eternal connection diagnostic",()=>{
 const i=source.indexOf('const presenceText=$("lobby-3x3-player-presence")');
 const j=source.indexOf("    // Server phase is authoritative.",i);
 assert.ok(i>=0&&j>i);
 const dom={textContent:""};
 const ctx={
  $:id=>id==="lobby-3x3-player-presence"?dom:null,
  presence:null,match:{status:"finished"}
 };
 vm.runInNewContext("(()=>{"+source.slice(i,j)+"})()",ctx);
 assert.match(dom.textContent,/Sessão encerrada/);
 assert.match(dom.textContent,/não se aplica/);
 assert.doesNotMatch(dom.textContent,/Aguardando diagnóstico/);
});
test("v0.1.119: none of the finished-match error recovery invokes mutating RPCs",()=>{
 const i=matchCode.indexOf('if(room.mode==="3x3" && match?.status==="finished")');
 const j=matchCode.indexOf("// Fast heartbeat",i);
 const snippet=matchCode.slice(i,j);
 assert.ok(i>=0&&j>i);
 assert.match(snippet,/await refresh3x3Allies\(\)/);
 assert.match(snippet,/await refreshHistory\(\)/);
 assert.doesNotMatch(snippet,/rpc\(|\.insert\(|\.update\(|\.delete\(|chaotic_(?:attack|pay|spend|pass|apply)/);
});
