-- v0.1.58 privacy hardening: even a now-knocked-out, STILL-FACEDOWN
-- teammate may have contributed Guru support to a historical inspection.
-- Never disclose its existence until every team member is actually revealed.
create or replace function public.chaotic_get_preview_3x3_safe_inspections(p_lobby_id uuid)
 returns jsonb language plpgsql security definer set search_path=''
as $safe$
declare
 actor uuid:=auth.uid();
 actor_host uuid;
 actor_guest uuid;
 creature_rows jsonb;
 dynamic_rows jsonb;
begin
 if actor is null or p_lobby_id is null
 then raise exception 'Faça login para consultar a inspeção de treino';end if;
 select m.host_id,m.guest_id into actor_host,actor_guest
 from public.chaotic_match_turns m
 join public.chaotic_lobbies l on l.id=m.lobby_id
 where m.lobby_id=p_lobby_id and l.mode='3x3'
  and l.host_id=m.host_id and l.guest_id=m.guest_id;
 if not found or actor not in (actor_host,actor_guest)
 then raise exception 'Acesso a inspeções 3x3 negado';end if;

 -- Whitelist returned keys. A snapshot can be older than the face-up
 -- transition; inspect CURRENT face status, defaulting to concealed.
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'turn_no',c.turn_no,
  'attacker_creature_name',case when c.attacker_id=actor or coalesce(fa.face_up,false)
   then c.attacker_creature_name else null end,
  'defender_creature_name',case when c.defender_id=actor or coalesce(fd.face_up,false)
   then c.defender_creature_name else null end,
  'attacker_base_elements',case when c.attacker_id=actor or coalesce(fa.face_up,false)
   then c.attacker_base_elements else '[]'::jsonb end,
  'defender_base_elements',case when c.defender_id=actor or coalesce(fd.face_up,false)
   then c.defender_base_elements else '[]'::jsonb end,
  'fire_base_match',case when c.attacker_id=actor or coalesce(fa.face_up,false)
   then c.fire_base_match else null end,
  'water_base_match',case when c.attacker_id=actor or coalesce(fa.face_up,false)
   then c.water_base_match else null end,
  'earth_base_match',case when c.attacker_id=actor or coalesce(fa.face_up,false)
   then c.earth_base_match else null end,
  'air_base_match',case when c.attacker_id=actor or coalesce(fa.face_up,false)
   then c.air_base_match else null end,
  'rex_air_immunity_candidate',case when c.defender_id=actor or coalesce(fd.face_up,false)
   then c.rex_air_immunity_candidate else null end,
  'final_damage_calculated',c.final_damage_calculated,
  'official_match_modified',c.official_match_modified
 ) order by c.turn_no desc),'[]'::jsonb)
 into creature_rows
 from (select * from public.chaotic_preview_3x3_creature_element_checks
   where lobby_id=p_lobby_id order by turn_no desc limit 40) c
 left join public.chaotic_preview_3x3_face_states fa on
  fa.lobby_id=c.lobby_id and fa.actor_id=c.attacker_id
  and fa.position=c.attacker_slot
 left join public.chaotic_preview_3x3_face_states fd on
  fd.lobby_id=c.lobby_id and fd.actor_id=c.defender_id
  and fd.position=c.defender_slot;

 -- Guru support count (even without the card name) fingerprints a hidden Guru.
 -- A viewer sees their own team's count, or the opposing team's count ONLY
 -- when every living teammate has been revealed; otherwise NULL, not zero.
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'turn_no',d.turn_no,
  'attacker_guru_support_count',case when d.attacker_id=actor
   or not exists(select 1 from public.chaotic_preview_3x3_allies a
    left join public.chaotic_preview_3x3_face_states f
     on f.lobby_id=a.lobby_id and f.actor_id=a.actor_id and f.position=a.position
    where a.lobby_id=p_lobby_id and a.actor_id=d.attacker_id
      and not coalesce(f.face_up,false))
   then d.attacker_guru_support_count else null end,
  'defender_guru_support_count',case when d.defender_id=actor
   or not exists(select 1 from public.chaotic_preview_3x3_allies a
    left join public.chaotic_preview_3x3_face_states f
     on f.lobby_id=a.lobby_id and f.actor_id=a.actor_id and f.position=a.position
    where a.lobby_id=p_lobby_id and a.actor_id=d.defender_id
      and not coalesce(f.face_up,false))
   then d.defender_guru_support_count else null end,
  'attacker_guru_air_candidate',case when d.attacker_id=actor
   or not exists(select 1 from public.chaotic_preview_3x3_allies a
    left join public.chaotic_preview_3x3_face_states f
     on f.lobby_id=a.lobby_id and f.actor_id=a.actor_id and f.position=a.position
    where a.lobby_id=p_lobby_id and a.actor_id=d.attacker_id
      and not coalesce(f.face_up,false))
   then d.attacker_guru_air_candidate else null end,
  'defender_guru_air_candidate',case when d.defender_id=actor
   or not exists(select 1 from public.chaotic_preview_3x3_allies a
    left join public.chaotic_preview_3x3_face_states f
     on f.lobby_id=a.lobby_id and f.actor_id=a.actor_id and f.position=a.position
    where a.lobby_id=p_lobby_id and a.actor_id=d.defender_id
      and not coalesce(f.face_up,false))
   then d.defender_guru_air_candidate else null end,
  'attacker_naty_variable_candidate',case when d.attacker_id=actor or coalesce(fa.face_up,false)
   then d.attacker_naty_variable_candidate else null end,
  'defender_naty_variable_candidate',case when d.defender_id=actor or coalesce(fd.face_up,false)
   then d.defender_naty_variable_candidate else null end,
  'attacker_air_attack_candidate',case when d.attacker_id=actor
   or not exists(select 1 from public.chaotic_preview_3x3_allies a
    left join public.chaotic_preview_3x3_face_states f
     on f.lobby_id=a.lobby_id and f.actor_id=a.actor_id and f.position=a.position
    where a.lobby_id=p_lobby_id and a.actor_id=d.attacker_id
      and not coalesce(f.face_up,false))
   then d.attacker_air_attack_candidate else null end,
  'final_damage_calculated',d.final_damage_calculated,
  'official_match_modified',d.official_match_modified
 ) order by d.turn_no desc),'[]'::jsonb)
 into dynamic_rows
 from (select * from public.chaotic_preview_3x3_dynamic_element_checks
  where lobby_id=p_lobby_id order by turn_no desc limit 40) d
 left join public.chaotic_preview_3x3_face_states fa
  on fa.lobby_id=d.lobby_id and fa.actor_id=d.attacker_id and fa.position=d.attacker_slot
 left join public.chaotic_preview_3x3_face_states fd
  on fd.lobby_id=d.lobby_id and fd.actor_id=d.defender_id and fd.position=d.defender_slot;
 return pg_catalog.jsonb_build_object(
  'creature_checks',creature_rows,'dynamic_checks',dynamic_rows);
end;
$safe$;

