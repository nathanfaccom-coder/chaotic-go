-- Chaotic GO v0.1.35 regression: per-creature 3x3 six-hex training movement.
-- Read-only transactional verification of RLS/grants and server movement safety.
begin;
do $test$
declare prep text; move_rpc text; policy_count integer;
begin
 if exists(select 1 from pg_class where oid in (
  'public.chaotic_preview_3x3_board_positions'::regclass,
  'public.chaotic_preview_3x3_move_events'::regclass) and not relrowsecurity)
 then raise exception '3x3 movement tables lack RLS';end if;
 if has_table_privilege('anon','public.chaotic_preview_3x3_board_positions','select')
   or has_table_privilege('authenticated','public.chaotic_preview_3x3_board_positions','insert')
   or has_table_privilege('authenticated','public.chaotic_preview_3x3_board_positions','update')
   or has_table_privilege('authenticated','public.chaotic_preview_3x3_move_events','insert')
   or has_table_privilege('authenticated','public.chaotic_preview_3x3_move_events','delete')
 then raise exception '3x3 movement can be forged directly by clients';end if;
 if not has_table_privilege('authenticated','public.chaotic_preview_3x3_board_positions','select')
   or not has_table_privilege('authenticated','public.chaotic_preview_3x3_move_events','select')
 then raise exception 'Members cannot view the experimental board';end if;
 if has_function_privilege('anon','public.chaotic_prepare_preview_3x3_board(uuid,integer)','execute')
   or has_function_privilege('anon','public.chaotic_move_preview_3x3_unit(uuid,integer,integer,integer)','execute')
   or not has_function_privilege('authenticated','public.chaotic_prepare_preview_3x3_board(uuid,integer)','execute')
   or not has_function_privilege('authenticated','public.chaotic_move_preview_3x3_unit(uuid,integer,integer,integer)','execute')
 then raise exception 'Move RPC auth grants invalid';end if;
 select count(*) into policy_count from pg_policies
   where schemaname='public'
     and tablename in ('chaotic_preview_3x3_board_positions','chaotic_preview_3x3_move_events')
     and qual like '%auth.uid()%' and qual like '%chaotic_match_turns%';
 if policy_count<>2 then raise exception 'Move board read access is not member-scoped';end if;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_prepare_preview_3x3_board(uuid,integer)'::regprocedure
 ),'[[:space:]]+','','g')) into prep;
 select lower(regexp_replace(pg_get_functiondef(
 'public.chaotic_move_preview_3x3_unit(uuid,integer,integer,integer)'::regprocedure
 ),'[[:space:]]+','','g')) into move_rpc;
 if position('auth.uid()' in prep)=0
  or position('m.current_playerisdistinctfromactor' in prep)=0
  or position('chaotic_preview_3x3_hp_wallets' in prep)=0
  or position('chaotic_preview_3x3_allies' in prep)=0
  or position('hp.creature_instance_id=a.creature_instance_id' in prep)=0
  or position('hex_position' in prep)=0
  or position('num<>3' in prep)=0
 then raise exception 'Board preparation missing player, DNA or 3-creature validation';end if;
 if position('auth.uid()' in move_rpc)=0
  or position('m.current_playerisdistinctfromactor' in move_rpc)=0
  or position('m.turn_no<>p_expected_turn' in move_rpc)=0
  or position('p_formation_slotnotbetween4and6' in move_rpc)=0
  or position('p_target_hexnotbetween1and6' in move_rpc)=0
  or position('chaotic_preview_3x3_move_events' in move_rpc)=0
  or position('h.hp_remaining<=0' in move_rpc)=0
  or position('neighbors:=caseb.hex_position' in move_rpc)=0
  or position('p_target_hex=any(neighbors)' in move_rpc)=0
  or position('hex_position=p_target_hex' in move_rpc)=0
  or position('forupdate' in move_rpc)=0
 then raise exception 'Move auth, occupancy, adjacency, HP or replay guard missing';end if;
 if not exists(select 1 from pg_constraint
   where conrelid='public.chaotic_preview_3x3_board_positions'::regclass
     and contype='u' and pg_get_constraintdef(oid) like '%hex_position%')
 then raise exception 'An allied hex can be occupied by more than one unit';end if;
 if not exists(select 1 from pg_constraint
   where conrelid='public.chaotic_preview_3x3_move_events'::regclass
     and contype='p' and pg_get_constraintdef(oid) like '%turn_no%')
 then raise exception 'Repeated moves on one turn are not forbidden by unique event ID';end if;
 if exists(select 1 from public.chaotic_preview_3x3_board_positions
   where official_position_changed or official_match_modified)
   or exists(select 1 from public.chaotic_preview_3x3_move_events
     where official_position_changed or official_match_modified or damage_applied)
 then raise exception 'Experimental movement leaked to official game state';end if;
end;
$test$;
rollback;
select 'PASS v0.1.35: 3x3 isolated adjacent move, occupancy/RLS, one action per turn, original board and HP safe' as result;