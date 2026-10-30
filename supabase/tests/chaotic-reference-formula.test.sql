-- Diagnostics for reference-only formula. Run in staging; rolled back in the same session.
begin;
do $$
declare a jsonb;b jsonb;c jsonb;d jsonb;
begin
 a:=public.chaotic_reference_modifier_formula('101','11','1');
 if (a->>'subtotal')::integer<>15 or (a->>'elemental')::integer<>5
 then raise exception 'Lion fire bonus incorrect: %',a;end if;
 b:=public.chaotic_reference_modifier_formula('107','1','4');
 if (b->>'subtotal')::integer<>10 or (b->>'elemental')::integer<>5
 then raise exception 'Johnes earth bonus incorrect: %',b;end if;
 c:=public.chaotic_reference_modifier_formula('104','11','1');
 if c->>'status'<>'roll_or_special_required' or c->>'subtotal' is not null
 then raise exception 'Fogo Primordial dice should block final preview: %',c;end if;
 d:=public.chaotic_reference_modifier_formula('999','11','1');
 if d->>'status'<>'unknown_attack' or d->>'subtotal' is not null
 then raise exception 'Invalid card must not produce a damage number: %',d;end if;
end $$;
insert into public.chaotic_preview_card_reference(
 kind,card_id,card_name,base_damage,attack_cost,
 element_damage,attribute_check,attribute_bonus)
values('attack','__test_attr__','Prova temporária',3,0,'{}'::jsonb,'coragem',10);
do $$
declare high jsonb;low jsonb;
begin
 high:=public.chaotic_reference_modifier_formula('__test_attr__','6','2');
 low:=public.chaotic_reference_modifier_formula('__test_attr__','2','6');
 if (high->>'attribute')::integer<>10 or (high->>'subtotal')::integer<>13
 then raise exception 'Expected +10 courage bonus: %',high;end if;
 if (low->>'attribute')::integer<>0 or (low->>'subtotal')::integer<>3
 then raise exception 'Expected zero courage bonus: %',low;end if;
end $$;
rollback;
select 'SUCCESS: elements, attributes, dice and nonexistent card checked with rollback' as result;