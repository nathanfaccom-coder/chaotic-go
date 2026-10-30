-- Chaotic GO 0.1.21: defender may acknowledge validated AIR immunity in Burst.
-- Rex immunity is passive. Amuleto do Vácuo requires equipment to be revealed.
-- No official damage, HP, card stock, ability token or victory is modified.
alter table public.chaotic_preview_burst_windows
 drop constraint if exists chaotic_preview_burst_windows_status_check,
 drop constraint if exists chaotic_preview_burst_windows_defender_response_check,
 drop constraint if exists chaotic_preview_burst_windows_check1;
alter table public.chaotic_preview_burst_windows
 add column if not exists defensive_immunity_source text
   check(defensive_immunity_source is null or defensive_immunity_source in ('rex_air','vacuum_amulet_air')),
 add constraint chaotic_preview_burst_windows_status_check
   check(status in ('awaiting_defender','defender_passed','defender_immunity_noted')),
 add constraint chaotic_preview_burst_windows_defender_response_check
   check(defender_response is null or defender_response in ('pass','acknowledge_air_immunity')),
 add constraint chaotic_preview_burst_windows_check1 check(
  (status='awaiting_defender' and defender_response is null
    and defender_responded_at is null and defensive_immunity_source is null)
  or (status='defender_passed' and defender_response='pass'
    and defender_responded_at is not null and defensive_immunity_source is null)
  or (status='defender_immunity_noted' and defender_response='acknowledge_air_immunity'
    and defender_responded_at is not null and defensive_immunity_source is not null)
 );

create or replace function public.chaotic_preview_air_immunity_reason(
 p_catalog_attack_id text,p_defender_name text,p_equipment_name text,p_equipment_revealed boolean
) returns jsonb
language plpgsql stable security invoker set search_path=''
as $fn$
declare
 ref public.chaotic_preview_card_reference;
 wind_damage boolean;
 clean_name text;
 clean_equip text;
 source_code text;
begin
 select * into ref from public.chaotic_preview_card_reference
  where kind='attack' and card_id=p_catalog_attack_id;
 if not found then raise exception 'Ataque fora do catálogo original';end if;
 wind_damage:=coalesce((ref.element_damage->>'ar')::integer,0)>0
   or coalesce((ref.element_damage->>'vento')::integer,0)>0;
 clean_name:=pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_defender_name,'')),
   ' [(]Max[)]$','');
 clean_equip:=pg_catalog.lower(pg_catalog.btrim(coalesce(p_equipment_name,'')));
 if wind_damage then
  if clean_name='Rex' then source_code:='rex_air';
  elsif coalesce(p_equipment_revealed,false) and clean_equip='amuleto do vácuo' then
    source_code:='vacuum_amulet_air';
  end if;
 end if;
 return pg_catalog.jsonb_build_object('eligible',source_code is not null,
  'air_attack',wind_damage,'source',source_code,
  'preview_only',true,'official_damage_modified',false);
end;
$fn$;
revoke all on function public.chaotic_preview_air_immunity_reason(text,text,text,boolean)
 from public,anon,authenticated;

create or replace function public.chaotic_acknowledge_preview_air_immunity(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_burst_windows
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 win public.chaotic_preview_burst_windows;
 c public.chaotic_preview_clashes;
 attack public.chaotic_preview_attack_instances;
 defender public.chaotic_preview_loadouts;
 equip public.chaotic_preview_equipment_reveals;
 evidence jsonb;
 result public.chaotic_preview_burst_windows;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or actor not in(m.host_id,m.guest_id) then
  raise exception 'Partida ou turno indisponível';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
  raise exception 'Sala 1x1 inválida';end if;
 select * into win from public.chaotic_preview_burst_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or win.status<>'awaiting_defender'
  or win.defender_id<>actor or win.attacker_id<>m.current_player
 then raise exception 'Somente o defensor pode reconhecer imunidade durante a resposta';end if;
 select * into c from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into attack from public.chaotic_preview_attack_instances
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into defender from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=actor;
 if c.attacker_id is distinct from win.attacker_id
  or c.defender_id is distinct from actor
  or c.defender_card is distinct from defender.card_instance_id
  or attack.actor_id is distinct from win.attacker_id
  or attack.attack_instance_id is distinct from win.attack_instance_id
  or attack.attack_instance_id is distinct from c.attack_card then
   raise exception 'Ataque ou criatura não corresponde à janela Burst';end if;
 select * into equip from public.chaotic_preview_equipment_reveals
  where lobby_id=p_lobby_id and actor_id=actor
    and equipment_instance_id=defender.equipment_instance_id
    and equipment_name=defender.equipment_name;
 evidence:=public.chaotic_preview_air_immunity_reason(
  attack.catalog_attack_id,defender.creature_name,defender.equipment_name,found);
 if (evidence->>'eligible')::boolean is not true then
   raise exception 'A criatura não possui imunidade validada para este ataque de Ar';end if;
 update public.chaotic_preview_burst_windows
  set status='defender_immunity_noted',
   defender_response='acknowledge_air_immunity',
   defender_responded_at=now(),
   defensive_immunity_source=evidence->>'source'
  where lobby_id=p_lobby_id and turn_no=p_expected_turn
 returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_acknowledge_preview_air_immunity(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_acknowledge_preview_air_immunity(uuid,integer)
 to authenticated;
