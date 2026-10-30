-- 0.1.24 test canonical equipment reveal arithmetic and safety in isolation.
begin;
do $$
declare x jsonb;
begin
 x:=public.chaotic_preview_reveal_equipment_effect('Anel Precioso',55,75,70);
 if x->>'effect_code'<>'precious_ring_hp' or (x->>'hp_after')::int<>40
  or (x->>'hp_max_after')::int<>75 or (x->>'wisdom_after')::int<>70
 then raise exception 'Ring damage invalid %',x;end if;
 x:=public.chaotic_preview_reveal_equipment_effect('Anel Precioso',6,75,70);
 if (x->>'hp_after')::int<>0 then raise exception 'Ring must clamp at zero';end if;
 x:=public.chaotic_preview_reveal_equipment_effect('Bastão da Sabedoria',60,75,88);
 if x->>'effect_code'<>'wisdom_staff' or (x->>'wisdom_after')::int<>128
  or (x->>'hp_after')::int<>60 or (x->>'hp_max_after')::int<>75
 then raise exception 'Staff bonus invalid %',x;end if;
 x:=public.chaotic_preview_reveal_equipment_effect('Bomba de Fogo',57,75,70);
 if x->>'effect_code'<>'fire_bomb_hp' or (x->>'hp_after')::int<>62
  or (x->>'hp_max_after')::int<>80 then raise exception 'Bomb HP invalid %',x;end if;
 begin
  perform public.chaotic_preview_reveal_equipment_effect('Arpa Mágica',50,75,70);
  raise exception 'Unknown effect was allowed';
 exception when raise_exception then
  if sqlerrm='Unknown effect was allowed' then raise;end if;
 end;
 if not (select relrowsecurity from pg_class
   where oid='public.chaotic_preview_burst_equipment_effects'::regclass) then
   raise exception 'Equipment effects RLS off';end if;
 if has_table_privilege('authenticated','public.chaotic_preview_burst_equipment_effects','insert')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_equipment_effects','update')
  or has_table_privilege('anon','public.chaotic_preview_burst_equipment_effects','select')
 then raise exception 'Direct event forging possible';end if;
 if has_function_privilege('anon','public.chaotic_apply_preview_burst_equipment_effect(uuid,integer)','execute')
 then raise exception 'Anonymous effect applied';end if;
 if not has_function_privilege('authenticated','public.chaotic_apply_preview_burst_equipment_effect(uuid,integer)','execute')
 then raise exception 'Authenticated attacker cannot run RPC';end if;
 if not exists(select 1 from pg_constraint
  where conrelid='public.chaotic_preview_burst_equipment_effects'::regclass
   and pg_get_constraintdef(oid) like '%official_hp_changed%') then
    raise exception 'No official HP safety guard';end if;
 if exists(select 1 from public.chaotic_preview_burst_equipment_effects
  where applied_to_official_match or official_hp_changed
   or final_damage_verified) then
    raise exception 'Found official effects in training-only table';end if;
end $$;
rollback;
select 'PASS: ring -15, staff +40 wisdom, bomb +5 HP, zero clamp, unsupported rejection and read-only RLS' as result;