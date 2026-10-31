-- v0.1.16: read-only regression; no real player cards or matches are created.
begin;
do $$
declare
 r jsonb;
 before_count bigint;
 bad boolean:=false;
begin
 r:=public.chaotic_preview_location_damage('101','Johnes','Vermelho',503);
 if (r->>'added_fire_elemental')::integer<>5 or
    (r->>'terrain_damage_delta')::integer<>0 then
  raise exception 'Magma must grant missing Fire to Johnes: %',r;end if;
 r:=public.chaotic_preview_location_damage('101','Lion','Azul',503);
 if (r->>'added_fire_elemental')::integer<>0 then
  raise exception 'Natural Fire must not double count on Lion: %',r;end if;
 r:=public.chaotic_preview_location_damage('101','Johnes','Vermelho',502);
 if (r->>'terrain_damage_delta')::integer<>-5 then
  raise exception 'Tunnel must reduce Water attack by 5: %',r;end if;
 r:=public.chaotic_preview_location_damage('110','Johnes','Vermelho',502);
 if (r->>'terrain_damage_delta')::integer<>5 then
  raise exception 'Tunnel must boost Air attack by 5: %',r;end if;
 r:=public.chaotic_preview_location_damage('101','Johnes','Azul',501);
 if (r->>'defender_energy_bonus')::integer<>10 or
    (r->>'terrain_damage_delta')::integer<>0 then
  raise exception 'Kiru must add 10 energy to Blue defender: %',r;end if;
 r:=public.chaotic_preview_location_damage('101','Johnes','Vermelho',501);
 if (r->>'defender_energy_bonus')::integer<>0 then
  raise exception 'Kiru must not buff a non-Blue defender: %',r;end if;
 r:=public.chaotic_preview_location_damage('101','Johnes','Azul',null);
 if (r->>'added_fire_elemental')::integer<>0 or
    (r->>'defender_energy_bonus')::integer<>0 then
  raise exception 'Absent location must have no buffs: %',r;end if;
 begin
  perform public.chaotic_preview_location_damage('101','Johnes','Azul',999);
 exception when others then bad:=true;
 end;
 if not bad then raise exception 'Invalid location accepted';end if;
 bad:=false;
 begin
  perform public.chaotic_preview_location_damage('101','NoSuchCreature','Azul',503);
 exception when others then bad:=true;
 end;
 if not bad then raise exception 'Unknown creature should reject Magma buff';end if;
 if not exists(select 1 from information_schema.columns
   where table_schema='public' and table_name='chaotic_preview_individual_damage'
     and column_name='location_damage_delta') then
   raise exception 'Location breakdown columns not installed';end if;
 if not (select relrowsecurity from pg_class
  where oid='public.chaotic_preview_individual_damage'::regclass) then
  raise exception 'Damage preview RLS disabled';end if;
 if has_table_privilege('authenticated','public.chaotic_preview_individual_damage','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_individual_damage','update')
 then raise exception 'Clients can forge damage previews';end if;
 if has_function_privilege('authenticated','public.chaotic_preview_location_damage(text,text,text,integer)','execute')
 then raise exception 'Clients must not bypass private location helper';end if;
 if has_function_privilege('anon','public.chaotic_calculate_individual_preview(uuid,integer)','execute')
 then raise exception 'Anonymous users can calculate damage';end if;
 if not (
  pg_get_functiondef('public.chaotic_calculate_individual_preview(uuid,integer)'::regprocedure)
   like '%spent_reason = ''attack''%'
  or pg_get_functiondef('public.chaotic_calculate_individual_preview(uuid,integer)'::regprocedure)
   like '%spent_reason=''attack''%'
 ) then raise exception 'Discard used as paid attack after migration';end if;
end $$;
rollback;
select 'PASS: Magma Fire, natural Fire, Tunnel Ar/Agua, Kiru tribe, RLS, paid hand, no official writes' as result;