begin;
do $$
declare
 v jsonb;
 a integer;
 invalid_rejected boolean:=false;
 name text;
 attr text;
begin
 if public.chaotic_preview_location_attribute(501)<>'s'
  or public.chaotic_preview_location_attribute(502)<>'p'
  or public.chaotic_preview_location_attribute(503)<>'v'
  or public.chaotic_preview_location_attribute(504) is not null then
    raise exception 'Location model to initiative attribute is inconsistent';end if;
 v:=public.chaotic_preview_initiative_compare(
  '{"v":90,"p":30,"s":20}'::jsonb,'{"v":10,"p":55,"s":60}'::jsonb,'p');
 if v->>'winner_side'<>'defender'
   or (v->>'attacker')::integer<>30 or (v->>'defender')::integer<>55
 then raise exception 'Power location failed: %',v;end if;
 v:=public.chaotic_preview_initiative_compare(
  '{"v":90,"p":30,"s":60}'::jsonb,'{"v":10,"p":55,"s":60}'::jsonb,'s');
 if v->>'winner_side'<>'attacker' or (v->>'tie_favors_attacker')::boolean is not true
 then raise exception 'Wisdom tie should favor attacker: %',v;end if;
 v:=public.chaotic_preview_initiative_compare(
  '{"v":21}'::jsonb,'{"v":50}'::jsonb,'v');
 if v->>'winner_side'<>'defender' then raise exception 'Magma speed fallback wrong';end if;
 begin
  perform public.chaotic_preview_initiative_compare('{"v":30}'::jsonb,'{"p":30}'::jsonb,'p');
 exception when others then invalid_rejected:=true;
 end;
 if not invalid_rejected then raise exception 'Missing Power stat accepted';end if;
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_room_locations'::regclass)
 then raise exception 'Location RLS disabled';end if;
 if has_table_privilege('authenticated','public.chaotic_preview_room_locations','insert')
 or has_table_privilege('authenticated','public.chaotic_preview_room_locations','update')
 or has_table_privilege('authenticated','public.chaotic_preview_room_locations','delete')
 then raise exception 'Players can force a Location';end if;
 if has_function_privilege('anon','public.chaotic_capture_preview_room_location(uuid,integer)','execute')
 then raise exception 'Anonymous RPC access';end if;
 if not has_function_privilege('authenticated','public.chaotic_capture_preview_room_location(uuid,integer)','execute')
 then raise exception 'Authenticated cannot request server draw';end if;
 select count(*) into a from information_schema.columns
  where table_schema='public' and table_name='chaotic_preview_initiatives'
  and column_name='location_id';
 if a<>1 then raise exception 'Initiative must persist chosen Location';end if;
 if not exists(select 1 from pg_policies
  where schemaname='public' and tablename='chaotic_preview_room_locations'
    and cmd='SELECT') then raise exception 'Members-only read policy missing';end if;
end $$;
rollback;
select 'PASS: Kiru Wisdom, Tunnel Power, Magma Speed, tie, RLS, private draw, no real game writes' as result;