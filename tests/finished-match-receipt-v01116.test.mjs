import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const visStart=source.indexOf("const readyButton=$(\"lobby-3x3-test-ready\")");
const visEnd=source.indexOf("const presenceText=$(\"lobby-3x3-player-presence\")",visStart);
const handlerStart=source.indexOf('$("lobby-3x3-refresh-connection").onclick=');
const handlerEnd=source.indexOf('$("lobby-3x3-prepare").onclick=',handlerStart);
assert.ok(visStart>=0&&visEnd>visStart&&handlerStart>=0&&handlerEnd>handlerStart);
const visibility=source.slice(visStart,visEnd);
const handler=source.slice(handlerStart,handlerEnd);
function control({status="active",roomStatus="ready",outcome=false}={}){
 const button={hidden:true,textContent:""},
       ready={hidden:true},unready={hidden:true};
 const nodes={"lobby-3x3-refresh-connection":button,
   "lobby-3x3-test-ready":ready,"lobby-3x3-test-unready":unready};
 const ctx={
  $:id=>nodes[id]||null,
  room:{id:"room-A",mode:"3x3",status:roomStatus},
  match:status===null?null:{status,turn_no:5},
  current:status==="active"&&roomStatus==="ready",
  presence:{self_ready:true},
  trainingOutcomes3x3:outcome?[{decided_turn:5}]:[]
 };
 vm.runInNewContext("(()=>{"+visibility+"})()",ctx);
 return {button,ready,unready};
}
function interaction({status="finished",outcome=true}={}){
 const messages=[];
 const ctx={
  room:{id:"room-A",mode:"3x3",status:"ready"},
  match:{turn_no:5,status},viewGeneration:7,
  busy:false,refreshInFlight:null,refreshQueued:false,
  document:{hidden:false},navigator:{onLine:true},
  trainingOutcomes3x3:outcome?[{winner_id:"host"}]:[],
  resumePhase3x3:null,playerPresence3x3:null,
  $:id=>id==="lobby-3x3-refresh-connection"?{onclick:null}:null,
  action:fn=>fn(),note:m=>messages.push(m),
  isActionContextCurrent:(roomId,turn,view)=>
    ctx.room?.id===roomId&&ctx.match?.turn_no===turn&&ctx.viewGeneration===view,
  watch:()=>{throw Error("No stuck fetch; should not recreate websocket")},
  refreshRoom:async()=>{ctx.refreshes++;},refreshes:0
 };
 const button={onclick:null};ctx.$=id=>id==="lobby-3x3-refresh-connection"?button:null;
 vm.runInNewContext(handler,ctx);
 return {ctx,button,messages};
}
test("v0.1.116: final match keeps the result-refresh control visible",()=>{
 const {button,ready,unready}=control({status:"finished",outcome:true});
 assert.equal(button.hidden,false);
 assert.equal(button.textContent,"Atualizar comprovante final");
 assert.equal(ready.hidden,true);
 assert.equal(unready.hidden,true);
});
test("v0.1.116: stored three-KO outcome still exposes the receipt while turn is active",()=>{
 const {button}=control({status:"active",outcome:true});
 assert.equal(button.hidden,false);
 assert.equal(button.textContent,"Atualizar comprovante final");
});
test("v0.1.116: active match keeps original connection-and-turn label",()=>{
 const {button}=control();
 assert.equal(button.hidden,false);
 assert.equal(button.textContent,"Atualizar conexão e turno");
});
test("v0.1.116: cancelled / no-match lobby does not expose inappropriate final button",()=>{
 for(const args of [{status:"finished",roomStatus:"cancelled"},
                    {status:null},{status:"waiting"}]){
  const {button}=control(args);
  assert.equal(button.hidden,true,JSON.stringify(args));
 }
});
test("v0.1.116: finished training refresh reads result and instructs two-phone comparison",async()=>{
 const {ctx,button,messages}=interaction();
 await button.onclick();
 assert.equal(ctx.refreshes,1);
 assert.equal(ctx.viewGeneration,7);
 assert.match(messages[0],/Resultado de treino consultado no servidor/);
 assert.match(messages[0],/Compare o código, o vencedor, o turno e c4–c6/);
 assert.match(messages[0],/nenhuma ação será repetida/);
});
test("v0.1.116: closed session without victory never falsely says there was a winner",async()=>{
 const {ctx,button,messages}=interaction({status:"finished",outcome:false});
 await button.onclick();
 assert.equal(ctx.refreshes,1);
 assert.match(messages[0],/sem vitória de treino confirmada/);
 assert.doesNotMatch(messages[0],/Resultado de treino consultado/);
});
test("v0.1.116: later response from an abandoned result-check has no success toast",async()=>{
 let resolve;
 const pending=new Promise(done=>resolve=done);
 const {ctx,button,messages}=interaction();
 ctx.refreshRoom=()=>pending;
 const task=button.onclick();
 ctx.room={id:"room-B",mode:"3x3",status:"ready"};
 ctx.viewGeneration=8;
 resolve();await task;
 assert.equal(messages.length,0);
});
test("v0.1.116: the finished-match refresh is read-only and never unlocks gameplay",()=>{
 assert.match(handler,/await refreshRoom\(\)/);
 assert.doesNotMatch(handler,/rpc\(|chaotic_(?:attack|spend|pay|pass|apply|borrow|prepare)/);
 assert.doesNotMatch(visibility,/btn\.disabled\s*=\s*false/);
 assert.ok(source.includes('id="lobby-3x3-verification-report"'));
 assert.ok(source.includes('id="lobby-3x3-copy-verification"'));
});
