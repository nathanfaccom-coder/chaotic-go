-- Chaotic GO v0.1.36 read-only regression: two-side 3x3 contact snapshots.
begin;
do $test$
declare fn text; movement_fn text; policy text;
begin
 if not (select relrowsecurity from pg_catalog.pg_class
  where oid='public.chaotic_preview_3x3_contact_intents'::regclass)
 then raise exception 'Contact table must enforce row-level security';end if;
 if has_table_privilege('anon','public.chaotic_preview_3x3_contact_intents','select')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_contact_intents','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_contact_intents','update')
  or has_table_privilege('authenticated','public.chaotic_preview_3x3_contact_intents','delete')
 then raise exception 'Unauthenticated or direct client contact writes permitted';end if;
 if not has_table_privilege('authenticated','public.chaotic_preview_3x3_contact_intents','select')
 then raise exception 'Match participants cannot read contact records';end if;
 if has_function_privilege('anon','public.chaotic_open_preview_3x3_contact(uuid,integer,integer,integer)','execute')
  or not has_function_privilege('authenticated','public.chaotic_open_preview_3x3_contact(uuid,integer,integer,integer)','execute')
 then raise exception 'Contact RPC execute permissions invalid';end if;
 select qual into policy from pg_catalog.pg_policies
 where schemaname='public' and tablename='chaotic_preview_3x3_contact_intents'
   and policyname='chaotic_preview_3x3_contact_members_read';
 if policy is null or position('auth.uid()' in policy)=0
   or position('chaotic_match_turns' in policy)=0
 then raise exception 'Contact history not restricted to match members';end if;
 select lower(regexp_replace(pg_catalog.pg_get_functiondef(
  'public.chaotic_open_preview_3x3_contact(uuid,integer,integer,integer)'::regprocedure),
  '[[:space:]]+','','g')) into fn;
 select lower(regexp_replace(pg_catalog.pg_get_functiondef(
  'public.chaotic_move_preview_3x3_unit(uuid,integer,integer,integer)'::regprocedure),
  '[[:space:]]+','','g')) into movement_fn;
 if position('auth.uid()' in fn)=0
  or position('m.current_playerisdistinctfromactor' in fn)=0
  or position('l.mode<>''3x3''' in fn)=0
  or position('chaotic_preview_3x3_board_positions' in fn)=0
  or position('chaotic_preview_3x3_hp_wallets' in fn)=0
  or position('attacker_board.hex_positionnotin(4,5)' in fn)=0
  or position('defender_board.hex_positionnotin(4,5)' in fn)=0
  or position('attacker_hp.hp_remaining<=0' in fn)=0
  or position('defender_hp.hp_remaining<=0' in fn)=0
  or position('forupdate' in fn)=0
  or position('chaotic_preview_clashes' in fn)=0
  or position('chaotic_preview_burst_windows' in fn)=0
 then raise exception 'Missing authenticated 3x3 cross-side HP and turn checks';end if;
 if position('chaotic_preview_3x3_contact_intents' in movement_fn)=0
 then raise exception 'Further movement is not blocked after contact';end if;
 if not exists(select 1 from pg_catalog.pg_constraint
  where conrelid='public.chaotic_preview_3x3_contact_intents'::regclass
   and contype='p' and pg_catalog.pg_get_constraintdef(oid) like '%turn_no%')
 then raise exception 'Duplicate contact per match turn not constrained';end if;
 if exists(select 1 from public.chaotic_preview_3x3_contact_intents
  where attack_card_validated or damage_applied or official_match_modified or official_hp_changed)
 then raise exception 'A contact incorrectly affected the official match';end if;
end;
$test$;
rollback;
select 'PASS v0.1.36: private 3x3 contact, both players/HP/hex4-5, no duplicate, move freeze and no damage' as result;