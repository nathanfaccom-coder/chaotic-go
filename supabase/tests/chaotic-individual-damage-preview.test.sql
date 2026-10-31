-- Run as a transaction: tests helper logic and API grants, no persistent mutations.
begin;
do $$
declare a jsonb;b jsonb;c jsonb;d jsonb;
begin
  a:=public.chaotic_preview_individual_parts('101','Lion',
    '{"c":80,"p":40,"s":30,"v":30,"e":55}'::jsonb,
    '{"c":50,"p":40,"s":30,"v":20,"e":45}'::jsonb);
  if a->>'status'<>'partial_estimate' or (a->>'base')::integer<>10
    or (a->>'elemental')::integer<>5 or (a->>'subtotal')::integer<>15
  then raise exception 'Elemento + dano do catálogo não correspondem: %',a;end if;
  b:=public.chaotic_preview_individual_parts('104','Johnes',
    '{"c":40,"p":40,"s":30,"v":20,"e":85}'::jsonb,
    '{"c":20,"p":20,"s":30,"v":40,"e":45}'::jsonb);
  if b->>'status'<>'special_resolution_required' or b->>'subtotal' is not null
  then raise exception 'Ataque com dado não pode produzir dano final: %',b;end if;
  c:=public.chaotic_preview_individual_parts('101','Johnes (Max)',
    '{"c":40,"p":40,"s":30,"v":20,"e":85}'::jsonb,
    '{"c":20,"p":20,"s":30,"v":40,"e":45}'::jsonb);
  if (c->>'subtotal')::integer<>10 then raise exception 'Nome Max não resolvido: %',c;end if;
  d:=public.chaotic_preview_individual_parts('113','Lion',
    '{"c":80,"p":40,"s":30,"v":30,"e":55}'::jsonb,
    '{"c":50,"p":40,"s":30,"v":20,"e":45}'::jsonb);
  if d->>'status'<>'special_resolution_required' or d->>'subtotal' is not null
  then raise exception 'Efeito de cemitério não pode ser finalizado: %',d;end if;
end $$;

insert into public.chaotic_preview_card_reference
 (kind,card_id,card_name,base_damage,attack_cost,element_damage,attribute_check,attribute_bonus)
 values('attack','__test_dna_check__','Atributo individual temporário',
 3,0,'{}'::jsonb,'coragem',9);
do $$
declare bigger jsonb;smaller jsonb;
begin
  bigger:=public.chaotic_preview_individual_parts('__test_dna_check__','Lion',
    '{"c":90,"p":30,"s":20,"v":20,"e":55}'::jsonb,
    '{"c":30,"p":30,"s":20,"v":20,"e":45}'::jsonb);
  smaller:=public.chaotic_preview_individual_parts('__test_dna_check__','Lion',
    '{"c":10,"p":30,"s":20,"v":20,"e":55}'::jsonb,
    '{"c":30,"p":30,"s":20,"v":20,"e":45}'::jsonb);
  if (bigger->>'subtotal')::integer<>12 or (bigger->>'attribute')::integer<>9
    or (smaller->>'subtotal')::integer<>3 or (smaller->>'attribute')::integer<>0
  then raise exception 'Bônus DNA não respeita comparação real: % vs %',bigger,smaller;end if;
end $$;

do $$
declare denied boolean:=false;
begin
  begin
    perform public.chaotic_calculate_individual_preview(null,1);
  exception when others then denied:=true;
  end;
  if not denied then raise exception 'RPC sem partida deveria ser recusada';end if;
  if has_table_privilege('authenticated','public.chaotic_preview_individual_damage','insert')
     or has_table_privilege('authenticated','public.chaotic_preview_individual_damage','update')
     or has_table_privilege('authenticated','public.chaotic_preview_individual_damage','delete')
  then raise exception 'Cliente poderia escrever prévia sem validação';end if;
  if has_function_privilege('anon','public.chaotic_calculate_individual_preview(uuid,integer)','execute')
  then raise exception 'Anônimo consegue executar o cálculo';end if;
  if not (select relrowsecurity from pg_class where oid='public.chaotic_preview_individual_damage'::regclass)
  then raise exception 'RLS desabilitada';end if;
end $$;
rollback;
select 'PASS: DNA, elementos, ataque especial, permissão, rollback e HP intocado' as result;
