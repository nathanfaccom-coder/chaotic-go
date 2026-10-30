import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../chaotic-lobby.js", import.meta.url), "utf8");
const rooms = new Map();
const realtimeChannels = [];
let counter = 0;

function makeClient(userId) {
  return {
    channel(name) {
      const listeners=[];
      const c={name,userId,listeners,active:false,
        on(kind,filter,handler) {
          assert.equal(kind,"postgres_changes");
          listeners.push({filter,handler});
          return this;
        },
        subscribe(callback){this.active=true;callback?.("SUBSCRIBED");return this;},
        unsubscribe(){this.active=false;return Promise.resolve();}
      };
      realtimeChannels.push(c);
      return c;
    },
    removeChannel(c){c.unsubscribe();return Promise.resolve();},
    rpc: async (method, args) => {
      if (method === "chaotic_create_lobby") {
        const room = {id: "room-" + (++counter), code: "ABCDEF12345" + counter,
          host_id:userId, guest_id:null, mode:args.p_mode, status:"waiting",
          expires_at:new Date(Date.now()+3600000).toISOString()};
        rooms.set(room.id,room); return {data:{...room},error:null};
      }
      const room = [...rooms.values()].find(r => r.id===args.p_id || r.code===args.p_code);
      if (!room) return {data:null,error:{message:"Sala indisponível"}};
      if (method === "chaotic_join_lobby") {
        if (room.host_id===userId || room.guest_id || room.status!=="waiting")
          return {data:null,error:{message:"Não é possível entrar"}};
        room.guest_id=userId; room.status="ready";
        return {data:{...room},error:null};
      }
      if (method === "chaotic_close_lobby") {
        if (room.host_id!==userId) return {data:null,error:{message:"Proibido"}};
        room.status="cancelled"; return {data:true,error:null};
      }
      if (method === "chaotic_leave_lobby") {
        if (room.guest_id!==userId) return {data:false,error:null};
        room.guest_id=null;room.status="waiting";return {data:true,error:null};
      }
      throw Error("Unexpected RPC "+method);
    },
    from(table) {
      assert.ok(["chaotic_lobbies","chaotic_match_turns","chaotic_match_events","chaotic_combat_declarations","chaotic_preview_board","chaotic_preview_clashes","chaotic_preview_damage","chaotic_preview_modifiers","chaotic_preview_dice","chaotic_preview_loadouts","chaotic_preview_attack_instances"].includes(table));
      return {select(){return this;},eq(_field,id){this.id=id;return this;},
        order(){return this;},
        limit(){return Promise.resolve({data:[],error:null});},
        then(resolve,reject) {
          if(table==="chaotic_preview_board")return Promise.resolve({data:[],error:null}).then(resolve,reject);
          return Promise.resolve({data:[],error:null}).then(resolve,reject);
        },
        async maybeSingle() {
          const room=rooms.get(this.id);
          if(table==="chaotic_match_turns")return {data:null,error:null};
          return {data:room&&(room.host_id===userId||room.guest_id===userId)?{...room}:null,error:null};
        }};
    }
  };
}

function makeBrowser(userId) {
  const elements = new Map();
  function elem(id) {
    if(!elements.has(id))elements.set(id,{
      id,textContent:"",value:"",style:{},hidden:false,
      classList:{toggle(){},add(){},remove(){}},
      disabled:false,isConnected:true,onclick:null,
      set innerHTML(value) {
        this._html=value;
        for (const match of value.matchAll(/id="([^"]+)"/g)) elem(match[1]);
      },
      get innerHTML() {return this._html||"";}
    });
    return elements.get(id);
  }
  elem("tela-menu");elem("tela-entrada-drome");
  const document={
    getElementById: id => elements.get(id)||null,
    querySelectorAll: query => query==="#tela-entrada-drome button"
      ? [...elements.values()].filter(x=>x.id.startsWith("lobby-")&&x.id.includes("btn")):[]
  };
  let clip="";
  const browser={
    window:{ChaoticAuth:{getClient:()=>makeClient(userId)},ChaoticAuthUser:{id:userId},
      abrirEntradaDrome(){}},
    document, navigator:{clipboard:{writeText:async x=>{clip=x;}}},
    setInterval:()=>1,clearInterval:()=>{},
    Date,console
  };
  vm.runInNewContext(source,browser,{timeout:2000});
  return {browser,elem,getClipboard:()=>clip};
}

