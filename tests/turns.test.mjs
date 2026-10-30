import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const rooms=new Map(),matches=new Map(),journals=new Map(),declarations=new Map(),board=new Map(),clashes=new Map(),baseDamage=new Map();
let seq=0;
function makeClient(actor) {
  return {
    async rpc(name,args={}) {
      if (name==="chaotic_create_lobby") {
        const room={id:"room"+(++seq),code:"ABCD1234"+String(seq).padStart(4,"0"),
          mode:args.p_mode,host_id:actor,guest_id:null,status:"waiting",
          expires_at:new Date(Date.now()+3600000).toISOString()};
        rooms.set(room.id,room);return {data:{...room},error:null};
      }
      const room=[...rooms.values()].find(r=>r.id===args.p_lobby_id||r.id===args.p_id||r.code===args.p_code);
      if(!room)return {data:null,error:{message:"Sala indisponível"}};
      if(name==="chaotic_join_lobby"){
        if(room.host_id===actor||room.guest_id||room.status!=="waiting")
          return {data:null,error:{message:"Sala indisponível"}};
        room.guest_id=actor;room.status="ready";return {data:{...room},error:null};
      }
      if(name==="chaotic_start_match"){
        if(room.host_id!==actor||room.status!=="ready"||matches.has(room.id))
          return {data:null,error:{message:"Apenas anfitrião pode começar"}};
        const state={lobby_id:room.id,host_id:room.host_id,guest_id:room.guest_id,
          status:"active",current_player:room.host_id,turn_no:1,last_player:null};
        matches.set(room.id,state);
        journals.set(room.id,[{seq:1,actor_id:actor,event_type:"start",turn_no:1}]);
        return {data:{...state},error:null};
      }
      if(name==="chaotic_pass_turn"){
        const state=matches.get(room.id);
        if(!state||state.status!=="active"||room.status!=="ready"
           ||state.current_player!==actor||state.turn_no!==args.p_expected_turn)
          return {data:null,error:{message:"Turno inválido"}};
        state.last_player=actor;state.current_player=actor===state.host_id?state.guest_id:state.host_id;
        state.turn_no++;
        journals.get(room.id).push({seq:state.turn_no,actor_id:actor,event_type:"pass",turn_no:state.turn_no});
        return {data:{...state},error:null};
      }
      if(name==="chaotic_declare_combat_action"){
        const match=matches.get(room.id);
        const values=declarations.get(room.id)||[];
        const hasCreature=values.some(x=>x.actor_id===actor&&x.kind==="creature");
        if(!match || match.status!=="active" || match.current_player!==actor ||
          match.turn_no!==args.p_expected_turn ||
          values.some(x=>x.turn_no===args.p_expected_turn) ||
          (args.p_kind==="attack"&&!hasCreature)||
          (args.p_kind==="creature"&&hasCreature))
          return {data:null,error:{message:"Ação inválida ou fora da vez"}};
        const record={actor_id:actor,turn_no:match.turn_no,kind:args.p_kind,
          deck_slot:args.p_deck_slot,card_slot:args.p_card_slot,
          card_id:args.p_kind==="creature"?"1":"105"};
        values.push(record);declarations.set(room.id,values);
        return {data:record,error:null};
      }
      if(name==="chaotic_place_preview_creature"){
        const match=matches.get(room.id),my=board.get(room.id+"/"+actor);
        const creature=(declarations.get(room.id)||[]).find(x=>x.actor_id===actor&&x.kind==="creature");
        if(!match||match.status!=="active"||match.current_player!==actor||
           match.turn_no!==args.p_expected_turn||!creature||my)
          return {data:null,error:{message:"Posicionamento inválido"}};
        if((room.mode==="1x1"&&creature.card_slot!==6)||
           (room.mode==="3x3"&&(creature.card_slot<4||creature.card_slot>6))||
           (room.mode==="6x6"&&(creature.card_slot<1||creature.card_slot>6)))
          return {data:null,error:{message:"Hexágono do modo inválido"}};
        const tile={lobby_id:room.id,actor_id:actor,card_id:creature.card_id,
          position:creature.card_slot,moved_turn:0};
        board.set(room.id+"/"+actor,tile);return {data:{...tile},error:null};
      }
      if(name==="chaotic_move_preview_creature"){
        const match=matches.get(room.id),tile=board.get(room.id+"/"+actor);
        if(!match||match.status!=="active"||match.current_player!==actor||
          match.turn_no!==args.p_expected_turn||!tile||tile.moved_turn===match.turn_no)
          return {data:null,error:{message:"Movimento fora de turno"}};
        const neighbors={1:[2,4],2:[1,3,4,5],3:[2,5],
          4:[1,2,5,6],5:[2,3,4,6],6:[4,5]};
        const dest=args.p_target_slot;
        if(!(neighbors[tile.position]||[]).includes(dest)||
           (room.mode==="1x1"&&dest!==6)||
           (room.mode==="3x3"&&(dest<4||dest>6)))
          return {data:null,error:{message:"Hexágonos não adjacentes"}};
        tile.position=dest;tile.moved_turn=match.turn_no;
        return {data:{...tile},error:null};
      }
      if(name==="chaotic_open_preview_clash"){
        const match=matches.get(room.id);
        const own=board.get(room.id+"/"+actor);
        const otherId=room.host_id===actor?room.guest_id:room.host_id;
        const enemy=board.get(room.id+"/"+otherId);
        const attack=(declarations.get(room.id)||[]).find(x=>
          x.actor_id===actor && x.kind==="attack" && x.turn_no===args.p_expected_turn);
        const pair=(a,b)=>{
          if(room.mode==="1x1")return a===6&&b===6;
          if(room.mode==="3x3")return [4,5].includes(a)&&[4,5].includes(b);
          return (a===1&&[2,3].includes(b)) ||
            (a===2&&[1,2,3].includes(b)) ||
            (a===3&&[1,2].includes(b));
        };
        const key=room.id+"/"+args.p_expected_turn;
        if(!match || match.status!=="active" || match.current_player!==actor ||
          match.turn_no!==args.p_expected_turn || !own || !enemy || !attack ||
          !pair(own.position,enemy.position) || clashes.has(key))
          return {data:null,error:{message:"Confronto indisponível"}};
        const item={lobby_id:room.id,turn_no:match.turn_no,attacker_id:actor,
          defender_id:otherId,attacker_card:own.card_id,defender_card:enemy.card_id,
          attack_card:attack.card_id,attacker_position:own.position,
          defender_position:enemy.position,result:"awaiting_original_engine"};
        clashes.set(key,item);
        return {data:{...item},error:null};
      }
      if(name==="chaotic_preview_calculate_base_damage"){
        const match=matches.get(room.id),clash=clashes.get(room.id+"/"+args.p_expected_turn);
        const key=room.id+"/"+args.p_expected_turn;
        if(!match||match.current_player!==actor||match.turn_no!==args.p_expected_turn||
          !clash||clash.attacker_id!==actor||baseDamage.has(key))
          return {data:null,error:{message:"Cálculo de dano rejeitado"}};
        const attackId=clash.attack_card;
        const status=attackId==="104"?"ambiguous_attack_id":
          attackId==="105"?"base_only":"unknown_attack_id";
        const obj={lobby_id:room.id,turn_no:match.turn_no,attacker_id:actor,
          attack_card_id:attackId,attack_name:status==="base_only"?"Vento Forte":null,
          base_damage:status==="base_only"?5:null,defender_name:status==="base_only"?"Johnes":null,
          defender_energy_base:status==="base_only"?45:null,
          energy_after_base:status==="base_only"?40:null,calculation_status:status};
        baseDamage.set(key,obj);
        return {data:{...obj},error:null};
      }
      if(name==="chaotic_stop_match"){
        const state=matches.get(room.id);
        if(!state||!["host","guest"].some(a=>a===actor)||state.status!=="active")
          return {data:null,error:{message:"Ação negada"}};
        state.status="finished";
        journals.get(room.id).push({seq:state.turn_no+1,actor_id:actor,event_type:"stop",turn_no:state.turn_no});
        return {data:{...state},error:null};
      }
      if(name==="chaotic_close_lobby"){
        if(actor!==room.host_id)return {data:null,error:{message:"Não autorizado"}};
        room.status="cancelled";return {data:true,error:null};
      }
      if(name==="chaotic_leave_lobby"){
        if(actor!==room.guest_id)return {data:false,error:null};
        room.guest_id=null;room.status="waiting";return {data:true,error:null};
      }
      throw Error(name);
    },
    from(table) {
      assert.ok(["chaotic_lobbies","chaotic_match_turns","chaotic_match_events","chaotic_combat_declarations","chaotic_preview_board","chaotic_preview_clashes","chaotic_preview_damage"].includes(table));
      return {select(){return this},eq(_,id){this.id=id;return this},
        then(resolve,reject) {
          const room=rooms.get(this.id);
          const allowed=room&&(room.host_id===actor||room.guest_id===actor);
          const result=table==="chaotic_preview_board"&&allowed
            ?[...board.values()].filter(x=>x.lobby_id===this.id).map(x=>({...x})):[];
          return Promise.resolve({data:result,error:null}).then(resolve,reject);
        },
        order(){return this;},
        limit(size) {
          const room=rooms.get(this.id);
          const isMember=room&&(room.host_id===actor||room.guest_id===actor);
          const events=isMember?(table==="chaotic_combat_declarations"
            ?(declarations.get(this.id)||[])
            :table==="chaotic_preview_clashes"
              ?[...clashes.values()].filter(x=>x.lobby_id===this.id)
              :table==="chaotic_preview_damage"
                ?[...baseDamage.values()].filter(x=>x.lobby_id===this.id)
                :(journals.get(this.id)||[])):[];
          return Promise.resolve({data:[...events].reverse().slice(0,size),error:null});
        },
        async maybeSingle(){
          const room=rooms.get(this.id);
          const member=room&&(room.host_id===actor||room.guest_id===actor);
          const value=table==="chaotic_lobbies"?room:matches.get(this.id);
          return {data:member&&value?{...value}:null,error:null};
        }};
    }
  };
}
function browser(actor) {
  const nodes=new Map();
  function el(id) {
    if(!nodes.has(id)) nodes.set(id,{
      id,style:{},hidden:false,value:"",textContent:"",isConnected:true,disabled:false,onclick:null,
      classList:{toggle(){},add(){},remove(){}},
      set innerHTML(html) {
        this.raw=html;
        for(const m of html.matchAll(/id="([^"]+)"/g))el(m[1]);
      },
      get innerHTML(){return this.raw||""}
    });
    return nodes.get(id);
  }
  el("tela-menu");el("tela-entrada-drome");
  const document={getElementById:id=>nodes.get(id)||null,querySelectorAll:()=>[]};
  const context={window:{ChaoticAuthUser:{id:actor},ChaoticAuth:{getClient:()=>makeClient(actor)}},
    document,navigator:{clipboard:{writeText:async()=>{}}},
    setInterval:()=>1,clearInterval:()=>{},Date,console};
  vm.runInNewContext(source,context);
  context.window.abrirSalaPrivadaDrome();
  el.crossBoardContact=context.window.chaoticPreviewContact;
  return el;
}
test("ordered turns, replay prevention, unauthorized opponent and stop",async()=>{
  const host=browser("host"),guest=browser("guest");
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  assert.equal(host("lobby-turn-start").hidden,false);
  await host("lobby-turn-start").onclick();
  await guest("lobby-turn-refresh").onclick();
  assert.equal(guest("lobby-turn-count").textContent,"1");
  // Creature selection is only possible on the actor's own turn.
  assert.equal(host("lobby-combat-submit").hidden,false);
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="1";
  await host("lobby-combat-submit").onclick();
  assert.match(host("lobby-combat-history").textContent,/escolheu criatura/);
  assert.equal(host("lobby-combat-submit").hidden,true);
  assert.match(guest("lobby-events").textContent,/iniciou o teste/);
  assert.match(host("lobby-board-host").textContent,/Anfitrião/);
  assert.equal(guest("lobby-turn-pass").hidden,true);
  const room=[...rooms.values()].find(r=>r.code===code);
  assert.ok((await makeClient("guest").rpc("chaotic_pass_turn",{p_lobby_id:room.id,p_expected_turn:1})).error);
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  assert.equal(guest("lobby-turn-pass").hidden,false);
  assert.ok((await makeClient("host").rpc("chaotic_pass_turn",{p_lobby_id:room.id,p_expected_turn:1})).error);
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-turn-count").textContent,"3");
  host("lobby-combat-kind").value="attack";
  host("lobby-combat-slot").value="1";
  await host("lobby-combat-submit").onclick();
  assert.match(host("lobby-combat-history").textContent,/declarou ataque/);
  assert.equal(declarations.get(room.id).length,2);
  const forbidden=await makeClient("intruder").rpc("chaotic_declare_combat_action",{
    p_lobby_id:room.id,p_expected_turn:3,p_kind:"attack",p_deck_slot:1,p_card_slot:1
  });
  assert.ok(forbidden.error);
  assert.match(host("lobby-events").textContent,/passou o turno 1/);
  assert.match(host("lobby-events").textContent,/passou o turno 2/);
  assert.equal(journals.get(room.id).length,3);
  assert.ok((await makeClient("intruder").rpc("chaotic_pass_turn",{p_lobby_id:room.id,p_expected_turn:3})).error);
  await host("lobby-turn-stop").onclick();
  await guest("lobby-turn-refresh").onclick();
  assert.equal(guest("lobby-turn-pass").hidden,true);
  assert.match(guest("lobby-turn-state").textContent,/encerrado/);
  assert.match(guest("lobby-events").textContent,/encerrou o teste/);
  assert.equal(journals.get(room.id).length,4);
  const noExtra = await makeClient("host").rpc("chaotic_pass_turn",{p_lobby_id:room.id,p_expected_turn:3});
  assert.ok(noExtra.error,"Finished test must reject further turns");
  assert.equal(journals.get(room.id).length,4);
});

