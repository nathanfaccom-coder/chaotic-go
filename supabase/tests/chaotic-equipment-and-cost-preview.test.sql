-- Chaotic GO v0.1.10: all temporary fixtures are rolled back.
begin;
insert into public.chaotic_preview_card_reference
 (kind,card_id,card_name,base_damage,attack_cost,element_damage,attribute_check,attribute_bonus)
 values
 ('attack','__gear_wind__','Test Wind',10,1,'{"ar":5}'::jsonb,null,0),
 ('attack','__gear_earth__','Test Earth',10,1,'{"terra":5}'::jsonb,null,0),
 ('attack','__gear_water__','Test Water',10,1,'{"agua":5}'::jsonb,null,0);
do $$
declare
 result jsonb;
 stats_a jsonb:='{"c":60,"p":50,"s":40,"v":30,"e":55}'::jsonb;
 stats_b jsonb:='{"c":50,"p":40,"s":30,"v":20,"e":40}'::jsonb;
begin
 result:=public.chaotic_preview_equipment_formula('__gear_earth__','Johnes',stats_a,stats_b,
 'Bracelete de cristal',true,'Promos',null,false);
 if (result->>'subtotal')::integer<>20 or (result->>'equipment_bonus')::integer<>5
 then raise exception 'Bracelete Terra: %',result; end if;
 result:=public.chaotic_preview_equipment_formula('__gear_water__','Alfel',stats_a,stats_b,
 'Bracelete de Água',false,'Promos',null,false);
 if (result->>'subtotal')::integer<>15 or (result->>'equipment_bonus')::integer<>0
 then raise exception 'Equipamento oculto não pode atuar: %',result; end if;
 result:=public.chaotic_preview_equipment_formula('__gear_wind__','Johnes',stats_a,stats_b,
 null,false,'Rex',null,false);
 if (result->>'subtotal')::integer<>0 or result->>'immunity_reason' not like '%Rex%'
 then raise exception 'Imunidade Rex: %',result; end if;
 result:=public.chaotic_preview_equipment_formula('__gear_wind__','Johnes',stats_a,stats_b,
 null,false,'Promos','Amuleto do Vácuo',true);
 if (result->>'subtotal')::integer<>0 or result->>'immunity_reason' not like '%Amuleto%'
 then raise exception 'Amuleto: %',result; end if;
 result:=public.chaotic_preview_equipment_formula('__gear_earth__','Johnes',stats_a,stats_b,
 null,false,'Promos','Anel Precioso',true);
 if result->>'subtotal' is not null or (result->>'elemental')::integer<>0
 then raise exception 'Anel: %',result; end if;
 result:=public.chaotic_preview_equipment_formula('__gear_earth__','Johnes',stats_a,stats_b,
 'Bomba de Fogo',true,'Promos',null,false);
 if result->>'subtotal' is not null then raise exception 'Bomba: %',result; end if;
 result:=public.chaotic_preview_equipment_formula('104','Lion',stats_a,stats_b,
 null,false,'Promos',null,false);
 if result->>'subtotal' is not null then raise exception 'Dado: %',result; end if;
 if has_table_privilege('authenticated','public.chaotic_preview_equipment_reveals','insert')
   or has_table_privilege('authenticated','public.chaotic_preview_equipment_reveals','update')
   or has_table_privilege('authenticated','public.chaotic_preview_equipment_reveals','delete')
 then raise exception 'Cliente consegue gravar revelação diretamente';end if;
 if has_function_privilege('anon','public.chaotic_reveal_preview_equipment(uuid,integer)','execute')
 then raise exception 'Anônimo consegue revelar equipamento';end if;
 if not (select relrowsecurity from pg_class where oid='public.chaotic_preview_equipment_reveals'::regclass)
 then raise exception 'RLS desativada';end if;
end $$;
rollback;
select 'PASS: equipamento, visibilidade, imunidades, custos não cobrados e permissões (rollback)' as result;