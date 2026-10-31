-- Chaotic GO 0.1.73 temporary custody: RLS + read-only, transaction rolled back.
begin;
insert into auth.users(id,instance_id,role,aud,email,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',label||'@example.invalid',now(),now()
from (values
('a1730000-0000-4000-8000-000000000173'::uuid,'custody-owner-v173'),
('b1730000-0000-4000-8000-000000000173'::uuid,'custody-borrower-v173'),
('c1730000-0000-4000-8000-000000000173'::uuid,'custody-outsider-v173')) v(id,label);
insert into public.chaotic_lobbies(id,code,host_id,guest_id,mode,status)
values('d1730000-0000-4000-8000-000000000173','A17300000001',
'a1730000-0000-4000-8000-000000000173','b1730000-0000-4000-8000-000000000173','3x3','ready');
insert into public.chaotic_match_turns(lobby_id,host_id,guest_id,current_player,turn_no)
values('d1730000-0000-4000-8000-000000000173',
'a1730000-0000-4000-8000-000000000173','b1730000-0000-4000-8000-000000000173',
'a1730000-0000-4000-8000-000000000173',1);
-- Build real 3x3 encounter and both real hands for readiness.
insert into public.chaotic_preview_3x3_allies
(lobby_id,actor_id,position,deck_slot,creature_instance_id,creature_name,starting_tokens,remaining_tokens)
select 'd1730000-0000-4000-8000-000000000173',x.actor,x.pos,1,
 (case when x.actor='a1730000-0000-4000-8000-000000000173'::uuid then 'H' else 'G' end)||x.pos,
 case x.pos when 4 then 'Johnes' when 5 then 'Promos' else 'Alakazaz' end,2,2
from (select a.actor,b.pos from
 (values ('a1730000-0000-4000-8000-000000000173'::uuid),
         ('b1730000-0000-4000-8000-000000000173'::uuid)) a(actor)
 cross join (values(4),(5),(6)) b(pos)) x;
insert into public.chaotic_preview_3x3_hp_wallets
(lobby_id,actor_id,position,creature_instance_id,creature_name,hp_initial,hp_max,hp_remaining,initialized_turn,damage_events)
select lobby_id,actor_id,position,creature_instance_id,creature_name,20,20,20,1,0
from public.chaotic_preview_3x3_allies where lobby_id='d1730000-0000-4000-8000-000000000173';
insert into public.chaotic_preview_3x3_board_positions
(lobby_id,actor_id,formation_slot,creature_instance_id,hex_position)
select lobby_id,actor_id,position,creature_instance_id,position
from public.chaotic_preview_3x3_allies where lobby_id='d1730000-0000-4000-8000-000000000173';
insert into public.chaotic_preview_3x3_attack_wallets
(lobby_id,actor_id,deck_slot,prepared_turn,last_draw_turn,total_cards)
values ('d1730000-0000-4000-8000-000000000173','a1730000-0000-4000-8000-000000000173',1,1,1,3),
 ('d1730000-0000-4000-8000-000000000173','b1730000-0000-4000-8000-000000000173',1,1,1,3);
insert into public.chaotic_preview_3x3_attack_hand
(lobby_id,actor_id,card_slot,attack_instance_id,draw_position,card_state)
select 'd1730000-0000-4000-8000-000000000173'::uuid,x.actor,x.slot,
 (case when x.actor='a1730000-0000-4000-8000-000000000173'::uuid then 'H' else 'G' end)||x.slot,
 x.slot,case when x.slot=1 then 'hand' else 'deck' end
from (select a.actor,b.slot from
 (values ('a1730000-0000-4000-8000-000000000173'::uuid),
         ('b1730000-0000-4000-8000-000000000173'::uuid)) a(actor)
 cross join (values(1),(2),(3)) b(slot)) x;
insert into public.chaotic_preview_3x3_contact_intents
(lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
attacker_creature_instance_id,defender_creature_instance_id,
attacker_hex,defender_hex,attacker_hp_at_contact,defender_hp_at_contact)
values('d1730000-0000-4000-8000-000000000173',1,
'a1730000-0000-4000-8000-000000000173',
'b1730000-0000-4000-8000-000000000173',4,4,'H4','G4',4,4,20,20);
insert into public.chaotic_preview_3x3_attack_projections
(lobby_id,turn_no,actor_id,attack_deck_slot,attack_card_slot,attack_instance_id,
catalog_attack_id,attack_name,base_damage,attack_cost,
attacker_slot,defender_id,defender_slot,defender_hp_before,
defender_hp_projected,projected_hp_loss,hypothetical_knockout)
values('d1730000-0000-4000-8000-000000000173',1,
'a1730000-0000-4000-8000-000000000173',1,1,'H1',
'102','Mão Negra',0,0,4,'b1730000-0000-4000-8000-000000000173',4,20,20,0,false);
insert into public.chaotic_game_nodes(user_id,node_path,data)
values('b1730000-0000-4000-8000-000000000173','album',
 '[{"id":"G1","tipoCarta":"Ataque","nome":"Vento Forte","quantidade":1}]'::jsonb);
insert into public.chaotic_preview_3x3_cost_inspections
 (lobby_id,turn_no,actor_id,attack_instance_id,card_slot,catalog_attack_id,
 attack_cost,points_available,can_afford,points_after_if_paid)
values('d1730000-0000-4000-8000-000000000173',1,
 'a1730000-0000-4000-8000-000000000173','H1',1,'102',0,3,true,3);
update public.chaotic_preview_3x3_attack_hand
 set card_state='spent',spent_turn=1,spent_reason='attack'
where lobby_id='d1730000-0000-4000-8000-000000000173'
 and actor_id='a1730000-0000-4000-8000-000000000173' and card_slot=1;
insert into public.chaotic_preview_3x3_attack_spends
 (lobby_id,turn_no,actor_id,attack_deck_slot,card_slot,attack_instance_id,
 catalog_attack_id,training_attack_cost,points_before,points_after)
values('d1730000-0000-4000-8000-000000000173',1,
 'a1730000-0000-4000-8000-000000000173',1,1,'H1','102',0,3,3);

insert into public.chaotic_preview_3x3_defense_windows
 (lobby_id,turn_no,attacker_id,defender_id,attacker_slot,defender_slot,
  attack_instance_id,training_attack_cost,status,defender_passed_at)
values('d1730000-0000-4000-8000-000000000173',1,
 'a1730000-0000-4000-8000-000000000173',
 'b1730000-0000-4000-8000-000000000173',
 4,4,'H1',0,'awaiting_defender',null);
do $outcome_test$
declare
 lobby uuid:='d1730000-0000-4000-8000-000000000173';
 host uuid:='a1730000-0000-4000-8000-000000000173';
 guest uuid:='b1730000-0000-4000-8000-000000000173';
 loan_id uuid;
 rejection text;
begin
 perform set_config('request.jwt.claim.sub',host::text,true);
 loan_id:=public.chaotic_internal_hold_preview_3x3_black_hand(lobby,1);
 if loan_id is null then raise exception 'No held card to return on outcome';end if;
 -- Corrupt original only INSIDE a rolled-back subtransaction. The outcome
 -- MUST fail closed rather than lose the original ownership metadata.
 update public.chaotic_preview_3x3_attack_hand set card_state='hand'
 where lobby_id=lobby and actor_id=guest and card_slot=1;
 rejection:=null;
 begin
  insert into public.chaotic_preview_3x3_training_outcomes
   (lobby_id,decided_turn,winner_id,defeated_id,
    defeated_team_size,outcome_scope)
  values(lobby,1,host,guest,3,'training_only_no_official_victory');
 exception when others then get stacked diagnostics rejection=message_text;end;
 if rejection is null or position('não está íntegra' in rejection)=0
 then raise exception 'Corrupt loan unexpectedly permitted terminal outcome: %',rejection;end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_outcomes where lobby_id=lobby)
 then raise exception 'Failed outcome left a committed winner row';end if;
 update public.chaotic_preview_3x3_attack_hand set card_state='loaned'
 where lobby_id=lobby and actor_id=guest and card_slot=1;
 insert into public.chaotic_preview_3x3_training_outcomes
 (lobby_id,decided_turn,winner_id,defeated_id,defeated_team_size,outcome_scope)
 values(lobby,1,host,guest,3,'training_only_no_official_victory');
 if (select card_state from public.chaotic_preview_3x3_attack_hand
   where lobby_id=lobby and actor_id=guest and card_slot=1)<>'deck'
 or (select custody_state from public.chaotic_preview_3x3_temporary_card_custody
   where id=loan_id)<>'released'
 or (select released_turn from public.chaotic_preview_3x3_temporary_card_custody
   where id=loan_id)<>1
 or (select count(*) from public.chaotic_preview_3x3_temporary_card_custody
   where lobby_id=lobby and custody_state='held')<>0
 then raise exception 'End-of-training did not restore the original owner card';end if;
 if (select official_match_ended or official_match_modified or experience_awarded
     or currency_awarded from public.chaotic_preview_3x3_training_outcomes
     where lobby_id=lobby)
 then raise exception 'Training-only outcome touched official match or rewards';end if;
end $outcome_test$;
rollback;
select 'PASS v0.1.76: bad original blocks victory; valid outcome automatically returns loan to owner and closes custody, no official changes, rollback' as result;
