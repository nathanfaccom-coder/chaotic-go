-- Chaotic GO 0.1.17: conditional effect projections ONLY.
-- No real/preview turn, attack, hand, points, HP or reward is modified.
-- Projection never means the effect has triggered: damage is still partial.

create table if not exists public.chaotic_preview_effect_candidates (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 victim_id uuid not null references auth.users(id),
 attack_instance_id text not null,
 catalog_attack_id text not null check(catalog_attack_id in ('107','111','112')),
 effect_code text not null check(effect_code in ('vine_skip','electronic_attack_lock','hand_attack_lock')),
 effect_scope text not null check(effect_scope in ('full_turn_no_draw_no_points','attack_only')),
 duration_target_turns smallint not null check(duration_target_turns between 1 and 2),
 first_target_turn integer not null check(first_target_turn between 2 and 121),
 last_target_turn integer not null check(last_target_turn between 2 and 123),
 indicative_damage integer not null check(indicative_damage between 1 and 1500),
 confirmation_state text not null default 'candidate_requires_final_damage'
  check(confirmation_state='candidate_requires_final_damage'),
 applied_to_match boolean not null default false check(applied_to_match=false),
 created_at timestamptz not null default now(),
 primary key (lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references public.chaotic_preview_individual_damage(lobby_id,turn_no)
  on delete cascade,
 check(attacker_id<>victim_id),
 check(last_target_turn=first_target_turn+2*(duration_target_turns-1))
);
alter table public.chaotic_preview_effect_candidates enable row level security;
revoke all on public.chaotic_preview_effect_candidates from public,anon,authenticated;
grant select on public.chaotic_preview_effect_candidates to authenticated;
drop policy if exists chaotic_effect_candidates_member_read on public.chaotic_preview_effect_candidates;
create policy chaotic_effect_candidates_member_read
 on public.chaotic_preview_effect_candidates for select to authenticated
 using (
  exists(select 1 from public.chaotic_match_turns m
   where m.lobby_id=chaotic_preview_effect_candidates.lobby_id
    and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
 );

-- Centralize original 107/111/112 rule mapping in a non-public helper.
create or replace function public.chaotic_preview_effect_spec(
 p_catalog_id text,p_estimated_damage integer,p_damage_status text
) returns jsonb language plpgsql immutable security invoker set search_path=''
as $fn$
declare
 code text;
 scope text;
 duration integer;
begin
 if p_catalog_id not in ('107','111','112') or p_catalog_id is null
 then return pg_catalog.jsonb_build_object('eligible',false,'reason','not_a_supported_effect');end if;
 if p_estimated_damage is null or p_estimated_damage<=0
    or p_damage_status is distinct from 'partial_estimate' then
  return pg_catalog.jsonb_build_object('eligible',false,
   'reason','no_positive_resolved_preview');
 end if;
 if p_catalog_id='107' then
  code:='vine_skip';scope:='full_turn_no_draw_no_points';duration:=1;
 elsif p_catalog_id='111' then
  code:='electronic_attack_lock';scope:='attack_only';duration:=2;
 else
  code:='hand_attack_lock';scope:='attack_only';duration:=1;
 end if;
 return pg_catalog.jsonb_build_object('eligible',true,'code',code,'scope',scope,
  'target_turns',duration,'requires_final_damage',true,'applies_now',false);
end;
$fn$;
revoke all on function public.chaotic_preview_effect_spec(text,integer,text)
 from public,anon,authenticated;

create or replace function public.chaotic_capture_preview_effect_candidate(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_effect_candidates
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 dmg public.chaotic_preview_individual_damage;
 attack public.chaotic_preview_attack_instances;
 clash public.chaotic_preview_clashes;
 spec jsonb;
 result public.chaotic_preview_effect_candidates;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.current_player<>actor
  or m.turn_no<>p_expected_turn or actor not in(m.host_id,m.guest_id)
 then raise exception 'Turno ou participante não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 indisponível';end if;
 select * into dmg from public.chaotic_preview_individual_damage
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or dmg.attacker_id<>actor or dmg.defender_id not in(m.host_id,m.guest_id)
   or dmg.defender_id=actor or dmg.cost_status<>'test_spent'
 then raise exception 'Dano individual e pagamento de teste ainda não verificados';end if;
 select * into attack from public.chaotic_preview_attack_instances
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 select * into clash from public.chaotic_preview_clashes
  where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if attack.actor_id is distinct from actor
  or attack.attack_instance_id is distinct from dmg.attack_instance_id
  or attack.catalog_attack_id is distinct from dmg.catalog_attack_id
  or clash.attacker_id is distinct from actor or clash.defender_id is distinct from dmg.defender_id
 then raise exception 'Confronto ou ataque não confere com o dano';end if;
 if exists(select 1 from public.chaotic_preview_effect_candidates
  where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
  raise exception 'Efeito de teste já registrado neste turno';end if;

 spec:=public.chaotic_preview_effect_spec(
  dmg.catalog_attack_id,dmg.preview_subtotal,dmg.calculation_status);
 if (spec->>'eligible')::boolean is not true then
  raise exception 'Sem dano parcial positivo validado para este efeito';end if;
 insert into public.chaotic_preview_effect_candidates(
  lobby_id,turn_no,attacker_id,victim_id,attack_instance_id,catalog_attack_id,
  effect_code,effect_scope,duration_target_turns,
  first_target_turn,last_target_turn,indicative_damage)
 values(p_lobby_id,p_expected_turn,actor,dmg.defender_id,dmg.attack_instance_id,
  dmg.catalog_attack_id,spec->>'code',spec->>'scope',
  (spec->>'target_turns')::integer,p_expected_turn+1,
  p_expected_turn+1+2*((spec->>'target_turns')::integer-1),
  dmg.preview_subtotal)
 returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_capture_preview_effect_candidate(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_capture_preview_effect_candidate(uuid,integer)
 to authenticated;

do $$
begin
 if not exists(select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
    and tablename='chaotic_preview_effect_candidates') then
  alter publication supabase_realtime add table public.chaotic_preview_effect_candidates;
 end if;
end $$;
