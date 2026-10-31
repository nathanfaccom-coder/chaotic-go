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
insert into public.chaotic_preview_3x3_temporary_card_custody
(lobby_id,source_actor_id,borrower_id,source_card_slot,source_attack_instance_id,catalog_attack_id,granted_turn)
values('d1730000-0000-4000-8000-000000000173',
'a1730000-0000-4000-8000-000000000173',
'b1730000-0000-4000-8000-000000000173',3,'private-owner-card','105',1);
set local role authenticated;
do $test$
declare
 lobby uuid:='d1730000-0000-4000-8000-000000000173';
 source uuid:='a1730000-0000-4000-8000-000000000173';
 borrower uuid:='b1730000-0000-4000-8000-000000000173';
 outsider uuid:='c1730000-0000-4000-8000-000000000173';
 cnt integer; failure text; state jsonb;
begin
 perform set_config('request.jwt.claim.sub',source::text,true);
 state:=public.chaotic_preview_3x3_black_hand_readiness(lobby,1);
 if state->>'status'<>'eligible_for_future_borrow'
   or state->>'possible'<>'true' or state->>'playable'<>'false'
   or state->>'payment_enabled'<>'false'
   or state->>'card_id_revealed'<>'false'
   or state->>'own_free_slots'<>'5'
   or state::text like '%G1%'
 then raise exception '102 readiness leaked source card or returned wrong status: %',state;end if;
 select count(*) into cnt from public.chaotic_preview_3x3_temporary_card_custody where lobby_id=lobby;
 if cnt<>1 then raise exception 'Owner cannot see custody';end if;
 perform set_config('request.jwt.claim.sub',borrower::text,true);
 failure:=null;
 begin perform public.chaotic_preview_3x3_black_hand_readiness(lobby,1);
 exception when others then get stacked diagnostics failure=message_text;end;
 if failure is null then raise exception 'Defender was allowed to inspect 102 readiness';end if;
 select count(*) into cnt from public.chaotic_preview_3x3_temporary_card_custody where lobby_id=lobby;
 if cnt<>1 then raise exception 'Borrower cannot see custody';end if;
 failure:=null;
 begin
 insert into public.chaotic_preview_3x3_temporary_card_custody
 (lobby_id,source_actor_id,borrower_id,source_card_slot,source_attack_instance_id,catalog_attack_id,granted_turn)
 values(lobby,source,borrower,4,'forged-card','104',1);
 exception when others then get stacked diagnostics failure=message_text;end;
 if failure is null then raise exception 'Client forged custody';end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 failure:=null;
 begin perform public.chaotic_preview_3x3_black_hand_readiness(lobby,1);
 exception when others then get stacked diagnostics failure=message_text;end;
 if failure is null then raise exception 'Outsider was allowed to inspect 102 readiness';end if;
 select count(*) into cnt from public.chaotic_preview_3x3_temporary_card_custody where lobby_id=lobby;
 if cnt<>0 then raise exception 'Outsider can see custody';end if;
end $test$;
reset role;
rollback;
select 'PASS 0.1.74: private 102 readiness, no hidden card IDs, defender and outsider blocked; custody RLS and read-only rollback' as result;