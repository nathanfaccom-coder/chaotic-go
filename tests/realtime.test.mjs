import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const owner="11111111-1111-4111-8111-111111111111";
const stranger="22222222-2222-4222-8222-222222222222";
const records=new Map();
const key=(id,node)=>id+"/"+node;
const channels=[];
const errors=[];
const client={
  channel(name){
    const channel={
      name,handler:null,config:null,active:false,
      on(kind,filter,handler) {
        assert.equal(kind,"postgres_changes");
        this.handler=handler;this.config=filter;return this;
      },
      subscribe(cb){this.active=true;cb?.("SUBSCRIBED");return this;},
      unsubscribe(){this.active=false;return Promise.resolve("ok");}
    };
    channels.push(channel);return channel;
  },
  removeChannel(ch){ch.unsubscribe();return Promise.resolve("ok");},
  from(table){
    assert.equal(table,"chaotic_game_nodes");
    const q={
      filters:{},likeFilter:null,
      select(){return this;},
      eq(field,value){this.filters[field]=value;return this;},
      like(field,value){this.likeFilter=[field,value];return this;},
      async maybeSingle(){
        const found=[...records.values()].find(row=>Object.entries(this.filters)
          .every(([k,v])=>row[k]===v));
        return {data:found||null,error:null};
      },
      then(resolve,reject){
        const selected=[...records.values()].filter(row=>{
          if(!Object.entries(this.filters).every(([k,v])=>row[k]===v))return false;
          return !this.likeFilter ||
            row[this.likeFilter[0]].startsWith(this.likeFilter[1].slice(0,-1));
        });
        return Promise.resolve({data:selected,error:null}).then(resolve,reject);
      }
    };
    return q;
  }
};
globalThis.window={
  ChaoticAuth:{getClient:()=>client},
  ChaoticAuthUser:{id:owner,email:"player@example.com"},
  dispatchEvent:e=>errors.push(e.detail)
};
const source=await readFile(new URL("../supabase-game-bridge.js",import.meta.url),"utf8");
const bridge=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const path=n=>bridge.ref(bridge.db,"jogadores/"+owner+"/"+n);
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test("subscribe to private player updates once for all nodes", async()=>{
  const observed=[];
  const unsubscribe=bridge.onValue(path("album"),s=>observed.push(s.val()));
  await tick();
  assert.equal(channels.length,1);
  assert.equal(channels[0].config.filter,"user_id=eq."+owner);
  records.set(key(owner,"album"),{user_id:owner,node_path:"album",data:[{id:3}]});
  channels[0].handler({eventType:"INSERT",new:{user_id:owner,node_path:"album",data:[{id:3}]},old:{}});
  assert.deepEqual(observed.at(-1),[{id:3}]);
  channels[0].handler({eventType:"UPDATE",new:{user_id:stranger,node_path:"album",data:[{id:99}]},old:{}});
  assert.deepEqual(observed.at(-1),[{id:3}],"Cross-account changes are never dispatched");
  channels[0].handler({eventType:"DELETE",new:{},old:{user_id:owner,node_path:"album"}});
  assert.equal(observed.at(-1),null,"Deletion notifies subscribers");
  unsubscribe();
  assert.equal(channels[0].active,false,"Channel closes once last listener unsubscribes");
});
test("deck editor updates refresh DROME aggregate when another device writes",async()=>{
  const observed=[];
  const stop=bridge.onValue(path("decks"),s=>observed.push(s.val()));
  await tick();
  const row={user_id:owner,node_path:"decks/6x6_slot_1",data:{nome:"Deck Original"}};
  records.set(key(owner,row.node_path),row);
  channels.at(-1).handler({eventType:"INSERT",new:row,old:{}});
  await tick();
  assert.equal(observed.at(-1)["6x6_slot_1"].nome,"Deck Original");
  stop();
  assert.equal(errors.length,0);
});
