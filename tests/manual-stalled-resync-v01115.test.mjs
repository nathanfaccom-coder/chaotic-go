import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const start=source.indexOf('$("lobby-3x3-refresh-connection").onclick=');
const end=source.indexOf('$("lobby-3x3-prepare").onclick=',start);
assert.ok(start>=0&&end>start,"manual resync handler boundaries");
const handlerSource=source.slice(start,end).trim();
const flush=()=>new Promise(ok=>setImmediate(ok));
function deferred(){
 let resolve,reject;
 const promise=new Promise((r,j)=>{resolve=r;reject=j;});
 return {promise,resolve,reject};
}
function harness(overrides={}){
 let watches=0,reads=0;
 const messages=[];
 const pending=deferred();
 const nodes={"lobby-3x3-refresh-connection":{onclick:null}};
 const ctx={
  room:{id:"room-A",mode:"3x3"},match:{turn_no:4,status:"active"},
  viewGeneration:7,refreshInFlight:{id:"frozen-read"},
  refreshQueued:true,busy:false,document:{hidden:false},navigator:{onLine:true},
  $:id=>nodes[id]||null, watch:()=>{watches++;},
  refreshRoom:()=>{reads++;return Promise.resolve();},
  trainingOutcomes3x3:[],
  resumePhase3x3:{training_finished:false},playerPresence3x3:{peer_synced_current_turn:true},
  isActionContextCurrent:(roomId,turn,view)=>
   ctx.room?.id===roomId&&ctx.match?.turn_no===turn&&ctx.viewGeneration===view,
  note:(msg)=>messages.push(msg),
  action:async(fn)=>{
   if(ctx.busy||ctx.navigator.onLine===false)return;
   ctx.busy=true;
   try{return await fn();}finally{ctx.busy=false;}
  },
  ...overrides
 };
 vm.runInNewContext(handlerSource,ctx);
 return {ctx,click:()=>nodes["lobby-3x3-refresh-connection"].onclick(),
  counts:()=>({watches,reads}),messages,pending};
}
test("v0.1.115: manual resync replaces frozen read without reusing old channel",async()=>{
 const f=harness(),previous=f.ctx.refreshInFlight;
 await f.click();
 assert.equal(f.ctx.viewGeneration,8);
 assert.equal(f.ctx.refreshInFlight,null);
 assert.equal(f.ctx.refreshQueued,false);
 assert.notEqual(previous,null);
 assert.deepEqual(f.counts(),{watches:1,reads:1});
 assert.match(f.messages.join(" "),/Conexão e etapa do ataque atualizadas/);
});
test("v0.1.115: a pending paid action is never interrupted by manual recovery",async()=>{
 const f=harness({busy:true});
 const current=f.ctx.refreshInFlight;
 await f.click();
 assert.equal(f.ctx.refreshInFlight,current);
 assert.equal(f.ctx.refreshQueued,true);
 assert.equal(f.ctx.viewGeneration,7);
 assert.deepEqual(f.counts(),{watches:0,reads:0});
});
test("v0.1.115: without a stuck read the manual button only refreshes once",async()=>{
 const f=harness({refreshInFlight:null,refreshQueued:false});
 await f.click();
 assert.equal(f.ctx.viewGeneration,7);
 assert.deepEqual(f.counts(),{watches:0,reads:1});
});
test("v0.1.115: offline manual click does not re-subscribe or send attacks",async()=>{
 const f=harness({navigator:{onLine:false}});
 const original=f.ctx.refreshInFlight;
 await f.click();
 assert.equal(f.ctx.refreshInFlight,original);
 assert.equal(f.ctx.viewGeneration,7);
 assert.deepEqual(f.counts(),{watches:0,reads:0});
});
test("v0.1.115: hidden app cannot invalidate a pending read by simulated tap",async()=>{
 const f=harness({document:{hidden:true}});
 const original=f.ctx.refreshInFlight;
 await f.click();
 assert.equal(f.ctx.refreshInFlight,original);
 assert.equal(f.ctx.viewGeneration,7);
 assert.equal(f.counts().watches,0);
});
test("v0.1.115: old room's late response never reports success in newly opened DROME",async()=>{
 const d=deferred();
 const f=harness({refreshRoom:()=>d.promise});
 const result=f.click();
 assert.equal(f.ctx.viewGeneration,8);
 f.ctx.room={id:"room-B",mode:"3x3"};
 f.ctx.match={turn_no:1,status:"active"};
 f.ctx.viewGeneration++;
 d.resolve();
 await result;
 assert.equal(f.messages.length,0);
});
test("v0.1.115: after manual recovery repeated taps keep the new read unless it also stalls",async()=>{
 const d=deferred();
 const f=harness({refreshRoom:()=>d.promise});
 const original=f.ctx.refreshInFlight;
 const first=f.click();
 assert.notEqual(f.ctx.refreshInFlight,original);
 assert.equal(f.ctx.viewGeneration,8);
 const second=f.click();
 assert.equal(f.ctx.viewGeneration,8,"busy lock protects new request while pending");
 assert.equal(f.counts().watches,1);
 d.resolve();
 await Promise.all([first,second]);
 await flush();
});
test("v0.1.115: manual recovery never replays mutations or writes original card data",()=>{
 assert.match(handlerSource,/if\(!busy && room\?\.mode==="3x3" && refreshInFlight/);
 assert.match(handlerSource,/viewGeneration\+\+;/);
 assert.match(handlerSource,/refreshInFlight=null;/);
 assert.match(handlerSource,/return action\(async\(\)=>/);
 assert.doesNotMatch(handlerSource,/rpc\(|chaotic_(?:attack|pay|spend|pass|apply|borrow|delete)/);
});