test("two accounts create and join a private room, host sees ready",async()=>{
  const host=makeBrowser("host"),guest=makeBrowser("guest");
  host.browser.window.abrirSalaPrivadaDrome();
  host.elem("lobby-select-mode").value="3x3";
  await host.elem("lobby-create-btn").onclick();
  assert.equal(host.elem("lobby-mode").textContent,"3x3");
  const code=host.elem("lobby-room-code").textContent;
  assert.match(code,/^[A-F0-9]{12}$/);
  guest.browser.window.abrirSalaPrivadaDrome();
  guest.elem("lobby-input-code").value=code;
  await guest.elem("lobby-join-btn").onclick();
  assert.match(guest.elem("lobby-status").textContent,/Dois jogadores/);
  await host.elem("lobby-refresh").onclick();
  assert.match(host.elem("lobby-status").textContent,/Dois jogadores/);
  await host.elem("lobby-copy").onclick();
  assert.match(host.getClipboard(),new RegExp(code));
  await guest.elem("lobby-close").onclick();
  await host.elem("lobby-refresh").onclick();
  assert.match(host.elem("lobby-status").textContent,/Aguardando/);
  await host.elem("lobby-close").onclick();
  assert.match(host.elem("lobby-notice").textContent,/saiu da sala/);
});

test("same account cannot join its own lobby", async()=>{
  const host=makeBrowser("self");
  host.browser.window.abrirSalaPrivadaDrome();
  host.elem("lobby-select-mode").value="1x1"; // Simula a opção padrão do SELECT real.
  await host.elem("lobby-create-btn").onclick();
  const code=host.elem("lobby-room-code").textContent;
  const otherTab=makeBrowser("self");
  otherTab.browser.window.abrirSalaPrivadaDrome();
  otherTab.elem("lobby-input-code").value=code;
  await otherTab.elem("lobby-join-btn").onclick();
  assert.match(otherTab.elem("lobby-notice").textContent,/Não é possível entrar/);
});

test("private room subscribes to current DROME tables and cleans up after closing",async()=>{
  const host=makeBrowser("live-host"),guest=makeBrowser("live-guest");
  host.browser.window.abrirSalaPrivadaDrome();
  host.elem("lobby-select-mode").value="1x1";
  await host.elem("lobby-create-btn").onclick();
  const own=realtimeChannels.findLast(c=>c.userId==="live-host");
  assert.ok(own?.active);
  assert.deepEqual(own.listeners.map(x=>x.filter.table),
    ["chaotic_lobbies","chaotic_match_turns","chaotic_match_events","chaotic_combat_declarations","chaotic_preview_board","chaotic_preview_clashes","chaotic_preview_damage","chaotic_preview_modifiers","chaotic_preview_dice","chaotic_preview_loadouts","chaotic_preview_attack_instances","chaotic_preview_individual_damage","chaotic_preview_equipment_reveals","chaotic_preview_attack_wallets","chaotic_preview_attack_hand","chaotic_preview_initiatives","chaotic_preview_room_locations","chaotic_preview_effect_candidates","chaotic_preview_hp_wallets","chaotic_preview_hp_events","chaotic_preview_resolution_audits","chaotic_preview_burst_windows","chaotic_preview_burst_priority","chaotic_preview_burst_priority_passes","chaotic_preview_burst_mugic_intents","chaotic_preview_burst_mugic_counterplans","chaotic_preview_mugic_token_wallets","chaotic_preview_mugic_token_settlements","chaotic_preview_ability_heal_events","chaotic_preview_harp_token_events","chaotic_preview_3x3_allies","chaotic_preview_3x3_hp_wallets","chaotic_preview_3x3_board_positions","chaotic_preview_3x3_move_events","chaotic_preview_3x3_contact_intents","chaotic_preview_3x3_token_transfers","chaotic_preview_burst_order_plans","chaotic_preview_burst_equipment_responses","chaotic_preview_burst_equipment_effects"]);
  const code=host.elem("lobby-room-code").textContent;
  guest.browser.window.abrirSalaPrivadaDrome();
  guest.elem("lobby-input-code").value=code;
  await guest.elem("lobby-join-btn").onclick();
  own.listeners[0].handler({eventType:"UPDATE"});
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(host.elem("lobby-status").textContent,/Dois jogadores/);
  await host.elem("lobby-close").onclick();
  assert.equal(own.active,false,"No stale subscription after closing room");
});
