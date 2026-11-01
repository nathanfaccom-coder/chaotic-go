import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const begin=source.indexOf("async function action(fn) {");
const end=source.indexOf("// Guard two fast taps/tabs",begin);
assert.ok(begin>=0&&end>begin);
function deferred(){
 let resolve,reject;
 const promise=new Promise((a,b)=>{resolve=a;reject=b;});
 return {promise,resolve,reject};
}
function setup(initialDisabled=[false,true]){
 const elements=initialDisabled.map(disabled=>({disabled,isConnected:true}));
 const ctx={room:{id:"same-room",mode:"3x3"},viewGeneration:8,busy:false,
   navigator:{onLine:true},match:{status:"active"},
   document:{querySelectorAll:()=>elements},note:()=>{},
   refreshRoom:async()=>{}
 };
 const action=vm.runInNewContext("("+source.slice(begin,end).trim()+")",ctx);
 return {elements,ctx,action};
}
test("v0.1.103: an already-disabled reveal remains disabled after another action",async()=>{
 const f=setup(),p=deferred();
 f.ctx.update3x3UI=()=>{};
 const work=f.action(()=>p.promise);
 assert.equal(f.ctx.busy,true);
 assert.deepEqual(f.elements.map(x=>x.disabled),[true,true]);
 p.resolve();await work;
 assert.equal(f.ctx.busy,false);
 assert.deepEqual(f.elements.map(x=>x.disabled),[false,true]);
});
test("v0.1.103: current server state can unlock a reveal after an action",async()=>{
 const f=setup(),p=deferred();
 let eligible=false,paints=0;
 f.ctx.update3x3UI=()=>{paints++;f.elements[1].disabled=!eligible;};
 const work=f.action(()=>p.promise);
 eligible=true;
 p.resolve();await work;
 assert.equal(paints,1);
 assert.deepEqual(f.elements.map(x=>x.disabled),[false,false]);
});
test("v0.1.103: server refresh can disable a formerly enabled control",async()=>{
 const f=setup([false,false]),p=deferred();
 f.ctx.update3x3UI=()=>{f.elements[0].disabled=true;};
 const work=f.action(()=>p.promise);
 p.resolve();await work;
 assert.deepEqual(f.elements.map(x=>x.disabled),[true,false]);
});
test("v0.1.103: a superseded request cannot touch a new screen's controls",async()=>{
 const f=setup(),older=deferred(),newer=deferred();
 let paints=0;
 f.ctx.update3x3UI=()=>{paints++;};
 const old=f.action(()=>older.promise);
 f.ctx.viewGeneration=9;f.ctx.busy=false;
 // A real show() rebuilds the DOM. The previous buttons become detached.
 f.elements.forEach(button=>{button.isConnected=false;});
 const newButtons=[
   {disabled:false,isConnected:true},
   {disabled:true,isConnected:true}
 ];
 f.ctx.document.querySelectorAll=()=>newButtons;
 const fresh=f.action(()=>newer.promise);
 older.resolve();await old;
 assert.equal(f.ctx.busy,true);
 assert.deepEqual(newButtons.map(x=>x.disabled),[true,true]);
 assert.equal(paints,0);
 newer.resolve();await fresh;
 assert.deepEqual(newButtons.map(x=>x.disabled),[false,true]);
 assert.equal(paints,1);
});
test("v0.1.103: stale error recovery cannot paint current UI",async()=>{
 const f=setup(),started=deferred(),endRefresh=deferred(),messages=[];
 f.ctx.note=msg=>messages.push(msg);
 f.ctx.refreshRoom=()=>{started.resolve();return endRefresh.promise;};
 f.ctx.update3x3UI=()=>{throw Error("stale screen repainted");};
 const running=f.action(async()=>{throw Error("turno inválido");});
 await started.promise;
 f.ctx.viewGeneration=9;f.ctx.room={id:"next-room",mode:"3x3"};
 endRefresh.resolve();await running;
 assert.equal(f.ctx.busy,true,"previous request must not change current lock");
 assert.equal(messages.length,1);
});
