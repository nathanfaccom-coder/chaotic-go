import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const src=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function handler(id) {
 const at=src.indexOf('$("'+id+'").onclick'),end=src.indexOf("\n    });",at);
 assert.ok(at>=0&&end>at,"handler "+id);
 return src.slice(at,end+7);
}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
for (const id of ["lobby-3x3-cancel-contact","lobby-3x3-black-hand-pay",
 "lobby-3x3-attack-spend","lobby-3x3-training-damage","lobby-3x3-defense-pass"]) {
 test("v0.1.96: "+id+" rejects new room after async preflight",async()=>{
   const pending=deferred(),started=deferred(),calls=[];
   const nodes=new Map(),$=k=>nodes.get(k)||nodes.set(k,{}).get(k);
   const ctx={
     $,room:{id:"old",mode:"3x3"},match:{turn_no:5,status:"active",current_player:id==="lobby-3x3-defense-pass"?"guest":"host"},viewGeneration:1,userId:"host",
     action:fn=>fn(),
     require3x3Phase:()=>{started.resolve();return pending.promise;},
     requireActionContext:(rid,turn,view)=>{
       if(ctx.room.id!==rid||ctx.viewGeneration!==view||ctx.match.turn_no!==turn)
         throw Error("stale");
     },
     isActionContextCurrent:(rid,turn,view)=>ctx.room.id===rid&&ctx.viewGeneration===view&&ctx.match.turn_no===turn,
     rpc:async(name,args)=>{calls.push({name,args});return {};},
     refresh3x3Allies:async()=>{throw Error("should not refresh");},
     note:()=>{},
     attackProjections3x3:[{turn_no:5,actor_id:"host",catalog_attack_id:"101"}],
     resolvableTrainingAttacks3x3:new Set(["101"])
   };
   vm.runInNewContext(handler(id),ctx);
   const call=$(id).onclick();
   await started.promise;
   ctx.room={id:"new",mode:"3x3"};ctx.viewGeneration=2;
   pending.resolve({phase:"ready",turn_no:5});
   await assert.rejects(call,/stale/);
   assert.equal(calls.length,0);
 });
}
test("v0.1.96: delayed turn-pass response never overwrites a newly selected room",async()=>{
 const pending=deferred(),started=deferred(),calls=[];
 const nodes=new Map(),$=k=>nodes.get(k)||nodes.set(k,{}).get(k);
 const ctx={
  $,room:{id:"old",mode:"3x3"},match:{turn_no:5,status:"active",current_player:"host"},viewGeneration:3,userId:"host",
  action:fn=>fn(),require3x3Phase:async()=>({phase:"ready",turn_no:5}),
  requireActionContext:(rid,turn,view)=>assert.ok(ctx.room.id===rid&&ctx.match.turn_no===turn&&ctx.viewGeneration===view),
  isActionContextCurrent:(rid,turn,view)=>ctx.room?.id===rid&&ctx.match?.turn_no===turn&&ctx.viewGeneration===view,
  rpc:(name,args)=>{calls.push({name,args});started.resolve();return pending.promise;},
  updateMatchUI:()=>{throw Error("stale view");},refreshHistory:async()=>{},note:()=>{}
 };
 vm.runInNewContext(handler("lobby-turn-pass"),ctx);
 const call=$("lobby-turn-pass").onclick();
 await started.promise;
 assert.equal(calls[0].args.p_lobby_id,"old");
 ctx.room={id:"new",mode:"3x3"};ctx.viewGeneration=4;
 ctx.match={turn_no:1,status:"active",current_player:"guest"};
 pending.resolve({turn_no:6,status:"active"});
 await call;
 assert.equal(ctx.match.turn_no,1);
});
test("v0.1.96: match lifecycle captures room ID and drops late results",()=>{
 for(const id of ["lobby-turn-start","lobby-turn-stop","lobby-close"]){
  const code=handler(id);
  assert.ok(code.includes("const expectedRoomId=room.id"),id);
  assert.ok(code.includes("isActionContextCurrent(expectedRoomId"),id);
 }
 assert.match(src,/if\(room\?\.id!==actionRoomId \|\| viewGeneration!==actionView\)return;/);
});
