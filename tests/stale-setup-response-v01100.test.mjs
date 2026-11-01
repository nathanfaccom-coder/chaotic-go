import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const src=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function extractHandler(id){
 const start=src.indexOf('$("'+id+'").onclick=');
 const end=id==="lobby-3x3-refresh-connection"
   ?src.indexOf('\n    $("lobby-3x3-prepare").onclick',start)
   :src.indexOf("\n    });",start);
 assert.ok(start>=0&&end>start,"handler found: "+id);
 return src.slice(start,end+(id==="lobby-3x3-refresh-connection"?0:7));
}
function pending(){
 let resolve,reject;
 const promise=new Promise((r,j)=>{resolve=r;reject=j});
 return {promise,resolve,reject};
}
function harness(id){
 const p=pending(),started=pending(),calls=[],messages=[];
 const elements=new Map();
 const $=key=>{
   if(!elements.has(key))elements.set(key,{value:"4",onclick:null});
   return elements.get(key);
 };
 const ctx={
   room:{id:"old-room",mode:"3x3"},
   match:{turn_no:4,current_player:"host",status:"active"},
   viewGeneration:7,userId:"host",$,
   busy:false,refreshInFlight:null,refreshQueued:false,
   document:{hidden:false},navigator:{onLine:true},watch:()=>{},
   action:async fn=>fn(),note:msg=>messages.push(msg),
   rpc:(method,args)=>{calls.push({method,args});started.resolve();return p.promise;},
   refreshRoom:()=>{started.resolve();return p.promise;},
   refresh3x3Allies:async()=>{throw Error("old request refreshed newer room");},
   playerPresence3x3:{self_ready:false,new_room:false},
   isActionContextCurrent:(rid,turn,view)=>
     ctx.room?.id===rid && ctx.match?.turn_no===turn && ctx.viewGeneration===view,
   update3x3UI:()=>{throw Error("stale presence painted on newer room");}
 };
 vm.runInNewContext(extractHandler(id),ctx);
 return {ctx,$,p,started,calls,messages};
}
for(const id of [
 "lobby-3x3-test-ready","lobby-3x3-test-unready",
 "lobby-3x3-prepare","lobby-3x3-hp-prepare","lobby-3x3-board-prepare",
 "lobby-3x3-move","lobby-3x3-contact"
]){
 test("v0.1.100: "+id+" drops a delayed response from the previous lobby",async()=>{
   const f=harness(id);
   const running=f.$(id).onclick();
   await f.started.promise;
   assert.equal(f.calls.length,1);
   assert.equal(f.calls[0].args.p_lobby_id,"old-room");
   f.ctx.room={id:"new-room",mode:"3x3"};
   f.ctx.match={turn_no:1,status:"active",current_player:"guest"};
   f.ctx.viewGeneration=8;
   const latest={new_room:true,self_ready:true};
   f.ctx.playerPresence3x3=latest;
   f.p.resolve({count:3,creatures:3,formation_slot:4,from_hex:1,to_hex:2,
     attacker_slot:4,defender_slot:5,both_ready_now:false});
   await running;
   assert.equal(f.ctx.playerPresence3x3,latest);
   assert.equal(f.messages.length,0,"no success toast in the new room");
 });
}
test("v0.1.100: stale manual reconnection cannot show success for another room",async()=>{
 const f=harness("lobby-3x3-refresh-connection");
 const running=f.$("lobby-3x3-refresh-connection").onclick();
 await f.started.promise;
 f.ctx.room={id:"new-room",mode:"3x3"};
 f.ctx.match={turn_no:1};
 f.ctx.viewGeneration=8;
 f.p.resolve();
 await running;
 assert.equal(f.messages.length,0);
});
test("v0.1.100: readiness updates UI after successful current-room server confirmation",async()=>{
 const f=harness("lobby-3x3-test-ready");
 let paints=0;
 f.ctx.update3x3UI=()=>{paints++;};
 const running=f.$("lobby-3x3-test-ready").onclick();
 await f.started.promise;
 f.p.resolve({self_ready:true,both_ready_now:false});
 await running;
 assert.equal(paints,1);
 assert.equal(f.ctx.playerPresence3x3.self_ready,true);
 assert.match(f.messages.join(" "),/Pronto registrado/);
});
test("v0.1.100: preparation still refreshes exactly once on same room and turn",async()=>{
 const f=harness("lobby-3x3-prepare");
 let refreshes=0;
 f.ctx.refresh3x3Allies=async()=>{refreshes++;};
 const running=f.$("lobby-3x3-prepare").onclick();
 await f.started.promise;
 f.p.resolve({count:3});
 await running;
 assert.equal(refreshes,1);
 assert.match(f.messages.join(" "),/Formação congelada/);
});
test("v0.1.100: guard validates room, screen and turn after each pending result",()=>{
 for(const id of ["lobby-3x3-test-ready","lobby-3x3-test-unready",
 "lobby-3x3-prepare","lobby-3x3-hp-prepare","lobby-3x3-board-prepare",
 "lobby-3x3-move","lobby-3x3-contact","lobby-3x3-refresh-connection"]){
  const s=extractHandler(id);
  assert.match(s,/const expectedRoomId=room.id,expectedTurn=match.turn_no,expectedView=viewGeneration;/);
  assert.match(s,/isActionContextCurrent\(expectedRoomId,expectedTurn,expectedView\)/);
 }
});