test("preview board: 3x3 placement, adjacent move and one move per turn",async()=>{
  const host=browser("board-host"),guest=browser("board-guest");
  host("lobby-select-mode").value="3x3";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="4";
  await host("lobby-combat-submit").onclick();
  assert.equal(host("lobby-hex-place").hidden,false);
  await host("lobby-hex-place").onclick();
  assert.match(host("lobby-hex-host-4").textContent,/c4 · #1/);
  assert.equal(host("lobby-hex-move").hidden,false);
  const id=[...rooms.values()].find(x=>x.code===code).id;
  const illegal=await makeClient("board-host").rpc("chaotic_move_preview_creature",{
    p_lobby_id:id,p_expected_turn:1,p_target_slot:1
  });
  assert.ok(illegal.error,"3x3 must reject hex c1");
  host("lobby-hex-destination").value="5";
  await host("lobby-hex-move").onclick();
  assert.match(host("lobby-hex-host-5").textContent,/c5 · #1/);
  const replay=await makeClient("board-host").rpc("chaotic_move_preview_creature",{
    p_lobby_id:id,p_expected_turn:1,p_target_slot:6
  });
  assert.ok(replay.error,"Same player must not move twice in a turn");
  await host("lobby-turn-pass").onclick();
  const enemy=await makeClient("board-host").rpc("chaotic_move_preview_creature",{
    p_lobby_id:id,p_expected_turn:2,p_target_slot:6
  });
  assert.ok(enemy.error,"Not the host's turn");
  await guest("lobby-turn-refresh").onclick();
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  host("lobby-hex-destination").value="6";
  await host("lobby-hex-move").onclick();
  assert.match(host("lobby-hex-host-6").textContent,/c6 · #1/);
  assert.equal(board.get(id+"/board-host").moved_turn,3);
});


test("official DROME cross-board contact matrix is respected",()=>{
  const ui=browser("contact-reader");
  for(const [mode,source,target] of [
    ["1x1",6,6],["3x3",4,4],["3x3",5,4],["6x6",1,3],
    ["6x6",2,2],["6x6",3,1]
  ]) assert.equal(ui.crossBoardContact(mode,source,target),true,
      mode+": c"+source+" should contact c"+target);
  for(const [mode,source,target] of [
    ["1x1",5,6],["3x3",6,4],["3x3",4,6],["6x6",6,6],
    ["6x6",1,1],["6x6",3,3],["6x6",4,5]
  ]) assert.equal(ui.crossBoardContact(mode,source,target),false,
      mode+": c"+source+" must not contact c"+target);
});

test("1x1 encounter requires both placed creatures and an attack on turn",async()=>{
  const host=browser("duel-host"),guest=browser("duel-guest");
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  const room=[...rooms.values()].find(x=>x.code===code);
  // No enemy creature placed => no confrontation even if caller tampers with UI.
  assert.ok((await makeClient("duel-host").rpc("chaotic_open_preview_clash",
    {p_lobby_id:room.id,p_expected_turn:1})).error);
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="6";
  await host("lobby-combat-submit").onclick();
  await host("lobby-hex-place").onclick();
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  guest("lobby-combat-kind").value="creature";
  guest("lobby-combat-deck").value="1";
  guest("lobby-combat-slot").value="6";
  await guest("lobby-combat-submit").onclick();
  await guest("lobby-hex-place").onclick();
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-clash-open").hidden,true,"Attack must be declared first");
  host("lobby-combat-kind").value="attack";
  host("lobby-combat-slot").value="1";
  await host("lobby-combat-submit").onclick();
  assert.equal(host("lobby-clash-open").hidden,false);
  await host("lobby-clash-open").onclick();
  assert.match(host("lobby-clash-history").textContent,/resolução pendente/);
  const key=room.id+"/3";
  assert.equal(clashes.get(key).attack_card,"105");
  assert.equal(host("lobby-damage-calculate").hidden,false);
  await host("lobby-damage-calculate").onclick();
  assert.match(host("lobby-damage-history").textContent,/dano BASE 5/);
  assert.match(host("lobby-damage-history").textContent,/energia base 45/);
  assert.equal(baseDamage.get(key).energy_after_base,40);
  assert.equal(host("lobby-damage-calculate").hidden,true);
  const duplicatePreview=await makeClient("duel-host").rpc("chaotic_preview_calculate_base_damage",
    {p_lobby_id:room.id,p_expected_turn:3});
  assert.ok(duplicatePreview.error,"Base damage cannot be replayed");
  assert.equal(clashes.get(key).result,"awaiting_original_engine");
  const again=await makeClient("duel-host").rpc("chaotic_open_preview_clash",
    {p_lobby_id:room.id,p_expected_turn:3});
  assert.ok(again.error,"Confronto duplicado deve ser rejeitado");
  const intruder=await makeClient("intruder").rpc("chaotic_open_preview_clash",
    {p_lobby_id:room.id,p_expected_turn:3});
  assert.ok(intruder.error,"Terceiro usuário deve ser rejeitado");
});

test("duplicate original attack ID 104 is marked ambiguous, not a damage value",async()=>{
  const host=browser("ambig-host"),guest=browser("ambig-guest");
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  const room=[...rooms.values()].find(x=>x.code===code);
  const m=matches.get(room.id);
  const key=room.id+"/1";
  clashes.set(key,{lobby_id:room.id,turn_no:1,attacker_id:"ambig-host",
    defender_id:"ambig-guest",attack_card:"104",attacker_card:"1",defender_card:"1"});
  const out=await makeClient("ambig-host").rpc("chaotic_preview_calculate_base_damage",{
    p_lobby_id:room.id,p_expected_turn:1});
  assert.equal(out.error,null);
  assert.equal(out.data.calculation_status,"ambiguous_attack_id");
  assert.equal(out.data.base_damage,null);
  await host("lobby-turn-refresh").onclick();
  assert.match(host("lobby-damage-history").textContent,/duplicado no catálogo original/);
  assert.equal(host("lobby-damage-calculate").hidden,true);
  assert.equal(m.turn_no,1,"No combat state changed");
});
