import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../chaotic-lobby.js", import.meta.url), "utf8");
const rooms = new Map();
const rematchRequests = new Map();
const realtimeChannels = [];
const browserStorage = new Map();
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
        const room = {id: "room-" + (++counter), code: "ABCDEF" + counter.toString(16).toUpperCase().padStart(6,"0"),
          host_id:userId, guest_id:null, mode:args.p_mode, status:"waiting",
          expires_at:new Date(Date.now()+3600000).toISOString()};
        rooms.set(room.id,room); return {data:{...room},error:null};
      }
      const room = [...rooms.values()].find(r => r.id===args.p_id ||
        r.id===args.p_source_lobby_id || r.code===args.p_code);
      if (!room) return {data:null,error:{message:"Sala indisponível"}};
      if (method === "chaotic_request_rematch") {
        if(!room.finished || room.guest_id==null || room.status!=="ready"
          || ![room.host_id,room.guest_id].includes(userId))
          return {data:null,error:{message:"A revanche só é permitida depois da conclusão do treino"}};
        let req=rematchRequests.get(room.id);
        if(!req){
          req={source_lobby_id:room.id,host_accepted:false,guest_accepted:false,new_lobby_id:null};
          rematchRequests.set(room.id,req);
        }
        if(userId===room.host_id)req.host_accepted=true;
        else req.guest_accepted=true;
        if(req.new_lobby_id)
          return {data:{state:"ready",new_lobby_id:req.new_lobby_id,training_only:true},error:null};
        if(!req.host_accepted||!req.guest_accepted)
          return {data:{state:"waiting_for_other_player",new_lobby_id:null,training_only:true},error:null};
        const code="ABCDEF"+(++counter).toString(16).toUpperCase().padStart(6,"0");
        const created={
          id:"room-"+counter,code,host_id:room.host_id,guest_id:room.guest_id,
          mode:room.mode,status:"ready",
          expires_at:new Date(Date.now()+3600000).toISOString()
        };
        room.status="cancelled";
        rooms.set(created.id,created);req.new_lobby_id=created.id;
        return {data:{state:"ready",new_lobby_id:created.id,training_only:true},error:null};
      }
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
      assert.ok(["chaotic_lobbies","chaotic_rematch_requests","chaotic_match_turns","chaotic_match_events","chaotic_combat_declarations","chaotic_preview_board","chaotic_preview_clashes","chaotic_preview_damage","chaotic_preview_modifiers","chaotic_preview_dice","chaotic_preview_loadouts","chaotic_preview_attack_instances"].includes(table));
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
          if(table==="chaotic_rematch_requests"){
            const source=rooms.get(this.id);
            return {data:source&&[source.host_id,source.guest_id].includes(userId)
              ?rematchRequests.get(this.id)||null:null,error:null};
          }
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
      abrirEntradaDrome(){},
      localStorage:{
        getItem:key=>browserStorage.has(key)?browserStorage.get(key):null,
        setItem:(key,value)=>browserStorage.set(key,String(value)),
        removeItem:key=>browserStorage.delete(key)
      }},
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
  assert.match(guest.elem("lobby-status").textContent,/Sala pronta/);
  await host.elem("lobby-refresh").onclick();
  assert.match(host.elem("lobby-status").textContent,/Sala pronta/);
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
    ["chaotic_lobbies","chaotic_match_turns","chaotic_match_events","chaotic_combat_declarations","chaotic_preview_board","chaotic_preview_clashes","chaotic_preview_damage","chaotic_preview_modifiers","chaotic_preview_dice","chaotic_preview_loadouts","chaotic_preview_attack_instances","chaotic_preview_individual_damage","chaotic_preview_equipment_reveals","chaotic_preview_attack_wallets","chaotic_preview_attack_hand","chaotic_preview_initiatives","chaotic_preview_room_locations","chaotic_preview_effect_candidates","chaotic_preview_hp_wallets","chaotic_preview_hp_events","chaotic_preview_resolution_audits","chaotic_preview_burst_windows","chaotic_preview_burst_priority","chaotic_preview_burst_priority_passes","chaotic_preview_burst_mugic_intents","chaotic_preview_burst_mugic_counterplans","chaotic_preview_mugic_token_wallets","chaotic_preview_mugic_token_settlements","chaotic_preview_ability_heal_events","chaotic_preview_harp_token_events","chaotic_preview_3x3_contact_intents","chaotic_preview_3x3_attack_projections","chaotic_preview_3x3_elemental_inspections","chaotic_preview_3x3_training_damage_events","chaotic_preview_3x3_training_attack_locks","chaotic_preview_3x3_training_knockouts","chaotic_preview_3x3_training_outcomes","chaotic_preview_3x3_defense_windows","chaotic_preview_3x3_attack_spends","chaotic_preview_3x3_cost_inspections","chaotic_preview_burst_order_plans","chaotic_preview_burst_equipment_responses","chaotic_preview_burst_equipment_effects"]);
  const code=host.elem("lobby-room-code").textContent;
  guest.browser.window.abrirSalaPrivadaDrome();
  guest.elem("lobby-input-code").value=code;
  await guest.elem("lobby-join-btn").onclick();
  own.listeners[0].handler({eventType:"UPDATE"});
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(host.elem("lobby-status").textContent,/Sala pronta/);
  await host.elem("lobby-close").onclick();
  assert.equal(own.active,false,"No stale subscription after closing room");
});

