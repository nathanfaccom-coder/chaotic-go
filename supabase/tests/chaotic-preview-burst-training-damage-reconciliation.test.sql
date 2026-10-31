-- v0.1.25: regression for equipment-only training damage reconciliation.
-- Read-only checks in a transaction; no matches or user data modified.
begin;
do $$
declare
 def text;
 formula jsonb;
 basal int;
 elem int;
begin
 formula:=public.chaotic_preview_equipment_formula(
  '110','Johnes',
  '{"c":70,"p":70,"s":70,"v":70,"e":65}'::jsonb,
  '{"c":70,"p":70,"s":70,"v":70,"e":65}'::jsonb,
  null,false,'Leona','Anel Precioso',false);
 basal:=(formula->>'subtotal')::integer;
 elem:=(formula->>'elemental')::integer;
 if basal<>10 or elem<>10 then
   raise exception 'Canonical SONAR must be ten Air and zero base: %',formula;end if;
 if greatest(0,basal-elem)<>0 then
   raise exception 'Ring must eliminate the entire Air bonus';end if;
 select pg_get_functiondef(
  'public.chaotic_calculate_individual_preview(uuid,integer)'::regprocedure
 ) into def;
 if position('chaotic_preview_burst_equipment_effects' in def)=0
  or position('chaotic_preview_burst_order_plans' in def)=0
  or position('chaotic_preview_hp_wallets' in def)=0
  or position('training_wallet.hp_remaining' in def)=0
  or position('training_result.defender_id' in def)=0
  or position('training_result.hp_after' in def)=0
  or position('training_result.effect_code' in def)=0
 then raise exception 'Partial damage not securely reconciled with training ledgers';end if;
 if position('training_result.effect_code=''wisdom_staff''' in def)=0
  or position('jsonb_set' in def)=0
 then raise exception 'Resolved staff wisdom has not entered defender DNA calculation';end if;
 if position('training_result.effect_code=''precious_ring_hp''' in def)=0
  or position('then 0 else (parts->>''elemental'')::integer end' in def)=0
 then raise exception 'Training ring elemental suppression absent';end if;
 if position('training_applied then' in def)=0
  or position('energy:=training_wallet.hp_remaining' in def)=0
 then raise exception 'Duplicate Kiru/HP accounting may persist';end if;
 if position('treino ainda não resolvido' in def)=0 then
  raise exception 'Unresolved equipment must block preview';end if;
 if has_function_privilege('anon',
   'public.chaotic_calculate_individual_preview(uuid,integer)','execute')
 then raise exception 'Anonymous damage preview RPC access';end if;
 if not has_function_privilege('authenticated',
   'public.chaotic_calculate_individual_preview(uuid,integer)','execute')
 then raise exception 'Authenticated attacker blocked';end if;
 if exists(select 1 from public.chaotic_preview_burst_equipment_effects
    where applied_to_official_match or official_hp_changed or final_damage_verified)
 then raise exception 'Experimental effect leaked to official game';end if;
end $$;
rollback;
select 'PASS: SONAR Air 10/Ring 0, training HP and Staff reconciliation, unresolved guard, no official damage' as result;