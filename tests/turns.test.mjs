import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const rooms=new Map(),matches=new Map(),journals=new Map(),declarations=new Map(),board=new Map(),clashes=new Map(),baseDamage=new Map(),modifiers=new Map(),dice=new Map(),loadouts=new Map(),attackInstances=new Map(),individualDamage=new Map(),equipmentReveals=new Map(),wallets=new Map(),hands=new Map();
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
      if(name==="chaotic_capture_preview_loadout"){
        const match=matches.get(room.id),unit=board.get(room.id+"/"+actor);
        const key=room.id+"/"+actor;
        if(room.mode!=="1x1"||!match||match.status!=="active"||
          match.current_player!==actor||match.turn_no!==args.p_expected_turn||
          !unit||unit.position!==6||loadouts.has(key))
          return {data:null,error:{message:"Ficha não autorizada"}};
        const snapshot={lobby_id:room.id,actor_id:actor,position:6,
          card_instance_id:unit.card_id,creature_name:"Criatura original",
          stats:{c:65,p:55,s:70,v:45,e:65},
          equipment_instance_id:"201",equipment_name:"Equipamento original"};
        loadouts.set(key,snapshot);
        return {data:{...snapshot},error:null};
      }
      if(name==="chaotic_reveal_preview_equipment"){
        const match=matches.get(room.id),loadout=loadouts.get(room.id+"/"+actor);
        const key=room.id+"/"+actor;
        if(!match||room.mode!=="1x1"||match.status!=="active"||
          match.current_player!==actor||match.turn_no!==args.p_expected_turn||
          !loadout?.equipment_instance_id||equipmentReveals.has(key))
          return {data:null,error:{message:"Revelação não autorizada"}};
        const item={lobby_id:room.id,actor_id:actor,
          equipment_instance_id:loadout.equipment_instance_id,
          equipment_name:loadout.equipment_name,revealed_turn:args.p_expected_turn};
        equipmentReveals.set(key,item);
        return {data:{...item},error:null};
      }
      if(name==="chaotic_prepare_preview_hand"){
        const match=matches.get(room.id),player=loadouts.get(room.id+"/"+actor),k=room.id+"/"+actor;
        if(room.mode!=="1x1"||!match||match.status!=="active"||
          match.current_player!==actor||match.turn_no!==args.p_expected_turn||
          !player||wallets.has(k))
          return {data:null,error:{message:"Mão inválida"}};
        wallets.set(k,{lobby_id:room.id,actor_id:actor,deck_slot:1,total_cards:20,
          prepared_turn:match.turn_no,last_draw_turn:match.turn_no,spent_points:0});
        // Deterministic shuffled fixture: slots 3,1,4 are the opening hand,
        // slot 2 is the next drawn card. The DB uses gen_random_uuid().
        const permutation=[2,4,1,3,...Array.from({length:16},(_,i)=>i+5)];
        const cards=[...Array(20)].map((_,i)=>({
          lobby_id:room.id,actor_id:actor,card_slot:i+1,
          draw_position:permutation[i],
          attack_instance_id:String(105+i),
          card_state:permutation[i]<=3?"hand":"deck",spent_turn:null}));
        hands.set(k,cards);
        return {data:{cards_in_hand:3,cards_in_deck:17,points:3},error:null};
      }
      if(name==="chaotic_sync_preview_hand"){
        const match=matches.get(room.id),k=room.id+"/"+actor,wallet=wallets.get(k);
        if(!wallet||!match||match.current_player!==actor||
          match.turn_no!==args.p_expected_turn||(match.turn_no-wallet.prepared_turn)%2!==0)
          return {data:null,error:{message:"Sincronização inválida"}};
        const points=3+Math.floor((match.turn_no-wallet.prepared_turn)/2)-wallet.spent_points;
        let drew=false;
        if(wallet.last_draw_turn<match.turn_no){
          const list=hands.get(k),available=list.filter(x=>x.card_state==="hand");
          const next=list.filter(x=>x.card_state==="deck")
            .sort((a,b)=>a.draw_position-b.draw_position)[0];
          if(next&&available.length<5){next.card_state="hand";drew=true;}
          wallet.last_draw_turn=match.turn_no;
        }
        return {data:{available_points:points,drew_card:drew},error:null};
      }
      if(name==="chaotic_spend_preview_attack"){
        const match=matches.get(room.id),k=room.id+"/"+actor;
        const wallet=wallets.get(k),attack=attackInstances.get(room.id+"/"+args.p_expected_turn);
        const clash=clashes.get(room.id+"/"+args.p_expected_turn);
        const card=hands.get(k)?.find(x=>x.card_slot===attack?.card_slot);
        const balance=wallet&&match?3+Math.floor((match.turn_no-wallet.prepared_turn)/2)
          -wallet.spent_points:-1;
        if(!match||match.current_player!==actor||match.turn_no!==args.p_expected_turn
          ||!wallet||wallet.last_draw_turn!==args.p_expected_turn||!attack
          ||!clash||clash.attacker_id!==actor
          ||!card||card.attack_instance_id!==attack.attack_instance_id
          ||card.card_state!=="hand"||balance<attack.attack_cost)
          return {data:null,error:{message:"Custo ou mão inválida"}};
        card.card_state="spent";card.spent_turn=match.turn_no;
        wallet.spent_points+=attack.attack_cost;
        return {data:{attack_name:attack.attack_name,spent_cost:attack.attack_cost,
          points_left:balance-attack.attack_cost},error:null};
      }
      if(name==="chaotic_capture_preview_attack"){
        const match=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const chosen=(declarations.get(room.id)||[]).find(x=>
          x.actor_id===actor&&x.turn_no===args.p_expected_turn&&x.kind==="attack");
        if(room.mode!=="1x1"||!match||match.status!=="active"||
          match.current_player!==actor||match.turn_no!==args.p_expected_turn||
          !loadouts.has(room.id+"/"+actor)||!chosen||attackInstances.has(key))
          return {data:null,error:{message:"Instância de ataque não autorizada"}};
        const snapshot={lobby_id:room.id,turn_no:match.turn_no,actor_id:actor,
          attack_instance_id:chosen.card_id,catalog_attack_id:"105",
          deck_slot:chosen.deck_slot,card_slot:chosen.card_slot,
          attack_name:"Vento Forte",attack_cost:1,base_damage:5};
        attackInstances.set(key,snapshot);
        return {data:{...snapshot},error:null};
      }
      if(name==="chaotic_calculate_individual_preview"){
        const match=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const clash=clashes.get(key),attack=attackInstances.get(key);
        const attacker=loadouts.get(room.id+"/"+actor);
        const defender=loadouts.get(room.id+"/"+(clash?.defender_id||""));
        if(room.mode!=="1x1"||!match||match.status!=="active"||
          match.current_player!==actor||match.turn_no!==args.p_expected_turn||
          !clash||clash.attacker_id!==actor||!attack||attack.actor_id!==actor||
          !attacker||!defender||attack.attack_instance_id!==clash.attack_card||
          attacker.card_instance_id!==clash.attacker_card||
          defender.card_instance_id!==clash.defender_card||individualDamage.has(key)||
          !hands.get(room.id+"/"+actor)?.some(x=>x.card_slot===attack.card_slot
            &&x.attack_instance_id===attack.attack_instance_id
            &&x.card_state==="spent"&&x.spent_turn===args.p_expected_turn))
          return {data:null,error:{message:"Prévia individual negada"}};
        const special=attack.catalog_attack_id==="104";
        const total=special?null:attack.base_damage;
        const result={lobby_id:room.id,turn_no:match.turn_no,attacker_id:actor,
          defender_id:clash.defender_id,attack_name:attack.attack_name,
          attacker_name:attacker.creature_name,defender_name:defender.creature_name,
          defender_energy_initial:defender.stats.e,base_damage:attack.base_damage,
          elemental_bonus:0,attribute_bonus:0,equipment_bonus:0,
          attack_cost:attack.attack_cost,cost_status:"test_spent",
          attacker_equipment_revealed:equipmentReveals.has(room.id+"/"+actor),
          defender_equipment_revealed:equipmentReveals.has(room.id+"/"+clash.defender_id),
          preview_subtotal:total,
          preview_energy_remaining:total===null?null:Math.max(0,defender.stats.e-total),
          calculation_status:special?"special_resolution_required":"partial_estimate"};
        individualDamage.set(key,result);
        return {data:{...result},error:null};
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
      if(name==="chaotic_roll_preview_die"){
        const match=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const mod=modifiers.get(key),clash=clashes.get(key);
        if(!match||match.status!=="active"||match.current_player!==actor||
           match.turn_no!==args.p_expected_turn||!mod||!clash||
           clash.attacker_id!==actor||clash.attack_card!=="104"||
           mod.formula_status!=="roll_or_special_required"||dice.has(key))
          return {data:null,error:{message:"Dado indisponível ou já rolado"}};
        // Deterministic mock only; SQL uses server-side 1d6.
        const row={lobby_id:room.id,turn_no:match.turn_no,actor_id:actor,
           attack_id:"104",die_faces:6,rolled_value:4,original_base:mod.base_damage,
           multiplied_base:mod.base_damage*4};
        dice.set(key,row);return {data:{...row},error:null};
      }
      if(name==="chaotic_preview_calculate_modifiers"){
        const match=matches.get(room.id);
        const key=room.id+"/"+args.p_expected_turn;
        const clash=clashes.get(key);
        if(!match||match.status!=="active"||match.current_player!==actor||
          match.turn_no!==args.p_expected_turn||!clash||clash.attacker_id!==actor||
          !baseDamage.has(key)||modifiers.has(key))
          return {data:null,error:{message:"Bônus não autorizados"}};
        const dice=clash.attack_card==="104";
        const row={lobby_id:room.id,turn_no:match.turn_no,attacker_id:actor,
          attack_card_id:clash.attack_card,base_damage:5,
          elemental_bonus:0,attribute_bonus:0,
          reference_subtotal:dice?null:5,
          formula_status:dice?"roll_or_special_required":"reference_only"};
        modifiers.set(key,row);return {data:{...row},error:null};
      }
      if(name==="chaotic_preview_calculate_base_damage"){
        const match=matches.get(room.id),clash=clashes.get(room.id+"/"+args.p_expected_turn);
        const key=room.id+"/"+args.p_expected_turn;
        if(!match||match.current_player!==actor||match.turn_no!==args.p_expected_turn||
          !clash||clash.attacker_id!==actor||baseDamage.has(key))
          return {data:null,error:{message:"Cálculo de dano rejeitado"}};
        const attackId=clash.attack_card;
        const status=["104","105"].includes(attackId)?"base_only":"unknown_attack_id";
        const obj={lobby_id:room.id,turn_no:match.turn_no,attacker_id:actor,
          attack_card_id:attackId,attack_name:status==="base_only"?(attackId==="104"?"Fogo Primordial 2.0":"Vento Forte"):null,
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
      assert.ok(["chaotic_lobbies","chaotic_match_turns","chaotic_match_events","chaotic_combat_declarations","chaotic_preview_board","chaotic_preview_clashes","chaotic_preview_damage","chaotic_preview_modifiers","chaotic_preview_dice","chaotic_preview_loadouts","chaotic_preview_attack_instances","chaotic_preview_individual_damage","chaotic_preview_equipment_reveals","chaotic_preview_attack_wallets","chaotic_preview_attack_hand"].includes(table));
      return {select(){return this},eq(_,id){this.id=id;return this},
        then(resolve,reject) {
          const room=rooms.get(this.id);
          const allowed=room&&(room.host_id===actor||room.guest_id===actor);
          const result=!allowed?[]:
            table==="chaotic_preview_board" ?
            [...board.values()].filter(x=>x.lobby_id===this.id).map(x=>({...x})):
            table==="chaotic_preview_loadouts" ?
            [...loadouts.values()].filter(x=>x.lobby_id===this.id).map(x=>({...x})) : [];
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
                :table==="chaotic_preview_modifiers"
                  ?[...modifiers.values()].filter(x=>x.lobby_id===this.id)
                  :table==="chaotic_preview_dice"
                    ?[...dice.values()].filter(x=>x.lobby_id===this.id)
                    :table==="chaotic_preview_attack_instances"
                      ?[...attackInstances.values()].filter(x=>x.lobby_id===this.id)
                      :table==="chaotic_preview_individual_damage"
                        ?[...individualDamage.values()].filter(x=>x.lobby_id===this.id)
                        :table==="chaotic_preview_equipment_reveals"
                          ?[...equipmentReveals.values()].filter(x=>x.lobby_id===this.id)
                          :table==="chaotic_preview_attack_wallets"
                            ?[...wallets.values()].filter(x=>x.lobby_id===this.id&&x.actor_id===actor)
                            :table==="chaotic_preview_attack_hand"
                              ?[...hands.values()].flat().filter(x=>x.lobby_id===this.id&&x.actor_id===actor
                            &&x.card_state!=="deck")
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
  assert.equal(host("lobby-damage-calculate").hidden,true,"Catalog-only previews are hidden for 1x1");
  const oldDamage=await makeClient("duel-host").rpc("chaotic_preview_calculate_base_damage",{
    p_lobby_id:room.id,p_expected_turn:3});
  assert.equal(oldDamage.error,null);
  await host("lobby-turn-refresh").onclick();
  assert.match(host("lobby-damage-history").textContent,/dano BASE 5/);
  assert.match(host("lobby-damage-history").textContent,/energia base 45/);
  assert.equal(baseDamage.get(key).energy_after_base,40);
  assert.equal(host("lobby-modifiers-calculate").hidden,true);
  const oldMods=await makeClient("duel-host").rpc("chaotic_preview_calculate_modifiers",{
    p_lobby_id:room.id,p_expected_turn:3});
  assert.equal(oldMods.error,null);
  await host("lobby-turn-refresh").onclick();
  assert.match(host("lobby-modifiers-history").textContent,/referência do catálogo/);
  assert.equal(modifiers.get(key).reference_subtotal,5);
  assert.equal(host("lobby-modifiers-calculate").hidden,true);
  const repeatMods=await makeClient("duel-host").rpc("chaotic_preview_calculate_modifiers",{
    p_lobby_id:room.id,p_expected_turn:3});
  assert.ok(repeatMods.error);
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

test("Fogo Primordial 2.0 requires dice roll and never shows a fake final damage",async()=>{
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
  assert.equal(out.data.calculation_status,"base_only");
  assert.equal(out.data.base_damage,5);
  const mod=await makeClient("ambig-host").rpc("chaotic_preview_calculate_modifiers",{
    p_lobby_id:room.id,p_expected_turn:1});
  assert.equal(mod.error,null);
  assert.equal(mod.data.formula_status,"roll_or_special_required");
  assert.equal(mod.data.reference_subtotal,null);
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-dice-roll").hidden,true,"Legacy-only controls stay hidden for 1x1");
  const oldDie=await makeClient("ambig-host").rpc("chaotic_roll_preview_die",{
    p_lobby_id:room.id,p_expected_turn:1});
  assert.equal(oldDie.error,null);
  await host("lobby-turn-refresh").onclick();
  assert.match(host("lobby-dice-history").textContent,/🎲 4 de 6/);
  assert.match(host("lobby-dice-history").textContent,/5 × 4 = 20/);
  assert.equal(dice.get(room.id+"/1").multiplied_base,20);
  assert.equal(host("lobby-dice-roll").hidden,true);
  const second=await makeClient("ambig-host").rpc("chaotic_roll_preview_die",{
     p_lobby_id:room.id,p_expected_turn:1});
  assert.ok(second.error,"No rerolls");
  const stranger=await makeClient("outside-user").rpc("chaotic_roll_preview_die",{
     p_lobby_id:room.id,p_expected_turn:1});
  assert.ok(stranger.error,"Only current attacker can roll");
  await host("lobby-turn-refresh").onclick();
  assert.match(host("lobby-modifiers-history").textContent,/exige dado/);
  assert.equal(host("lobby-damage-calculate").hidden,true);
  assert.equal(m.turn_no,1,"No combat state changed");
});

test("1x1 loadout captures DNA and equipment once, only when owned turn is active",async()=>{
  const host=browser("dna-host"),guest=browser("dna-guest");
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  const room=[...rooms.values()].find(x=>x.code===code);
  assert.equal(host("lobby-loadout-capture").hidden,true,"Cannot capture an unplaced creature");
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="6";
  await host("lobby-combat-submit").onclick();
  await host("lobby-hex-place").onclick();
  assert.equal(host("lobby-loadout-capture").hidden,false);
  await host("lobby-loadout-capture").onclick();
  assert.match(host("lobby-loadout-host").textContent,/Energia 65/);
  assert.match(host("lobby-loadout-host").textContent,/Equipamento original/);
  assert.equal(host("lobby-loadout-capture").hidden,true,"Snapshot cannot be overwritten");
  const outsider=await makeClient("outsider").rpc("chaotic_capture_preview_loadout",{
    p_lobby_id:room.id,p_expected_turn:1});
  assert.ok(outsider.error);
  const duplicate=await makeClient("dna-host").rpc("chaotic_capture_preview_loadout",{
    p_lobby_id:room.id,p_expected_turn:1});
  assert.ok(duplicate.error);
  assert.equal(loadouts.get(room.id+"/dna-host").stats.e,65);
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  assert.match(guest("lobby-loadout-host").textContent,/Energia 65/,"Opponent receives the same snapshot");
});


test("1x1 attack instance snapshot is bound to declaration, turn and owner",async()=>{
  const host=browser("attack-host"),guest=browser("attack-guest");
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  guest("lobby-input-code").value=host("lobby-room-code").textContent;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  const id=[...rooms.values()].find(r=>r.host_id==="attack-host").id;
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="6";
  await host("lobby-combat-submit").onclick();
  await host("lobby-hex-place").onclick();
  await host("lobby-loadout-capture").onclick();
  await host("lobby-hand-prepare").onclick();
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  guest("lobby-combat-kind").value="creature";
  guest("lobby-combat-deck").value="1";
  guest("lobby-combat-slot").value="6";
  await guest("lobby-combat-submit").onclick();
  await guest("lobby-hex-place").onclick();
  await guest("lobby-loadout-capture").onclick();
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  await host("lobby-hand-sync").onclick();
  assert.equal(host("lobby-attack-instance-capture").hidden,true);
  host("lobby-combat-kind").value="attack";
  host("lobby-combat-slot").value="1";
  await host("lobby-combat-submit").onclick();
  assert.equal(host("lobby-attack-instance-capture").hidden,false);
  await host("lobby-attack-instance-capture").onclick();
  assert.match(host("lobby-attack-instance-history").textContent,/Vento Forte/);
  assert.match(host("lobby-attack-instance-history").textContent,/catálogo #105/);
  assert.equal(host("lobby-attack-instance-capture").hidden,true);
  assert.equal(attackInstances.get(id+"/3").attack_instance_id,"105");
  const duplicate=await makeClient("attack-host").rpc("chaotic_capture_preview_attack",
    {p_lobby_id:id,p_expected_turn:3});
  assert.ok(duplicate.error);
  const outsider=await makeClient("attack-outsider").rpc("chaotic_capture_preview_attack",
    {p_lobby_id:id,p_expected_turn:3});
  assert.ok(outsider.error);
  await guest("lobby-turn-refresh").onclick();
  assert.match(guest("lobby-attack-instance-history").textContent,/Vento Forte/);
});


test("1x1 DNA preview shows individual energy and never changes actual combat",async()=>{
  const host=browser("dna-preview-host"),guest=browser("dna-preview-guest");
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  guest("lobby-input-code").value=host("lobby-room-code").textContent;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  const id=[...rooms.values()].find(r=>r.host_id==="dna-preview-host").id;
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="6";
  await host("lobby-combat-submit").onclick();
  await host("lobby-hex-place").onclick();
  await host("lobby-loadout-capture").onclick();
  await host("lobby-hand-prepare").onclick();
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  guest("lobby-combat-kind").value="creature";
  guest("lobby-combat-deck").value="1";
  guest("lobby-combat-slot").value="6";
  await guest("lobby-combat-submit").onclick();
  await guest("lobby-hex-place").onclick();
  await guest("lobby-loadout-capture").onclick();
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  await host("lobby-hand-sync").onclick();
  host("lobby-combat-kind").value="attack";
  host("lobby-combat-slot").value="1";
  await host("lobby-combat-submit").onclick();
  await host("lobby-clash-open").onclick();
  assert.equal(host("lobby-individual-damage-calculate").hidden,true,
    "Must validate captured attack first");
  await host("lobby-attack-instance-capture").onclick();
  assert.equal(host("lobby-individual-damage-calculate").hidden,true,
    "No DNA simulation before confirming attack cost");
  assert.equal(host("lobby-hand-spend").hidden,false);
  await host("lobby-hand-spend").onclick();
  assert.equal(host("lobby-individual-damage-calculate").hidden,false);
  assert.equal(host("lobby-damage-calculate").hidden,true,"Legacy preview blocked");
  await host("lobby-individual-damage-calculate").onclick();
  assert.match(host("lobby-individual-damage-history").textContent,/Energia individual inicial 65/);
  assert.match(host("lobby-individual-damage-history").textContent,/65 → 60/);
  assert.match(host("lobby-individual-damage-history").textContent,/HP real inalterado/);
  const row=individualDamage.get(id+"/3");
  assert.equal(row.defender_energy_initial,65);
  assert.equal(row.preview_energy_remaining,60);
  assert.equal(host("lobby-individual-damage-calculate").hidden,true);
  assert.equal(matches.get(id).turn_no,3);
  assert.equal(clashes.get(id+"/3").result,"awaiting_original_engine");
  assert.equal(loadouts.get(id+"/dna-preview-guest").stats.e,65);
  assert.equal(wallets.get(id+"/dna-preview-host").spent_points,1);
  assert.equal(hands.get(id+"/dna-preview-host")[0].card_state,"spent");
  assert.ok((await makeClient("dna-preview-host").rpc("chaotic_calculate_individual_preview",
    {p_lobby_id:id,p_expected_turn:3})).error,"No repeated simulation");
  assert.ok((await makeClient("stranger").rpc("chaotic_calculate_individual_preview",
    {p_lobby_id:id,p_expected_turn:3})).error,"No third-party simulation");
  await guest("lobby-turn-refresh").onclick();
  assert.match(guest("lobby-individual-damage-history").textContent,/65 → 60/);
});


test("1x1 equipment reveal can be done once by owner on own turn, with no HP mutation",async()=>{
  const host=browser("equipment-host"),guest=browser("equipment-guest");
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const id=[...rooms.values()].find(r=>r.host_id==="equipment-host").id;
  guest("lobby-input-code").value=host("lobby-room-code").textContent;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  assert.equal(host("lobby-equipment-reveal").hidden,true,
    "No reveal before a creature has been prepared");
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="6";
  await host("lobby-combat-submit").onclick();
  await host("lobby-hex-place").onclick();
  await host("lobby-loadout-capture").onclick();
  assert.equal(host("lobby-equipment-reveal").hidden,false,
    "Must allow reveal of owned equipment after saving the individual creature");
  const intruder=await makeClient("not-member").rpc("chaotic_reveal_preview_equipment",
    {p_lobby_id:id,p_expected_turn:1});
  assert.ok(intruder.error);
  await host("lobby-equipment-reveal").onclick();
  assert.equal(host("lobby-equipment-reveal").hidden,true);
  assert.match(host("lobby-equipment-reveal-history").textContent,/Equipamento original/);
  assert.equal(equipmentReveals.get(id+"/equipment-host").revealed_turn,1);
  assert.equal(loadouts.get(id+"/equipment-host").stats.e,65);
  const again=await makeClient("equipment-host").rpc("chaotic_reveal_preview_equipment",
    {p_lobby_id:id,p_expected_turn:1});
  assert.ok(again.error);
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  assert.match(guest("lobby-equipment-reveal-history").textContent,/Anfitrião revelou/);
  const wrongTurn=await makeClient("equipment-host").rpc("chaotic_reveal_preview_equipment",
    {p_lobby_id:id,p_expected_turn:2});
  assert.ok(wrongTurn.error);
});


test("1x1 server-owned resource hand rejects wrong actor, insufficient points and replay",async()=>{
 const host=browser("resource-host"),guest=browser("resource-guest");
 host("lobby-select-mode").value="1x1";
 await host("lobby-create-btn").onclick();
 const code=host("lobby-room-code").textContent;
 guest("lobby-input-code").value=code;
 await guest("lobby-join-btn").onclick();
 await host("lobby-refresh").onclick();
 await host("lobby-turn-start").onclick();
 const id=[...rooms.values()].find(x=>x.code===code).id;
 host("lobby-combat-kind").value="creature";
 host("lobby-combat-deck").value="1";
 host("lobby-combat-slot").value="6";
 await host("lobby-combat-submit").onclick();
 await host("lobby-hex-place").onclick();
 await host("lobby-loadout-capture").onclick();
 assert.equal(host("lobby-hand-prepare").hidden,false);
 await host("lobby-hand-prepare").onclick();
 assert.equal(host("lobby-hand-prepare").hidden,true);
 assert.equal(hands.get(id+"/resource-host").filter(x=>x.card_state==="hand").length,3);
 assert.equal(wallets.get(id+"/resource-host").spent_points,0);
 assert.equal(wallets.get(id+"/resource-host").total_cards,20);
 const visible=await makeClient("resource-host").from("chaotic_preview_attack_hand")
   .select("actor_id,card_slot,draw_position,card_state").eq("lobby_id",id)
   .order("draw_position",{ascending:true}).limit(20);
 assert.equal(visible.data.length,3,"Never reveal undealt server deck");
 assert.deepEqual(visible.data.map(x=>x.card_slot).sort((a,b)=>a-b),[1,3,4]);
 assert.equal(host("lobby-hand-spend").hidden,true);
 assert.ok((await makeClient("resource-guest").rpc("chaotic_spend_preview_attack",{
   p_lobby_id:id,p_expected_turn:1})).error);
 assert.ok((await makeClient("resource-host").rpc("chaotic_prepare_preview_hand",{
   p_lobby_id:id,p_expected_turn:1})).error);
 await host("lobby-turn-pass").onclick();
 await guest("lobby-turn-refresh").onclick();
 guest("lobby-combat-kind").value="creature";
 guest("lobby-combat-deck").value="1";
 guest("lobby-combat-slot").value="6";
 await guest("lobby-combat-submit").onclick();
 await guest("lobby-hex-place").onclick();
 await guest("lobby-loadout-capture").onclick();
 await guest("lobby-turn-pass").onclick();
 await host("lobby-turn-refresh").onclick();
 assert.equal(host("lobby-hand-sync").hidden,false);
 await host("lobby-hand-sync").onclick();
 assert.equal(host("lobby-hand-sync").hidden,true);
 assert.equal(hands.get(id+"/resource-host").filter(x=>x.card_state==="hand").length,4);
 assert.equal(hands.get(id+"/resource-host").find(x=>x.card_slot===2).card_state,"hand");
 const visibleNow=await makeClient("resource-host").from("chaotic_preview_attack_hand")
   .select("actor_id,card_slot,draw_position,card_state").eq("lobby_id",id)
   .order("draw_position",{ascending:true}).limit(20);
 assert.equal(visibleNow.data.length,4);
 assert.equal(visibleNow.data.some(x=>x.card_state==="deck"),false);
 host("lobby-combat-kind").value="attack";
 host("lobby-combat-slot").value="1";
 await host("lobby-combat-submit").onclick();
 await host("lobby-clash-open").onclick();
 await host("lobby-attack-instance-capture").onclick();
 const attack=attackInstances.get(id+"/3");
 attack.attack_cost=9;
 assert.ok((await makeClient("resource-host").rpc("chaotic_spend_preview_attack",{
   p_lobby_id:id,p_expected_turn:3})).error,"Insufficient points rejected");
 assert.equal(wallets.get(id+"/resource-host").spent_points,0);
 assert.equal(hands.get(id+"/resource-host")[0].card_state,"hand");
 attack.attack_cost=1;
 const wrong=await makeClient("resource-guest").rpc("chaotic_spend_preview_attack",{
   p_lobby_id:id,p_expected_turn:3});
 assert.ok(wrong.error,"Opponent cannot spend during host turn");
 await host("lobby-hand-spend").onclick();
 assert.equal(wallets.get(id+"/resource-host").spent_points,1);
 assert.equal(hands.get(id+"/resource-host")[0].card_state,"spent");
 assert.equal(hands.get(id+"/resource-host")[0].spent_turn,3);
 assert.match(host("lobby-attack-resource-summary").textContent,/pontos 3/);
 assert.ok((await makeClient("resource-host").rpc("chaotic_spend_preview_attack",{
   p_lobby_id:id,p_expected_turn:3})).error,"Card replay rejected");
 assert.equal(loadouts.get(id+"/resource-guest").stats.e,65);
});
