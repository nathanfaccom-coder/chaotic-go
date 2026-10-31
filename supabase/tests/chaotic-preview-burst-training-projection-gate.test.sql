-- 0.1.26: protection for applying hypothetical HP only after checked Burst.
-- Transactional checks; no official match data, users or cards modified.
begin;
do $$
declare f text; key text;
begin
 select pg_get_functiondef('public.chaotic_apply_preview_hp_projection(uuid,integer)'::regprocedure) into f;
 foreach key in array array[
 'chaotic_preview_burst_windows','chaotic_preview_burst_order_plans',
 'chaotic_preview_burst_equipment_responses','chaotic_preview_burst_equipment_effects',
 'inspect_queued_equipment_reveal','inspect_passive_air_immunity','inspect_attack',
 'training_ledger','burst_effect.hp_after','unit_d.hp_remaining',
 'Projeção bloqueada: HP do treino mudou'
 ] loop
   if position(key in f)=0 then raise exception 'Burst training guard missing: %',key;end if;
 end loop;
 if has_function_privilege('anon','public.chaotic_apply_preview_hp_projection(uuid,integer)','execute')
    or not has_function_privilege('authenticated','public.chaotic_apply_preview_hp_projection(uuid,integer)','execute')
 then raise exception 'Incorrect access to training projection RPC';end if;
 if exists(select 1 from public.chaotic_preview_hp_events
    where official_hp_changed or final_damage_verified)
 then raise exception 'Official state leaked to training HP events';end if;
 if exists(select 1 from public.chaotic_preview_burst_equipment_effects
    where applied_to_official_match or official_hp_changed or final_damage_verified)
 then raise exception 'Official state leaked to equipment training';end if;
 if position('chaotic_preview_hp_remainder' in f)=0
   or position('chaotic_preview_hp_events' in f)=0
 then raise exception 'Original hypothetical HP projection behavior missing';end if;
end $$;
rollback;
select 'PASS v0.1.26: inspected Burst before hypothetical damage, replay/HP guards and no official state' as result;