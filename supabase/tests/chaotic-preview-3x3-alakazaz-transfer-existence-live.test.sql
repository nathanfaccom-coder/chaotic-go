-- v0.1.57 real RLS/JSON masking test. All synthetic data is ROLLED BACK.
begin;
do $fixture$
declare
 host uuid:='a1570000-0000-4000-8000-000000000157';
 guest uuid:='b1570000-0000-4000-8000-000000000157';
 room uuid:='c1570000-0000-4000-8000-000000000157';
begin
 insert into auth.users(id,instance_id,role,aud,email,created_at,updated_at)
 values(host,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'chaotic-test-v57-host@example.invalid',now(),now()),
 (guest,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'chaotic-test-v57-guest@example.invalid',now(),now());
 insert into public.chaotic_lobbies(id,code,host_id,guest_id,mode,status)
 values(room,'C15700000001',host,guest,'3x3','ready');
 insert into public.chaotic_match_turns(
 lobby_id,host_id,guest_id,current_player,turn_no)
 values(room,host,guest,host,1);
 insert into public.chaotic_preview_3x3_allies(
 lobby_id,actor_id,position,deck_slot,creature_instance_id,creature_name,
 starting_tokens,remaining_tokens)
 select room,a.actor,p.pos,1,
  (case when a.actor=host then 'H' else 'G' end)||p.pos::text,
  case when a.actor=host then 'Lion' when p.pos=4 then 'Rex'
       when p.pos=5 then 'Promos' else 'Alakazaz' end,
  case when a.actor=host then 1 when p.pos=4 then 3 when p.pos=5 then 3 else 5 end,
  case when a.actor=host then 1 when p.pos=4 then 3 when p.pos=5 then 3 else 5 end
 from (values(host),(guest)) a(actor) cross join (values(4),(5),(6)) p(pos);
 insert into public.chaotic_preview_3x3_hp_wallets(
  lobby_id,actor_id,position,creature_instance_id,creature_name,
  hp_initial,hp_max,hp_remaining,initialized_turn,damage_events)
 select lobby_id,actor_id,position,creature_instance_id,creature_name,
  case when actor_id=guest then 35 else 20 end,
  case when actor_id=guest then 35 else 20 end,
  case when actor_id=guest then 33 else 20 end,
  1,case when actor_id=guest then 1 else 0 end
 from public.chaotic_preview_3x3_allies where lobby_id=room;
 insert into public.chaotic_preview_3x3_board_positions(
 lobby_id,actor_id,formation_slot,creature_instance_id,hex_position)
 select lobby_id,actor_id,position,creature_instance_id,position-3
 from public.chaotic_preview_3x3_allies where lobby_id=room;
 -- Guest c6 Alakazaz secretly donated one token to c5.
 -- Even existence of this action identifies Alakazaz, so hide the event.
 insert into public.chaotic_preview_3x3_token_transfers(
  lobby_id,turn_no,actor_id,donor_position,receiver_position,
  donor_creature_instance_id,receiver_creature_instance_id,
  donor_before,donor_after,receiver_before,receiver_after)
 values(room,1,guest,6,5,'G6','G5',5,4,3,4);
 -- Simulate a champion already revealed by contact (the contact trigger
 -- itself was tested in v0.1.56); only guest c5 is now face-up.
 update public.chaotic_preview_3x3_face_states
 set face_up=true,revealed_turn=1,reveal_reason='combat'
 where lobby_id=room and actor_id=guest and position=5;
 if (select count(*) from public.chaotic_preview_3x3_face_states
  where lobby_id=room)<>6 then raise exception 'Missing initial facedown rows';end if;
end $fixture$;

set local role authenticated;
select set_config('request.jwt.claim.sub','a1570000-0000-4000-8000-000000000157',true);
do $host$
declare
 room uuid:='c1570000-0000-4000-8000-000000000157';
 guest uuid:='b1570000-0000-4000-8000-000000000157';
 host uuid:='a1570000-0000-4000-8000-000000000157';
 report jsonb; masked jsonb; shown jsonb; hp_mask jsonb; own jsonb; board_mask jsonb; hidden_donor jsonb;
begin
 if (select count(*) from public.chaotic_preview_3x3_allies
   where lobby_id=room)<>3
 or (select count(*) from public.chaotic_preview_3x3_hp_wallets
   where lobby_id=room)<>3
 or (select count(*) from public.chaotic_preview_3x3_board_positions
   where lobby_id=room)<>3
 then raise exception 'Owner-only RLS leaked all rival units';end if;
 -- A FACE-DOWN Alakazaz's transfer must not even be enumerable to the rival.
 if (select count(*) from public.chaotic_preview_3x3_token_transfers
  where lobby_id=room)<>0
 then raise exception 'Rival can SELECT raw Alakazaz private transfer';end if;
 report:=public.chaotic_get_preview_3x3_safe_state(room);
 if pg_catalog.jsonb_array_length(report->'token_transfers')<>0
 then raise exception 'Hidden Alakazaz identity leaked through existence of transfer: %',
  report->'token_transfers';end if;
 select x into masked from pg_catalog.jsonb_array_elements(report->'allies') x
  where x->>'actor_id'=guest::text and (x->>'position')::integer=4;
 select x into shown from pg_catalog.jsonb_array_elements(report->'allies') x
  where x->>'actor_id'=guest::text and (x->>'position')::integer=5;
 select x into own from pg_catalog.jsonb_array_elements(report->'allies') x
  where x->>'actor_id'=host::text and (x->>'position')::integer=4;
 select x into hp_mask from pg_catalog.jsonb_array_elements(report->'hp_wallets') x
  where x->>'actor_id'=guest::text and (x->>'position')::integer=4;
 select x into board_mask from pg_catalog.jsonb_array_elements(report->'board_positions') x
  where x->>'actor_id'=guest::text and (x->>'formation_slot')::integer=4;
 select x into hidden_donor from pg_catalog.jsonb_array_elements(report->'allies') x
  where x->>'actor_id'=guest::text and (x->>'position')::integer=6;
 if hidden_donor->>'created_at' is not null
  or hidden_donor->>'updated_at' is not null
  or hidden_donor->>'received_tokens' is not null
 then raise exception 'Alakazaz identified via hidden ally timestamps: %',hidden_donor;end if;
 if masked->>'creature_name' is not null or masked->>'creature_instance_id' is not null
  or masked->>'starting_tokens' is not null or masked->>'deck_slot' is not null
  or shown->>'creature_name'<>'Promos' or own->>'creature_name'<>'Lion'
  or hp_mask->>'creature_name' is not null or hp_mask->>'hp_max' is not null
  or (hp_mask->>'hp_remaining')::integer<>1
  or board_mask->>'creature_instance_id' is not null
 then raise exception 'Host masked view leaked data or hid already-revealed champion: %',report;end if;
