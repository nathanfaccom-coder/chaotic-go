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
do $loan_test$
declare
 room uuid:='d1730000-0000-4000-8000-000000000173';
 host uuid:='a1730000-0000-4000-8000-000000000173';
 guest uuid:='b1730000-0000-4000-8000-000000000173';
 loan uuid;
 failure text;
 visible jsonb;
begin
 perform set_config('request.jwt.claim.sub',guest::text,true);
 failure:=null;
 begin perform public.chaotic_internal_hold_preview_3x3_black_hand(room,1);
 exception when others then get stacked diagnostics failure=message_text;end;
 if failure is null then raise exception 'Defender triggered Black Hand loan';end if;
 perform set_config('request.jwt.claim.sub',host::text,true);
 loan:=public.chaotic_internal_hold_preview_3x3_black_hand(room,1);
 if loan is null or
   (select custody_state from public.chaotic_preview_3x3_temporary_card_custody where id=loan)<>'held'
   or (select source_actor_id from public.chaotic_preview_3x3_temporary_card_custody where id=loan)<>guest
   or (select borrower_id from public.chaotic_preview_3x3_temporary_card_custody where id=loan)<>host
   or (select catalog_attack_id from public.chaotic_preview_3x3_temporary_card_custody where id=loan)<>'105'
   or (select card_state from public.chaotic_preview_3x3_attack_hand where lobby_id=room and actor_id=guest and card_slot=1)<>'loaned'
   or (select count(*) from public.chaotic_preview_3x3_attack_hand where lobby_id=room and actor_id=host)<>3
 then raise exception '102 owner-preserving temporary loan incorrect';end if;
 -- The borrower sees ONLY this one verified original card, not all enemy cards.
 visible:=public.chaotic_get_preview_3x3_borrowed_attacks(room);
 if visible->>'held_count'<>'1'
  or visible->>'playable'<>'false'
  or visible->>'payment_enabled'<>'false'
  or visible->'borrowed_attacks'->0->>'custody_id'<>loan::text
  or visible->'borrowed_attacks'->0->>'attack_name'<>'Vento Forte'
  or visible->'borrowed_attacks'->0->>'catalog_attack_id'<>'105'
  or visible->'borrowed_attacks'->0->>'base_damage'<>'5'
  or visible->'borrowed_attacks'->0->>'attack_cost'<>'1'
  or visible::text like '%G1%'
  or visible::text like '%source_attack_instance_id%'
  or visible::text like '%source_card_slot%'
 then raise exception 'Borrower-only borrowed card detail wrong or leaked data: %',visible;end if;
 perform set_config('request.jwt.claim.sub',guest::text,true);
 visible:=public.chaotic_get_preview_3x3_borrowed_attacks(room);
 if visible->>'held_count'<>'0'
 then raise exception 'Owner got borrower-only stolen card details';end if;
 perform set_config('request.jwt.claim.sub',host::text,true);
 failure:=null;
 begin perform public.chaotic_internal_hold_preview_3x3_black_hand(room,1);
 exception when others then get stacked diagnostics failure=message_text;end;
 if failure is null or position('antirreplay' in failure)=0
 then raise exception '102 duplicate loan was allowed: %',failure;end if;
 perform set_config('request.jwt.claim.sub',guest::text,true);
 if not public.chaotic_internal_release_preview_3x3_black_hand(room,loan,1)
 then raise exception 'Original owner could not recover card';end if;
 if (select card_state from public.chaotic_preview_3x3_attack_hand where lobby_id=room and actor_id=guest and card_slot=1)<>'deck'
  or (select custody_state from public.chaotic_preview_3x3_temporary_card_custody where id=loan)<>'released'
  or (select released_turn from public.chaotic_preview_3x3_temporary_card_custody where id=loan)<>1
 then raise exception '102 owner-only card restoration failed';end if;
 failure:=null;
 begin perform public.chaotic_internal_release_preview_3x3_black_hand(room,loan,1);
 exception when others then get stacked diagnostics failure=message_text;end;
 if failure is null then raise exception '102 duplicate release succeeded';end if;
 perform set_config('request.jwt.claim.sub',host::text,true);
 visible:=public.chaotic_get_preview_3x3_borrowed_attacks(room);
 if visible->>'held_count'<>'0'
 then raise exception 'Borrower still sees released card as held';end if;
 perform set_config('request.jwt.claim.sub',host::text,true);
 failure:=null;
 begin perform public.chaotic_internal_hold_preview_3x3_black_hand(room,1);
 exception when others then get stacked diagnostics failure=message_text;end;
 if failure is null or position('antirreplay' in failure)=0
 then raise exception '102 repeat after RELEASE was accepted: %',failure;end if;

end $loan_test$;
set local role authenticated;
do $role_test$
declare failure text;
 result jsonb;
begin
 perform set_config('request.jwt.claim.sub','a1730000-0000-4000-8000-000000000173',true);
 failure:=null;
 begin perform public.chaotic_internal_hold_preview_3x3_black_hand(
 'd1730000-0000-4000-8000-000000000173',1);
 exception when others then get stacked diagnostics failure=message_text;end;
 if failure is null then raise exception 'Authenticated browser invoked internal loan';end if;
 failure:=null;
 begin perform public.chaotic_internal_release_preview_3x3_black_hand(
 'd1730000-0000-4000-8000-000000000173',
 (select id from public.chaotic_preview_3x3_temporary_card_custody
 where lobby_id='d1730000-0000-4000-8000-000000000173' limit 1),1);
 exception when others then get stacked diagnostics failure=message_text;end;
 if failure is null then raise exception 'Authenticated browser invoked internal restitution';end if;
 result:=public.chaotic_get_preview_3x3_borrowed_attacks('d1730000-0000-4000-8000-000000000173');
 if result->>'held_count'<>'0'
 then raise exception 'Authenticated borrower state after return was not empty';end if;
 perform set_config('request.jwt.claim.sub','c1730000-0000-4000-8000-000000000173',true);
 failure:=null;
 begin perform public.chaotic_get_preview_3x3_borrowed_attacks('d1730000-0000-4000-8000-000000000173');
 exception when others then get stacked diagnostics failure=message_text;end;
 if failure is null then raise exception 'Outsider could inspect stolen-card details';end if;
end $role_test$;
reset role;
rollback;
select 'PASS v0.1.76: borrower-only 105 catalog details, no album/instance leakage, owner and outsider excluded, released hidden; 102 loan and rollback' as result;
