import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function isolate(start,end,ctx){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,"expected boundaries for "+start);
  return vm.runInNewContext("("+source.slice(a,b).trim()+")",ctx);
}
function deferred(){
  let resolve,reject;
  const promise=new Promise((r,j)=>{resolve=r;reject=j;});
  return {promise,resolve,reject};
}
function actionContext(){
  return {
    busy:false,room:{id:"room-old",mode:"3x3"},viewGeneration:8,
    match:{status:"active"},navigator:{onLine:true},document:{querySelectorAll:()=>[]},
    note:()=>{},refreshRoom:async()=>{}
  };
}
test("v0.1.98: old mobile action cannot release the lock owned by the new screen",async()=>{
  const ctx=actionContext(),act=isolate("async function action(fn)","// Guard two fast taps/tabs",ctx);
  const oldRpc=deferred(),newRpc=deferred();
  const oldAction=act(()=>oldRpc.promise);
  assert.equal(ctx.busy,true);
  // This is the same release of the lock performed at the start of show().
  ctx.viewGeneration=9;ctx.room={id:"room-new",mode:"3x3"};ctx.busy=false;
  const newAction=act(()=>newRpc.promise);
  assert.equal(ctx.busy,true);
  oldRpc.resolve();
  await oldAction;
  assert.equal(ctx.busy,true,"the old request may not unlock a new request");
  newRpc.resolve();
  await newAction;
  assert.equal(ctx.busy,false);
});
test("v0.1.98: conflict refresh never posts a stale-room notice to the new match",async()=>{
  const ctx=actionContext(),messages=[],started=deferred(),finish=deferred();
  ctx.note=m=>messages.push(m);
  ctx.refreshRoom=()=>{started.resolve();return finish.promise;};
  const act=isolate("async function action(fn)","// Guard two fast taps/tabs",ctx);
  const old=act(async()=>{throw Error("turno já foi concluído");});
  await started.promise;
  ctx.room={id:"room-new",mode:"3x3"};ctx.viewGeneration=9;ctx.busy=false;
  ctx.match={status:"active"};
  finish.resolve();
  await old;
  assert.equal(messages.length,1);
  assert.doesNotMatch(messages.join(" "),/servidor atualizou o combate/i);
});
test("v0.1.98: new room refresh starts independently of an abandoned old refresh",async()=>{
  const ctx={
    room:{id:"room-old"},viewGeneration:3,
    refreshInFlight:null,refreshQueued:false,
    $:id=>id==="lobby-current"?{}:null
  };
  const old=deferred(),fresh=deferred(),calls=[];
  ctx.refreshRoomOnce=()=>{
    calls.push(ctx.room?.id);
    return ctx.room?.id==="room-old"?old.promise:fresh.promise;
  };
  const refresh=isolate("async function refreshRoom()","  // A complete 3x3 refresh reads many tables sequentially.",ctx);
  const oldRequest=refresh();
  assert.equal(calls.length,1);
  ctx.viewGeneration=4;ctx.room={id:"room-new"};
  ctx.refreshInFlight=null;ctx.refreshQueued=false;
  const newRequest=refresh();
  assert.deepEqual(calls,["room-old","room-new"]);
  // A queued update belongs to the new refresh, not to the old one.
  const queued=refresh();
  ctx.refreshQueued=true;
  old.resolve();
  await oldRequest;
  assert.equal(calls.length,2,"the previous room must never drain the new queue");
  ctx.refreshQueued=false;
  fresh.resolve();
  await Promise.all([newRequest,queued]);
  assert.deepEqual(calls,["room-old","room-new"]);
  assert.equal(ctx.refreshInFlight,null);
});
test("v0.1.98: opening DROME releases orphaned work and clears the refresh queue",()=>{
  const start=source.indexOf("function show() {");
  const end=source.indexOf('$("tela-menu").style.display = "none";',start);
  const block=source.slice(start,end);
  for(const key of ["busy=false;","refreshInFlight=null;","refreshQueued=false;"])
    assert.ok(block.includes(key),key);
  assert.ok(source.includes("viewGeneration===requestedView && $(\"lobby-current\")"));
  assert.match(source,/if\(viewGeneration===actionView\)\{\s*busy=false;/);
});