end $host$;

select set_config('request.jwt.claim.sub','b1570000-0000-4000-8000-000000000157',true);
do $guest$
declare room uuid:='c1570000-0000-4000-8000-000000000157';report jsonb; hidden jsonb;own jsonb;
begin
 if (select count(*) from public.chaotic_preview_3x3_allies where lobby_id=room)<>3
 then raise exception 'Guest read hostile 3x3 original names';end if;
 report:=public.chaotic_get_preview_3x3_safe_state(room);
 if pg_catalog.jsonb_array_length(report->'token_transfers')<>1
  or report->'token_transfers'->0->>'donor_creature_name'<>'Alakazaz'
  or (report->'token_transfers'->0->>'donor_position')::integer<>6
 then raise exception 'Owner lost their own Alakazaz training history: %',
  report->'token_transfers';end if;

 select x into hidden from pg_catalog.jsonb_array_elements(report->'allies') x
  where x->>'actor_id'='a1570000-0000-4000-8000-000000000157'
   and (x->>'position')::integer=4;
 select x into own from pg_catalog.jsonb_array_elements(report->'allies') x
  where x->>'actor_id'='b1570000-0000-4000-8000-000000000157'
   and (x->>'position')::integer=4;
 if hidden->>'creature_name' is not null
  or hidden->>'creature_instance_id' is not null
  or own->>'creature_name'<>'Rex'
 then raise exception 'Guest saw facedown rival or lost own identity: %',report;end if;
end $guest$;

-- After revealing ONLY the donor, the opponent may see a sanitized
-- event, without exposing the still-facedown receiver's card identity.
reset role;
-- This independent case leaves the receiver facedown after donor reveal.
update public.chaotic_preview_3x3_face_states
 set face_up=false,reveal_reason='face_down',revealed_turn=null
 where lobby_id='c1570000-0000-4000-8000-000000000157'::uuid
   and actor_id='b1570000-0000-4000-8000-000000000157'::uuid
   and position=5;
update public.chaotic_preview_3x3_face_states
 set face_up=true,reveal_reason='vento_forte',revealed_turn=1
 where lobby_id='c1570000-0000-4000-8000-000000000157'::uuid
   and actor_id='b1570000-0000-4000-8000-000000000157'::uuid
   and position=6;
set local role authenticated;
select set_config('request.jwt.claim.sub','a1570000-0000-4000-8000-000000000157',true);
do $revealed$
declare report jsonb;evt jsonb;
begin
 report:=public.chaotic_get_preview_3x3_safe_state(
  'c1570000-0000-4000-8000-000000000157'::uuid);
 if pg_catalog.jsonb_array_length(report->'token_transfers')<>1
 then raise exception 'Revealed donor history not visible';end if;
 evt:=report->'token_transfers'->0;
 if (evt->>'donor_position')::integer<>6
  or evt->>'donor_creature_name' is not null
  or evt->>'receiver_creature_instance_id' is not null
  or evt->>'receiver_before' is not null
 then raise exception 'Receiver hidden information leaked: %',evt;end if;
end $revealed$;

select set_config('request.jwt.claim.sub','d1570000-0000-4000-8000-000000000157',true);
do $outsider$
declare report jsonb;error_text text;
begin
 error_text:=null;
 begin
  report:=public.chaotic_get_preview_3x3_safe_state(
   'c1570000-0000-4000-8000-000000000157'::uuid);
 exception when others then get stacked diagnostics error_text=message_text;end;
 if error_text is null or position('Acesso à formação' in error_text)=0
 then raise exception 'Non-member accessed safe formation RPC: %',report;end if;
end $outsider$;
reset role;
do $check$
declare table_name text;
begin
 foreach table_name in array array[
 'chaotic_preview_3x3_allies','chaotic_preview_3x3_hp_wallets',
 'chaotic_preview_3x3_board_positions','chaotic_preview_3x3_move_events',
 'chaotic_preview_3x3_token_transfers'] loop
  if exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
    and tablename=table_name)
  then raise exception 'Raw secret table still on Realtime: %',table_name;end if;
 end loop;
 if has_function_privilege('anon',
  'public.chaotic_get_preview_3x3_safe_state(uuid)','execute')
 then raise exception 'Anonymous can invoke private member state';end if;
end $check$;
rollback;
select 'PASS v0.1.59: Alakazaz transfer existence fully hidden until donor revealed; owner intact, receiver sanitized, outsider blocked, rollback' as result;
