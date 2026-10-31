-- Chaotic GO 0.1.40: no-write regression for owner-private discard and recycled training draw.
begin;
do $check$
declare t text; p text; fn text; draw_fn text;
begin
 foreach t in array array['chaotic_preview_3x3_hand_discards',
  'chaotic_preview_3x3_hand_draw_events'] loop
  if not (select relrowsecurity from pg_catalog.pg_class
   where oid=('public.'||t)::regclass)
   or has_table_privilege('anon','public.'||t,'select')
   or has_table_privilege('authenticated','public.'||t,'insert')
   or has_table_privilege('authenticated','public.'||t,'update')
   or has_table_privilege('authenticated','public.'||t,'delete')
  then raise exception 'Private training hand log is exposed: %',t;end if;
  if not has_table_privilege('authenticated','public.'||t,'select')
  then raise exception 'Hand owner cannot read log: %',t;end if;
  select qual into p from pg_catalog.pg_policies where schemaname='public'
   and tablename=t and cmd='SELECT';
  if p is null or position('auth.uid()' in p)=0
   or position('actor_id' in p)=0
  then raise exception 'Owner-only read policy missing on %',t;end if;
  if exists(select 1 from pg_catalog.pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public' and tablename=t)
  then raise exception 'Private card log must not be broadcast as public Realtime table: %',t;end if;
 end loop;
 if has_function_privilege('anon','public.chaotic_discard_preview_3x3_hand(uuid,integer,integer)','execute')
  or not has_function_privilege('authenticated','public.chaotic_discard_preview_3x3_hand(uuid,integer,integer)','execute')
  or has_function_privilege('anon','public.chaotic_sync_preview_3x3_hand(uuid,integer)','execute')
 then raise exception 'Authentication / execution privileges incorrect';end if;
 select lower(regexp_replace(pg_catalog.pg_get_functiondef(
 'public.chaotic_discard_preview_3x3_hand(uuid,integer,integer)'::regprocedure),
 '[[:space:]]+','','g')) into fn;
 select lower(regexp_replace(pg_catalog.pg_get_functiondef(
 'public.chaotic_sync_preview_3x3_hand(uuid,integer)'::regprocedure),
 '[[:space:]]+','','g')) into draw_fn;
 if position('auth.uid()' in fn)=0
  or position('m.current_playerisdistinctfromactor' in fn)=0
  or position('m.turn_no<>p_expected_turn' in fn)=0
  or position('l.mode<>''3x3''' in fn)=0
  or position('w.last_draw_turn<>p_expected_turn' in fn)=0
  or position('item.card_state<>''hand''' in fn)=0
  or position('chaotic_preview_3x3_contact_intents' in fn)=0
  or position('chaotic_preview_3x3_attack_spends' in fn)=0
  or position('spent_reason=''discard''' in fn)=0
  or position('forupdate' in fn)=0
 then raise exception 'Discard owner, state, turn, or already-declared Attack guard missing';end if;
 if position('auth.uid()' in draw_fn)=0
  or position('m.current_playerisdistinctfromactor' in draw_fn)=0
  or position('w.last_draw_turn<p_expected_turn' in draw_fn)=0
  or position('ifn_hand<5then' in draw_fn)=0
  or position('ifn_deck=0then' in draw_fn)=0
  or position('card_state=''spent''' in draw_fn)=0
  or position('setcard_state=''deck''' in draw_fn)=0
  or position('recycle_priority=pg_catalog.gen_random_uuid()' in draw_fn)=0
  or position('spent_turn=null' in draw_fn)=0
  or position('chaotic_preview_3x3_hand_draw_events' in draw_fn)=0
  or position('forupdate' in draw_fn)=0
 then raise exception 'Shuffle, discard-only recycle, single draw or audit guard missing';end if;
 if not exists(select 1 from pg_catalog.pg_constraint
   where conrelid='public.chaotic_preview_3x3_attack_hand'::regclass
    and conname='chaotic_preview_3x3_attack_hand_spent_state_check'
    and pg_catalog.pg_get_constraintdef(oid) ilike '%discard%')
 then raise exception 'Voluntary discard state not checked';end if;
 if not exists(select 1 from pg_catalog.pg_constraint
   where conrelid='public.chaotic_preview_3x3_hand_discards'::regclass
   and contype='p' and pg_catalog.pg_get_constraintdef(oid) like '%turn_no%')
 then raise exception 'Only-one-discard-per-turn constraint absent';end if;
 if not exists(select 1 from pg_catalog.pg_constraint
   where conrelid='public.chaotic_preview_3x3_hand_draw_events'::regclass
   and contype='p' and pg_catalog.pg_get_constraintdef(oid) like '%turn_no%')
 then raise exception 'Only-one-draw-event-per-turn constraint absent';end if;
 if exists(select 1 from public.chaotic_preview_3x3_hand_discards
  where original_card_consumed or training_points_changed or official_match_modified)
 or exists(select 1 from public.chaotic_preview_3x3_hand_draw_events
  where original_card_consumed or official_match_modified)
 then raise exception 'Private discard/draw changed original cards or official state';end if;
end $check$;
rollback;
select 'PASS v0.1.40: owner-only discard/recycle, once-per-turn audit, original cards intact' as result;