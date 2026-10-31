-- Chaotic GO v0.1.61 actual two-member live PostgreSQL integration.
-- Synthetic users and room only, with explicit BEGIN/ROLLBACK.
begin;
insert into auth.users(id,instance_id,role,aud,email,created_at,updated_at)
values
('a1610000-0000-4000-8000-000000000161','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','chaotic-v61-a@example.invalid',now(),now()),
('b1610000-0000-4000-8000-000000000161','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','chaotic-v61-b@example.invalid',now(),now());
insert into public.chaotic_lobbies(id,code,host_id,guest_id,mode,status)
values ('c1610000-0000-4000-8000-000000000161','C16100000001',
 'a1610000-0000-4000-8000-000000000161',
 'b1610000-0000-4000-8000-000000000161','3x3','ready');
insert into public.chaotic_match_turns(lobby_id,host_id,guest_id,current_player,turn_no)
values ('c1610000-0000-4000-8000-000000000161',
 'a1610000-0000-4000-8000-000000000161',
 'b1610000-0000-4000-8000-000000000161',
 'a1610000-0000-4000-8000-000000000161',1);
set local role authenticated;
select set_config('request.jwt.claim.sub','a1610000-0000-4000-8000-000000000161',true);
do $host$
declare state jsonb;error_text text;
begin
 state:=public.chaotic_ping_preview_3x3_player('c1610000-0000-4000-8000-000000000161',true);
 if not (state->>'self_ready')::boolean or not (state->>'self_active')::boolean
   or (state->>'peer_active')::boolean or (state->>'both_ready_now')::boolean
   or (state->>'active_turn')::integer<>1 or not (state->>'your_turn')::boolean
 then raise exception 'Initial host presence invalid: %',state;end if;
 if has_table_privilege('authenticated',
  'public.chaotic_preview_3x3_player_presence','select')
 or has_table_privilege('authenticated',
  'public.chaotic_preview_3x3_player_presence','update')
 then raise exception 'Client bypassed presence RPC';end if;
end $host$;
select set_config('request.jwt.claim.sub','b1610000-0000-4000-8000-000000000161',true);
do $guest$
declare state jsonb;
begin
 state:=public.chaotic_ping_preview_3x3_player('c1610000-0000-4000-8000-000000000161',true);
 if not (state->>'both_ready_now')::boolean or not (state->>'peer_active')::boolean
 or not (state->>'self_ready')::boolean or (state->>'your_turn')::boolean
 then raise exception 'Both players failed ready check: %',state;end if;
end $guest$;
select set_config('request.jwt.claim.sub','a1610000-0000-4000-8000-000000000161',true);
do $hostcheck$
declare state jsonb;
begin
 state:=public.chaotic_ping_preview_3x3_player('c1610000-0000-4000-8000-000000000161',null);
 if not (state->>'both_ready_now')::boolean then
  raise exception 'Host cannot see guest ready: %',state;end if;
end $hostcheck$;
reset role;
update public.chaotic_preview_3x3_player_presence set
 last_seen_at=now()-interval '45 seconds'
where lobby_id='c1610000-0000-4000-8000-000000000161'
 and actor_id='b1610000-0000-4000-8000-000000000161';
set local role authenticated;
select set_config('request.jwt.claim.sub','a1610000-0000-4000-8000-000000000161',true);
do $stale$
declare state jsonb;
begin
 state:=public.chaotic_ping_preview_3x3_player('c1610000-0000-4000-8000-000000000161',null);
 if (state->>'peer_active')::boolean or (state->>'both_ready_now')::boolean
 or not (state->>'peer_ready')::boolean
 then raise exception 'Stale peer falsely marked connected: %',state;end if;
end $stale$;
select set_config('request.jwt.claim.sub','b1610000-0000-4000-8000-000000000161',true);
do $unready$
declare state jsonb;
begin
 state:=public.chaotic_ping_preview_3x3_player('c1610000-0000-4000-8000-000000000161',false);
 if (state->>'self_ready')::boolean or (state->>'both_ready_now')::boolean
 then raise exception 'Unready toggle failed: %',state;end if;
end $unready$;
select set_config('request.jwt.claim.sub','a1610000-0000-4000-8000-000000000161',true);
do $still_unready$
declare state jsonb;
begin
 state:=public.chaotic_ping_preview_3x3_player('c1610000-0000-4000-8000-000000000161',null);
 if (state->>'both_ready_now')::boolean or (state->>'peer_ready')::boolean
 then raise exception 'Peer toggle not synchronized: %',state;end if;
end $still_unready$;
select set_config('request.jwt.claim.sub','d1610000-0000-4000-8000-000000000161',true);
do $outsider$
declare error_text text;
begin
 error_text:=null;
 begin
  perform public.chaotic_ping_preview_3x3_player('c1610000-0000-4000-8000-000000000161',true);
 exception when others then get stacked diagnostics error_text=message_text;end;
 if error_text is null or position('dois membros ativos' in error_text)=0
 then raise exception 'Outsider accessed presence RPC: %',error_text;end if;
end $outsider$;
reset role;
-- Different valid room state: training result has a winner, but official
-- match, XP and balance are not changed by the presence diagnostic.
insert into public.chaotic_preview_3x3_training_outcomes(
 lobby_id,decided_turn,winner_id,defeated_id)
 values('c1610000-0000-4000-8000-000000000161',1,
 'a1610000-0000-4000-8000-000000000161',
 'b1610000-0000-4000-8000-000000000161');
set local role authenticated;
select set_config('request.jwt.claim.sub','a1610000-0000-4000-8000-000000000161',true);
do $finish$
declare state jsonb;err text;
begin
 state:=public.chaotic_ping_preview_3x3_player('c1610000-0000-4000-8000-000000000161',null);
 if not (state->>'training_finished')::boolean
 or not (state->>'you_won_training')::boolean
 or (state->>'both_ready_now')::boolean
 or (state->>'official_match_modified')::boolean
 then raise exception 'Training winner not handled safely: %',state;end if;
 err:=null;
 begin
  perform public.chaotic_ping_preview_3x3_player('c1610000-0000-4000-8000-000000000161',true);
 exception when others then get stacked diagnostics err=message_text;end;
 if err is null or position('Treinamento encerrado' in err)=0
 then raise exception 'Finished training accepted ready again: %',err;end if;
end $finish$;
reset role;
rollback;
select 'PASS v0.1.61: real two-player ready, offline/stale, unready, outsider denial, training win read-only; rolled back' as result;