test("v0.1.67: a reloaded player recovers their own open room from Supabase",async()=>{
  const host=makeBrowser("resume67-host"),guest=makeBrowser("resume67-guest");
  host.browser.window.abrirSalaPrivadaDrome();
  host.elem("lobby-select-mode").value="3x3";
  await host.elem("lobby-create-btn").onclick();
  const id=[...rooms.values()].find(r=>r.host_id==="resume67-host")?.id;
  const key="chaotic-go:last-room:resume67-host";
  const cached=JSON.parse(browserStorage.get(key));
  assert.equal(cached.id,id);
  assert.equal(cached.code,undefined,"Do not cache the invitation code");
  assert.equal(cached.decks,undefined,"Do not cache hidden Decks");
  const code=host.elem("lobby-room-code").textContent;
  guest.browser.window.abrirSalaPrivadaDrome();
  guest.elem("lobby-input-code").value=code;
  await guest.elem("lobby-join-btn").onclick();
  const refresh=makeBrowser("resume67-host");
  refresh.browser.window.abrirSalaPrivadaDrome();
  for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(refresh.elem("lobby-room-code").textContent,code,
    "restoration note: "+refresh.elem("lobby-notice").textContent+
    " | saved: "+String(browserStorage.get(key)));
  assert.equal(refresh.elem("lobby-mode").textContent,"3x3");
  assert.match(refresh.elem("lobby-status").textContent,/Sala pronta/);
  assert.match(refresh.elem("lobby-notice").textContent,/Sala recuperada/);
  assert.equal(rooms.size,[...rooms.values()].filter(()=>true).length);
  await refresh.elem("lobby-close").onclick();
  assert.equal(browserStorage.has(key),false,"Closing room clears saved reference");
});
test("v0.1.67: a forged local room ID never authorizes an outsider",async()=>{
  const host=makeBrowser("resume67-owner");
  host.browser.window.abrirSalaPrivadaDrome();
  host.elem("lobby-select-mode").value="1x1";
  await host.elem("lobby-create-btn").onclick();
  const id=[...rooms.values()].find(r=>r.host_id==="resume67-owner")?.id;
  const key="chaotic-go:last-room:resume67-outsider";
  browserStorage.set(key,JSON.stringify({id,expires_at:new Date(Date.now()+360000).toISOString()}));
  const outsider=makeBrowser("resume67-outsider");
  outsider.browser.window.abrirSalaPrivadaDrome();
  for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(outsider.elem("lobby-room-code").textContent,"");
  assert.equal(browserStorage.has(key),false);
  assert.match(outsider.elem("lobby-notice").textContent,/não pertence/);
  await host.elem("lobby-close").onclick();
});
test("v0.1.67: expired and corrupt saved IDs are forgotten without replaying a game",async()=>{
  for (const [user,entry] of [
    ["resume67-expired",JSON.stringify({id:"not-a-room",expires_at:new Date(Date.now()-1e5).toISOString()})],
    ["resume67-invalid","{garbled"]
  ]){
    const key="chaotic-go:last-room:"+user;
    browserStorage.set(key,entry);
    const tab=makeBrowser(user);
    tab.browser.window.abrirSalaPrivadaDrome();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(browserStorage.has(key),false);
    assert.equal(tab.elem("lobby-room-code").textContent,"");
  }
});

