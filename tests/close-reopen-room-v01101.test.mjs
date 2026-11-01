import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
function isolate(start,end,ctx) {
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"expected function boundaries: "+start);
 return vm.runInNewContext("("+source.slice(a,b).trim()+")",ctx);
}
function closeHandler(ctx){
 const a=source.indexOf('$("lobby-close").onclick');
 const b=source.indexOf("\n    });",a);
 assert.ok(a>=0&&b>a,"close action exists");
 vm.runInNewContext(source.slice(a,b+7),ctx);
}
function context(side="host",closeResult=true){
 const nodes=new Map();
 const $=id=>{
  if(!nodes.has(id))nodes.set(id,{
   id,onclick:null,onchange:null,isConnected:true,disabled:false,
   hidden:false,style:{display:""},textContent:"",innerHTML:"",
   value:id==="lobby-select-mode"?"3x3":""
  });
  return nodes.get(id);
 };
 let calls=[],messages=[],forgets=0,remembered=0,watches=0,stops=0;
 const oldRoom={id:"room-older",code:"ABCDEF123456",mode:"3x3",
  host_id:"host",guest_id:"guest",status:"ready",expires_at:"2099-01-01T00:00:00Z"};
 const freshRoom={...oldRoom,id:"room-fresh",status:"waiting"};
 const ctx={
  $,userId:side,room:oldRoom,match:{turn_no:3,status:"active"},
  viewGeneration:5,busy:false,refreshInFlight:Promise.resolve(),
  refreshQueued:true,restoreInProgress:true,restoreOwner:{},
  playerPresence3x3:{old_room:true},trainingOutcomes3x3:[{winner_id:"host"}],
  hand3x3:[{attack_instance_id:"secret"}],allies3x3:[{id:"old"}],
  resumePhase3x3:{turn_no:3,phase:"damage_settled"},
  document:{querySelectorAll:()=>[...nodes.values()]},
  window:{modoMenu:true},navigator:{onLine:true},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==="chaotic_close_lobby"||name==="chaotic_leave_lobby")return closeResult;
   if(name==="chaotic_create_lobby")return freshRoom;
   throw Error("unexpected RPC "+name);
  },
  note:msg=>messages.push(msg),forgetLastRoom:()=>{forgets++;},
  rememberLastRoom:()=>{remembered++;},
  halt:()=>{stops++;},updateRoomUI:()=>{},updateMatchUI:()=>{},
  restoreLastRoom:async()=>{},watch:()=>{watches++;},
  refreshRoom:async()=>{}
 };
 ctx.action=isolate("async function action(fn)","// Guard two fast taps/tabs",ctx);
 ctx.isActionContextCurrent=isolate("function isActionContextCurrent(roomId,turn,view)","function requireActionContext(",ctx);
 ctx.show=isolate("function show() {","// Mobile browsers may suspend timers and Realtime",ctx);
 closeHandler(ctx);
 return {ctx,$,messages,calls,freshRoom,stats:()=>({forgets,remembered,watches,stops})};
}
for(const side of ["host","guest"]){
 test("v0.1.101: "+side+" can close/leave and create again without reopening the app",async()=>{
  const f=context(side),startGeneration=f.ctx.viewGeneration;
  const close=f.$("lobby-close").onclick();
  await close;
  assert.equal(f.calls[0].name,side==="host"?"chaotic_close_lobby":"chaotic_leave_lobby");
  assert.equal(f.calls[0].args.p_id,"room-older");
  assert.equal(f.ctx.room,null);
  assert.equal(f.ctx.match,null);
  assert.equal(f.ctx.viewGeneration,startGeneration+1);
  assert.equal(f.ctx.busy,false,"a closed room must not leave action locked");
  assert.equal(f.ctx.refreshInFlight,null);
  assert.equal(f.ctx.refreshQueued,false);
  assert.deepEqual(Array.from(f.ctx.allies3x3),[]);
  assert.deepEqual(Array.from(f.ctx.hand3x3),[]);
  assert.deepEqual(Array.from(f.ctx.trainingOutcomes3x3),[]);
  assert.equal(f.ctx.playerPresence3x3,null);
  assert.equal(f.ctx.resumePhase3x3,null);
  assert.equal(f.stats().forgets,1);
  assert.equal(typeof f.$("lobby-create-btn").onclick,"function");
  await f.$("lobby-create-btn").onclick();
  assert.equal(f.ctx.room.id,"room-fresh");
  assert.equal(f.ctx.busy,false);
  assert.equal(f.calls[1].name,"chaotic_create_lobby");
  assert.equal(f.stats().remembered,1);
  assert.equal(f.stats().watches,1);
 });
}
test("v0.1.101: rejected closure does not discard an active room or its UI",async()=>{
 const f=context("host",false);
 const oldRoom=f.ctx.room;
 await f.$("lobby-close").onclick();
 assert.equal(f.ctx.room,oldRoom);
 assert.equal(f.ctx.viewGeneration,5);
 assert.equal(f.ctx.busy,false);
 assert.equal(f.stats().forgets,0);
 assert.equal(f.$("lobby-create-btn").onclick,null);
 assert.match(f.messages.join(" "),/sala já pode ter sido encerrada/i);
});
test("v0.1.101: successful closure rebuilds the DROME before showing confirmation",()=>{
 const at=source.indexOf('$("lobby-close").onclick');
 const end=source.indexOf("\n    });",at);
 const handler=source.slice(at,end);
 assert.ok(handler.indexOf("forgetLastRoom()")<handler.indexOf("show()"));
 assert.ok(handler.indexOf("show()")<handler.indexOf("note(wasHost?"));
 assert.doesNotMatch(handler,/forgetLastRoom\(\);\s*\+\+viewGeneration/);
});
