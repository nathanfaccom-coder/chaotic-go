import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const source=await readFile(new URL("../chaotic-lobby.js",import.meta.url),"utf8");
const presence3x3Mock=new Map();
const rooms=new Map(),matches=new Map(),journals=new Map(),declarations=new Map(),board=new Map(),clashes=new Map(),baseDamage=new Map(),modifiers=new Map(),dice=new Map(),loadouts=new Map(),attackInstances=new Map(),individualDamage=new Map(),equipmentReveals=new Map(),wallets=new Map(),hands=new Map(),initiatives=new Map(),locations=new Map(),effectCandidates=new Map(),hpWallets=new Map(),hpEvents=new Map(),resolutionAudits=new Map(),burstWindows=new Map(),burstOrderPlans=new Map(),burstPriority=new Map(),burstPriorityPasses=new Map(),burstMugicIntents=new Map(),burstMugicCounterplans=new Map(),mugicTrainingWallets=new Map(),mugicTrainingSettlements=new Map(),trainingAbilityEvents=new Map(),harpTrainingEvents=new Map(),allies3x3=new Map(),transfers3x3=new Map(),decks3x3=new Map(),hp3x3=new Map(),boardPositions3x3=new Map(),moveEvents3x3=new Map(),contacts3x3=new Map(),attackProjections3x3=new Map(),hand3x3Wallets=new Map(),hand3x3Cards=new Map(),hand3x3Discards=new Map(),hand3x3DrawEvents=new Map(),costChecks3x3=new Map(),attackSpends3x3=new Map(),defenseWindows3x3=new Map(),elementReviews3x3=new Map(),burstEquipmentResponses=new Map(),burstEquipmentEffects=new Map();
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
      if(name==="chaotic_ping_preview_3x3_player"){
        const m=matches.get(room.id);
        if(!m||m.status!=="active"||room.status!=="ready"||room.mode!=="3x3"
         ||![m.host_id,m.guest_id].includes(actor))
          return {data:null,error:{message:"Diagnóstico disponível somente para dois membros ativos"}};
        const key=room.id+"/"+actor,peer=actor===m.host_id?m.guest_id:m.host_id;
        const now=Date.now(),older=presence3x3Mock.get(key);
        const ready=args.p_ready==null?(older?.ready??false):args.p_ready;
        presence3x3Mock.set(key,{ready,lastSeen:now});
        const other=presence3x3Mock.get(room.id+"/"+peer);
        const peerActive=!!other&&other.lastSeen>=now-25000;
        return {data:{
          self_active:true,peer_active:peerActive,
          self_ready:ready,peer_ready:other?.ready??false,
          both_ready_now:ready&&peerActive&&!!other?.ready,
          active_turn:m.turn_no,your_turn:m.current_player===actor,
          training_finished:false,you_won_training:null,
          presence_window_seconds:25,training_only:true,
          official_match_modified:false
        },error:null};
      }
      if(name==="chaotic_get_preview_3x3_safe_inspections"){
        if(![room.host_id,room.guest_id].includes(actor))
          return {data:null,error:{message:"Acesso a inspeções 3x3 negado"}};
        return {data:{creature_checks:[],dynamic_checks:[]},error:null};
      }
      if(name==="chaotic_get_preview_3x3_safe_state"){
        if(![room.host_id,room.guest_id].includes(actor))
          return {data:null,error:{message:"Acesso à formação 3x3 negado"}};
        const scope=(records)=>[...records.values()].filter(x=>x.lobby_id===room.id)
          .map(x=>({...x}));
        return {data:{
          allies:scope(allies3x3),hp_wallets:scope(hp3x3),
          board_positions:scope(boardPositions3x3),move_events:scope(moveEvents3x3),
          token_transfers:scope(transfers3x3)
        },error:null};
      }
      if(name==="chaotic_prepare_preview_3x3_allies"){
        const m=matches.get(room.id), deck=decks3x3.get(actor+"/"+args.p_deck_slot);
        const mine=[...allies3x3.values()].filter(x=>x.lobby_id===room.id&&x.actor_id===actor);
        const caps={Alakazaz:5,Lion:1,Vidal:2,"Xamã":4,Frador:1};
        const cards=deck?.slice(3,6);
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||m.current_player!==actor||room.mode!=="3x3"||room.status!=="ready"
          ||![m.host_id,m.guest_id].includes(actor)||mine.length
          ||!Number.isInteger(args.p_deck_slot)||args.p_deck_slot<1||args.p_deck_slot>3
          ||!Array.isArray(deck)||deck.length<6
          ||cards.some(x=>!x?.id||!Object.hasOwn(caps,x.name))
          ||new Set(cards.map(x=>x.id)).size!==3)
          return {data:null,error:{message:"Invalid 3x3 saved deck or replay"}};
        cards.forEach((card,i)=>allies3x3.set(room.id+"/"+actor+"/"+(i+4),{
          lobby_id:room.id,actor_id:actor,position:i+4,deck_slot:args.p_deck_slot,
          creature_instance_id:card.id,creature_name:card.name,
          starting_tokens:caps[card.name],remaining_tokens:caps[card.name],
          received_tokens:0,official_match_modified:false
        }));
        return {data:{status:"captured_3x3_training_only",count:3,
          mode:"3x3",official_match_modified:false},error:null};
      }
      if(name==="chaotic_prepare_preview_3x3_hp"){
        const m=matches.get(room.id);
        const own=[...allies3x3.values()].filter(x=>x.lobby_id===room.id&&x.actor_id===actor)
          .sort((a,b)=>a.position-b.position);
        const existing=[...hp3x3.values()].filter(x=>x.lobby_id===room.id&&x.actor_id===actor);
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||m.current_player!==actor||room.mode!=="3x3"||room.status!=="ready"
          ||![m.host_id,m.guest_id].includes(actor)||own.length!==3||existing.length)
          return {data:null,error:{message:"Not your turn, invalid 3x3 formation, or HP replay"}};
        const eligible=own.map(x=>{
          const deck=decks3x3.get(actor+"/"+x.deck_slot);
          const card=deck?.[x.position-1];
          return card?.id===x.creature_instance_id&&card?.name===x.creature_name
            &&Number.isInteger(card.energy)&&card.energy>=1&&card.energy<=500
            ?{unit:x,energy:card.energy}:null;
        });
        if(eligible.some(x=>!x))return {data:null,error:{message:"Invalid individual card energy or Deck mismatch"}};
        for(const x of eligible)hp3x3.set(room.id+"/"+actor+"/"+x.unit.position,{
          lobby_id:room.id,actor_id:actor,position:x.unit.position,
          creature_instance_id:x.unit.creature_instance_id,creature_name:x.unit.creature_name,
          hp_initial:x.energy,hp_max:x.energy,hp_remaining:x.energy,
          initialized_turn:m.turn_no,damage_events:0,healing_events:0,
          official_hp_changed:false,official_match_modified:false,
          location_bonuses_applied:false
        });
        return {data:{status:"hp_3x3_training_seeded",count:3,
          official_match_modified:false,location_bonuses_applied:false,
          damage_applied:false},error:null};
      }
      if(name==="chaotic_prepare_preview_3x3_board"){
        const m=matches.get(room.id);
        const own=[...allies3x3.values()].filter(x=>x.lobby_id===room.id&&x.actor_id===actor);
        const hps=own.map(x=>hp3x3.get(room.id+"/"+actor+"/"+x.position));
        const already=[...boardPositions3x3.values()].some(x=>x.lobby_id===room.id&&x.actor_id===actor);
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||m.current_player!==actor||room.mode!=="3x3"||room.status!=="ready"
          ||![m.host_id,m.guest_id].includes(actor)||own.length!==3||already
          ||hps.some((x,i)=>!x||x.creature_instance_id!==own[i].creature_instance_id
            ||x.hp_remaining<=0))
          return {data:null,error:{message:"Cannot seed missing, dead or already positioned 3x3 creatures"}};
        for(const x of own)boardPositions3x3.set(room.id+"/"+actor+"/"+x.position,{
          lobby_id:room.id,actor_id:actor,formation_slot:x.position,
          creature_instance_id:x.creature_instance_id,hex_position:x.position,
          moved_turn:0,official_position_changed:false,official_match_modified:false
        });
        return {data:{status:"3x3_board_preview_prepared",hexes_per_player:6,
          creatures:3,official_match_modified:false},error:null};
      }
      if(name==="chaotic_prepare_preview_3x3_hand"){
        const m=matches.get(room.id),own=[...allies3x3.values()].filter(x=>x.lobby_id===room.id&&x.actor_id===actor);
        const slot=own[0]?.deck_slot,deck=decks3x3.get(actor+"/"+slot);
        const attacks=deck?.attacks;
        const key=room.id+"/"+actor;
        const valid=Array.isArray(attacks)&&attacks.length>=3&&attacks.length<=20
          &&new Set(attacks.map(x=>x.id)).size===attacks.length
          &&attacks.every(x=>x&&x.id&&x.name&&x.quantity!==0
            &&Object.hasOwn({"Ácido Gástrico":1,"Fogo Primordial 2.0":1,"Mão Negra":1},x.name));
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||m.current_player!==actor||room.mode!=="3x3"||room.status!=="ready"
          ||own.length!==3||own.some(x=>x.deck_slot!==slot)
          ||![m.host_id,m.guest_id].includes(actor)||hand3x3Wallets.has(key)
          ||!valid)
          return {data:null,error:{message:"Invalid 3x3 hand seed or replay"}};
        const wallet={lobby_id:room.id,actor_id:actor,deck_slot:slot,
          prepared_turn:m.turn_no,last_draw_turn:m.turn_no,
          total_cards:attacks.length,spent_points:0,recycle_cycles:0,
          official_points_changed:false,official_match_modified:false};
        hand3x3Wallets.set(key,wallet);
        attacks.forEach((card,i)=>hand3x3Cards.set(key+"/"+(i+1),{
          lobby_id:room.id,actor_id:actor,card_slot:i+1,
          attack_instance_id:card.id,draw_position:i+1,draw_cycle:0,recycle_priority:0,
          spent_turn:null,spent_reason:null,
          card_state:i<3?"hand":"deck",original_card_consumed:false
        }));
        return {data:{state:"3x3_private_shuffled_training_hand",
          cards_in_hand:3,cards_in_deck:attacks.length-3,
          points_available:3,official_match_modified:false},error:null};
      }
      if(name==="chaotic_discard_preview_3x3_hand"){
        const m=matches.get(room.id),wallet=hand3x3Wallets.get(room.id+"/"+actor);
        const key=room.id+"/"+args.p_expected_turn+"/"+actor;
        const card=hand3x3Cards.get(room.id+"/"+actor+"/"+args.p_card_slot);
        const turnKey=room.id+"/"+args.p_expected_turn;
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||m.current_player!==actor||room.mode!=="3x3"||room.status!=="ready"
          ||![m.host_id,m.guest_id].includes(actor)
          ||!Number.isInteger(args.p_card_slot)||args.p_card_slot<1||args.p_card_slot>20
          ||!wallet||wallet.last_draw_turn!==m.turn_no
          ||wallet.prepared_turn>m.turn_no||(m.turn_no-wallet.prepared_turn)%2!==0
          ||hand3x3Discards.has(key)||!card||card.card_state!=="hand"
          ||card.spent_turn!=null||contacts3x3.has(turnKey)
          ||attackProjections3x3.has(turnKey)||costChecks3x3.has(turnKey)
          ||attackSpends3x3.has(turnKey)||clashes.has(turnKey)||burstWindows.has(turnKey))
          return {data:null,error:{message:"Cannot discard outside own turn or after contact/attack"}};
        const e={lobby_id:room.id,turn_no:m.turn_no,actor_id:actor,
          card_slot:card.card_slot,attack_instance_id:card.attack_instance_id,
          original_card_consumed:false,training_points_changed:false,
          official_match_modified:false};
        card.card_state="spent";card.spent_turn=m.turn_no;card.spent_reason="discard";
        hand3x3Discards.set(key,e);
        return {data:{...e},error:null};
      }
      if(name==="chaotic_sync_preview_3x3_hand"){
        const m=matches.get(room.id),key=room.id+"/"+actor,w=hand3x3Wallets.get(key);
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||m.current_player!==actor||room.mode!=="3x3"||room.status!=="ready"
          ||!w||args.p_expected_turn<w.last_draw_turn
          ||(args.p_expected_turn-w.prepared_turn)%2!==0)
          return {data:null,error:{message:"Bad turn to synchronize hand"}};
        const own=[...hand3x3Cards.values()].filter(x=>x.lobby_id===room.id&&x.actor_id===actor);
        let drew=false,recycled=0,drawnSlot=null;
        if(w.last_draw_turn<args.p_expected_turn){
          const held=own.filter(x=>x.card_state==="hand");
          if(held.length<5){
            let deckCards=own.filter(x=>x.card_state==="deck");
            if(deckCards.length===0){
              const spent=own.filter(x=>x.card_state==="spent");
              if(spent.length){
                if(w.recycle_cycles>=120)
                  return {data:null,error:{message:"Maximum recycle cycles reached"}};
                w.recycle_cycles++;
                recycled=spent.length;
                for(const item of spent){
                  item.card_state="deck";item.spent_turn=null;item.spent_reason=null;
                  item.draw_cycle=w.recycle_cycles;item.recycle_priority=item.card_slot;
                }
                deckCards=spent;
              }
            }
            const next=deckCards.sort((a,b)=>
              a.draw_cycle-b.draw_cycle||a.recycle_priority-b.recycle_priority||
              a.draw_position-b.draw_position)[0];
            if(next){next.card_state="hand";drew=true;drawnSlot=next.card_slot;}
          }
          w.last_draw_turn=args.p_expected_turn;
          hand3x3DrawEvents.set(room.id+"/"+args.p_expected_turn+"/"+actor,{
            lobby_id:room.id,actor_id:actor,turn_no:m.turn_no,drew_card:drew,
            drawn_card_slot:drawnSlot,recycle_cycle:w.recycle_cycles,
            recycled_count:recycled,
            hand_count_after:own.filter(x=>x.card_state==="hand").length,
            available_points:3+(m.turn_no-w.prepared_turn)/2-w.spent_points,
            official_match_modified:false,original_card_consumed:false
          });
        }
        return {data:{available_points:3+(args.p_expected_turn-w.prepared_turn)/2-w.spent_points,
          drew_card:drew,recycled:recycled>0,recycled_count:recycled,
          recycle_cycle:w.recycle_cycles,turn_no:m.turn_no,cost_not_paid:true},error:null};
      }
      if(name==="chaotic_inspect_preview_3x3_hand_cost"){
        const m=matches.get(room.id),key=room.id+"/"+args.p_expected_turn,
          preview=attackProjections3x3.get(key),w=hand3x3Wallets.get(room.id+"/"+actor);
        const card=hand3x3Cards.get(room.id+"/"+actor+"/"+preview?.attack_card_slot);
        const contact=contacts3x3.get(key);
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||m.current_player!==actor||room.mode!=="3x3"||room.status!=="ready"
          ||!preview||preview.actor_id!==actor||!contact
          ||contact.attacker_id!==actor||contact.attacker_slot!==preview.attacker_slot
          ||!w||w.deck_slot!==preview.attack_deck_slot
          ||w.last_draw_turn!==args.p_expected_turn
          ||(args.p_expected_turn-w.prepared_turn)%2!==0
          ||card?.attack_instance_id!==preview.attack_instance_id||card.card_state!=="hand"
          ||costChecks3x3.has(key))
          return {data:null,error:{message:"Attack not in owner hand, wrong turn or replay"}};
        const points=3+(args.p_expected_turn-w.prepared_turn)/2-w.spent_points;
        const can=points>=preview.attack_cost;
        const event={lobby_id:room.id,turn_no:m.turn_no,actor_id:actor,
          attack_instance_id:preview.attack_instance_id,card_slot:preview.attack_card_slot,
          catalog_attack_id:preview.catalog_attack_id,attack_cost:preview.attack_cost,
          points_available:points,can_afford:can,
          points_after_if_paid:can?points-preview.attack_cost:null,
          hand_verified:true,actual_attack_cost_paid:false,
          original_card_consumed:false,training_hp_changed:false,
          official_match_modified:false};
        costChecks3x3.set(key,event);
        return {data:{...event},error:null};
      }
      if(name==="chaotic_open_preview_3x3_defense_window"){
        const m=matches.get(room.id),turn=args.p_expected_turn,key=room.id+"/"+turn;
        const c=contacts3x3.get(key),p=attackProjections3x3.get(key);
        const paid=attackSpends3x3.get(key),enemy=actor===m?.host_id?m?.guest_id:m?.host_id;
        if(!m||m.status!=="active"||room.status!=="ready"||room.mode!=="3x3"
          ||m.turn_no!==turn||m.current_player!==actor
          ||![m.host_id,m.guest_id].includes(actor)||!enemy
          ||!c||c.attacker_id!==actor||c.defender_id!==enemy||c.damage_applied
          ||!p||p.actor_id!==actor||p.defender_id!==enemy
          ||p.attacker_slot!==c.attacker_slot||p.defender_slot!==c.defender_slot
          ||!paid||paid.actor_id!==actor||paid.attack_instance_id!==p.attack_instance_id
          ||paid.training_attack_cost!==p.attack_cost||!paid.training_points_paid
          ||!paid.training_card_spent||paid.training_damage_applied
          ||defenseWindows3x3.has(key)||clashes.has(key)||burstWindows.has(key))
          return {data:null,error:{message:"Cannot open unpaid or duplicated 3x3 defender window"}};
        const event={lobby_id:room.id,turn_no:turn,attacker_id:actor,defender_id:enemy,
          attacker_slot:c.attacker_slot,defender_slot:c.defender_slot,
          attack_instance_id:paid.attack_instance_id,training_attack_cost:p.attack_cost,
          status:"awaiting_defender",defender_passed_at:null,
          defensive_card_verified:false,defensive_effect_executed:false,
          training_hp_changed:false,official_hp_changed:false,official_match_modified:false};
        defenseWindows3x3.set(key,event);return {data:{...event},error:null};
      }
      if(name==="chaotic_inspect_preview_3x3_elemental_defense"){
        const m=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const w=defenseWindows3x3.get(key),p=attackProjections3x3.get(key);
        const contact=contacts3x3.get(key),paid=attackSpends3x3.get(key);
        const hp=hp3x3.get(room.id+"/"+actor+"/"+w?.defender_slot);
        const attackerHp=hp3x3.get(room.id+"/"+w?.attacker_id+"/"+w?.attacker_slot);
        const catalog={
          "104":{name:"Fogo Primordial 2.0",fire:5,water:0,earth:0,air:0,
            special:"six_sided_base_multiplier"},
          "101":{name:"Ácido Gástrico",fire:5,water:5,earth:0,air:0,special:"none"}
        }[p?.catalog_attack_id];
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||room.status!=="ready"||room.mode!=="3x3"
          ||![m.host_id,m.guest_id].includes(actor)
          ||!w||w.defender_id!==actor||w.attacker_id!==m.current_player
          ||w.status!=="awaiting_defender"||elementReviews3x3.has(key)
          ||!p||p.actor_id!==w.attacker_id||p.defender_id!==actor
          ||p.attack_instance_id!==w.attack_instance_id
          ||p.attack_cost!==w.training_attack_cost
          ||!catalog||catalog.name!==p.attack_name
          ||!contact||contact.attacker_id!==w.attacker_id||contact.defender_id!==actor
          ||contact.attacker_slot!==w.attacker_slot||contact.defender_slot!==w.defender_slot
          ||!paid||!paid.training_points_paid||!paid.training_card_spent
          ||paid.attack_instance_id!==p.attack_instance_id
          ||hp?.creature_instance_id!==contact.defender_creature_instance_id
          ||hp?.hp_remaining!==contact.defender_hp_at_contact||hp?.hp_remaining<=0
          ||attackerHp?.creature_instance_id!==contact.attacker_creature_instance_id
          ||attackerHp?.hp_remaining!==contact.attacker_hp_at_contact
          ||attackerHp?.hp_remaining<=0)
          return {data:null,error:{message:"Only defender can review pending canonical elements"}};
        const event={lobby_id:room.id,turn_no:m.turn_no,attacker_id:w.attacker_id,
          defender_id:actor,attacker_slot:w.attacker_slot,defender_slot:w.defender_slot,
          attack_instance_id:p.attack_instance_id,catalog_attack_id:p.catalog_attack_id,
          attack_name:catalog.name,base_damage:p.base_damage,
          fire_component:catalog.fire,water_component:catalog.water,
          earth_component:catalog.earth,air_component:catalog.air,
          special_resolution:catalog.special,
          attacker_hp_at_contact:contact.attacker_hp_at_contact,
          defender_hp_at_contact:contact.defender_hp_at_contact,
          elemental_eligibility_verified:false,special_effect_executed:false,
          defender_equipment_verified:false,final_damage_calculated:false,
          training_hp_changed:false,official_hp_changed:false,
          official_match_modified:false,inspection_scope:"canonical_attack_components_only"};
        elementReviews3x3.set(key,event);
        return {data:{...event},error:null};
      }
      if(name==="chaotic_pass_preview_3x3_defense"){
        const m=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const window=defenseWindows3x3.get(key);
        if(!m||m.status!=="active"||room.status!=="ready"||room.mode!=="3x3"
          ||m.turn_no!==args.p_expected_turn||![m.host_id,m.guest_id].includes(actor)
          ||!window||window.defender_id!==actor
          ||window.attacker_id!==m.current_player
          ||window.status!=="awaiting_defender"||window.defender_passed_at!==null)
          return {data:null,error:{message:"Only the 3x3 defender may pass, exactly once"}};
        window.status="defender_passed_preview";
        window.defender_passed_at="2026-10-30T00:00:00.000Z";
        return {data:{...window},error:null};
      }
      if(name==="chaotic_spend_preview_3x3_attack"){
        const m=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const contact=contacts3x3.get(key),p=attackProjections3x3.get(key);
        const inspection=costChecks3x3.get(key);
        const w=hand3x3Wallets.get(room.id+"/"+actor);
        const item=hand3x3Cards.get(room.id+"/"+actor+"/"+p?.attack_card_slot);
        const budget=w?3+(args.p_expected_turn-w.prepared_turn)/2-w.spent_points:null;
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||m.current_player!==actor||room.mode!=="3x3"||room.status!=="ready"
          ||![m.host_id,m.guest_id].includes(actor)
          ||!contact||contact.attacker_id!==actor
          ||contact.defender_id!==(actor===m.host_id?m.guest_id:m.host_id)
          ||contact.damage_applied||contact.attack_card_validated
          ||!p||p.actor_id!==actor||p.defender_id!==contact.defender_id
          ||p.attacker_slot!==contact.attacker_slot||p.defender_slot!==contact.defender_slot
          ||p.defender_hp_before!==contact.defender_hp_at_contact
          ||!inspection||inspection.actor_id!==actor
          ||inspection.attack_instance_id!==p.attack_instance_id
          ||inspection.card_slot!==p.attack_card_slot
          ||inspection.catalog_attack_id!==p.catalog_attack_id
          ||inspection.attack_cost!==p.attack_cost
          ||!inspection.hand_verified||!inspection.can_afford
          ||inspection.actual_attack_cost_paid||inspection.original_card_consumed
          ||!w||w.deck_slot!==p.attack_deck_slot
          ||w.last_draw_turn!==m.turn_no||w.prepared_turn>m.turn_no
          ||(m.turn_no-w.prepared_turn)%2!==0
          ||budget<0||budget>65||budget!==inspection.points_available
          ||inspection.points_after_if_paid!==budget-p.attack_cost
          ||budget<p.attack_cost
          ||!item||item.card_state!=="hand"
          ||item.attack_instance_id!==p.attack_instance_id
          ||item.spent_turn!=null||attackSpends3x3.has(key)
          ||clashes.has(key)||burstWindows.has(key))
          return {data:null,error:{message:"Invalid 3x3 hand payment, no balance, old turn or replay"}};
        const ev={lobby_id:room.id,turn_no:m.turn_no,actor_id:actor,
          attack_deck_slot:p.attack_deck_slot,card_slot:p.attack_card_slot,
          attack_instance_id:p.attack_instance_id,catalog_attack_id:p.catalog_attack_id,
          training_attack_cost:p.attack_cost,points_before:budget,
          points_after:budget-p.attack_cost,
          training_points_paid:true,training_card_spent:true,training_damage_applied:false,
          official_points_changed:false,original_card_consumed:false,
          official_hp_changed:false,official_match_modified:false,
          resolution_status:"paid_training_unresolved"};
        w.spent_points+=p.attack_cost;
        item.card_state="spent";
        item.spent_turn=m.turn_no;
        item.spent_reason="attack";
        attackSpends3x3.set(key,ev);
        return {data:{...ev},error:null};
      }
      if(name==="chaotic_prepare_preview_3x3_base_attack"){
        const m=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const contact=contacts3x3.get(key);
        const ally=allies3x3.get(room.id+"/"+actor+"/"+contact?.attacker_slot);
        const myBoard=boardPositions3x3.get(room.id+"/"+actor+"/"+contact?.attacker_slot);
        const enemyBoard=boardPositions3x3.get(room.id+"/"+contact?.defender_id+"/"+contact?.defender_slot);
        const hp=hp3x3.get(room.id+"/"+contact?.defender_id+"/"+contact?.defender_slot);
        const ownHp=hp3x3.get(room.id+"/"+actor+"/"+contact?.attacker_slot);
        const deck=decks3x3.get(actor+"/"+ally?.deck_slot);
        const card=deck?.attacks?.[args.p_attack_card_slot-1];
        const model={"Ácido Gástrico":{catalog:"101",base:10,cost:3},
          "Fogo Primordial 2.0":{catalog:"104",base:5,cost:2},
          "Mão Negra":{catalog:"102",base:0,cost:0}}[card?.name];
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||m.current_player!==actor||room.mode!=="3x3"||room.status!=="ready"
          ||![m.host_id,m.guest_id].includes(actor)||!contact
          ||contact.attacker_id!==actor
          ||contact.defender_id===(actor===m.host_id?m.host_id:m.guest_id)
          ||contact.damage_applied||contact.official_match_modified
          ||!ally||!myBoard||!enemyBoard||!hp||!ownHp
          ||myBoard.hex_position!==contact.attacker_hex
          ||enemyBoard.hex_position!==contact.defender_hex
          ||myBoard.creature_instance_id!==contact.attacker_creature_instance_id
          ||enemyBoard.creature_instance_id!==contact.defender_creature_instance_id
          ||hp.creature_instance_id!==contact.defender_creature_instance_id
          ||hp.hp_remaining!==contact.defender_hp_at_contact
          ||ownHp.hp_remaining!==contact.attacker_hp_at_contact
          ||!Number.isInteger(args.p_attack_card_slot)
          ||args.p_attack_card_slot<1||args.p_attack_card_slot>20
          ||!deck||deck[contact.attacker_slot-1]?.id!==ally.creature_instance_id
          ||!card?.id||!model||card.quantity===0
          ||card.danoBase!==model.base||card.custo!==model.cost
          ||attackProjections3x3.has(key)||clashes.has(key)||burstWindows.has(key))
          return {data:null,error:{message:"Cannot validate original attack or replay base-only projection"}};
        const after=Math.max(0,hp.hp_remaining-model.base);
        const data={lobby_id:room.id,turn_no:m.turn_no,actor_id:actor,
          attack_deck_slot:ally.deck_slot,attack_card_slot:args.p_attack_card_slot,
          attack_instance_id:card.id,catalog_attack_id:model.catalog,
          attack_name:card.name,base_damage:model.base,attack_cost:model.cost,
          attacker_slot:contact.attacker_slot,defender_id:contact.defender_id,
          defender_slot:contact.defender_slot,
          defender_hp_before:hp.hp_remaining,defender_hp_projected:after,
          projected_hp_loss:hp.hp_remaining-after,hypothetical_knockout:after===0,
          attack_in_hand_verified:false,attack_cost_paid:false,
          elemental_damage_applied:false,defensive_effects_resolved:false,
          training_hp_changed:false,official_hp_changed:false,
          original_card_consumed:false,official_match_modified:false,
          calculation_scope:"base_only_unresolved"};
        attackProjections3x3.set(key,data);
        return {data:{...data},error:null};
      }
      if(name==="chaotic_open_preview_3x3_contact"){
        const m=matches.get(room.id),turn=args.p_expected_turn;
        const enemyId=actor===m?.host_id?m?.guest_id:m?.host_id;
        const attacker=boardPositions3x3.get(room.id+"/"+actor+"/"+args.p_attacker_slot);
        const defender=boardPositions3x3.get(room.id+"/"+enemyId+"/"+args.p_defender_slot);
        const attackerHp=hp3x3.get(room.id+"/"+actor+"/"+args.p_attacker_slot);
        const defenderHp=hp3x3.get(room.id+"/"+enemyId+"/"+args.p_defender_slot);
        const key=room.id+"/"+turn;
        const ownCount=[...boardPositions3x3.values()].filter(x=>x.lobby_id===room.id&&x.actor_id===actor).length;
        const enemyCount=[...boardPositions3x3.values()].filter(x=>x.lobby_id===room.id&&x.actor_id===enemyId).length;
        if(!m||m.status!=="active"||m.turn_no!==turn||m.current_player!==actor
          ||room.mode!=="3x3"||room.status!=="ready"||![m.host_id,m.guest_id].includes(actor)
          ||!Number.isInteger(args.p_attacker_slot)||args.p_attacker_slot<4||args.p_attacker_slot>6
          ||!Number.isInteger(args.p_defender_slot)||args.p_defender_slot<4||args.p_defender_slot>6
          ||ownCount!==3||enemyCount!==3||!attacker||!defender
          ||![4,5].includes(attacker.hex_position)||![4,5].includes(defender.hex_position)
          ||attackerHp?.creature_instance_id!==attacker.creature_instance_id
          ||defenderHp?.creature_instance_id!==defender.creature_instance_id
          ||attackerHp.hp_remaining<=0||defenderHp.hp_remaining<=0
          ||contacts3x3.has(key)||clashes.has(key)||burstWindows.has(key))
          return {data:null,error:{message:"Invalid, replayed or non-contacting 3x3 encounter"}};
        const contact={lobby_id:room.id,turn_no:turn,attacker_id:actor,defender_id:enemyId,
          attacker_slot:args.p_attacker_slot,defender_slot:args.p_defender_slot,
          attacker_creature_instance_id:attacker.creature_instance_id,
          defender_creature_instance_id:defender.creature_instance_id,
          attacker_hex:attacker.hex_position,defender_hex:defender.hex_position,
          attacker_hp_at_contact:attackerHp.hp_remaining,
          defender_hp_at_contact:defenderHp.hp_remaining,
          contact_status:"awaiting_validated_attack_preview",
          attack_card_validated:false,damage_applied:false,
          official_match_modified:false,official_hp_changed:false};
        contacts3x3.set(key,contact);
        return {data:{...contact},error:null};
      }
      if(name==="chaotic_move_preview_3x3_unit"){
        const m=matches.get(room.id),key=room.id+"/"+args.p_expected_turn+"/"+actor;
        const own=[...boardPositions3x3.values()].filter(x=>x.lobby_id===room.id&&x.actor_id===actor);
        const b=boardPositions3x3.get(room.id+"/"+actor+"/"+args.p_formation_slot);
        const hp=hp3x3.get(room.id+"/"+actor+"/"+args.p_formation_slot);
        const neighbors={1:[2,4],2:[1,3,4,5],3:[2,5],
          4:[1,2,5,6],5:[2,3,4,6],6:[4,5]};
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||m.current_player!==actor||room.mode!=="3x3"||room.status!=="ready"
          ||![m.host_id,m.guest_id].includes(actor)||own.length!==3||!b
          ||!Number.isInteger(args.p_target_hex)||args.p_target_hex<1||args.p_target_hex>6
          ||b.moved_turn===m.turn_no||moveEvents3x3.has(key)
          ||!hp||hp.creature_instance_id!==b.creature_instance_id||hp.hp_remaining<=0
          ||!neighbors[b.hex_position]?.includes(args.p_target_hex)
          ||own.some(x=>x.hex_position===args.p_target_hex)
          ||clashes.has(room.id+"/"+m.turn_no)||burstWindows.has(room.id+"/"+m.turn_no)
          ||contacts3x3.has(room.id+"/"+m.turn_no))
          return {data:null,error:{message:"Illegal 3x3 movement, replay or occupied ally hex"}};
        const event={lobby_id:room.id,turn_no:m.turn_no,actor_id:actor,
          formation_slot:b.formation_slot,creature_instance_id:b.creature_instance_id,
          from_hex:b.hex_position,to_hex:args.p_target_hex,
          official_position_changed:false,official_match_modified:false,damage_applied:false};
        b.hex_position=args.p_target_hex;b.moved_turn=m.turn_no;
        moveEvents3x3.set(key,event);
        return {data:{...event},error:null};
      }
      if(name==="chaotic_transfer_preview_alakazaz_token"){
        const m=matches.get(room.id);
        const own=[...allies3x3.values()].filter(x=>x.lobby_id===room.id&&x.actor_id===actor);
        const donor=own.find(x=>x.creature_name==="Alakazaz");
        const recv=own.find(x=>x.position===args.p_receiver_position);
        const key=room.id+"/"+args.p_expected_turn+"/"+actor;
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||m.current_player!==actor||room.mode!=="3x3"||room.status!=="ready"
          ||![m.host_id,m.guest_id].includes(actor)||own.length!==3
          ||!donor||donor.remaining_tokens<1||!recv||recv.position===donor.position
          ||recv.creature_instance_id===donor.creature_instance_id
          ||recv.remaining_tokens>=20||transfers3x3.has(key)
          ||clashes.has(room.id+"/"+args.p_expected_turn)
          ||burstWindows.has(room.id+"/"+args.p_expected_turn))
          return {data:null,error:{message:"Invalid Alakazaz transfer or duplicate"}};
        const event={lobby_id:room.id,turn_no:m.turn_no,actor_id:actor,
          donor_position:donor.position,receiver_position:recv.position,
          donor_creature_instance_id:donor.creature_instance_id,
          receiver_creature_instance_id:recv.creature_instance_id,
          donor_creature_name:"Alakazaz",tokens_moved:1,
          donor_before:donor.remaining_tokens,donor_after:donor.remaining_tokens-1,
          receiver_before:recv.remaining_tokens,receiver_after:recv.remaining_tokens+1,
          original_card_consumed:false,official_tokens_changed:false,
          official_match_modified:false};
        donor.remaining_tokens--;recv.remaining_tokens++;recv.received_tokens++;
        transfers3x3.set(key,event);
        return {data:{...event},error:null};
      }
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
           ||state.current_player!==actor||state.turn_no!==args.p_expected_turn
           ||(room.mode==="3x3"&&attackSpends3x3.has(room.id+"/"+args.p_expected_turn)
             &&(defenseWindows3x3.get(room.id+"/"+args.p_expected_turn)?.status!=="defender_passed_preview"
              ||defenseWindows3x3.get(room.id+"/"+args.p_expected_turn)?.attacker_id!==actor))
           ||(room.mode==="1x1"&&burstWindows.has(room.id+"/"+args.p_expected_turn)&&(
              burstWindows.get(room.id+"/"+args.p_expected_turn)?.status==="awaiting_defender"
              ||burstPriority.get(room.id+"/"+args.p_expected_turn)?.priority_status!=="closed_preview"
              ||!burstOrderPlans.has(room.id+"/"+args.p_expected_turn)
              ||[...burstMugicIntents.values()].some(x=>x.lobby_id===room.id
                &&x.turn_no===args.p_expected_turn&&x.intent_status==="queued_unexecuted"))))
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
          card_id:args.p_kind==="creature"?"1":String(104+args.p_card_slot)};
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
          card_instance_id:unit.card_id,creature_name:"Alakazaz",tribe:"Azul",
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
          prepared_turn:match.turn_no,last_draw_turn:match.turn_no,spent_points:0,
          recycle_cycles:0});
        // Deterministic shuffled fixture: slots 3,1,4 are the opening hand,
        // slot 2 is the next drawn card. The DB uses gen_random_uuid().
        const permutation=[2,4,1,3,...Array.from({length:16},(_,i)=>i+5)];
        const cards=[...Array(20)].map((_,i)=>({
          lobby_id:room.id,actor_id:actor,card_slot:i+1,
          draw_position:permutation[i],draw_cycle:0,recycle_priority:null,
          attack_instance_id:String(105+i),spent_reason:null,
          card_state:permutation[i]<=3?"hand":"deck",spent_turn:null}));
        hands.set(k,cards);
        return {data:{cards_in_hand:3,cards_in_deck:17,points:3},error:null};
      }
      if(name==="chaotic_discard_preview_attack"){
        const match=matches.get(room.id),k=room.id+"/"+actor;
        const wallet=wallets.get(k),cards=hands.get(k);
        const slot=args.p_card_slot;
        const card=cards?.find(x=>x.card_slot===slot);
        if(!match||match.status!=="active"||match.current_player!==actor
          ||match.turn_no!==args.p_expected_turn||!wallet
          ||wallet.last_draw_turn!==args.p_expected_turn
          ||!Number.isInteger(slot)||!card||card.card_state!=="hand"
          ||attackInstances.get(room.id+"/"+args.p_expected_turn)?.attack_instance_id===card.attack_instance_id)
          return {data:null,error:{message:"Descarte indisponível"}};
        card.card_state="spent";card.spent_turn=match.turn_no;card.spent_reason="discard";
        return {data:{discarded_slot:slot,attack_instance_id:card.attack_instance_id,
          turn_no:match.turn_no},error:null};
      }
      if(name==="chaotic_sync_preview_hand"){
        const match=matches.get(room.id),k=room.id+"/"+actor,wallet=wallets.get(k);
        if(!wallet||!match||match.current_player!==actor||
          match.turn_no!==args.p_expected_turn||(match.turn_no-wallet.prepared_turn)%2!==0)
          return {data:null,error:{message:"Sincronização inválida"}};
        const points=3+Math.floor((match.turn_no-wallet.prepared_turn)/2)-wallet.spent_points;
        let drew=false,recycled=false;
        if(wallet.last_draw_turn<match.turn_no){
          const list=hands.get(k),available=list.filter(x=>x.card_state==="hand");
          if(available.length<5&&!list.some(x=>x.card_state==="deck")){
            const spent=list.filter(x=>x.card_state==="spent");
            if(spent.length){
              wallet.recycle_cycles+=1;
              spent.forEach((x,i)=>{
                x.card_state="deck";x.spent_turn=null;x.spent_reason=null;
                x.draw_cycle=wallet.recycle_cycles;x.recycle_priority=String(spent.length-i);
              });
              recycled=true;
            }
          }
          const next=list.filter(x=>x.card_state==="deck")
            .sort((a,b)=>(a.draw_cycle-b.draw_cycle)||
              String(a.recycle_priority??"").localeCompare(String(b.recycle_priority??""))||
              (a.draw_position-b.draw_position))[0];
          if(next&&available.length<5){next.card_state="hand";drew=true;}
          wallet.last_draw_turn=match.turn_no;
        }
        return {data:{available_points:points,drew_card:drew,recycled},error:null};
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
        card.card_state="spent";card.spent_turn=match.turn_no;card.spent_reason="attack";
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
          !loadouts.has(room.id+"/"+actor)||!chosen||attackInstances.has(key)||
          wallets.get(room.id+"/"+actor)?.last_draw_turn!==args.p_expected_turn||
          !hands.get(room.id+"/"+actor)?.some(x=>x.card_slot===chosen.card_slot
            &&x.attack_instance_id===chosen.card_id&&x.card_state==="hand"))
          return {data:null,error:{message:"Instância de ataque não autorizada"}};
        const snapshot={lobby_id:room.id,turn_no:match.turn_no,actor_id:actor,
          attack_instance_id:chosen.card_id,catalog_attack_id:chosen.card_id,
          deck_slot:chosen.deck_slot,card_slot:chosen.card_slot,
          attack_name:chosen.card_id==="107"?"Armadilha de Vinha":"Vento Forte",
          attack_cost:1,base_damage:5};
        attackInstances.set(key,snapshot);
        return {data:{...snapshot},error:null};
      }
      if(name==="chaotic_capture_preview_room_location"){
        const match=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const clash=clashes.get(key),attacker=loadouts.get(room.id+"/"+actor);
        const defender=loadouts.get(room.id+"/"+(clash?.defender_id||""));
        if(room.mode!=="1x1"||!match||match.status!=="active"
         ||match.current_player!==actor||match.turn_no!==args.p_expected_turn
         ||!clash||clash.attacker_id!==actor||!attacker||!defender
         ||locations.has(room.id)||[...initiatives.values()].some(x=>x.lobby_id===room.id))
         return {data:null,error:{message:"Local não autorizado"}};
        const id=actor.startsWith("location-power")?502:actor.startsWith("location-speed")?503:501;
        const entry={lobby_id:room.id,selected_by:actor,selected_turn:match.turn_no,
          catalog_location_id:id,location_name:id===501?"Cidade de Kiru":
            id===502?"O Túnel da Tempestade":"A Barragem de Magma",
          attribute_code:id===501?"s":id===502?"p":"v"};
        locations.set(room.id,entry);
        return {data:{...entry},error:null};
      }
      if(name==="chaotic_capture_preview_initiative"){
        const match=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const clash=clashes.get(key),attacker=loadouts.get(room.id+"/"+actor);
        const defender=loadouts.get(room.id+"/"+(clash?.defender_id||""));
        if(room.mode!=="1x1"||!match||match.status!=="active"
          ||match.current_player!==actor||match.turn_no!==args.p_expected_turn
          ||!clash||clash.attacker_id!==actor||!attacker||!defender
          ||attacker.card_instance_id!==clash.attacker_card
          ||defender.card_instance_id!==clash.defender_card||initiatives.has(key))
          return {data:null,error:{message:"Iniciativa não autorizada"}};
        const loc=locations.get(room.id),attr=loc?.attribute_code||"v";
        const av=attacker.stats[attr],dv=defender.stats[attr];
        const winner=av>=dv?actor:clash.defender_id;
        const item={lobby_id:room.id,turn_no:match.turn_no,attacker_id:actor,
          defender_id:clash.defender_id,attacker_value:av,
          defender_value:dv,winning_player:winner,
          tie_favors_attacker:av===dv,attribute_code:attr,
          location_id:loc?.catalog_location_id||null,
          attribute_source:loc?"preview_location_deck":"no_location_speed_default"};
        initiatives.set(key,item);
        return {data:{...item},error:null};
      }
      if(name==="chaotic_open_preview_burst"){
        const m=matches.get(room.id),k=room.id+"/"+args.p_expected_turn;
        const cl=clashes.get(k),atk=attackInstances.get(k);
        if(room.mode!=="1x1"||room.status!=="ready"||!m||m.status!=="active"
          ||m.turn_no!==args.p_expected_turn||m.current_player!==actor
          ||cl?.attacker_id!==actor||!cl?.defender_id||atk?.actor_id!==actor
          ||atk?.attack_instance_id!==cl?.attack_card
          ||individualDamage.has(k)||burstWindows.has(k))
          return {data:null,error:{message:"Abertura de Burst não permitida"}};
        const item={lobby_id:room.id,turn_no:m.turn_no,attacker_id:actor,
          defender_id:cl.defender_id,attack_instance_id:cl.attack_card,
          status:"awaiting_defender",defender_response:null,
          burst_fully_resolved:false,final_damage_verified:false};
        burstWindows.set(k,item);
        return {data:{...item},error:null};
      }
      if(name==="chaotic_pass_preview_burst"){
        const m=matches.get(room.id),k=room.id+"/"+args.p_expected_turn;
        const win=burstWindows.get(k);
        if(room.mode!=="1x1"||room.status!=="ready"||!m||m.status!=="active"
          ||m.turn_no!==args.p_expected_turn||win?.status!=="awaiting_defender"
          ||win.defender_id!==actor||win.attacker_id!==m.current_player)
          return {data:null,error:{message:"Somente defensor pode PASSAR"}};
        win.status="defender_passed";win.defender_response="pass";
        return {data:{...win},error:null};
      }
      if(name==="chaotic_acknowledge_preview_air_immunity"){
        const m=matches.get(room.id),k=room.id+"/"+args.p_expected_turn;
        const win=burstWindows.get(k),cl=clashes.get(k),atk=attackInstances.get(k);
        const defender=loadouts.get(room.id+"/"+actor);
        const revealed=equipmentReveals.get(room.id+"/"+actor);
        const air=atk?.catalog_attack_id==="110";
        const isRex=defender?.creature_name==="Rex";
        const amulet=defender?.equipment_name==="Amuleto do Vácuo"
          &&revealed?.equipment_instance_id===defender.equipment_instance_id
          &&revealed?.equipment_name===defender.equipment_name;
        if(room.mode!=="1x1"||room.status!=="ready"||!m||m.status!=="active"
          ||m.turn_no!==args.p_expected_turn||win?.status!=="awaiting_defender"
          ||win.defender_id!==actor||win.attacker_id!==m.current_player
          ||cl?.defender_id!==actor||cl?.defender_card!==defender?.card_instance_id
          ||atk?.actor_id!==win.attacker_id||atk?.attack_instance_id!==win.attack_instance_id
          ||!air||(!isRex&&!amulet))
          return {data:null,error:{message:"Imunidade de Ar não autorizada"}};
        win.status="defender_immunity_noted";
        win.defender_response="acknowledge_air_immunity";
        win.defensive_immunity_source=isRex?"rex_air":"vacuum_amulet_air";
        return {data:{...win},error:null};
      }
      if(name==="chaotic_queue_preview_burst_equipment"){
        const m=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const win=burstWindows.get(key),clash=clashes.get(key);
        const unit=loadouts.get(room.id+"/"+actor);
        if(room.mode!=="1x1"||room.status!=="ready"||!m||m.status!=="active"
          ||m.turn_no!==args.p_expected_turn||win?.status!=="awaiting_defender"
          ||win.defender_id!==actor||win.attacker_id!==m.current_player
          ||clash?.defender_id!==actor||clash?.defender_card!==unit?.card_instance_id
          ||!unit?.equipment_instance_id||!unit?.equipment_name
          ||equipmentReveals.has(room.id+"/"+actor)
          ||burstEquipmentResponses.has(key)||burstOrderPlans.has(key)
          ||[...burstEquipmentEffects.values()].some(x=>
            x.lobby_id===room.id&&x.defender_id===actor
            &&x.equipment_instance_id===unit.equipment_instance_id))
          return {data:null,error:{message:"Revelação de equipamento indisponível"}};
        const queued={lobby_id:room.id,turn_no:m.turn_no,defender_id:actor,
          creature_instance_id:unit.card_instance_id,
          equipment_instance_id:unit.equipment_instance_id,
          equipment_name:unit.equipment_name,
          response_kind:"declare_equipment_reveal",
          resolution_status:"queued_unexecuted",
          equipment_actually_revealed:false,
          official_match_modified:false};
        burstEquipmentResponses.set(key,queued);
        return {data:{...queued},error:null};
      }
      if(name==="chaotic_apply_preview_burst_equipment_effect"){
        const m=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const win=burstWindows.get(key),q=burstEquipmentResponses.get(key);
        const plan=burstOrderPlans.get(key);
        const unit=loadouts.get(room.id+"/"+q?.defender_id);
        const wallet=hpWallets.get(room.id+"/"+q?.defender_id);
        const name=(q?.equipment_name||"").toLowerCase();
        const effects={
          "anel precioso":"precious_ring_hp",
          "bastão da sabedoria":"wisdom_staff",
          "bastao da sabedoria":"wisdom_staff",
          "bomba de fogo":"fire_bomb_hp"
        };
        if(room.mode!=="1x1"||room.status!=="ready"||!m||m.status!=="active"
          ||m.turn_no!==args.p_expected_turn||m.current_player!==actor
          ||win?.attacker_id!==actor||win.status!=="defender_passed"
          ||q?.defender_id!==win.defender_id
          ||plan?.attacker_id!==actor||plan.inspection_step_count!==2
          ||plan.inspection_steps[0].stage!=="inspect_queued_equipment_reveal"
          ||plan.inspection_steps[1].stage!=="inspect_attack"
          ||unit?.card_instance_id!==q.creature_instance_id
          ||unit?.equipment_instance_id!==q.equipment_instance_id
          ||unit?.equipment_name!==q.equipment_name
          ||wallet?.creature_instance_id!==q.creature_instance_id
          ||!effects[name]||burstEquipmentEffects.has(key)
          ||equipmentReveals.has(room.id+"/"+q.defender_id)
          ||[...burstEquipmentEffects.values()].some(x=>
            x.lobby_id===room.id&&x.defender_id===q.defender_id
            &&x.equipment_instance_id===q.equipment_instance_id))
          return {data:null,error:{message:"Efeito de treinamento indisponível"}};
        const before=wallet.hp_remaining,max=wallet.hp_max,wis=unit.stats.s;
        const after=effects[name]==="precious_ring_hp"?Math.max(0,before-15)
          :effects[name]==="fire_bomb_hp"?before+5:before;
        const afterMax=max+(effects[name]==="fire_bomb_hp"?5:0);
        const afterWis=wis+(effects[name]==="wisdom_staff"?40:0);
        wallet.hp_remaining=after;wallet.hp_max=afterMax;
        const entry={lobby_id:room.id,turn_no:m.turn_no,attacker_id:actor,
          defender_id:q.defender_id,creature_instance_id:q.creature_instance_id,
          equipment_instance_id:q.equipment_instance_id,equipment_name:q.equipment_name,
          effect_code:effects[name],hp_before:before,hp_after:after,
          hp_max_before:max,hp_max_after:afterMax,wisdom_before:wis,
          wisdom_after:afterWis,resolution_status:"training_ledger_applied",
          applied_to_training_ledger:true,applied_to_official_match:false,
          official_hp_changed:false,final_damage_verified:false};
        burstEquipmentEffects.set(key,entry);
        return {data:{...entry},error:null};
      }
      if(name==="chaotic_open_preview_burst_priority"){
        const m=matches.get(room.id),k=room.id+"/"+args.p_expected_turn,w=burstWindows.get(k);
        if(room.mode!=="1x1"||room.status!=="ready"||!m||m.status!=="active"
          ||m.current_player!==actor||m.turn_no!==args.p_expected_turn
          ||w?.attacker_id!==actor||!["defender_passed","defender_immunity_noted"].includes(w?.status)
          ||burstPriority.has(k)||burstOrderPlans.has(k)||individualDamage.has(k))
          return {data:null,error:{message:"Cannot open priority"}};
        const state={lobby_id:room.id,turn_no:m.turn_no,attacker_id:actor,
          defender_id:w.defender_id,next_actor_id:actor,consecutive_passes:0,
          priority_status:"awaiting_priority",official_match_modified:false,
          burst_fully_resolved:false,final_damage_verified:false};
        burstPriority.set(k,state);return {data:{...state},error:null};
      }
      if(name==="chaotic_pass_preview_burst_priority"){
        const m=matches.get(room.id),k=room.id+"/"+args.p_expected_turn;
        const state=burstPriority.get(k),w=burstWindows.get(k);
        if(room.mode!=="1x1"||room.status!=="ready"||!m||m.status!=="active"
          ||m.turn_no!==args.p_expected_turn||m.current_player!==w?.attacker_id
          ||![m.host_id,m.guest_id].includes(actor)
          ||state?.next_actor_id!==actor||state?.priority_status!=="awaiting_priority"
          ||state.defender_id!==w.defender_id||burstOrderPlans.has(k)||individualDamage.has(k))
          return {data:null,error:{message:"Priority is not yours"}};
        const events=burstPriorityPasses.get(k)||[];
        events.push({lobby_id:room.id,turn_no:m.turn_no,pass_seq:events.length+1,
          actor_id:actor,action_type:"pass",official_match_modified:false});
        burstPriorityPasses.set(k,events);
        state.consecutive_passes=events.length;
        state.priority_status=events.length===2?"closed_preview":"awaiting_priority";
        state.next_actor_id=events.length===2?null:state.defender_id;
        return {data:{...state},error:null};
      }
      if(name==="chaotic_queue_preview_burst_mugic"){
        const m=matches.get(room.id),k=room.id+"/"+args.p_expected_turn;
        const w=burstWindows.get(k),p=burstPriority.get(k),unit=loadouts.get(room.id+"/"+actor);
        const id=args.p_catalog_mugic_id;
        if(!m||m.status!=="active"||room.mode!=="1x1"||room.status!=="ready"
          ||m.turn_no!==args.p_expected_turn||![m.host_id,m.guest_id].includes(actor)
          ||w?.attacker_id!==m.current_player
          ||!["defender_passed","defender_immunity_noted"].includes(w?.status)
          ||p?.priority_status!=="awaiting_priority"||p.next_actor_id!==actor
          ||!unit||!["301","302"].includes(id)
          ||burstOrderPlans.has(k)||individualDamage.has(k)
          ||burstMugicIntents.has(k+"/"+actor))
          return {data:null,error:{message:"Mugic original indisponível no Deck de treinamento"}};
        const entry={lobby_id:room.id,turn_no:m.turn_no,actor_id:actor,
          card_instance_id:"test-mugic-"+id,catalog_mugic_id:id,
          mugic_name:id==="301"?"Canção da Criação":"Canção da Rejeição",
          intent_status:"queued_unexecuted",consumes_card:false,consumes_tokens:false,
          applied_to_official_match:false,effect_executed:false};
        burstMugicIntents.set(k+"/"+actor,entry);
        return {data:{...entry},error:null};
      }
      if(name==="chaotic_cancel_preview_burst_mugic"){
        const m=matches.get(room.id),k=room.id+"/"+args.p_expected_turn;
        const entry=burstMugicIntents.get(k+"/"+actor);
        if(!m||m.status!=="active"||m.turn_no!==args.p_expected_turn
          ||entry?.intent_status!=="queued_unexecuted"
          ||burstOrderPlans.has(k)||individualDamage.has(k))
          return {data:null,error:{message:"Intenção não cancelável"}};
        entry.intent_status="cancelled";
        return {data:{...entry},error:null};
      }
      if(name==="chaotic_discard_preview_harp_for_token"){
        const m=matches.get(room.id),key=room.id+"/"+actor;
        const unit=loadouts.get(key),reveal=equipmentReveals.get(key);
        const wallet=mugicTrainingWallets.get(key);
        if(room.mode!=="1x1"||room.status!=="ready"||!m||m.status!=="active"
           ||m.current_player!==actor||m.turn_no!==args.p_expected_turn
           ||![m.host_id,m.guest_id].includes(actor)
           ||unit?.equipment_name!=="Arpa Mágica"||!unit.equipment_instance_id
           ||reveal?.equipment_name!=="Arpa Mágica"
           ||reveal.equipment_instance_id!==unit.equipment_instance_id
           ||reveal.revealed_turn>args.p_expected_turn
           ||wallet?.creature_instance_id!==unit.card_instance_id
           ||wallet?.creature_name!==unit.creature_name
           ||(wallet.bonus_tokens||0)!==0||wallet.remaining_tokens>=20
           ||harpTrainingEvents.has(key)
           ||clashes.has(room.id+"/"+args.p_expected_turn)
           ||burstWindows.has(room.id+"/"+args.p_expected_turn)
           ||individualDamage.has(room.id+"/"+args.p_expected_turn))
          return {data:null,error:{message:"Original harp unrevealed, already spent or outside turn"}};
        const event={lobby_id:room.id,actor_id:actor,turn_no:m.turn_no,
          creature_instance_id:unit.card_instance_id,
          equipment_instance_id:unit.equipment_instance_id,equipment_name:"Arpa Mágica",
          token_gain:1,tokens_before:wallet.remaining_tokens,
          tokens_after:wallet.remaining_tokens+1,
          equipment_discarded_training:true,original_equipment_discarded:false,
          official_tokens_changed:false,official_match_modified:false,effect_scope:"training_only"};
        wallet.remaining_tokens+=1;
        wallet.bonus_tokens=(wallet.bonus_tokens||0)+1;
        harpTrainingEvents.set(key,event);
        return {data:{...event},error:null};
      }
      if(name==="chaotic_apply_preview_ability_heal"){
        const m=matches.get(room.id),unit=loadouts.get(room.id+"/"+actor);
        const target=loadouts.get(room.id+"/"+args.p_target_actor_id);
        const wallet=mugicTrainingWallets.get(room.id+"/"+actor);
        const hp=hpWallets.get(room.id+"/"+args.p_target_actor_id);
        const k=room.id+"/"+args.p_expected_turn+"/"+actor;
        const ability={Lion:"lion_energy_10",Vidal:"vidal_heal_15","Xamã":"xama_heal_10"}[unit?.creature_name];
        if(room.mode!=="1x1"||room.status!=="ready"||!m||m.status!=="active"
           ||m.current_player!==actor||m.turn_no!==args.p_expected_turn
           ||![m.host_id,m.guest_id].includes(args.p_target_actor_id)
           ||!ability||!target||!hp||hp.hp_remaining<1
           ||wallet?.creature_name!==unit.creature_name
           ||wallet.creature_instance_id!==unit.card_instance_id||wallet.remaining_tokens<1
           ||hp.creature_instance_id!==target.card_instance_id
           ||(unit.creature_name==="Lion"&&args.p_target_actor_id!==actor)
           ||trainingAbilityEvents.has(k)||clashes.has(room.id+"/"+args.p_expected_turn)
           ||burstWindows.has(room.id+"/"+args.p_expected_turn)
           ||individualDamage.has(room.id+"/"+args.p_expected_turn)
           ||(unit.creature_name==="Lion"&&(hp.hp_max>540||hp.hp_remaining>540)))
          return {data:null,error:{message:"Ability not allowed in this turn/target/HP/token state"}};
        const nextMax=hp.hp_max+(ability==="lion_energy_10"?10:0);
        const nextHp=ability==="lion_energy_10"?hp.hp_remaining+10:
          Math.min(hp.hp_max,hp.hp_remaining+(ability==="vidal_heal_15"?15:10));
        const result={lobby_id:room.id,turn_no:m.turn_no,actor_id:actor,
          target_actor_id:args.p_target_actor_id,
          source_creature_name:unit.creature_name,ability_code:ability,
          source_creature_instance_id:unit.card_instance_id,
          target_creature_instance_id:target.card_instance_id,
          token_cost:1,tokens_before:wallet.remaining_tokens,
          tokens_after:wallet.remaining_tokens-1,
          hp_before:hp.hp_remaining,hp_after:nextHp,
          hp_max_before:hp.hp_max,hp_max_after:nextMax,
          applied_to_training:true,official_match_modified:false,official_hp_changed:false,
          official_tokens_consumed:false};
        wallet.remaining_tokens--;
        hp.hp_remaining=nextHp;hp.hp_max=nextMax;
        trainingAbilityEvents.set(k,result);
        return {data:{...result},error:null};
      }
      if(name==="chaotic_prepare_preview_mugic_token_wallet"){
        const m=matches.get(room.id),unit=loadouts.get(room.id+"/"+actor);
        if(!m||m.status!=="active"||room.status!=="ready"||room.mode!=="1x1"
           ||m.turn_no!==args.p_expected_turn||![m.host_id,m.guest_id].includes(actor)
           ||!unit||!["Alakazaz","Lion","Vidal","Xamã"].includes(unit.creature_name))
          return {data:null,error:{message:"Missing authentic creature loadout"}};
        const key=room.id+"/"+actor;
        if(!mugicTrainingWallets.has(key)){
          const caps={Alakazaz:5,Lion:1,Vidal:2,"Xamã":4};
          mugicTrainingWallets.set(key,{
            lobby_id:room.id,actor_id:actor,creature_instance_id:unit.card_instance_id,
            creature_name:unit.creature_name,starting_tokens:caps[unit.creature_name],
            remaining_tokens:caps[unit.creature_name],
            official_match_modified:false
          });
        }
        return {data:{...mugicTrainingWallets.get(key)},error:null};
      }
      if(name==="chaotic_simulate_preview_mugic_counter_cost"){
        const m=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const w=burstWindows.get(key),priority=burstPriority.get(key);
        const plan=burstMugicCounterplans.get(key);
        const c=burstMugicIntents.get(key+"/"+actor),d=burstMugicIntents.get(key+"/"+w?.defender_id);
        const wa=mugicTrainingWallets.get(room.id+"/"+actor),wd=mugicTrainingWallets.get(room.id+"/"+w?.defender_id);
        if(!m||m.status!=="active"||m.current_player!==actor||m.turn_no!==args.p_expected_turn
           ||room.mode!=="1x1"||room.status!=="ready"
           ||w?.attacker_id!==actor||priority?.priority_status!=="closed_preview"
           ||!plan||plan.attacker_id!==actor||plan.defender_id!==w.defender_id
           ||c?.catalog_mugic_id!=="301"||d?.catalog_mugic_id!=="302"
           ||c.intent_status!=="queued_unexecuted"||d.intent_status!=="queued_unexecuted"
           ||c.card_instance_id!==undefined&&c.card_instance_id==="mismatched"
           ||!wa||!wd||wa.remaining_tokens<1||wd.remaining_tokens<2
           ||mugicTrainingSettlements.has(key)||burstOrderPlans.has(key)||individualDamage.has(key))
          return {data:null,error:{message:"Insufficient training tokens or already settled"}};
        const record={lobby_id:room.id,turn_no:m.turn_no,attacker_id:actor,defender_id:w.defender_id,
          attacker_tokens_before:wa.remaining_tokens,attacker_tokens_after:wa.remaining_tokens-1,
          defender_tokens_before:wd.remaining_tokens,defender_tokens_after:wd.remaining_tokens-2,
          outcome:"creation_negated_training_only",tokens_verified:true,training_tokens_debited:true,
          official_match_modified:false,original_card_consumed:false,actual_mugic_effect_executed:false};
        wa.remaining_tokens-=1;wd.remaining_tokens-=2;
        c.intent_status="resolved_training";d.intent_status="resolved_training";
        mugicTrainingSettlements.set(key,record);
        return {data:{...record},error:null};
      }
      if(name==="chaotic_prepare_preview_mugic_counterplan"){
        const m=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const w=burstWindows.get(key),p=burstPriority.get(key);
        const first=burstMugicIntents.get(key+"/"+actor);
        const second=burstMugicIntents.get(key+"/"+w?.defender_id);
        const passes=burstPriorityPasses.get(key)||[];
        if(room.mode!=="1x1"||room.status!=="ready"||!m||m.status!=="active"
          ||m.current_player!==actor||m.turn_no!==args.p_expected_turn
          ||w?.attacker_id!==actor||w?.status!=="defender_passed"
          ||p?.priority_status!=="closed_preview"||p.consecutive_passes!==2
          ||passes.length!==2||passes[0].actor_id!==actor
          ||passes[1].actor_id!==w.defender_id
          ||first?.catalog_mugic_id!=="301"||first.intent_status!=="queued_unexecuted"
          ||second?.catalog_mugic_id!=="302"||second.intent_status!=="queued_unexecuted"
          ||burstMugicCounterplans.has(key)||burstOrderPlans.has(key)||individualDamage.has(key))
          return {data:null,error:{message:"Cannot prepare counterplan"}};
        const result={lobby_id:room.id,turn_no:m.turn_no,attacker_id:actor,
          defender_id:w.defender_id,
          required_creation_tokens:1,required_rejection_tokens:2,
          hypothetical_creation_negated:true,token_balance_verified:false,
          consumes_tokens:false,consumes_cards:false,effect_executed:false,
          official_match_modified:false,final_damage_verified:false,
          inspection_status:"lifo_counter_review_only",
          inspection_steps:[
            {reverse_order:1,actor:"defender",name:"Canção da Rejeição",executed:false},
            {reverse_order:2,actor:"attacker",name:"Canção da Criação",executed:false}
          ]};
        burstMugicCounterplans.set(key,result);
        return {data:{...result},error:null};
      }
      if(name==="chaotic_prepare_preview_burst_order"){
        const m=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const win=burstWindows.get(key),clash=clashes.get(key),attack=attackInstances.get(key),
          queued=burstEquipmentResponses.get(key);
        if(room.mode!=="1x1"||room.status!=="ready"||!m||m.status!=="active"
          ||m.turn_no!==args.p_expected_turn||m.current_player!==actor
          ||win?.attacker_id!==actor
          ||!["defender_passed","defender_immunity_noted"].includes(win?.status)
          ||clash?.attacker_id!==actor||clash?.defender_id!==win.defender_id
          ||clash?.attack_card!==win.attack_instance_id
          ||attack?.actor_id!==actor||attack?.attack_instance_id!==win.attack_instance_id
          ||burstOrderPlans.has(key)
          ||burstPriority.get(key)?.priority_status!=="closed_preview"
          ||burstPriorityPasses.get(key)?.length!==2
          ||[...burstMugicIntents.values()].some(x=>x.lobby_id===room.id
            &&x.turn_no===args.p_expected_turn&&x.intent_status==="queued_unexecuted")
          ||(queued&&win.status==="defender_immunity_noted"))
          return {data:null,error:{message:"Sequência Burst não autorizada"}};
        const steps=win.status==="defender_immunity_noted"
          ?[{order:1,stage:"inspect_passive_air_immunity",actor:"defender",
              source:win.defensive_immunity_source,executed:false},
            {order:2,stage:"inspect_attack",actor:"attacker",
              source:"declared_attack",executed:false}]
          :queued
          ?[{order:1,stage:"inspect_queued_equipment_reveal",actor:"defender",
              source:"equipment_instance",equipment_name:queued.equipment_name,
              executed:false},
            {order:2,stage:"inspect_attack",actor:"attacker",
              source:"declared_attack",executed:false}]
          :[{order:1,stage:"inspect_attack",actor:"attacker",
              source:"declared_attack",executed:false}];
        const entry={lobby_id:room.id,turn_no:m.turn_no,
          attacker_id:actor,defender_id:win.defender_id,
          defender_response:win.defender_response,
          defensive_immunity_source:win.defensive_immunity_source||null,
          inspection_steps:steps,inspection_step_count:steps.length,
          preparation_status:"prepared_not_executed",
          burst_stack_executed:false,final_damage_verified:false,
          official_match_modified:false};
        burstOrderPlans.set(key,entry);
        return {data:{...entry},error:null};
      }
      if(name==="chaotic_audit_preview_damage"){
        const m=matches.get(room.id),k=room.id+"/"+args.p_expected_turn;
        const d=individualDamage.get(k),atk=attackInstances.get(k),cl=clashes.get(k);
        const a=loadouts.get(room.id+"/"+actor);
        const v=loadouts.get(room.id+"/"+(d?.defender_id||""));
        const paid=hands.get(room.id+"/"+actor)?.find(x=>
          x.attack_instance_id===d?.attack_instance_id);
        if(room.mode!=="1x1"||!m||m.status!=="active"
          ||m.turn_no!==args.p_expected_turn||m.current_player!==actor
          ||d?.attacker_id!==actor||d?.cost_status!=="test_spent"
          ||atk?.attack_instance_id!==d?.attack_instance_id
          ||atk?.catalog_attack_id!==d?.catalog_attack_id
          ||cl?.attacker_id!==actor||cl?.defender_id!==d?.defender_id
          ||a?.card_instance_id!==d?.attacker_instance_id
          ||v?.card_instance_id!==d?.defender_instance_id
          ||paid?.card_state!=="spent"||paid?.spent_reason!=="attack"
          ||paid?.spent_turn!==m.turn_no||resolutionAudits.has(k))
          return {data:null,error:{message:"Auditoria não autorizada"}};
        const blockers=["burst_unresolved","creature_abilities_unresolved",
          "official_turn_and_hp_unintegrated","card_ownership_not_authoritative"];
        if(d.calculation_status!=="partial_estimate"||d.preview_subtotal===null)
          blockers.push("damage_formula_incomplete");
        const attackSpecial={
          "104":"die_roll_or_special_resolution",
          "107":"vine_turn_skip_requires_final_damage",
          "111":"electronic_attack_lock_requires_final_damage",
          "112":"hand_attack_lock_requires_final_damage",
          "106":"poison_over_future_turns_unresolved",
          "105":"hidden_creature_reveal_unresolved"
        };
        blockers.push(attackSpecial[atk.catalog_attack_id]||
          "hand_draw_heal_or_other_action_unresolved");
        if(!d.location_id)blockers.push("location_not_selected");
        const win=burstWindows.get(k);
        blockers.push(!win?"burst_window_not_opened":
          win.status==="awaiting_defender"?"burst_defender_response_pending":
          win.status==="defender_immunity_noted"?
            "burst_air_immunity_acknowledged_preview_only":
          "burst_defender_passed_preview_only");
        if(a.equipment_name||v.equipment_name)
          blockers.push("equipment_full_effects_unresolved");
        const out={lobby_id:room.id,turn_no:m.turn_no,actor_id:actor,
          victim_id:d.defender_id,catalog_attack_id:atk.catalog_attack_id,
          blocker_codes:blockers,blocker_count:blockers.length,
          review_status:"incomplete",damage_status:d.calculation_status,
          final_damage_verified:false,applied_to_official_match:false};
        resolutionAudits.set(k,out);
        return {data:{...out},error:null};
      }
      if(name==="chaotic_prepare_preview_hp"){
        const match=matches.get(room.id),loc=locations.get(room.id);
        const host=loadouts.get(room.id+"/"+room.host_id);
        const guest=loadouts.get(room.id+"/"+room.guest_id);
        if(room.mode!=="1x1"||!match||match.status!=="active"
          ||match.turn_no!==args.p_expected_turn||match.current_player!==actor
          ||!loc||!host||!guest
          ||hpWallets.has(room.id+"/"+room.host_id)
          ||hpWallets.has(room.id+"/"+room.guest_id)
          ||[...individualDamage.values()].some(x=>x.lobby_id===room.id))
          return {data:null,error:{message:"HP de teste não inicializado"}};
        const hpFor=x=>x.stats.e+(loc.catalog_location_id===501&&x.tribe==="Azul"?10:0);
        for(const [who,unit] of [[room.host_id,host],[room.guest_id,guest]]){
          const max=hpFor(unit);
          hpWallets.set(room.id+"/"+who,{lobby_id:room.id,actor_id:who,
            creature_instance_id:unit.card_instance_id,
            location_id:loc.catalog_location_id,hp_max:max,hp_remaining:max,
            projected_hits:0});
        }
        return {data:{status:"initialized_hypothetical",
          host_hp:hpFor(host),guest_hp:hpFor(guest),
          location_id:loc.catalog_location_id,official_hp_changed:false},error:null};
      }
      if(name==="chaotic_apply_preview_hp_projection"){
        const match=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const dmg=individualDamage.get(key),attack=attackInstances.get(key);
        const card=hands.get(room.id+"/"+actor)?.find(x=>
          x.attack_instance_id===dmg?.attack_instance_id);
        const a=hpWallets.get(room.id+"/"+actor);
        const d=hpWallets.get(room.id+"/"+(dmg?.defender_id||""));
        if(room.mode!=="1x1"||!match||match.status!=="active"
          ||match.turn_no!==args.p_expected_turn||match.current_player!==actor
          ||!dmg||dmg.attacker_id!==actor||!d
          ||!a||a.hp_remaining<=0||d.hp_remaining<=0
          ||attack?.attack_instance_id!==dmg.attack_instance_id
          ||attack?.catalog_attack_id!==dmg.catalog_attack_id
          ||card?.spent_reason!=="attack"||card?.spent_turn!==args.p_expected_turn
          ||dmg.calculation_status!=="partial_estimate"
          ||dmg.cost_status!=="test_spent"
          ||d.location_id!==dmg.location_id
          ||hpEvents.has(key))
          return {data:null,error:{message:"Aplicação de HP hipotético não autorizada"}};
        const before=d.hp_remaining;
        d.hp_remaining=Math.max(0,before-dmg.preview_subtotal);
        d.projected_hits+=1;
        const ev={lobby_id:room.id,turn_no:args.p_expected_turn,
          attacker_id:actor,victim_id:dmg.defender_id,hp_before:before,
          hp_after:d.hp_remaining,indicative_damage:dmg.preview_subtotal,
          hypothetical_applied_damage:before-d.hp_remaining,
          official_hp_changed:false,final_damage_verified:false};
        hpEvents.set(key,ev);
        return {data:{projection:"hypothetical_partial_damage",turn_no:args.p_expected_turn,
          victim_id:dmg.defender_id,hp_before:before,hp_after:d.hp_remaining,
          indicative_damage:dmg.preview_subtotal,official_hp_changed:false,
          final_damage_verified:false},error:null};
      }
      if(name==="chaotic_capture_preview_effect_candidate"){
        const m=matches.get(room.id),k=room.id+"/"+args.p_expected_turn;
        const d=individualDamage.get(k),a=attackInstances.get(k),cl=clashes.get(k);
        if(room.mode!=="1x1"||!m||m.status!=="active"
          ||m.turn_no!==args.p_expected_turn||m.current_player!==actor
          ||actor!==d?.attacker_id||a?.actor_id!==actor
          ||a?.attack_instance_id!==d?.attack_instance_id
          ||a?.catalog_attack_id!==d?.catalog_attack_id
          ||cl?.defender_id!==d?.defender_id
          ||d?.cost_status!=="test_spent"
          ||d?.calculation_status!=="partial_estimate"
          ||!(d.preview_subtotal>0)
          ||!["107","111","112"].includes(d.catalog_attack_id)
          ||effectCandidates.has(k))
          return {data:null,error:{message:"Efeito condicional não autorizado"}};
        const duration=d.catalog_attack_id==="111"?2:1;
        const obj={lobby_id:room.id,turn_no:args.p_expected_turn,attacker_id:actor,
          victim_id:d.defender_id,attack_instance_id:d.attack_instance_id,
          catalog_attack_id:d.catalog_attack_id,
          effect_code:d.catalog_attack_id==="107"?"vine_skip":
            d.catalog_attack_id==="111"?"electronic_attack_lock":"hand_attack_lock",
          effect_scope:d.catalog_attack_id==="107"?
            "full_turn_no_draw_no_points":"attack_only",
          duration_target_turns:duration,first_target_turn:m.turn_no+1,
          last_target_turn:m.turn_no+1+2*(duration-1),
          indicative_damage:d.preview_subtotal,
          confirmation_state:"candidate_requires_final_damage",
          applied_to_match:false};
        effectCandidates.set(k,obj);
        return {data:{...obj},error:null};
      }
      if(name==="chaotic_calculate_individual_preview"){
        const match=matches.get(room.id),key=room.id+"/"+args.p_expected_turn;
        const clash=clashes.get(key),attack=attackInstances.get(key);
        const attacker=loadouts.get(room.id+"/"+actor);
        const defender=loadouts.get(room.id+"/"+(clash?.defender_id||""));
        const trainingResult=burstEquipmentEffects.get(key);
        const queue=burstEquipmentResponses.get(key);
        const trainingReady=!queue||(trainingResult
          &&queue.defender_id===trainingResult.defender_id
          &&queue.equipment_instance_id===trainingResult.equipment_instance_id
          &&queue.creature_instance_id===defender?.card_instance_id
          &&queue.equipment_name===defender?.equipment_name
          &&burstOrderPlans.get(key)?.inspection_steps?.[0]?.stage==="inspect_queued_equipment_reveal");
        const trainingWallet=hpWallets.get(room.id+"/"+(clash?.defender_id||""));
        if(room.mode!=="1x1"||!match||match.status!=="active"||
          match.current_player!==actor||match.turn_no!==args.p_expected_turn||
          burstWindows.get(key)?.status==="awaiting_defender"||
          (burstWindows.has(key)&&(
            burstPriority.get(key)?.priority_status!=="closed_preview"
            ||!burstOrderPlans.has(key)))
          ||[...burstMugicIntents.values()].some(x=>x.lobby_id===room.id
            &&x.turn_no===args.p_expected_turn&&x.intent_status==="queued_unexecuted")||
          !trainingReady||
          (queue&&(!trainingWallet
            ||trainingWallet.hp_remaining!==trainingResult.hp_after
            ||trainingWallet.hp_max!==trainingResult.hp_max_after))||
          !clash||clash.attacker_id!==actor||!attack||attack.actor_id!==actor||
          !attacker||!defender||attack.attack_instance_id!==clash.attack_card||
          attacker.card_instance_id!==clash.attacker_card||
          defender.card_instance_id!==clash.defender_card||individualDamage.has(key)||
          !hands.get(room.id+"/"+actor)?.some(x=>x.card_slot===attack.card_slot
            &&x.attack_instance_id===attack.attack_instance_id
            &&x.card_state==="spent"&&x.spent_reason==="attack"
            &&x.spent_turn===args.p_expected_turn))
          return {data:null,error:{message:"Prévia individual negada"}};
        const special=attack.catalog_attack_id==="104";
        const location=locations.get(room.id);
        const locId=location?.catalog_location_id||null;
        const locationEnergy=locId===501&&defender.tribe==="Azul"?10:0;
        const hasWind=attack.catalog_attack_id==="110";
        const hasWater=attack.catalog_attack_id==="101";
        const locationDelta=locId===502?(hasWind?5:0)-(hasWater?5:0):0;
        const magmaElemental=locId===503&&attack.catalog_attack_id==="101"?5:0;
        const elementalBonus=hasWind?10:0;
        const ring=trainingResult?.effect_code==="precious_ring_hp";
        const immune=hasWind&&(defender.creature_name==="Rex"||
          (defender.equipment_name==="Amuleto do Vácuo"&&
           equipmentReveals.has(room.id+"/"+defender.actor_id)));
        const total=special?null:immune?0:Math.max(0,attack.base_damage+locationDelta+
          (ring?0:magmaElemental)+(ring?0:elementalBonus));
        const result={lobby_id:room.id,turn_no:match.turn_no,attacker_id:actor,
          defender_id:clash.defender_id,attack_instance_id:attack.attack_instance_id,
          catalog_attack_id:attack.catalog_attack_id,attack_name:attack.attack_name,
          attacker_instance_id:attacker.card_instance_id,
          defender_instance_id:defender.card_instance_id,
          attacker_name:attacker.creature_name,defender_name:defender.creature_name,
          defender_energy_initial:queue?trainingWallet.hp_remaining:defender.stats.e+locationEnergy,
          base_damage:attack.base_damage,
          elemental_bonus:ring?0:elementalBonus,attribute_bonus:0,equipment_bonus:0,
          location_id:locId,location_damage_delta:locationDelta,
          location_elemental_bonus:magmaElemental,location_energy_bonus:locationEnergy,
          attack_cost:attack.attack_cost,cost_status:"test_spent",
          attacker_equipment_revealed:equipmentReveals.has(room.id+"/"+actor),
          defender_equipment_revealed:equipmentReveals.has(room.id+"/"+clash.defender_id),
          immunity_reason:immune?(defender.creature_name==="Rex"
            ?"Rex: imune a Ar":"Amuleto do Vácuo revelado: imune a Ar"):null,
          preview_subtotal:total,
          preview_energy_remaining:total===null?null:Math.max(0,
            (queue?trainingWallet.hp_remaining:defender.stats.e+locationEnergy)-total),
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
      assert.ok(["chaotic_lobbies","chaotic_match_turns","chaotic_match_events","chaotic_combat_declarations","chaotic_preview_board","chaotic_preview_clashes","chaotic_preview_damage","chaotic_preview_modifiers","chaotic_preview_dice","chaotic_preview_loadouts","chaotic_preview_attack_instances","chaotic_preview_individual_damage","chaotic_preview_equipment_reveals","chaotic_preview_attack_wallets","chaotic_preview_attack_hand","chaotic_preview_initiatives","chaotic_preview_room_locations","chaotic_preview_effect_candidates","chaotic_preview_hp_wallets","chaotic_preview_hp_events","chaotic_preview_resolution_audits","chaotic_preview_burst_windows","chaotic_preview_burst_priority","chaotic_preview_burst_priority_passes","chaotic_preview_burst_mugic_intents","chaotic_preview_burst_mugic_counterplans","chaotic_preview_mugic_token_wallets","chaotic_preview_mugic_token_settlements","chaotic_preview_ability_heal_events","chaotic_preview_harp_token_events","chaotic_preview_3x3_contact_intents","chaotic_preview_3x3_attack_projections","chaotic_preview_3x3_attack_wallets","chaotic_preview_3x3_attack_hand","chaotic_preview_3x3_cost_inspections","chaotic_preview_3x3_attack_spends","chaotic_preview_3x3_elemental_inspections","chaotic_preview_3x3_training_damage_events","chaotic_preview_3x3_face_states","chaotic_preview_3x3_vento_reveal_events","chaotic_preview_3x3_sonar_search_events","chaotic_preview_3x3_training_attack_locks","chaotic_preview_3x3_training_knockouts","chaotic_preview_3x3_training_outcomes","chaotic_preview_3x3_private_equipment_checks","chaotic_preview_3x3_defense_windows","chaotic_preview_3x3_hand_discards","chaotic_preview_3x3_hand_draw_events","chaotic_preview_burst_order_plans","chaotic_preview_burst_equipment_responses","chaotic_preview_burst_equipment_effects"].includes(table));
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
                              :table==="chaotic_preview_initiatives"
                                ?[...initiatives.values()].filter(x=>x.lobby_id===this.id)
                                :table==="chaotic_preview_room_locations"
                                  ?[...locations.values()].filter(x=>x.lobby_id===this.id)
                                  :table==="chaotic_preview_effect_candidates"
                                    ?[...effectCandidates.values()].filter(x=>x.lobby_id===this.id)
                                    :table==="chaotic_preview_hp_wallets"
                                      ?[...hpWallets.values()].filter(x=>x.lobby_id===this.id)
                                      :table==="chaotic_preview_hp_events"
                                        ?[...hpEvents.values()].filter(x=>x.lobby_id===this.id)
                                        :table==="chaotic_preview_resolution_audits"
                                          ?[...resolutionAudits.values()].filter(x=>x.lobby_id===this.id)
                                          :table==="chaotic_preview_burst_windows"
                                            ?[...burstWindows.values()].filter(x=>x.lobby_id===this.id)
                                            :table==="chaotic_preview_burst_priority"
                                              ?[...burstPriority.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_burst_priority_passes"
                                              ?[...burstPriorityPasses.values()].flat().filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_burst_mugic_intents"
                                              ?[...burstMugicIntents.values()].filter(x=>
                                                x.lobby_id===this.id&&x.actor_id===actor)
                                              :table==="chaotic_preview_burst_mugic_counterplans"
                                              ?[...burstMugicCounterplans.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_mugic_token_wallets"
                                              ?[...mugicTrainingWallets.values()].filter(x=>x.lobby_id===this.id&&x.actor_id===actor)
                                              :table==="chaotic_preview_mugic_token_settlements"
                                              ?[...mugicTrainingSettlements.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_ability_heal_events"
                                              ?[...trainingAbilityEvents.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_harp_token_events"
                                              ?[...harpTrainingEvents.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_3x3_allies"
                                              ?[...allies3x3.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_3x3_hp_wallets"
                                              ?[...hp3x3.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_3x3_board_positions"
                                              ?[...boardPositions3x3.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_3x3_move_events"
                                              ?[...moveEvents3x3.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_3x3_contact_intents"
                                              ?[...contacts3x3.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_3x3_attack_projections"
                                              ?[...attackProjections3x3.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_3x3_attack_wallets"
                                              ?[...hand3x3Wallets.values()].filter(x=>x.lobby_id===this.id&&x.actor_id===actor)
                                              :table==="chaotic_preview_3x3_attack_hand"
                                              ?[...hand3x3Cards.values()].filter(x=>x.lobby_id===this.id&&x.actor_id===actor)
                                              :table==="chaotic_preview_3x3_hand_discards"
                                              ?[...hand3x3Discards.values()].filter(x=>x.lobby_id===this.id&&x.actor_id===actor)
                                              :table==="chaotic_preview_3x3_hand_draw_events"
                                              ?[...hand3x3DrawEvents.values()].filter(x=>x.lobby_id===this.id&&x.actor_id===actor)
                                              :table==="chaotic_preview_3x3_cost_inspections"
                                              ?[...costChecks3x3.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_3x3_attack_spends"
                                              ?[...attackSpends3x3.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_3x3_elemental_inspections"
                                              ?[...elementReviews3x3.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_3x3_creature_element_checks"
                                              ?[]
                                              :table==="chaotic_preview_3x3_dynamic_element_checks"
                                              ?[]
                                              :table==="chaotic_preview_3x3_training_damage_events"
                                              ?[]
                                              :table==="chaotic_preview_3x3_face_states"
                                              ?[]
                                              :table==="chaotic_preview_3x3_vento_reveal_events"
                                              ?[]
                                              :table==="chaotic_preview_3x3_sonar_search_events"
                                              ?[]
                                              :table==="chaotic_preview_3x3_training_attack_locks"
                                              ?[]
                                              :table==="chaotic_preview_3x3_training_knockouts"
                                              ?[]
                                              :table==="chaotic_preview_3x3_training_outcomes"
                                              ?[]
                                              :table==="chaotic_preview_3x3_private_equipment_checks"
                                              ?[]
                                              :table==="chaotic_preview_3x3_defense_windows"
                                              ?[...defenseWindows3x3.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_3x3_token_transfers"
                                              ?[...transfers3x3.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_burst_order_plans"
                                              ?[...burstOrderPlans.values()].filter(x=>x.lobby_id===this.id)
                                              :table==="chaotic_preview_burst_equipment_responses"
                                                ?[...burstEquipmentResponses.values()].filter(x=>x.lobby_id===this.id)
                                                :table==="chaotic_preview_burst_equipment_effects"
                                                  ?[...burstEquipmentEffects.values()].filter(x=>x.lobby_id===this.id)
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
  const undealt=hands.get(id+"/dna-preview-host")[0];
  undealt.card_state="deck";
  assert.ok((await makeClient("dna-preview-host").rpc("chaotic_capture_preview_attack",{
    p_lobby_id:id,p_expected_turn:3})).error,
    "An undealt card cannot be captured through a direct RPC");
  undealt.card_state="hand";
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
  assert.match(host("lobby-individual-damage-history").textContent,/Energia de referência da prévia 65/);
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
 assert.equal(hands.get(id+"/resource-host")[0].spent_reason,"attack");
 assert.match(host("lobby-attack-resource-summary").textContent,/pontos 3/);
 assert.ok((await makeClient("resource-host").rpc("chaotic_spend_preview_attack",{
   p_lobby_id:id,p_expected_turn:3})).error,"Card replay rejected");
 assert.equal(loadouts.get(id+"/resource-guest").stats.e,65);
});


test("1x1 test discard is private, one-time, and discarded cards reshuffle after draw deck empties",async()=>{
  const host=browser("recycle-host"),guest=browser("recycle-guest");
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  const id=[...rooms.values()].find(x=>x.code===code).id;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="6";
  await host("lobby-combat-submit").onclick();
  await host("lobby-hex-place").onclick();
  await host("lobby-loadout-capture").onclick();
  await host("lobby-hand-prepare").onclick();
  const first=hands.get(id+"/recycle-host").find(x=>x.card_slot===3);
  assert.equal(first.card_state,"hand");
  host("lobby-hand-discard-slot").value="3";
  assert.equal(host("lobby-hand-discard").hidden,false);
  await host("lobby-hand-discard").onclick();
  assert.equal(first.card_state,"spent");
  assert.equal(first.spent_reason,"discard");
  assert.match(host("lobby-attack-resource-summary").textContent,/lixo 1/);
  assert.equal(wallets.get(id+"/recycle-host").spent_points,0);
  const outsider=await makeClient("recycle-guest").rpc("chaotic_discard_preview_attack",{
    p_lobby_id:id,p_expected_turn:1,p_card_slot:3});
  assert.ok(outsider.error);
  const duplicate=await makeClient("recycle-host").rpc("chaotic_discard_preview_attack",{
    p_lobby_id:id,p_expected_turn:1,p_card_slot:3});
  assert.ok(duplicate.error);
  const guestHand=await makeClient("recycle-guest").from("chaotic_preview_attack_hand")
    .select("card_state").eq("lobby_id",id).order("draw_position",{ascending:true}).limit(20);
  assert.equal(guestHand.data.length,0,"Opponent never sees private card IDs");
  // Simulate a long test duel: all of the remaining pile was previously spent.
  const cards=hands.get(id+"/recycle-host");
  cards.filter(x=>x.card_state==="deck").forEach(x=>{
    x.card_state="spent";x.spent_turn=1;x.spent_reason="attack";
  });
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-hand-sync").hidden,false);
  const result=await makeClient("recycle-host").rpc("chaotic_sync_preview_hand",{
    p_lobby_id:id,p_expected_turn:3});
  assert.equal(result.error,null);
  assert.equal(result.data.recycled,true);
  assert.equal(result.data.drew_card,true);
  assert.equal(wallets.get(id+"/recycle-host").recycle_cycles,1);
  assert.equal(cards.filter(x=>x.card_state==="hand").length,3);
  assert.equal(cards.filter(x=>x.card_state==="spent").length,0);
  assert.ok(cards.filter(x=>x.card_state==="deck").every(x=>x.spent_reason===null
    &&x.spent_turn===null));
  const after=await makeClient("recycle-host").from("chaotic_preview_attack_hand")
    .select("card_state").eq("lobby_id",id).order("draw_position",{ascending:true}).limit(20);
  assert.equal(after.data.length,3,"Only purchased cards are visible after reshuffle");
  assert.equal(after.data.some(x=>x.card_state==="deck"),false);
  const repeat=await makeClient("recycle-host").rpc("chaotic_sync_preview_hand",{
    p_lobby_id:id,p_expected_turn:3});
  assert.equal(repeat.data.drew_card,false,"No duplicate draw in same turn");
  assert.equal(repeat.data.recycled,false);
});

test("1x1 initiative snapshot uses individual Speed, tie to attacker, no turn or HP changes",async()=>{
 const host=browser("init-host"),guest=browser("init-guest");
 host("lobby-select-mode").value="1x1";
 await host("lobby-create-btn").onclick();
 const id=[...rooms.values()].find(r=>r.host_id==="init-host").id;
 guest("lobby-input-code").value=host("lobby-room-code").textContent;
 await guest("lobby-join-btn").onclick();
 await host("lobby-refresh").onclick();
 await host("lobby-turn-start").onclick();
 host("lobby-combat-kind").value="creature";
 host("lobby-combat-deck").value="1";
 host("lobby-combat-slot").value="6";
 await host("lobby-combat-submit").onclick();
 await host("lobby-hex-place").onclick();
 await host("lobby-loadout-capture").onclick();
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
 host("lobby-combat-kind").value="attack";
 host("lobby-combat-deck").value="1";
 host("lobby-combat-slot").value="1";
 await host("lobby-combat-submit").onclick();
 assert.equal(host("lobby-initiative-preview-calculate").hidden,true);
 await host("lobby-clash-open").onclick();
 assert.equal(host("lobby-initiative-preview-calculate").hidden,false);
 assert.ok((await makeClient("intruder").rpc("chaotic_capture_preview_initiative",{
   p_lobby_id:id,p_expected_turn:3})).error);
 await host("lobby-initiative-preview-calculate").onclick();
 assert.equal(host("lobby-initiative-preview-calculate").hidden,true);
 assert.match(host("lobby-initiative-history").textContent,/45 × defensor 45/);
 assert.match(host("lobby-initiative-history").textContent,/empate favorece atacante/);
 assert.equal(initiatives.get(id+"/3").winning_player,"init-host");
 assert.equal(matches.get(id).current_player,"init-host");
 assert.equal(matches.get(id).turn_no,3);
 assert.equal(loadouts.get(id+"/init-guest").stats.e,65);
 assert.ok((await makeClient("init-host").rpc("chaotic_capture_preview_initiative",{
   p_lobby_id:id,p_expected_turn:3})).error,"Replay blocked");
 await guest("lobby-turn-refresh").onclick();
 assert.match(guest("lobby-initiative-history").textContent,/Anfitrião/);
 const defender=loadouts.get(id+"/init-guest");
 defender.stats.v=70;
 await host("lobby-turn-pass").onclick();
 await guest("lobby-turn-refresh").onclick();
 await guest("lobby-turn-pass").onclick();
 await host("lobby-turn-refresh").onclick();
 host("lobby-combat-kind").value="attack";
 host("lobby-combat-deck").value="1";
 host("lobby-combat-slot").value="1";
 await host("lobby-combat-submit").onclick();
 await host("lobby-clash-open").onclick();
 await host("lobby-initiative-preview-calculate").onclick();
 assert.equal(initiatives.get(id+"/5").winning_player,"init-guest");
 assert.equal(matches.get(id).current_player,"init-host");
});

test("1x1 original Deck Local selects Wisdom or Power without mutating turns",async()=>{
 const host=browser("location-power-host"),guest=browser("location-power-guest");
 host("lobby-select-mode").value="1x1";
 await host("lobby-create-btn").onclick();
 const code=host("lobby-room-code").textContent;
 const id=[...rooms.values()].find(x=>x.code===code).id;
 guest("lobby-input-code").value=code;
 await guest("lobby-join-btn").onclick();
 await host("lobby-refresh").onclick();
 await host("lobby-turn-start").onclick();
 host("lobby-combat-kind").value="creature";
 host("lobby-combat-deck").value="1";
 host("lobby-combat-slot").value="6";
 await host("lobby-combat-submit").onclick();
 await host("lobby-hex-place").onclick();
 await host("lobby-loadout-capture").onclick();
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
 host("lobby-combat-kind").value="attack";
 host("lobby-combat-deck").value="1";
 host("lobby-combat-slot").value="1";
 await host("lobby-combat-submit").onclick();
 await host("lobby-clash-open").onclick();
 assert.equal(host("lobby-location-capture").hidden,false);
 assert.ok((await makeClient("location-power-guest").rpc("chaotic_capture_preview_room_location",{
   p_lobby_id:id,p_expected_turn:3})).error);
 await host("lobby-location-capture").onclick();
 assert.equal(locations.get(id).catalog_location_id,502);
 assert.match(host("lobby-location-history").textContent,/Túnel da Tempestade/);
 assert.match(host("lobby-location-history").textContent,/Poder/);
 assert.equal(host("lobby-location-capture").hidden,true);
 assert.ok((await makeClient("location-power-host").rpc("chaotic_capture_preview_room_location",{
   p_lobby_id:id,p_expected_turn:3})).error,"Cannot redraw the Local");
 const defender=loadouts.get(id+"/location-power-guest");
 defender.stats.p=90;defender.stats.v=3;
 await host("lobby-initiative-preview-calculate").onclick();
 const got=initiatives.get(id+"/3");
 assert.equal(got.attribute_code,"p");
 assert.equal(got.attribute_source,"preview_location_deck");
 assert.equal(got.winning_player,"location-power-guest");
 assert.match(host("lobby-initiative-history").textContent,/Poder/);
 assert.equal(matches.get(id).current_player,"location-power-host");
 assert.equal(loadouts.get(id+"/location-power-guest").stats.e,65);
 await guest("lobby-turn-refresh").onclick();
 assert.match(guest("lobby-location-history").textContent,/Túnel da Tempestade/);
 assert.match(guest("lobby-initiative-history").textContent,/Poder/);
});

test("1x1 Kiru location preview adds Blue energy without changing saved DNA or the turn",async()=>{
  const host=browser("location-kiru-host"),guest=browser("location-kiru-guest");
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  const id=[...rooms.values()].find(x=>x.code===code).id;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
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
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="1";
  await host("lobby-combat-submit").onclick();
  await host("lobby-clash-open").onclick();
  await host("lobby-location-capture").onclick();
  assert.equal(locations.get(id).catalog_location_id,501);
  assert.equal(host("lobby-hp-prepare").hidden,false);
  assert.ok((await makeClient("location-kiru-guest").rpc("chaotic_prepare_preview_hp",{
    p_lobby_id:id,p_expected_turn:3})).error,"Opponent cannot start HP outside own turn");
  await host("lobby-hp-prepare").onclick();
  assert.equal(hpWallets.get(id+"/location-kiru-guest").hp_max,75);
  assert.equal(hpWallets.get(id+"/location-kiru-host").hp_max,75);
  assert.equal(host("lobby-hp-prepare").hidden,true);
  assert.ok((await makeClient("location-kiru-host").rpc("chaotic_prepare_preview_hp",{
    p_lobby_id:id,p_expected_turn:3})).error,"Cannot restart HP to heal");
  await host("lobby-attack-instance-capture").onclick();
  await host("lobby-hand-spend").onclick();
  await host("lobby-individual-damage-calculate").onclick();
  const damage=individualDamage.get(id+"/3");
  assert.equal(damage.location_id,501);
  assert.equal(damage.location_energy_bonus,10);
  assert.equal(damage.defender_energy_initial,75);
  assert.equal(damage.preview_energy_remaining,70);
  assert.match(host("lobby-individual-damage-history").textContent,/Cidade de Kiru/);
  assert.match(host("lobby-individual-damage-history").textContent,/energia \+10/);
  assert.match(host("lobby-individual-damage-history").textContent,/75 → 70/);
  assert.equal(loadouts.get(id+"/location-kiru-guest").stats.e,65);
  assert.equal(matches.get(id).current_player,"location-kiru-host");
  assert.equal(host("lobby-resolution-audit-capture").hidden,false);
  assert.ok((await makeClient("location-kiru-guest").rpc("chaotic_audit_preview_damage",{
    p_lobby_id:id,p_expected_turn:3})).error,"Opponent cannot audit outside turn");
  await host("lobby-resolution-audit-capture").onclick();
  const audited=resolutionAudits.get(id+"/3");
  assert.equal(audited.review_status,"incomplete");
  assert.equal(audited.final_damage_verified,false);
  assert.ok(audited.blocker_codes.includes("burst_unresolved"));
  assert.match(host("lobby-resolution-audit-history").textContent,/DANO FINAL NÃO CONFIRMADO/);
  assert.equal(host("lobby-resolution-audit-capture").hidden,true);
  assert.ok((await makeClient("location-kiru-host").rpc("chaotic_audit_preview_damage",{
    p_lobby_id:id,p_expected_turn:3})).error,"Audit cannot be repeated");
  assert.equal(host("lobby-hp-apply").hidden,false);
  assert.ok((await makeClient("location-kiru-guest").rpc("chaotic_apply_preview_hp_projection",{
    p_lobby_id:id,p_expected_turn:3})).error,"Opponent cannot apply someone else's damage");
  await host("lobby-hp-apply").onclick();
  assert.equal(hpWallets.get(id+"/location-kiru-guest").hp_remaining,70);
  assert.equal(hpEvents.get(id+"/3").hp_before,75);
  assert.equal(hpEvents.get(id+"/3").hp_after,70);
  assert.equal(hpEvents.get(id+"/3").official_hp_changed,false);
  assert.equal(host("lobby-hp-apply").hidden,true);
  assert.match(host("lobby-hp-summary").textContent,/70\/75/);
  assert.ok((await makeClient("location-kiru-host").rpc("chaotic_apply_preview_hp_projection",{
    p_lobby_id:id,p_expected_turn:3})).error,"HP same turn cannot be decremented twice");
  await guest("lobby-turn-refresh").onclick();
  assert.match(guest("lobby-individual-damage-history").textContent,/Cidade de Kiru/);
  assert.match(guest("lobby-hp-summary").textContent,/70\/75/);
  assert.match(guest("lobby-resolution-audit-history").textContent,/Burst ainda não resolvido/);
  // A second turn's damage must accumulate from 70, NOT original Kiru 75.
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  await host("lobby-hand-sync").onclick();
  host("lobby-combat-kind").value="attack";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="3";
  await host("lobby-combat-submit").onclick();
  await host("lobby-clash-open").onclick();
  await host("lobby-attack-instance-capture").onclick();
  await host("lobby-hand-spend").onclick();
  await host("lobby-individual-damage-calculate").onclick();
  await host("lobby-hp-apply").onclick();
  assert.equal(hpEvents.get(id+"/5").hp_before,70);
  assert.equal(hpEvents.get(id+"/5").hp_after,65);
  assert.equal(hpWallets.get(id+"/location-kiru-guest").hp_remaining,65);
  assert.equal(hpWallets.get(id+"/location-kiru-guest").projected_hits,2);
  assert.equal(loadouts.get(id+"/location-kiru-guest").stats.e,65,
    "Frozen actual DNA must not be altered by cumulative projections");
  assert.equal(matches.get(id).turn_no,5);
  assert.equal(matches.get(id).current_player,"location-kiru-host");
  assert.match(host("lobby-hp-events").textContent,/T3/);
  assert.match(host("lobby-hp-events").textContent,/T5/);
});

test("1x1 conditional Vinha effect is predicted for next opponent turn but NEVER applied",async()=>{
  const host=browser("effect-host"),guest=browser("effect-guest");
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  const id=[...rooms.values()].find(x=>x.code===code).id;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
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
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="1";
  await host("lobby-combat-submit").onclick();
  await host("lobby-clash-open").onclick();
  await host("lobby-attack-instance-capture").onclick();
  const attack=attackInstances.get(id+"/3");
  attack.catalog_attack_id="107";
  attack.attack_name="Armadilha de Vinha";
  await host("lobby-hand-spend").onclick();
  assert.equal(host("lobby-effect-candidate-capture").hidden,true);
  await host("lobby-individual-damage-calculate").onclick();
  assert.equal(host("lobby-resolution-audit-capture").hidden,false);
  await host("lobby-resolution-audit-capture").onclick();
  assert.ok(resolutionAudits.get(id+"/3").blocker_codes.includes(
    "vine_turn_skip_requires_final_damage"));
  assert.equal(resolutionAudits.get(id+"/3").final_damage_verified,false);
  assert.equal(host("lobby-effect-candidate-capture").hidden,false);
  assert.ok((await makeClient("effect-guest").rpc("chaotic_capture_preview_effect_candidate",{
    p_lobby_id:id,p_expected_turn:3})).error);
  await host("lobby-effect-candidate-capture").onclick();
  const effect=effectCandidates.get(id+"/3");
  assert.equal(effect.effect_code,"vine_skip");
  assert.equal(effect.effect_scope,"full_turn_no_draw_no_points");
  assert.equal(effect.first_target_turn,4);
  assert.equal(effect.duration_target_turns,1);
  assert.equal(effect.applied_to_match,false);
  assert.match(host("lobby-effect-candidates-history").textContent,/NÃO ATIVADO/);
  assert.equal(host("lobby-effect-candidate-capture").hidden,true);
  assert.ok((await makeClient("effect-host").rpc("chaotic_capture_preview_effect_candidate",{
    p_lobby_id:id,p_expected_turn:3})).error,"No duplicate projection");
  await guest("lobby-turn-refresh").onclick();
  assert.match(guest("lobby-effect-candidates-history").textContent,/Armadilha de Vinha/);
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  assert.equal(matches.get(id).current_player,"effect-guest","Candidate cannot skip an actual turn");
  assert.equal(matches.get(id).turn_no,4);
  assert.equal(loadouts.get(id+"/effect-guest").stats.e,65);
});


async function completePriority(host,guest,exerciseMugic=false){
  assert.equal(host("lobby-burst-priority-open").hidden,false);
  await host("lobby-burst-priority-open").onclick();
  if(exerciseMugic){
    assert.equal(host("lobby-burst-mugic-reject").hidden,false);
    await host("lobby-burst-mugic-reject").onclick();
    assert.match(host("lobby-burst-mugic-history").textContent,/INTENÇÃO PENDENTE/);
    assert.equal(host("lobby-burst-mugic-cancel").hidden,false);
    assert.equal(host("lobby-burst-mugic-reject").hidden,true,
      "One Mugic intent per player in a test window");
  }
  assert.equal(host("lobby-burst-priority-pass").hidden,false);
  await host("lobby-burst-priority-pass").onclick();
  assert.equal(host("lobby-burst-priority-pass").hidden,true,"Attacker cannot repeat PASS");
  await guest("lobby-turn-refresh").onclick();
  assert.equal(guest("lobby-burst-priority-pass").hidden,false);
  await guest("lobby-burst-priority-pass").onclick();
  assert.match(guest("lobby-burst-priority-history").textContent,/Dois passes confirmados/);
  await host("lobby-turn-refresh").onclick();
  if(exerciseMugic){
    const pending=[...burstMugicIntents.values()].find(x=>x.intent_status==="queued_unexecuted");
    assert.ok(pending,"The server keeps the Mugic intent while both players pass");
    assert.equal(host("lobby-burst-order-prepare").hidden,true,
      "Unresolved Mugic must block even the inspection plan");
    assert.ok((await makeClient(pending.actor_id).rpc("chaotic_prepare_preview_burst_order",{
      p_lobby_id:pending.lobby_id,p_expected_turn:pending.turn_no
    })).error,"Server must reject an unresolved Mugic after both priority passes");
    await host("lobby-burst-mugic-cancel").onclick();
    assert.match(host("lobby-burst-mugic-history").textContent,/intenção cancelada/);
  }
  assert.equal(host("lobby-burst-order-prepare").hidden,false);
}

test("Arpa Mágica grants +1 TRAINING token once after equipment reveal; original card stays intact",async()=>{
  const actor="harp-host",other="harp-guest";
  const host=browser(actor),guest=browser(other);
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  const id=[...rooms.values()].find(x=>x.code===code).id;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  loadouts.set(id+"/"+actor,{
    lobby_id:id,actor_id:actor,position:6,deck_slot:1,
    card_instance_id:"xama-own-1",creature_name:"Xamã",tribe:"Azul",
    equipment_instance_id:"harp-own-203",equipment_name:"Arpa Mágica",stats:{e:30}
  });
  loadouts.set(id+"/"+other,{
    lobby_id:id,actor_id:other,position:6,deck_slot:1,
    card_instance_id:"opponent-owned",creature_name:"Lion",tribe:"Azul",stats:{e:35}
  });
  hpWallets.set(id+"/"+actor,{
    lobby_id:id,actor_id:actor,creature_instance_id:"xama-own-1",
    hp_max:30,hp_remaining:20,projected_hits:0,init_turn:1,location_id:501
  });
  hpWallets.set(id+"/"+other,{
    lobby_id:id,actor_id:other,creature_instance_id:"opponent-owned",
    hp_max:35,hp_remaining:35,projected_hits:0,init_turn:1,location_id:501
  });
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-mugic-token-wallet-prepare").hidden,false);
  await host("lobby-mugic-token-wallet-prepare").onclick();
  assert.equal(mugicTrainingWallets.get(id+"/"+actor).remaining_tokens,4);
  assert.equal(host("lobby-harp-token-activate").hidden,true,
    "Harp cannot be used before its own equipment reveal");
  assert.ok((await makeClient(actor).rpc("chaotic_discard_preview_harp_for_token",{
    p_lobby_id:id,p_expected_turn:1})).error,
    "Server, not merely button, requires original equipped harp to be revealed");
  assert.ok((await makeClient(other).rpc("chaotic_discard_preview_harp_for_token",{
    p_lobby_id:id,p_expected_turn:1})).error,"Opponent cannot grant a token");
  await makeClient(actor).rpc("chaotic_reveal_preview_equipment",{
    p_lobby_id:id,p_expected_turn:1
  });
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-harp-token-activate").hidden,false);
  await host("lobby-harp-token-activate").onclick();
  const event=harpTrainingEvents.get(id+"/"+actor);
  assert.equal(event.tokens_before,4);
  assert.equal(event.tokens_after,5);
  assert.equal(event.equipment_discarded_training,true);
  assert.equal(event.original_equipment_discarded,false);
  assert.equal(event.official_tokens_changed,false);
  assert.equal(event.official_match_modified,false);
  assert.equal(mugicTrainingWallets.get(id+"/"+actor).remaining_tokens,5);
  assert.equal(mugicTrainingWallets.get(id+"/"+actor).bonus_tokens,1);
  assert.equal(loadouts.get(id+"/"+actor).equipment_instance_id,"harp-own-203",
    "Original equipped snapshot must not be erased");
  assert.match(host("lobby-harp-token-history").textContent,/ORIGINAL permanece/);
  assert.ok((await makeClient(actor).rpc("chaotic_discard_preview_harp_for_token",{
    p_lobby_id:id,p_expected_turn:1})).error,"Replay must not mint a second token");
  host("lobby-ability-target").value="self";
  await host("lobby-ability-heal-activate").onclick();
  assert.equal(mugicTrainingWallets.get(id+"/"+actor).remaining_tokens,4,
    "After +1 from harp, Xamã's original -1 healing cost still works");
  assert.equal(hpWallets.get(id+"/"+actor).hp_remaining,30);
  assert.equal(mugicTrainingWallets.get(id+"/"+actor).bonus_tokens,1);
});

test("3x3 metadata keeps every one of the 15 original Attack names and flags dice-only effects",async()=>{
  const original=await readFile(new URL("../cartas.js",import.meta.url),"utf8");
  const migration=await readFile(new URL("../supabase/chaotic-preview-3x3-canonical-elemental-defender-inspection.sql",import.meta.url),"utf8");
  const section=original.slice(original.indexOf("const ATAQUES = ["),
    original.indexOf("// 3. BANCO DE DADOS: EQUIPAMENTOS")).split("/*")[0];
  const originalEntries=[...section.matchAll(/id:\s*(1\d\d),[\s\S]*?nome:\s*"([^"]+)"/g)]
    .map(m=>[m[1],m[2]]);
  const sqlEntries=[...migration.matchAll(/^\s*\('(1\d\d)','([^']+)'/gm)]
    .map(m=>[m[1],m[2]]);
  assert.equal(originalEntries.length,15);
  assert.equal(sqlEntries.length,15);
  assert.deepEqual(sqlEntries,originalEntries,
    "Canonical source metadata must track the original Attack IDs and names");
  assert.match(migration,/\('104','Fogo Primordial 2\.0',5,0,0,0,'flat_fire_fields','six_sided_base_multiplier'\)/);
  assert.match(migration,/\('101','Ácido Gástrico',5,5,0,0,'danoElemental','none'\)/);
  assert.match(migration,/final_damage_calculated boolean not null default false check\(final_damage_calculated=false\)/);
});

test("3x3 defers defender pass until paid, while ordinary no-attack turns still advance",async()=>{
  const owner="guard3-host",opponent="guard3-guest";
  const host=browser(owner),guest=browser(opponent);
  host("lobby-select-mode").value="3x3";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  const id=[...rooms.values()].find(x=>x.code===code).id;
  assert.ok((await makeClient(opponent).rpc("chaotic_pass_preview_3x3_defense",{
    p_lobby_id:id,p_expected_turn:1})).error,
    "A defender cannot pass before a paid training attack");
  assert.ok((await makeClient(owner).rpc("chaotic_open_preview_3x3_defense_window",{
    p_lobby_id:id,p_expected_turn:1})).error,
    "Attacker cannot open a reaction without an actual training payment");
  assert.equal(defenseWindows3x3.has(id+"/1"),false);
  assert.ok((await makeClient(opponent).rpc("chaotic_inspect_preview_3x3_elemental_defense",{
    p_lobby_id:id,p_expected_turn:1})).error,
    "No elemental inspection is possible without a paid Attack window");
  assert.equal(elementReviews3x3.has(id+"/1"),false);
  await host("lobby-turn-pass").onclick();
  assert.equal(matches.get(id).turn_no,2,
    "Ordinary 3x3 turns without a paid Attack must still advance");
  await guest("lobby-turn-refresh").onclick();
  assert.equal(guest("lobby-3x3-defense-pass").hidden,true);
  assert.ok((await makeClient(opponent).rpc("chaotic_pass_preview_3x3_defense",{
    p_lobby_id:id,p_expected_turn:1})).error,
    "A stale turn cannot create a defensive pass");
});

test("3x3 Alakazaz transfers a token only to the same player's ally, once per turn",async()=>{
  const owner="ally3-host",opponent="ally3-guest";
  const host=browser(owner),guest=browser(opponent);
  host("lobby-select-mode").value="3x3";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  const room=[...rooms.values()].find(x=>x.code===code);
  const id=room.id;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  const deckA=[null,null,null,
    {id:"allied-alakazaz-1",name:"Alakazaz",energy:10},
    {id:"allied-vidal-2",name:"Vidal",energy:35},
    {id:"allied-lion-3",name:"Lion",energy:46}];
  const deckB=[null,null,null,
    {id:"enemy-frador-1",name:"Frador",energy:55},
    {id:"enemy-lion-2",name:"Lion",energy:40},
    {id:"enemy-vidal-3",name:"Vidal",energy:32}];
  deckA.attacks=[
    {id:"attack-host-101",name:"Ácido Gástrico",quantity:1,danoBase:10,custo:3},
    {id:"attack-host-104",name:"Fogo Primordial 2.0",quantity:1,danoBase:5,custo:2},
    {id:"attack-host-102",name:"Mão Negra",quantity:1,danoBase:0,custo:0}
  ];
  deckB.attacks=[
    {id:"attack-guest-104",name:"Fogo Primordial 2.0",quantity:1,danoBase:5,custo:2},
    {id:"attack-guest-101",name:"Ácido Gástrico",quantity:1,danoBase:10,custo:3},
    {id:"attack-guest-102",name:"Mão Negra",quantity:1,danoBase:0,custo:0}
  ];
  decks3x3.set(owner+"/1",deckA);
  decks3x3.set(opponent+"/1",deckB);
  assert.equal(host("lobby-3x3-prepare").hidden,false);
  assert.ok((await makeClient(opponent).rpc("chaotic_prepare_preview_3x3_allies",{
    p_lobby_id:id,p_expected_turn:1,p_deck_slot:1})).error,
    "Other player cannot capture cards outside their own turn");
  host("lobby-3x3-deck").value="1";
  await host("lobby-3x3-prepare").onclick();
  assert.equal(host("lobby-3x3-prepare").hidden,true,host("lobby-notice").textContent);
  assert.equal(allies3x3.get(id+"/"+owner+"/4").creature_name,"Alakazaz");
  assert.equal(allies3x3.get(id+"/"+owner+"/4").starting_tokens,5);
  assert.equal(allies3x3.get(id+"/"+owner+"/5").creature_name,"Vidal");
  assert.equal(allies3x3.get(id+"/"+owner+"/5").remaining_tokens,2);
  assert.equal(host("lobby-3x3-hand-prepare").hidden,false);
  assert.ok((await makeClient(opponent).rpc("chaotic_prepare_preview_3x3_hand",{
    p_lobby_id:id,p_expected_turn:1})).error,
    "Opponent cannot prepare a private hand on someone else's turn");
  await host("lobby-3x3-hand-prepare").onclick();
  assert.equal(hand3x3Wallets.get(id+"/"+owner).total_cards,3);
  assert.equal(hand3x3Wallets.get(id+"/"+owner).spent_points,0);
  assert.equal([...hand3x3Cards.values()].filter(x=>x.actor_id===owner&&x.card_state==="hand").length,3);
  assert.equal(host("lobby-3x3-hand-prepare").hidden,true,
    "Private hand cannot be re-shuffled to select a new set of cards");
  assert.ok((await makeClient(owner).rpc("chaotic_prepare_preview_3x3_hand",{
    p_lobby_id:id,p_expected_turn:1})).error,
    "Second hand preparation must be rejected on server");
  assert.equal(host("lobby-3x3-hp-prepare").hidden,false);
  assert.ok((await makeClient(opponent).rpc("chaotic_prepare_preview_3x3_hp",{
    p_lobby_id:id,p_expected_turn:1})).error,
    "Opponent cannot seed another player's HP outside their turn");
  deckA[5].energy=700;
  assert.ok((await makeClient(owner).rpc("chaotic_prepare_preview_3x3_hp",{
    p_lobby_id:id,p_expected_turn:1})).error,
    "Invalid individual energy rejects all three wallets atomically");
  assert.equal([...hp3x3.values()].filter(x=>x.lobby_id===id).length,0);
  deckA[5].energy=46;
  await host("lobby-3x3-hp-prepare").onclick();
  assert.equal(host("lobby-3x3-hp-prepare").hidden,true);
  assert.equal(hp3x3.get(id+"/"+owner+"/4").hp_max,10);
  assert.equal(hp3x3.get(id+"/"+owner+"/5").hp_remaining,35);
  assert.equal(hp3x3.get(id+"/"+owner+"/6").hp_max,46);
  assert.equal(hp3x3.get(id+"/"+owner+"/5").official_hp_changed,false);
  assert.equal(hp3x3.get(id+"/"+owner+"/5").location_bonuses_applied,false);
  assert.match(host("lobby-3x3-hp-history").textContent,/HP de treino 35\/35/);
  assert.equal(host("lobby-3x3-board-prepare").hidden,false);
  assert.ok((await makeClient(opponent).rpc("chaotic_prepare_preview_3x3_board",{
    p_lobby_id:id,p_expected_turn:1})).error,"Opponent cannot place units outside their turn");
  assert.ok((await makeClient(owner).rpc("chaotic_move_preview_3x3_unit",{
    p_lobby_id:id,p_expected_turn:1,p_formation_slot:4,p_target_hex:1})).error,
    "Cannot move a creature before its own 3x3 training board exists");
  await host("lobby-3x3-board-prepare").onclick();
  assert.equal(host("lobby-3x3-board-prepare").hidden,true);
  assert.equal(boardPositions3x3.get(id+"/"+owner+"/4").hex_position,4);
  assert.equal(boardPositions3x3.get(id+"/"+owner+"/5").hex_position,5);
  assert.equal(boardPositions3x3.get(id+"/"+owner+"/6").hex_position,6);
  assert.ok((await makeClient(owner).rpc("chaotic_prepare_preview_3x3_board",{
    p_lobby_id:id,p_expected_turn:1})).error,"Board replay must never reset movement");
  assert.ok((await makeClient(owner).rpc("chaotic_move_preview_3x3_unit",{
    p_lobby_id:id,p_expected_turn:1,p_formation_slot:4,p_target_hex:3})).error,
    "c4 cannot jump to non-adjacent hex 3");
  assert.ok((await makeClient(owner).rpc("chaotic_move_preview_3x3_unit",{
    p_lobby_id:id,p_expected_turn:1,p_formation_slot:4,p_target_hex:5})).error,
    "c4 cannot occupy ally c5's hex");
  assert.ok((await makeClient(opponent).rpc("chaotic_move_preview_3x3_unit",{
    p_lobby_id:id,p_expected_turn:1,p_formation_slot:4,p_target_hex:1})).error,
    "Opponent cannot move host's creature");
  host("lobby-3x3-move-unit").value="4";
  host("lobby-3x3-move-destination").value="1";
  assert.equal(host("lobby-3x3-move").hidden,false);
  await host("lobby-3x3-move").onclick();
  const ownerMove=moveEvents3x3.get(id+"/1/"+owner);
  assert.equal(ownerMove?.from_hex,4);
  assert.equal(ownerMove?.to_hex,1);
  assert.equal(ownerMove.damage_applied,false);
  assert.equal(ownerMove.official_position_changed,false);
  assert.equal(boardPositions3x3.get(id+"/"+owner+"/4").hex_position,1);
  assert.equal(boardPositions3x3.get(id+"/"+owner+"/4").formation_slot,4,
    "Creature c4 retains its original formation identity after moving");
  assert.equal(hp3x3.get(id+"/"+owner+"/4").hp_remaining,10,
    "Movement cannot change HP");
  assert.match(host("lobby-3x3-board-history").textContent,/hex 1/);
  assert.equal(host("lobby-3x3-move").hidden,true);
  assert.ok((await makeClient(owner).rpc("chaotic_move_preview_3x3_unit",{
    p_lobby_id:id,p_expected_turn:1,p_formation_slot:5,p_target_hex:2})).error,
    "Second movement by another creature in same player turn must fail");
  assert.equal(boardPositions3x3.get(id+"/"+owner+"/5").hex_position,5);
  assert.ok((await makeClient(owner).rpc("chaotic_prepare_preview_3x3_hp",{
    p_lobby_id:id,p_expected_turn:1})).error,"Reinitialization cannot restore HP");
  assert.ok((await makeClient(owner).rpc("chaotic_prepare_preview_3x3_allies",{
    p_lobby_id:id,p_expected_turn:1,p_deck_slot:1})).error,
    "Capturing twice cannot reset the token balances");
  assert.ok((await makeClient(owner).rpc("chaotic_transfer_preview_alakazaz_token",{
    p_lobby_id:id,p_expected_turn:1,p_receiver_position:4})).error,
    "Alakazaz must not donate to himself");
  assert.ok((await makeClient(owner).rpc("chaotic_transfer_preview_alakazaz_token",{
    p_lobby_id:id,p_expected_turn:1,p_receiver_position:3})).error,
    "Nonexistent or opponent board slots cannot receive tokens");
  assert.ok((await makeClient(opponent).rpc("chaotic_transfer_preview_alakazaz_token",{
    p_lobby_id:id,p_expected_turn:1,p_receiver_position:5})).error,
    "Opponent cannot spend allied tokens");
  host("lobby-3x3-receiver").value="5";
  assert.equal(host("lobby-3x3-transfer").hidden,false);
  await host("lobby-3x3-transfer").onclick();
  const event=transfers3x3.get(id+"/1/"+owner);
  assert.equal(event?.donor_before,5);
  assert.equal(event?.donor_after,4);
  assert.equal(event?.receiver_before,2);
  assert.equal(event?.receiver_after,3);
  assert.equal(event.official_tokens_changed,false);
  assert.equal(event.original_card_consumed,false);
  assert.equal(allies3x3.get(id+"/"+owner+"/4").remaining_tokens,4);
  assert.equal(allies3x3.get(id+"/"+owner+"/5").remaining_tokens,3);
  assert.equal(allies3x3.get(id+"/"+owner+"/5").received_tokens,1);
  assert.equal(host("lobby-3x3-transfer").hidden,true);
  assert.match(host("lobby-3x3-transfer-history").textContent,/Alakazaz c4/);
  assert.ok((await makeClient(owner).rpc("chaotic_transfer_preview_alakazaz_token",{
    p_lobby_id:id,p_expected_turn:1,p_receiver_position:6})).error,
    "Replay on same turn must fail even with another target");
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  assert.equal(guest("lobby-3x3-prepare").hidden,false);
  guest("lobby-3x3-deck").value="1";
  await guest("lobby-3x3-prepare").onclick();
  await guest("lobby-3x3-hand-prepare").onclick();
  assert.equal(hand3x3Wallets.get(id+"/"+opponent).prepared_turn,2);
  assert.equal(guest("lobby-3x3-hp-prepare").hidden,false);
  await guest("lobby-3x3-hp-prepare").onclick();
  assert.equal(guest("lobby-3x3-hp-prepare").hidden,true);
  await guest("lobby-3x3-board-prepare").onclick();
  assert.equal(boardPositions3x3.get(id+"/"+opponent+"/4").hex_position,4);
  assert.equal(boardPositions3x3.get(id+"/"+owner+"/4").hex_position,1,
    "Each player has a separate experimental side; guest cannot override host");
  assert.ok((await makeClient(owner).rpc("chaotic_move_preview_3x3_unit",{
    p_lobby_id:id,p_expected_turn:2,p_formation_slot:4,p_target_hex:2})).error,
    "Host cannot move during opponent's turn");
  guest("lobby-3x3-move-unit").value="5";
  guest("lobby-3x3-move-destination").value="2";
  await guest("lobby-3x3-move").onclick();
  assert.equal(boardPositions3x3.get(id+"/"+opponent+"/5").hex_position,2);
  assert.equal(moveEvents3x3.get(id+"/2/"+opponent).official_position_changed,false);
  assert.equal(boardPositions3x3.get(id+"/"+owner+"/4").hex_position,1);
  assert.equal(hp3x3.get(id+"/"+opponent+"/4").hp_max,55);
  assert.equal(hp3x3.get(id+"/"+opponent+"/5").hp_max,40);
  assert.equal(hp3x3.get(id+"/"+opponent+"/6").hp_remaining,32);
  assert.equal([...hp3x3.values()].filter(x=>x.lobby_id===id).length,6);
  assert.equal(hp3x3.get(id+"/"+owner+"/4").hp_remaining,10,
    "Other account cannot overwrite the host's HP");
  assert.equal(allies3x3.get(id+"/"+opponent+"/4").creature_name,"Frador");
  assert.equal(allies3x3.get(id+"/"+owner+"/4").remaining_tokens,4,
    "Opponent's snapshot cannot reset our saved training tokens");
  assert.equal(guest("lobby-3x3-transfer").hidden,true,
    "Non-Alakazaz player cannot send allied tokens");
  assert.ok((await makeClient(opponent).rpc("chaotic_transfer_preview_alakazaz_token",{
    p_lobby_id:id,p_expected_turn:2,p_receiver_position:5})).error);
  assert.equal(transfers3x3.get(id+"/1/"+owner).official_match_modified,false);
  assert.ok((await makeClient(owner).rpc("chaotic_open_preview_3x3_contact",{
    p_lobby_id:id,p_expected_turn:2,p_attacker_slot:5,p_defender_slot:4})).error,
    "Owner cannot open contact on guest's turn");
  assert.ok((await makeClient(opponent).rpc("chaotic_open_preview_3x3_contact",{
    p_lobby_id:id,p_expected_turn:2,p_attacker_slot:5,p_defender_slot:5})).error,
    "Guest c5 has moved to hex 2; cannot register a distant contact");
  assert.ok((await makeClient(opponent).rpc("chaotic_open_preview_3x3_contact",{
    p_lobby_id:id,p_expected_turn:2,p_attacker_slot:4,p_defender_slot:4})).error,
    "Host c4 has moved to hex 1; cannot register a distant contact");
  guest("lobby-3x3-contact-attacker").value="4";
  guest("lobby-3x3-contact-defender").value="5";
  assert.equal(guest("lobby-3x3-contact").hidden,false);
  await guest("lobby-3x3-contact").onclick();
  const firstContact=contacts3x3.get(id+"/2");
  assert.equal(firstContact?.attacker_id,opponent);
  assert.equal(firstContact.attacker_slot,4);
  assert.equal(firstContact.defender_slot,5);
  assert.equal(firstContact.attacker_hex,4);
  assert.equal(firstContact.defender_hex,5);
  assert.equal(firstContact.attacker_hp_at_contact,55);
  assert.equal(firstContact.defender_hp_at_contact,35);
  assert.equal(firstContact.damage_applied,false);
  assert.equal(firstContact.attack_card_validated,false);
  assert.equal(firstContact.official_match_modified,false);
  assert.equal(guest("lobby-3x3-attack-project").hidden,false);
  assert.ok((await makeClient(owner).rpc("chaotic_prepare_preview_3x3_base_attack",{
    p_lobby_id:id,p_expected_turn:2,p_attack_card_slot:1})).error,
    "Host cannot validate an Attack on the guest's turn");
  assert.ok((await makeClient(opponent).rpc("chaotic_prepare_preview_3x3_base_attack",{
    p_lobby_id:id,p_expected_turn:2,p_attack_card_slot:4})).error,
    "An empty Attack slot cannot be projected");
  const originalCost=deckB.attacks[0].custo;
  deckB.attacks[0].custo=45;
  assert.ok((await makeClient(opponent).rpc("chaotic_prepare_preview_3x3_base_attack",{
    p_lobby_id:id,p_expected_turn:2,p_attack_card_slot:1})).error,
    "Attack card numbers cannot override the authoritative catalog");
  deckB.attacks[0].custo=originalCost;
  guest("lobby-3x3-attack-slot").value="1";
  await guest("lobby-3x3-attack-project").onclick();
  const guestAttack=attackProjections3x3.get(id+"/2");
  assert.equal(guestAttack?.catalog_attack_id,"104");
  assert.equal(guestAttack.base_damage,5);
  assert.equal(guestAttack.defender_hp_before,35);
  assert.equal(guestAttack.defender_hp_projected,30);
  assert.equal(guestAttack.projected_hp_loss,5);
  assert.equal(guestAttack.attack_cost_paid,false);
  assert.equal(guestAttack.attack_in_hand_verified,false);
  assert.equal(guestAttack.training_hp_changed,false);
  assert.equal(guestAttack.official_hp_changed,false);
  assert.equal(guest("lobby-3x3-cost-check").hidden,false);
  const guestCard=hand3x3Cards.get(id+"/"+opponent+"/1");
  guestCard.card_state="deck";
  assert.ok((await makeClient(opponent).rpc("chaotic_inspect_preview_3x3_hand_cost",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "Attack that is not in owner's hand cannot pass the cost inspection");
  guestCard.card_state="hand";
  assert.ok((await makeClient(owner).rpc("chaotic_inspect_preview_3x3_hand_cost",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "Opponent cannot inspect or spend another player's attack");
  await guest("lobby-3x3-cost-check").onclick();
  const guestCost=costChecks3x3.get(id+"/2");
  assert.equal(guestCost.hand_verified,true);
  assert.equal(guestCost.can_afford,true);
  assert.equal(guestCost.attack_cost,2);
  assert.equal(guestCost.points_available,3);
  assert.equal(guestCost.points_after_if_paid,1);
  assert.equal(guestCost.actual_attack_cost_paid,false);
  assert.equal(guestCost.original_card_consumed,false);
  assert.equal(hand3x3Wallets.get(id+"/"+opponent).spent_points,0);
  assert.equal(hand3x3Cards.get(id+"/"+opponent+"/1").card_state,"hand");
  assert.match(guest("lobby-3x3-cost-history").textContent,/Ainda não pago/);
  assert.ok((await makeClient(opponent).rpc("chaotic_inspect_preview_3x3_hand_cost",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "Cost inspection must be idempotent / reject a second event");
  assert.equal(guest("lobby-3x3-attack-spend").hidden,false);
  assert.ok((await makeClient(owner).rpc("chaotic_spend_preview_3x3_attack",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "Only owner of the current turn can pay an attack cost");
  const blocked=hand3x3Cards.get(id+"/"+opponent+"/1");
  blocked.card_state="deck";
  assert.ok((await makeClient(opponent).rpc("chaotic_spend_preview_3x3_attack",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "Spending must reject a card no longer in the server-dealt hand");
  blocked.card_state="hand";
  await guest("lobby-3x3-attack-spend").onclick();
  const guestSpend=attackSpends3x3.get(id+"/2");
  assert.equal(guestSpend?.training_attack_cost,2);
  assert.equal(guestSpend?.points_before,3);
  assert.equal(guestSpend?.points_after,1);
  assert.equal(guestSpend.training_points_paid,true);
  assert.equal(guestSpend.training_card_spent,true);
  assert.equal(guestSpend.official_points_changed,false);
  assert.equal(guestSpend.original_card_consumed,false);
  assert.equal(guestSpend.training_damage_applied,false);
  assert.equal(hand3x3Wallets.get(id+"/"+opponent).spent_points,2);
  assert.equal(hand3x3Cards.get(id+"/"+opponent+"/1").card_state,"spent");
  assert.equal(hand3x3Cards.get(id+"/"+opponent+"/1").spent_turn,2);
  assert.equal(hand3x3Cards.get(id+"/"+opponent+"/1").spent_reason,"attack");
  assert.equal(guest("lobby-3x3-attack-spend").hidden,true);
  assert.match(guest("lobby-3x3-spend-history").textContent,/3 → 1 pontos/);
  assert.ok((await makeClient(opponent).rpc("chaotic_spend_preview_3x3_attack",{
    p_lobby_id:id,p_expected_turn:2})).error,"Clicking twice must never debit twice");
  assert.equal(hand3x3Wallets.get(id+"/"+opponent).spent_points,2);
  assert.equal(hp3x3.get(id+"/"+owner+"/5").hp_remaining,35,
    "Only damage projection is saved; no training HP is changed");
  assert.match(guest("lobby-3x3-attack-history").textContent,/SOMENTE SE dano-base/);
  assert.equal(guest("lobby-3x3-attack-project").hidden,true);
  assert.ok((await makeClient(opponent).rpc("chaotic_prepare_preview_3x3_base_attack",{
    p_lobby_id:id,p_expected_turn:2,p_attack_card_slot:1})).error,
    "Replay cannot create a second 3x3 Attack projection");
  assert.match(guest("lobby-3x3-contact-history").textContent,/Contato registrado/);
  assert.ok((await makeClient(opponent).rpc("chaotic_open_preview_3x3_contact",{
    p_lobby_id:id,p_expected_turn:2,p_attacker_slot:4,p_defender_slot:5})).error,
    "A second contact cannot be recorded in the same player turn");
  assert.ok((await makeClient(opponent).rpc("chaotic_pass_turn",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "Paid 3x3 attack MUST NOT advance without defensive pass, even before opening window");
  assert.ok((await makeClient(owner).rpc("chaotic_open_preview_3x3_defense_window",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "The defender cannot open the attacker's priority window");
  assert.ok((await makeClient(owner).rpc("chaotic_pass_preview_3x3_defense",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "The defender cannot pass a window that has not been opened");
  assert.equal(guest("lobby-3x3-defense-open").hidden,false);
  await guest("lobby-3x3-defense-open").onclick();
  const firstWindow=defenseWindows3x3.get(id+"/2");
  assert.equal(firstWindow?.attacker_id,opponent);
  assert.equal(firstWindow?.defender_id,owner);
  assert.equal(firstWindow?.status,"awaiting_defender");
  assert.equal(firstWindow?.defensive_effect_executed,false);
  assert.equal(firstWindow?.official_match_modified,false);
  assert.equal(guest("lobby-3x3-defense-open").hidden,true);
  assert.ok((await makeClient(opponent).rpc("chaotic_open_preview_3x3_defense_window",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "Cannot re-open defender priority to farm a second reaction");
  assert.ok((await makeClient(opponent).rpc("chaotic_pass_preview_3x3_defense",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "The attacker cannot masquerade as the defender");
  assert.ok((await makeClient(opponent).rpc("chaotic_pass_turn",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "Even after opening the window, the turn is blocked pending the defender");
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-3x3-defense-pass").hidden,false);
  assert.equal(host("lobby-3x3-element-review").hidden,false);
  assert.ok((await makeClient(opponent).rpc("chaotic_inspect_preview_3x3_elemental_defense",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "Attacker cannot issue defender-only elemental audit");
  await host("lobby-3x3-element-review").onclick();
  const firstElements=elementReviews3x3.get(id+"/2");
  assert.equal(firstElements?.catalog_attack_id,"104");
  assert.equal(firstElements?.base_damage,5);
  assert.equal(firstElements?.fire_component,5);
  assert.equal(firstElements?.water_component,0);
  assert.equal(firstElements?.special_resolution,"six_sided_base_multiplier");
  assert.equal(firstElements?.elemental_eligibility_verified,false);
  assert.equal(firstElements?.special_effect_executed,false);
  assert.equal(firstElements?.training_hp_changed,false);
  assert.equal(hp3x3.get(id+"/"+owner+"/5").hp_remaining,35);
  assert.match(host("lobby-3x3-element-history").textContent,/dado de 6 lados/);
  assert.equal(host("lobby-3x3-element-review").hidden,true);
  assert.ok((await makeClient(owner).rpc("chaotic_inspect_preview_3x3_elemental_defense",{
    p_lobby_id:id,p_expected_turn:2})).error,
    "Defender cannot repeat element audit to change projected outcome");
  await host("lobby-3x3-defense-pass").onclick();
  assert.equal(defenseWindows3x3.get(id+"/2").status,"defender_passed_preview");
  assert.equal(host("lobby-3x3-defense-pass").hidden,true);
  assert.ok((await makeClient(owner).rpc("chaotic_pass_preview_3x3_defense",{
    p_lobby_id:id,p_expected_turn:2})).error,"The defender pass is single-use");
  await guest("lobby-turn-refresh").onclick();
  assert.match(guest("lobby-3x3-defense-history").textContent,/Defensor PASSOU/);
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-3x3-hand-sync").hidden,false);
  assert.ok((await makeClient(opponent).rpc("chaotic_sync_preview_3x3_hand",{
    p_lobby_id:id,p_expected_turn:3})).error,
    "Guest cannot draw from host's hand on host's turn");
  await host("lobby-3x3-hand-sync").onclick();
  assert.equal(hand3x3Wallets.get(id+"/"+owner).last_draw_turn,3);
  assert.equal(host("lobby-3x3-hand-sync").hidden,true);
  host("lobby-3x3-contact-attacker").value="5";
  host("lobby-3x3-contact-defender").value="4";
  assert.equal(host("lobby-3x3-move").hidden,false,
    "Attacker has not moved this turn before contact");
  await host("lobby-3x3-contact").onclick();
  const secondContact=contacts3x3.get(id+"/3");
  assert.equal(secondContact?.attacker_id,owner);
  assert.equal(secondContact?.attacker_hp_at_contact,35);
  assert.equal(secondContact?.defender_hp_at_contact,55);
  assert.equal(host("lobby-3x3-attack-project").hidden,false);
  host("lobby-3x3-attack-slot").value="1";
  await host("lobby-3x3-attack-project").onclick();
  const hostAttack=attackProjections3x3.get(id+"/3");
  assert.equal(hostAttack?.catalog_attack_id,"101");
  assert.equal(hostAttack?.attack_cost,3);
  assert.equal(hostAttack?.defender_hp_before,55);
  assert.equal(hostAttack?.defender_hp_projected,45);
  assert.equal(hostAttack?.projected_hp_loss,10);
  assert.equal(hostAttack?.calculation_scope,"base_only_unresolved");
  await host("lobby-3x3-cost-check").onclick();
  const hostCost=costChecks3x3.get(id+"/3");
  assert.equal(hostCost?.hand_verified,true);
  assert.equal(hostCost?.points_available,4);
  assert.equal(hostCost?.attack_cost,3);
  assert.equal(hostCost?.points_after_if_paid,1);
  assert.equal(hostCost?.actual_attack_cost_paid,false);
  assert.equal(hostCost?.training_hp_changed,false);
  assert.equal(host("lobby-3x3-attack-spend").hidden,false);
  const tooExpensive=costChecks3x3.get(id+"/3");
  tooExpensive.can_afford=false;
  assert.ok((await makeClient(owner).rpc("chaotic_spend_preview_3x3_attack",{
    p_lobby_id:id,p_expected_turn:3})).error,
    "Server rejects payment whenever the inspection is not affordable");
  tooExpensive.can_afford=true;
  await host("lobby-3x3-attack-spend").onclick();
  const hostSpend=attackSpends3x3.get(id+"/3");
  assert.equal(hostSpend?.training_attack_cost,3);
  assert.equal(hostSpend?.points_before,4);
  assert.equal(hostSpend?.points_after,1);
  assert.equal(hostSpend?.training_damage_applied,false);
  assert.equal(hostSpend?.official_match_modified,false);
  assert.equal(hand3x3Wallets.get(id+"/"+owner).spent_points,3);
  assert.equal(hand3x3Cards.get(id+"/"+owner+"/1").card_state,"spent");
  assert.equal(host("lobby-3x3-attack-spend").hidden,true);
  assert.ok((await makeClient(owner).rpc("chaotic_spend_preview_3x3_attack",{
    p_lobby_id:id,p_expected_turn:3})).error,
    "Replayed Attack cost must not be charged again");
  assert.equal(hp3x3.get(id+"/"+opponent+"/4").hp_remaining,55);
  assert.equal(host("lobby-3x3-move").hidden,true,
    "Contact freezes further movement on its own turn");
  assert.ok((await makeClient(owner).rpc("chaotic_move_preview_3x3_unit",{
    p_lobby_id:id,p_expected_turn:3,p_formation_slot:5,p_target_hex:2})).error,
    "Server must block movement after opening a 3x3 contact");
  assert.equal(boardPositions3x3.get(id+"/"+owner+"/5").hex_position,5);
  assert.equal(hp3x3.get(id+"/"+owner+"/5").hp_remaining,35);
  assert.ok((await makeClient(owner).rpc("chaotic_pass_turn",{
    p_lobby_id:id,p_expected_turn:3})).error,
    "A host-paid 3x3 Attack cannot bypass defender acknowledgement");
  await host("lobby-3x3-defense-open").onclick();
  assert.equal(defenseWindows3x3.get(id+"/3").attacker_id,owner);
  await guest("lobby-turn-refresh").onclick();
  assert.equal(guest("lobby-3x3-defense-pass").hidden,false);
  assert.equal(guest("lobby-3x3-element-review").hidden,false);
  await guest("lobby-3x3-element-review").onclick();
  const secondElements=elementReviews3x3.get(id+"/3");
  assert.equal(secondElements?.catalog_attack_id,"101");
  assert.equal(secondElements?.base_damage,10);
  assert.equal(secondElements?.fire_component,5);
  assert.equal(secondElements?.water_component,5);
  assert.equal(secondElements?.special_resolution,"none");
  assert.equal(secondElements?.defender_equipment_verified,false);
  assert.equal(secondElements?.final_damage_calculated,false);
  assert.equal(secondElements?.official_match_modified,false);
  assert.equal(hp3x3.get(id+"/"+opponent+"/4").hp_remaining,55);
  await guest("lobby-3x3-defense-pass").onclick();
  assert.equal(defenseWindows3x3.get(id+"/3").status,"defender_passed_preview");
  assert.equal(defenseWindows3x3.get(id+"/3").training_hp_changed,false);
  await host("lobby-turn-refresh").onclick();
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  assert.equal(guest("lobby-3x3-hand-sync").hidden,false);
  await guest("lobby-3x3-hand-sync").onclick();
  const guestDraw=hand3x3DrawEvents.get(id+"/4/"+opponent);
  assert.equal(guestDraw?.recycled_count,1,
    "A paid training Attack returns to the private draw pile only on a later turn");
  assert.equal(guestDraw?.drew_card,true);
  assert.equal(guestDraw?.drawn_card_slot,1);
  assert.equal(guestDraw?.recycle_cycle,1);
  assert.equal(hand3x3Cards.get(id+"/"+opponent+"/1").card_state,"hand");
  assert.equal(hand3x3Wallets.get(id+"/"+opponent).spent_points,2,
    "Recycling cannot refund the actual previous training payment");
  assert.equal(attackSpends3x3.get(id+"/2").training_attack_cost,2,
    "The original payment audit survives recycling");
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  await host("lobby-3x3-hand-sync").onclick();
  const hostDraw=hand3x3DrawEvents.get(id+"/5/"+owner);
  assert.equal(hostDraw?.recycled_count,1);
  assert.equal(hostDraw?.drawn_card_slot,1);
  assert.equal(hand3x3Wallets.get(id+"/"+owner).spent_points,3);
  assert.equal(attackSpends3x3.get(id+"/3").points_after,1);
  assert.equal(hp3x3.get(id+"/"+opponent+"/4").hp_remaining,55,
    "Recycling must not apply damage or affect the defender's HP");
});

test("3x3 private discard recycles ONLY spent cards on next valid turn and never refunds attack points",async()=>{
  const owner="recycle3-host",opponent="recycle3-guest";
  const host=browser(owner),guest=browser(opponent);
  host("lobby-select-mode").value="3x3";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  const id=[...rooms.values()].find(x=>x.code===code).id;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  const card=(id,name)=>({id,name,quantity:1,danoBase:
    name==="Ácido Gástrico"?10:name==="Fogo Primordial 2.0"?5:0,
    custo:name==="Ácido Gástrico"?3:name==="Fogo Primordial 2.0"?2:0});
  const deck=[null,null,null,
    {id:"recycle-alakazaz",name:"Alakazaz"},
    {id:"recycle-vidal",name:"Vidal"},{id:"recycle-lion",name:"Lion"}];
  deck.attacks=[card("recycle-a101","Ácido Gástrico"),
    card("recycle-a104","Fogo Primordial 2.0"),card("recycle-a102","Mão Negra")];
  decks3x3.set(owner+"/1",deck);
  host("lobby-3x3-deck").value="1";
  await host("lobby-3x3-prepare").onclick();
  await host("lobby-3x3-hand-prepare").onclick();
  assert.equal(hand3x3Wallets.get(id+"/"+owner).recycle_cycles,0);
  assert.equal(host("lobby-3x3-discard").hidden,false);
  host("lobby-3x3-discard-slot").value="1";
  assert.ok((await makeClient(opponent).rpc("chaotic_discard_preview_3x3_hand",{
    p_lobby_id:id,p_expected_turn:1,p_card_slot:1})).error,
    "The opponent cannot discard our private card");
  assert.ok((await makeClient(owner).rpc("chaotic_discard_preview_3x3_hand",{
    p_lobby_id:id,p_expected_turn:1,p_card_slot:18})).error,
    "A nonexisting card slot cannot be discarded");
  await host("lobby-3x3-discard").onclick();
  assert.equal(hand3x3Cards.get(id+"/"+owner+"/1").card_state,"spent");
  assert.equal(hand3x3Cards.get(id+"/"+owner+"/1").spent_reason,"discard");
  assert.equal(hand3x3Cards.get(id+"/"+owner+"/1").spent_turn,1);
  assert.equal(hand3x3Wallets.get(id+"/"+owner).spent_points,0);
  assert.equal(hand3x3Discards.get(id+"/1/"+owner).training_points_changed,false);
  assert.equal(hand3x3Discards.get(id+"/1/"+owner).original_card_consumed,false);
  assert.equal(host("lobby-3x3-discard").hidden,true);
  assert.ok((await makeClient(owner).rpc("chaotic_discard_preview_3x3_hand",{
    p_lobby_id:id,p_expected_turn:1,p_card_slot:2})).error,
    "Only one voluntary discard is allowed per turn");
  assert.equal([...hand3x3Cards.values()].filter(x=>x.lobby_id===id&&x.actor_id===owner&&x.card_state==="deck").length,0);
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  assert.ok((await makeClient(owner).rpc("chaotic_sync_preview_3x3_hand",{
    p_lobby_id:id,p_expected_turn:2})).error,"Cannot recycle on the other player's turn");
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-3x3-hand-sync").hidden,false);
  await host("lobby-3x3-hand-sync").onclick();
  assert.equal(hand3x3Wallets.get(id+"/"+owner).recycle_cycles,1);
  const firstDraw=hand3x3DrawEvents.get(id+"/3/"+owner);
  assert.equal(firstDraw.drew_card,true);
  assert.equal(firstDraw.recycled_count,1);
  assert.equal(firstDraw.recycle_cycle,1);
  assert.equal(firstDraw.drawn_card_slot,1);
  assert.equal(firstDraw.hand_count_after,3);
  assert.equal(firstDraw.available_points,4);
  assert.equal(hand3x3Cards.get(id+"/"+owner+"/1").card_state,"hand");
  assert.equal(hand3x3Cards.get(id+"/"+owner+"/1").spent_turn,null);
  assert.equal(hand3x3Cards.get(id+"/"+owner+"/1").spent_reason,null);
  assert.equal(hand3x3Wallets.get(id+"/"+owner).spent_points,0);
  assert.equal(host("lobby-3x3-hand-sync").hidden,true);
  assert.match(host("lobby-3x3-recycle-history").textContent,/reciclar 1 carta/);
  const repeated=await makeClient(owner).rpc("chaotic_sync_preview_3x3_hand",{
    p_lobby_id:id,p_expected_turn:3});
  assert.equal(repeated.data?.drew_card,false,
    "Repeated synchronization should never draw another card");
  assert.equal(hand3x3DrawEvents.size>0,true);
  assert.equal(hand3x3Wallets.get(id+"/"+owner).recycle_cycles,1);
  assert.equal(hand3x3Cards.get(id+"/"+owner+"/1").card_state,"hand");
  assert.equal(host("lobby-3x3-hand-history").textContent.includes("Reciclagens: 1"),true);
});

test("Lion, Vidal and Xamã spend exactly one TRAINING token and update only hypothetical HP",async()=>{
  const cases=[
    {name:"Lion",gain:10,hostHp:20,max:30,target:"self",startTokens:1,expectedHp:30,expectedMax:40},
    {name:"Vidal",gain:15,hostHp:20,max:30,target:"opponent",startTokens:2,expectedHp:30,expectedMax:30},
    {name:"Xamã",gain:10,hostHp:20,max:30,target:"opponent",startTokens:4,expectedHp:30,expectedMax:30}
  ];
  for(const c of cases){
    const actor="ability-"+c.name+"-host",defender="ability-"+c.name+"-guest";
    const host=browser(actor),guest=browser(defender);
    host("lobby-select-mode").value="1x1";
    await host("lobby-create-btn").onclick();
    const code=host("lobby-room-code").textContent;
    const id=[...rooms.values()].find(x=>x.code===code).id;
    guest("lobby-input-code").value=code;
    await guest("lobby-join-btn").onclick();
    await host("lobby-refresh").onclick();
    await host("lobby-turn-start").onclick();
    const instance="instance-"+c.name;
    loadouts.set(id+"/"+actor,{
      lobby_id:id,actor_id:actor,position:6,card_instance_id:instance,
      creature_name:c.name,tribe:"Azul",stats:{e:30}
    });
    loadouts.set(id+"/"+defender,{
      lobby_id:id,actor_id:defender,position:6,card_instance_id:"target-"+c.name,
      creature_name:"Alakazaz",tribe:"Azul",stats:{e:30}
    });
    for(const [who,instanceId] of [[actor,instance],[defender,"target-"+c.name]]){
      hpWallets.set(id+"/"+who,{
        lobby_id:id,actor_id:who,creature_instance_id:instanceId,
        hp_max:30,hp_remaining:who===actor?(c.target==="self"?20:25):20,
        location_id:501,init_turn:1,projected_hits:0
      });
    }
    mugicTrainingWallets.set(id+"/"+actor,{
      lobby_id:id,actor_id:actor,creature_instance_id:instance,
      creature_name:c.name,starting_tokens:c.startTokens,remaining_tokens:c.startTokens,
      official_match_modified:false
    });
    await host("lobby-turn-refresh").onclick();
    assert.equal(host("lobby-ability-heal-activate").hidden,false,
      c.name+" can use its own validated ability before a clash");
    host("lobby-ability-target").value=c.target;
    const who=c.target==="self"?actor:defender;
    const other=c.target==="self"?defender:actor;
    const previous=hpWallets.get(id+"/"+other).hp_remaining;
    if(c.name==="Lion"){
      assert.ok((await makeClient(actor).rpc("chaotic_apply_preview_ability_heal",{
        p_lobby_id:id,p_expected_turn:1,p_target_actor_id:defender
      })).error,"Lion cannot buff the opponent");
    }
    assert.ok((await makeClient(defender).rpc("chaotic_apply_preview_ability_heal",{
      p_lobby_id:id,p_expected_turn:1,p_target_actor_id:who
    })).error,"Opponent cannot spend other player's tokens");
    await host("lobby-ability-heal-activate").onclick();
    const event=trainingAbilityEvents.get(id+"/1/"+actor);
    assert.equal(event?.source_creature_name,c.name);
    assert.equal(event.token_cost,1);
    assert.equal(event.tokens_before,c.startTokens);
    assert.equal(event.tokens_after,c.startTokens-1);
    assert.equal(event.hp_after,c.expectedHp);
    assert.equal(event.hp_max_after,c.expectedMax);
    assert.equal(event.official_hp_changed,false);
    assert.equal(event.official_tokens_consumed,false);
    assert.equal(mugicTrainingWallets.get(id+"/"+actor).remaining_tokens,c.startTokens-1);
    assert.equal(hpWallets.get(id+"/"+who).hp_remaining,c.expectedHp);
    assert.equal(hpWallets.get(id+"/"+other).hp_remaining,previous);
    assert.match(host("lobby-ability-heal-history").textContent,/HP de teste/);
    assert.ok((await makeClient(actor).rpc("chaotic_apply_preview_ability_heal",{
      p_lobby_id:id,p_expected_turn:1,p_target_actor_id:who
    })).error,"Replay cannot debit twice in the same turn");
    assert.equal(mugicTrainingWallets.get(id+"/"+actor).remaining_tokens,c.startTokens-1);
  }
});

test("Burst 1x1 inspects Creation countered by Rejection in LIFO without consumption",async()=>{
  const host=browser("mugic-lifo-host"),guest=browser("mugic-lifo-guest");
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  const id=[...rooms.values()].find(x=>x.code===code).id;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="6";
  await host("lobby-combat-submit").onclick();
  await host("lobby-hex-place").onclick();
  await host("lobby-loadout-capture").onclick();
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
  await host("lobby-hand-prepare").onclick();
  host("lobby-combat-kind").value="attack";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="1";
  await host("lobby-combat-submit").onclick();
  await host("lobby-clash-open").onclick();
  assert.equal(host("lobby-burst-open").hidden,true);
  await host("lobby-attack-instance-capture").onclick();
  assert.equal(host("lobby-burst-open").hidden,false);
  await host("lobby-burst-open").onclick();
  await guest("lobby-turn-refresh").onclick();
  await guest("lobby-burst-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  await host("lobby-burst-priority-open").onclick();
  assert.equal(host("lobby-burst-mugic-create").hidden,false);
  await host("lobby-burst-mugic-create").onclick();
  const creation=burstMugicIntents.get(id+"/3/mugic-lifo-host");
  assert.equal(creation?.catalog_mugic_id,"301");
  assert.equal(creation.consumes_tokens,false);
  assert.equal(host("lobby-burst-mugic-counterplan").hidden,true);
  assert.ok((await makeClient("mugic-lifo-host").rpc("chaotic_prepare_preview_mugic_counterplan",{
    p_lobby_id:id,p_expected_turn:3})).error,"Cannot counter before two passes");
  await host("lobby-burst-priority-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  assert.equal(guest("lobby-burst-mugic-reject").hidden,false);
  await guest("lobby-burst-mugic-reject").onclick();
  assert.equal(guest("lobby-burst-mugic-history").textContent.includes("Canção da Criação"),false,
    "Opponent must not see private Creation before counterplan");
  await guest("lobby-burst-priority-pass").onclick();
  assert.ok((await makeClient("mugic-lifo-guest").rpc("chaotic_prepare_preview_mugic_counterplan",{
    p_lobby_id:id,p_expected_turn:3})).error,"Defender cannot forge the review");
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-burst-mugic-counterplan").hidden,false);
  assert.equal(host("lobby-burst-order-prepare").hidden,true);
  await host("lobby-burst-mugic-counterplan").onclick();
  const plan=burstMugicCounterplans.get(id+"/3");
  assert.equal(plan?.inspection_steps[0].name,"Canção da Rejeição");
  assert.equal(plan.inspection_steps[1].name,"Canção da Criação");
  assert.equal(plan.hypothetical_creation_negated,true);
  assert.equal(plan.token_balance_verified,false);
  assert.equal(plan.effect_executed,false);
  assert.equal(plan.consumes_cards,false);
  assert.equal(plan.consumes_tokens,false);
  assert.match(host("lobby-burst-mugic-counter-history").textContent,/INSPEÇÃO LIFO/);
  assert.ok((await makeClient("mugic-lifo-host").rpc("chaotic_prepare_preview_mugic_counterplan",{
    p_lobby_id:id,p_expected_turn:3})).error,"Cannot repeat the review");
  await guest("lobby-turn-refresh").onclick();
  assert.match(guest("lobby-burst-mugic-counter-history").textContent,/Rejeição/);
  assert.equal(host("lobby-mugic-token-settle").hidden,false);
  assert.ok((await makeClient("mugic-lifo-host").rpc("chaotic_simulate_preview_mugic_counter_cost",{
    p_lobby_id:id,p_expected_turn:3})).error,"Both players must seed wallets before debiting");
  await host("lobby-mugic-token-wallet-prepare").onclick();
  await guest("lobby-mugic-token-wallet-prepare").onclick();
  assert.equal(mugicTrainingWallets.get(id+"/mugic-lifo-host").starting_tokens,5);
  assert.equal(mugicTrainingWallets.get(id+"/mugic-lifo-guest").starting_tokens,5);
  const beforeInsufficient=mugicTrainingWallets.get(id+"/mugic-lifo-guest");
  beforeInsufficient.remaining_tokens=1;
  assert.ok((await makeClient("mugic-lifo-host").rpc("chaotic_simulate_preview_mugic_counter_cost",{
    p_lobby_id:id,p_expected_turn:3})).error,"If defender lacks 2 tokens, neither user pays");
  assert.equal(mugicTrainingWallets.get(id+"/mugic-lifo-host").remaining_tokens,5);
  assert.equal(mugicTrainingSettlements.has(id+"/3"),false);
  beforeInsufficient.remaining_tokens=5;
  await host("lobby-turn-refresh").onclick();
  await host("lobby-mugic-token-settle").onclick();
  const paid=mugicTrainingSettlements.get(id+"/3");
  assert.equal(paid.attacker_tokens_before,5);
  assert.equal(paid.attacker_tokens_after,4);
  assert.equal(paid.defender_tokens_before,5);
  assert.equal(paid.defender_tokens_after,3);
  assert.equal(paid.original_card_consumed,false);
  assert.equal(paid.actual_mugic_effect_executed,false);
  assert.equal(paid.official_match_modified,false);
  assert.equal(burstMugicIntents.get(id+"/3/mugic-lifo-host").intent_status,"resolved_training");
  assert.equal(burstMugicIntents.get(id+"/3/mugic-lifo-guest").intent_status,"resolved_training");
  assert.ok((await makeClient("mugic-lifo-host").rpc("chaotic_simulate_preview_mugic_counter_cost",{
    p_lobby_id:id,p_expected_turn:3})).error,"Duplicate request must never debit twice");
  assert.ok((await makeClient("mugic-lifo-guest").rpc("chaotic_simulate_preview_mugic_counter_cost",{
    p_lobby_id:id,p_expected_turn:3})).error,"Defender cannot forge attacker resource debit");
  assert.equal(mugicTrainingWallets.get(id+"/mugic-lifo-host").remaining_tokens,4);
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-burst-order-prepare").hidden,false,
    "Completed training-only Mugic cost can unlock existing attack inspection");
  await host("lobby-burst-order-prepare").onclick();
  assert.equal(burstOrderPlans.get(id+"/3").burst_stack_executed,false);
  assert.equal(matches.get(id).current_player,"mugic-lifo-host");
});

test("1x1 Burst defender may pass during attacker's turn but cannot resolve damage",async()=>{
  const host=browser("burst-host"),guest=browser("burst-guest");
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  const id=[...rooms.values()].find(x=>x.code===code).id;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="6";
  await host("lobby-combat-submit").onclick();
  await host("lobby-hex-place").onclick();
  await host("lobby-loadout-capture").onclick();
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
  await host("lobby-hand-prepare").onclick();
  host("lobby-combat-kind").value="attack";
  host("lobby-combat-deck").value="1";
  host("lobby-combat-slot").value="1";
  await host("lobby-combat-submit").onclick();
  await host("lobby-clash-open").onclick();
  assert.equal(host("lobby-burst-open").hidden,true);
  await host("lobby-attack-instance-capture").onclick();
  assert.equal(host("lobby-burst-open").hidden,false);
  await host("lobby-burst-open").onclick();
  assert.equal(burstWindows.get(id+"/3").status,"awaiting_defender");
  assert.ok((await makeClient("burst-host").rpc("chaotic_prepare_preview_burst_order",{
    p_lobby_id:id,p_expected_turn:3})).error,"Cannot plan before defender responded");
  assert.equal(host("lobby-turn-pass").hidden,true,
    "Attacker cannot pass while defender is deciding");
  assert.ok((await makeClient("burst-host").rpc("chaotic_pass_turn",{
    p_lobby_id:id,p_expected_turn:3})).error,
    "Direct RPC cannot skip pending Burst");
  await host("lobby-hand-spend").onclick();
  assert.equal(host("lobby-individual-damage-calculate").hidden,true,
    "Defender's pending response blocks damage preview");
  assert.ok((await makeClient("burst-host").rpc("chaotic_calculate_individual_preview",{
    p_lobby_id:id,p_expected_turn:3})).error,
    "Direct RPC cannot bypass a pending defender response");
  assert.equal(host("lobby-burst-open").hidden,true);
  assert.ok((await makeClient("burst-host").rpc("chaotic_pass_preview_burst",{
    p_lobby_id:id,p_expected_turn:3})).error,"Attacker cannot pass as defender");
  assert.ok((await makeClient("intruder").rpc("chaotic_pass_preview_burst",{
    p_lobby_id:id,p_expected_turn:3})).error,"Third party cannot respond");
  assert.ok((await makeClient("burst-host").rpc("chaotic_open_preview_burst",{
    p_lobby_id:id,p_expected_turn:3})).error,"Cannot open the same Burst twice");
  await guest("lobby-turn-refresh").onclick();
  assert.equal(guest("lobby-burst-pass").hidden,false,
    "Defender may pass even though not current player");
  await guest("lobby-burst-pass").onclick();
  const win=burstWindows.get(id+"/3");
  assert.equal(win.status,"defender_passed");
  assert.equal(win.defender_response,"pass");
  assert.equal(win.burst_fully_resolved,false);
  assert.equal(win.final_damage_verified,false);
  assert.equal(matches.get(id).current_player,"burst-host");
  assert.equal(guest("lobby-burst-pass").hidden,true);
  assert.ok((await makeClient("burst-guest").rpc("chaotic_pass_preview_burst",{
    p_lobby_id:id,p_expected_turn:3})).error,"Pass is one-time");
  await host("lobby-turn-refresh").onclick();
  assert.match(host("lobby-burst-history").textContent,/PASSAR/);
  assert.equal(host("lobby-burst-order-prepare").hidden,true);
  assert.ok((await makeClient("burst-host").rpc("chaotic_prepare_preview_burst_order",{
    p_lobby_id:id,p_expected_turn:3})).error,"Cannot prepare before both priority passes");
  assert.ok((await makeClient("burst-guest").rpc("chaotic_prepare_preview_burst_order",{
    p_lobby_id:id,p_expected_turn:3})).error,"Defender cannot forge attacker plan");
  await completePriority(host,guest,true);
  await host("lobby-burst-order-prepare").onclick();
  const plan=burstOrderPlans.get(id+"/3");
  assert.equal(plan.inspection_step_count,1,"PASS is not a counter-card");
  assert.equal(plan.inspection_steps[0].stage,"inspect_attack");
  assert.equal(plan.burst_stack_executed,false);
  assert.equal(plan.final_damage_verified,false);
  assert.match(host("lobby-burst-order-history").textContent,/PASSOU/);
  assert.ok((await makeClient("burst-host").rpc("chaotic_prepare_preview_burst_order",{
    p_lobby_id:id,p_expected_turn:3})).error,"Cannot recapture sequence");
  assert.equal(host("lobby-turn-pass").hidden,false);
  assert.equal(host("lobby-individual-damage-calculate").hidden,false);
  await host("lobby-individual-damage-calculate").onclick();
  await host("lobby-resolution-audit-capture").onclick();
  const audit=resolutionAudits.get(id+"/3");
  assert.ok(audit.blocker_codes.includes("burst_defender_passed_preview_only"));
  assert.ok(audit.blocker_codes.includes("burst_unresolved"));
  assert.equal(audit.final_damage_verified,false);
  assert.match(host("lobby-resolution-audit-history").textContent,/defensor passou/);
  await host("lobby-turn-pass").onclick();
  assert.ok((await makeClient("burst-guest").rpc("chaotic_pass_preview_burst",{
    p_lobby_id:id,p_expected_turn:3})).error,"Stale Burst cannot be passed");
  assert.equal(matches.get(id).current_player,"burst-guest");
});

for (const defenseKind of ["rex","amulet"]) {

test("Burst 1x1 validates "+defenseKind+" immunity to Ar without changing official damage",async()=>{
  const hostId="air-"+defenseKind+"-host",guestId="air-"+defenseKind+"-guest";
  const host=browser(hostId),guest=browser(guestId);
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const code=host("lobby-room-code").textContent;
  const id=[...rooms.values()].find(x=>x.code===code).id;
  guest("lobby-input-code").value=code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";host("lobby-combat-slot").value="6";
  await host("lobby-combat-submit").onclick();
  await host("lobby-hex-place").onclick();
  await host("lobby-loadout-capture").onclick();
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  guest("lobby-combat-kind").value="creature";
  guest("lobby-combat-deck").value="1";guest("lobby-combat-slot").value="6";
  await guest("lobby-combat-submit").onclick();
  await guest("lobby-hex-place").onclick();
  await guest("lobby-loadout-capture").onclick();
  const defender=loadouts.get(id+"/"+guestId);
  if(defenseKind==="rex"){
    defender.creature_name="Rex";
  }else{
    defender.equipment_name="Amuleto do Vácuo";
    await guest("lobby-turn-refresh").onclick();
    await guest("lobby-equipment-reveal").onclick();
  }
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  await host("lobby-hand-prepare").onclick();
  host("lobby-combat-kind").value="attack";
  host("lobby-combat-deck").value="1";host("lobby-combat-slot").value="1";
  await host("lobby-combat-submit").onclick();
  await host("lobby-clash-open").onclick();
  await host("lobby-attack-instance-capture").onclick();
  const card=attackInstances.get(id+"/3");
  card.catalog_attack_id="110";card.attack_name="SONAR";
  await host("lobby-burst-open").onclick();
  await host("lobby-hand-spend").onclick();
  assert.ok((await makeClient(hostId).rpc("chaotic_acknowledge_preview_air_immunity",{
    p_lobby_id:id,p_expected_turn:3})).error,"Attacker cannot acknowledge defense");
  assert.ok((await makeClient("intruder").rpc("chaotic_acknowledge_preview_air_immunity",{
    p_lobby_id:id,p_expected_turn:3})).error,"Outsider cannot respond");
  await guest("lobby-turn-refresh").onclick();
  assert.equal(guest("lobby-burst-air-immunity").hidden,false);
  await guest("lobby-burst-air-immunity").onclick();
  const win=burstWindows.get(id+"/3");
  assert.equal(win.status,"defender_immunity_noted");
  assert.equal(win.defender_response,"acknowledge_air_immunity");
  assert.equal(win.defensive_immunity_source,defenseKind==="rex"?"rex_air":"vacuum_amulet_air");
  assert.equal(win.burst_fully_resolved,false);
  assert.equal(win.final_damage_verified,false);
  assert.equal(guest("lobby-burst-pass").hidden,true,"Second response is forbidden");
  assert.ok((await makeClient(guestId).rpc("chaotic_acknowledge_preview_air_immunity",{
    p_lobby_id:id,p_expected_turn:3})).error,"Cannot acknowledge twice");
  await host("lobby-turn-refresh").onclick();
  assert.match(host("lobby-burst-history").textContent,/imunidade a Ar/);
  assert.equal(host("lobby-burst-order-prepare").hidden,true);
  await completePriority(host,guest);
  await host("lobby-burst-order-prepare").onclick();
  const plan=burstOrderPlans.get(id+"/3");
  assert.equal(plan.inspection_step_count,2);
  assert.equal(plan.inspection_steps[0].stage,"inspect_passive_air_immunity");
  assert.equal(plan.inspection_steps[0].source,
    defenseKind==="rex"?"rex_air":"vacuum_amulet_air");
  assert.equal(plan.inspection_steps[1].stage,"inspect_attack");
  assert.equal(plan.inspection_steps.every(x=>x.executed===false),true);
  assert.equal(plan.burst_stack_executed,false);
  assert.match(host("lobby-burst-order-history").textContent,/não é contra-ataque/);
  await guest("lobby-turn-refresh").onclick();
  assert.match(guest("lobby-burst-order-history").textContent,/conferir a carta atacante/);
  assert.equal(host("lobby-individual-damage-calculate").hidden,false);
  await host("lobby-individual-damage-calculate").onclick();
  const damage=individualDamage.get(id+"/3");
  assert.equal(damage.preview_subtotal,0,"Air immunity eliminates provisional wind damage");
  assert.match(damage.immunity_reason,/imune a Ar/);
  await host("lobby-resolution-audit-capture").onclick();
  const audit=resolutionAudits.get(id+"/3");
  assert.ok(audit.blocker_codes.includes("burst_air_immunity_acknowledged_preview_only"));
  assert.ok(audit.blocker_codes.includes("burst_unresolved"));
  assert.equal(audit.final_damage_verified,false);
  assert.equal(loadouts.get(id+"/"+guestId).stats.e,65);
  assert.equal(matches.get(id).current_player,hostId);
  assert.equal(matches.get(id).turn_no,3);
});
}

test("Burst 1x1 queues real defender equipment for LIFO inspection without premature reveal or damage",async()=>{
  const hostId="queued-gear-host",guestId="queued-gear-guest";
  const host=browser(hostId),guest=browser(guestId);
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const id=[...rooms.values()].at(-1).id;
  guest("lobby-input-code").value=host("lobby-room-code").textContent;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";host("lobby-combat-slot").value="6";
  await host("lobby-combat-submit").onclick();
  await host("lobby-hex-place").onclick();
  await host("lobby-loadout-capture").onclick();
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  guest("lobby-combat-kind").value="creature";
  guest("lobby-combat-deck").value="1";guest("lobby-combat-slot").value="6";
  await guest("lobby-combat-submit").onclick();
  await guest("lobby-hex-place").onclick();
  await guest("lobby-loadout-capture").onclick();
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  await host("lobby-hand-prepare").onclick();
  host("lobby-combat-kind").value="attack";
  host("lobby-combat-deck").value="1";host("lobby-combat-slot").value="1";
  await host("lobby-combat-submit").onclick();
  await host("lobby-clash-open").onclick();
  await host("lobby-attack-instance-capture").onclick();
  await host("lobby-burst-open").onclick();
  await host("lobby-hand-spend").onclick();
  await guest("lobby-turn-refresh").onclick();
  assert.equal(guest("lobby-burst-queue-equipment").hidden,false);
  assert.ok((await makeClient(hostId).rpc("chaotic_queue_preview_burst_equipment",{
    p_lobby_id:id,p_expected_turn:3})).error,"Attacker cannot queue defendant equipment");
  assert.ok((await makeClient("intruder").rpc("chaotic_queue_preview_burst_equipment",{
    p_lobby_id:id,p_expected_turn:3})).error,"Intruder cannot queue a response");
  await guest("lobby-burst-queue-equipment").onclick();
  const response=burstEquipmentResponses.get(id+"/3");
  assert.equal(response.equipment_name,"Equipamento original");
  assert.equal(response.equipment_actually_revealed,false);
  assert.equal(response.official_match_modified,false);
  assert.equal(equipmentReveals.has(id+"/"+guestId),false,
    "Queuing the reveal cannot apply the equipment before resolving Burst");
  assert.equal(guest("lobby-burst-queue-equipment").hidden,true);
  assert.equal(guest("lobby-burst-air-immunity").hidden,true);
  assert.ok((await makeClient(guestId).rpc("chaotic_queue_preview_burst_equipment",{
    p_lobby_id:id,p_expected_turn:3})).error,"Duplicate response rejected");
  await host("lobby-turn-refresh").onclick();
  assert.match(host("lobby-burst-equipment-history").textContent,/NÃO executada/);
  await guest("lobby-burst-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-individual-damage-calculate").hidden,true,
    "Pending equipment resolution keeps even preview damage blocked");
  assert.ok((await makeClient(hostId).rpc("chaotic_calculate_individual_preview",{
    p_lobby_id:id,p_expected_turn:3})).error,
    "Direct preview damage RPC cannot ignore queued equipment");
  await completePriority(host,guest);
  await host("lobby-burst-order-prepare").onclick();
  const plan=burstOrderPlans.get(id+"/3");
  assert.equal(plan.inspection_step_count,2);
  assert.equal(plan.inspection_steps[0].stage,"inspect_queued_equipment_reveal");
  assert.equal(plan.inspection_steps[0].equipment_name,"Equipamento original");
  assert.equal(plan.inspection_steps[1].stage,"inspect_attack");
  assert.equal(plan.inspection_steps.every(step=>step.executed===false),true);
  assert.match(host("lobby-burst-order-history").textContent,/revelação pendente/);
  await guest("lobby-turn-refresh").onclick();
  assert.match(guest("lobby-burst-order-history").textContent,/revelação pendente/);
  assert.equal(matches.get(id).current_player,hostId);
  assert.equal(matches.get(id).turn_no,3);
  assert.equal(loadouts.get(id+"/"+guestId).stats.e,65);
  assert.equal(equipmentReveals.has(id+"/"+guestId),false);
  await host("lobby-turn-pass").onclick();
  assert.equal(matches.get(id).current_player,guestId,
    "After the defender passes, turn can progress despite unresolved test-only equipment");
});

for (const scenario of [
  {name:"Anel Precioso",effect:"precious_ring_hp",hp:50,max:75,wis:70},
  {name:"Bastão da Sabedoria",effect:"wisdom_staff",hp:65,max:75,wis:110},
  {name:"Bomba de Fogo",effect:"fire_bomb_hp",hp:70,max:80,wis:70}
]) {
test("Burst equipment "+scenario.name+" changes ONLY server training ledger",async()=>{
  const hostId="equip-"+scenario.effect+"-host";
  const guestId="equip-"+scenario.effect+"-guest";
  const host=browser(hostId),guest=browser(guestId);
  host("lobby-select-mode").value="1x1";
  await host("lobby-create-btn").onclick();
  const room=[...rooms.values()].at(-1),id=room.id;
  guest("lobby-input-code").value=room.code;
  await guest("lobby-join-btn").onclick();
  await host("lobby-refresh").onclick();
  await host("lobby-turn-start").onclick();
  host("lobby-combat-kind").value="creature";
  host("lobby-combat-deck").value="1";host("lobby-combat-slot").value="6";
  await host("lobby-combat-submit").onclick();
  await host("lobby-hex-place").onclick();
  await host("lobby-loadout-capture").onclick();
  await host("lobby-turn-pass").onclick();
  await guest("lobby-turn-refresh").onclick();
  guest("lobby-combat-kind").value="creature";
  guest("lobby-combat-deck").value="1";guest("lobby-combat-slot").value="6";
  await guest("lobby-combat-submit").onclick();
  await guest("lobby-hex-place").onclick();
  await guest("lobby-loadout-capture").onclick();
  const own=loadouts.get(id+"/"+guestId);
  own.equipment_name=scenario.name;
  locations.set(id,{lobby_id:id,catalog_location_id:501});
  const wallet={lobby_id:id,actor_id:guestId,
    creature_instance_id:own.card_instance_id,
    hp_max:75,hp_remaining:65,projected_hits:0,location_id:501};
  hpWallets.set(id+"/"+guestId,wallet);
  hpWallets.set(id+"/"+hostId,{...wallet,actor_id:hostId,
    creature_instance_id:loadouts.get(id+"/"+hostId).card_instance_id});
  await guest("lobby-turn-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  await host("lobby-hand-prepare").onclick();
  host("lobby-combat-kind").value="attack";
  host("lobby-combat-deck").value="1";host("lobby-combat-slot").value="1";
  await host("lobby-combat-submit").onclick();
  await host("lobby-clash-open").onclick();
  await host("lobby-attack-instance-capture").onclick();
  if(scenario.effect==="precious_ring_hp"){
    const card=attackInstances.get(id+"/3");
    card.catalog_attack_id="110";
    card.attack_name="SONAR";
    card.base_damage=0; // Canonical SONAR: 0 base +10 Air, ring cancels Air.
  }
  await host("lobby-burst-open").onclick();
  await host("lobby-hand-spend").onclick();
  await guest("lobby-turn-refresh").onclick();
  await guest("lobby-burst-queue-equipment").onclick();
  assert.equal(host("lobby-burst-equipment-effect-apply").hidden,true,
    "Cannot apply before opponent passes and server plan exists");
  assert.ok((await makeClient(hostId).rpc("chaotic_apply_preview_burst_equipment_effect",{
    p_lobby_id:id,p_expected_turn:3})).error);
  await guest("lobby-burst-pass").onclick();
  await host("lobby-turn-refresh").onclick();
  assert.equal(host("lobby-burst-equipment-effect-apply").hidden,true,
    "Cannot apply before order inspection is prepared");
  await completePriority(host,guest);
  await host("lobby-burst-order-prepare").onclick();
  assert.equal(host("lobby-burst-equipment-effect-apply").hidden,false);
  assert.ok((await makeClient(guestId).rpc("chaotic_apply_preview_burst_equipment_effect",{
    p_lobby_id:id,p_expected_turn:3})).error,
    "Defender cannot execute from other player's turn");
  await host("lobby-burst-equipment-effect-apply").onclick();
  const ev=burstEquipmentEffects.get(id+"/3");
  assert.equal(ev.effect_code,scenario.effect);
  assert.equal(ev.hp_before,65);
  assert.equal(ev.hp_after,scenario.hp);
  assert.equal(ev.hp_max_after,scenario.max);
  assert.equal(ev.wisdom_after,scenario.wis);
  assert.equal(wallet.hp_remaining,scenario.hp);
  assert.equal(wallet.hp_max,scenario.max);
  assert.equal(ev.applied_to_official_match,false);
  assert.equal(ev.official_hp_changed,false);
  assert.equal(ev.final_damage_verified,false);
  assert.equal(own.stats.e,65,"Frozen DNA original remains unchanged");
  assert.equal(own.stats.s,70,"Frozen wisdom DNA original remains unchanged");
  assert.equal(equipmentReveals.has(id+"/"+guestId),false,
    "Training effects never reveal actual equipment");
  assert.equal(host("lobby-burst-equipment-effect-apply").hidden,true);
  assert.ok((await makeClient(hostId).rpc("chaotic_apply_preview_burst_equipment_effect",{
    p_lobby_id:id,p_expected_turn:3})).error,"Effect cannot be replayed");
  assert.equal(host("lobby-individual-damage-calculate").hidden,false,
    "Server-applied training effects now permit a partial preview, never final damage");
  await host("lobby-individual-damage-calculate").onclick();
  const partial=individualDamage.get(id+"/3");
  assert.equal(partial.defender_energy_initial,scenario.hp,
    "Partial preview must start from the updated training wallet");
  assert.equal(partial.calculation_status,"partial_estimate");
  const expectedPartial=scenario.effect==="precious_ring_hp"?0:5;
  assert.equal(partial.preview_subtotal,expectedPartial,
    "Ring negates the canonical 10-Air SONAR attack; other equipment retains base damage");
  assert.equal(partial.preview_energy_remaining,Math.max(0,scenario.hp-expectedPartial));
  assert.equal(partial.cost_status,"test_spent");
  assert.equal(partial.elemental_bonus,
    scenario.effect==="precious_ring_hp"?0:0,
    "No effective elemental bonus remains after ring; regular fixture is neutral");
  assert.equal(host("lobby-hp-apply").hidden,false);
  await host("lobby-hp-apply").onclick();
  const hit=hpEvents.get(id+"/3");
  assert.equal(hit.hp_before,scenario.hp);
  assert.equal(hit.hp_after,Math.max(0,scenario.hp-expectedPartial));
  assert.equal(wallet.hp_remaining,hit.hp_after);
  assert.equal(hit.official_hp_changed,false);
  assert.equal(hit.final_damage_verified,false);
  assert.ok((await makeClient(hostId).rpc("chaotic_apply_preview_hp_projection",{
    p_lobby_id:id,p_expected_turn:3})).error,
    "The same post-Burst attack must not subtract from training HP twice");
  await guest("lobby-turn-refresh").onclick();
  assert.match(guest("lobby-hp-summary").textContent,
    new RegExp(String(hit.hp_after)+"/"+String(scenario.max)));
  assert.equal(own.stats.e,65);
  await guest("lobby-turn-refresh").onclick();
  assert.match(guest("lobby-burst-equipment-effects-history").textContent,
    /EFEITO APLICADO SOMENTE AO TREINAMENTO/);
  assert.equal(matches.get(id).current_player,hostId);
  assert.equal(matches.get(id).turn_no,3);
});
}
