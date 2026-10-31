begin;
do $$
declare
 outcome jsonb;
 c integer;
 answer_sql text;
begin
 outcome:=public.chaotic_preview_air_immunity_reason('110','Rex',null,false);
 if (outcome->>'eligible')::boolean is not true
  or outcome->>'source'<>'rex_air'
  or (outcome->>'official_damage_modified')::boolean is not false
 then raise exception 'Rex should resist wind passively: %',outcome;end if;
 outcome:=public.chaotic_preview_air_immunity_reason('110','Johnes','Amuleto do Vácuo',true);
 if (outcome->>'eligible')::boolean is not true
  or outcome->>'source'<>'vacuum_amulet_air'
 then raise exception 'Revealed amulet should resist wind: %',outcome;end if;
 outcome:=public.chaotic_preview_air_immunity_reason('110','Johnes','Amuleto do Vácuo',false);
 if (outcome->>'eligible')::boolean is not false then
  raise exception 'Hidden amulet must not provide wind immunity: %',outcome;end if;
 outcome:=public.chaotic_preview_air_immunity_reason('101','Rex','Amuleto do Vácuo',true);
 if (outcome->>'eligible')::boolean is not false then
  raise exception 'Nonwind attack incorrectly resisted: %',outcome;end if;
 outcome:=public.chaotic_preview_air_immunity_reason('110','Rex','Amuleto do Vácuo',true);
 if outcome->>'source'<>'rex_air' then
   raise exception 'Rex source should win over duplicate amulet: %',outcome;end if;
 if has_table_privilege('authenticated','public.chaotic_preview_burst_windows','update')
  or has_table_privilege('authenticated','public.chaotic_preview_burst_windows','insert')
 then raise exception 'Client can forge immunity responses';end if;
 if has_function_privilege('anon','public.chaotic_acknowledge_preview_air_immunity(uuid,integer)','execute')
 then raise exception 'Anonymous can acknowledge immunity';end if;
 if not has_function_privilege('authenticated','public.chaotic_acknowledge_preview_air_immunity(uuid,integer)','execute')
 then raise exception 'Authenticated defender cannot acknowledge';end if;
 if has_function_privilege('authenticated',
   'public.chaotic_preview_air_immunity_reason(text,text,text,boolean)','execute')
 then raise exception 'Private model helper should not be called from browser';end if;
 select pg_get_functiondef('public.chaotic_acknowledge_preview_air_immunity(uuid,integer)'::regprocedure) into answer_sql;
 if position('win.defender_id <> actor' in answer_sql)=0 and
   position('win.defender_id<>actor' in answer_sql)=0
 then raise exception 'Defender-identity guard absent';end if;
 if position('equipment_instance_id = defender.equipment_instance_id' in answer_sql)=0 and
    position('equipment_instance_id=defender.equipment_instance_id' in answer_sql)=0
 then raise exception 'Revealed amulet instance check missing';end if;
 if position('status = ''awaiting_defender''' in
    pg_get_functiondef('public.chaotic_pass_turn(uuid,integer)'::regprocedure))=0
    and position('status=''awaiting_defender''' in
    pg_get_functiondef('public.chaotic_pass_turn(uuid,integer)'::regprocedure))=0
 then raise exception 'Pass-turn does not block pending defender response';end if;
 if position('burst_air_immunity_acknowledged_preview_only' in
   pg_get_functiondef('public.chaotic_audit_preview_damage(uuid,integer)'::regprocedure))=0
 then raise exception 'Final damage audit does not list immunity acknowledgement';end if;
 select count(*) into c from pg_constraint
  where conrelid='public.chaotic_preview_burst_windows'::regclass
   and pg_get_constraintdef(oid) like '%burst_fully_resolved%';
 if c=0 then raise exception 'Burst finalization check missing';end if;
end $$;
rollback;
select 'PASS: Rex & revealed Amulet vs Ar, hidden gear, nonwind, actor guards, no final damage' as result;