test("v0.1.128: original 12-char code still joins normally",async()=>{
 const host=makeBrowser("invite128-a"),guest=makeBrowser("invite128-b");
 host.browser.window.abrirSalaPrivadaDrome();
 host.elem("lobby-select-mode").value="3x3";
 await host.elem("lobby-create-btn").onclick();
 const code=host.elem("lobby-room-code").textContent;
 guest.browser.window.abrirSalaPrivadaDrome();
 guest.elem("lobby-input-code").value=code.toLowerCase();
 await guest.elem("lobby-join-btn").onclick();
 assert.match(guest.elem("lobby-status").textContent,/Sala pronta/);
});
test("v0.1.128: recipient can paste complete original invite into join input",async()=>{
 const host=makeBrowser("invite128-c"),guest=makeBrowser("invite128-d");
 host.browser.window.abrirSalaPrivadaDrome();
 host.elem("lobby-select-mode").value="3x3";
 await host.elem("lobby-create-btn").onclick();
 await host.elem("lobby-copy").onclick();
 const invitation=host.getClipboard();
 assert.match(invitation,/https:\/\/nathanfaccom-coder\.github\.io\/chaotic-go\//);
 guest.browser.window.abrirSalaPrivadaDrome();
 guest.elem("lobby-input-code").value=invitation;
 await guest.elem("lobby-join-btn").onclick();
 assert.match(guest.elem("lobby-status").textContent,/Sala pronta/);
});
test("v0.1.128: copy-only-code gives the exact private room code",async()=>{
 const host=makeBrowser("invite128-e");
 host.browser.window.abrirSalaPrivadaDrome();
 host.elem("lobby-select-mode").value="3x3";
 await host.elem("lobby-create-btn").onclick();
 await host.elem("lobby-copy-code").onclick();
 assert.equal(host.getClipboard(),host.elem("lobby-room-code").textContent);
});
test("v0.1.128: sharing falls back to copied invitation on unsupported Android",async()=>{
 const host=makeBrowser("invite128-f");
 host.browser.window.abrirSalaPrivadaDrome();
 host.elem("lobby-select-mode").value="3x3";
 await host.elem("lobby-create-btn").onclick();
 await host.elem("lobby-share-invite").onclick();
 assert.match(host.getClipboard(),/Convite Chaotic GO/);
 assert.match(host.elem("lobby-notice").textContent,/copiado/);
});
test("v0.1.128: invalid pasted message cannot enter another private room",async()=>{
 const guest=makeBrowser("invite128-g");
 guest.browser.window.abrirSalaPrivadaDrome();
 guest.elem("lobby-input-code").value="Olá, meu ID 111111111111 é outro assunto.";
 await guest.elem("lobby-join-btn").onclick();
 assert.match(guest.elem("lobby-notice").textContent,/Convite inválido/);
});

test("v0.1.132: both previous players accept a new room after training",async()=>{
 const host=makeBrowser("rematch-host"),guest=makeBrowser("rematch-guest");
 host.browser.window.abrirSalaPrivadaDrome();
 host.elem("lobby-select-mode").value="3x3";
 await host.elem("lobby-create-btn").onclick();
 const oldCode=host.elem("lobby-room-code").textContent;
 const oldRoom=[...rooms.values()].find(x=>x.code===oldCode);
 guest.browser.window.abrirSalaPrivadaDrome();
 guest.elem("lobby-input-code").value=oldCode;
 await guest.elem("lobby-join-btn").onclick();
 oldRoom.finished=true; // Mock for a SERVER-confirmed terminal training.
 await host.elem("lobby-rematch-btn").onclick();
 assert.match(host.elem("lobby-notice").textContent,/outro jogador também precisa confirmar/i);
 assert.equal(oldRoom.status,"ready");
 await guest.elem("lobby-rematch-btn").onclick();
 assert.equal(oldRoom.status,"cancelled");
 const newCode=guest.elem("lobby-room-code").textContent;
 assert.notEqual(newCode,oldCode);
 assert.match(guest.elem("lobby-status").textContent,/Sala pronta/);
 await host.elem("lobby-refresh").onclick();
 assert.equal(host.elem("lobby-room-code").textContent,newCode);
 assert.match(host.elem("lobby-status").textContent,/Sala pronta/);
 const next=[...rooms.values()].find(x=>x.code===newCode);
 assert.equal(next.host_id,oldRoom.host_id);
 assert.equal(next.guest_id,oldRoom.guest_id);
 assert.equal(next.mode,oldRoom.mode);
 assert.equal(rematchRequests.get(oldRoom.id).new_lobby_id,next.id);
});
test("v0.1.132: no rematch while a match is still running",async()=>{
 const host=makeBrowser("rematch-running-host"),guest=makeBrowser("rematch-running-guest");
 host.browser.window.abrirSalaPrivadaDrome();
 host.elem("lobby-select-mode").value="1x1";
 await host.elem("lobby-create-btn").onclick();
 const code=host.elem("lobby-room-code").textContent;
 guest.browser.window.abrirSalaPrivadaDrome();
 guest.elem("lobby-input-code").value=code;
 await guest.elem("lobby-join-btn").onclick();
 const room=[...rooms.values()].find(x=>x.code===code);
 await host.elem("lobby-rematch-btn").onclick();
 assert.equal(room.status,"ready");
 assert.equal(rematchRequests.has(room.id),false);
 assert.match(host.elem("lobby-notice").textContent,/só é permitida depois/i);
});
test("v0.1.132: a different account cannot request rematch from another room",async()=>{
 const host=makeBrowser("rematch-protected-host");
 host.browser.window.abrirSalaPrivadaDrome();
 host.elem("lobby-select-mode").value="3x3";
 await host.elem("lobby-create-btn").onclick();
 const room=[...rooms.values()].find(x=>x.code===host.elem("lobby-room-code").textContent);
 room.finished=true;
 const outsider=makeClient("unrelated");
 const answer=await outsider.rpc("chaotic_request_rematch",{p_source_lobby_id:room.id});
 assert.ok(answer.error);
 assert.equal(rematchRequests.has(room.id),false);
});
