-- Chaotic GO v0.1.41 — isolated defender PASS window after a paid 3x3 training attack.
-- This is ONLY a turn-priority acknowledgement, not a defensive card/effect.
-- It never consumes official resources, applies damage, or changes a real match result.

create table if not exists public.chaotic_preview_3x3_defense_windows (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 attacker_slot smallint not null check(attacker_slot between 4 and 6),
 defender_slot smallint not null check(defender_slot between 4 and 6),
 attack_instance_id text not null check(length(attack_instance_id) between 1 and 48),
 training_attack_cost integer not null check(training_attack_cost between 0 and 50),
 status text not null default 'awaiting_defender'
  check(status in ('awaiting_defender','defender_passed_preview')),
 defender_passed_at timestamptz,
 defensive_card_verified boolean not null default false check(defensive_card_verified=false),
 defensive_effect_executed boolean not null default false check(defensive_effect_executed=false),
 training_hp_changed boolean not null default false check(training_hp_changed=false),
 official_hp_changed boolean not null default false check(official_hp_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references public.chaotic_preview_3x3_attack_spends(lobby_id,turn_no)
  on delete cascade,
 check(attacker_id<>defender_id),
 check((status='awaiting_defender' and defender_passed_at is null)
    or (status='defender_passed_preview' and defender_passed_at is not null))
);
alter table public.chaotic_preview_3x3_defense_windows enable row level security;
revoke all on public.chaotic_preview_3x3_defense_windows from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_defense_windows to authenticated;
create policy chaotic_preview_3x3_defense_members_read
 on public.chaotic_preview_3x3_defense_windows for select to authenticated
 using(exists(select 1 from public.chaotic_match_turns m
 where m.lobby_id=chaotic_preview_3x3_defense_windows.lobby_id
  and (m.host_id=(select auth.uid()) or m.guest_id=(select auth.uid()))));

create or replace function public.chaotic_open_preview_3x3_defense_window(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_3x3_defense_windows
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 contact public.chaotic_preview_3x3_contact_intents;
 attack public.chaotic_preview_3x3_attack_projections;
 spent public.chaotic_preview_3x3_attack_spends;
 result public.chaotic_preview_3x3_defense_windows;
 enemy_id uuid;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno 3x3 inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor or actor not in(m.host_id,m.guest_id)
 then raise exception 'Somente o atacante na própria vez pode abrir a janela';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
   or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 indisponível';end if;
 enemy_id:=case when actor=m.host_id then m.guest_id else m.host_id end;
 if enemy_id is null then raise exception 'Adversário não encontrado';end if;
 if exists(select 1 from public.chaotic_preview_3x3_defense_windows
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Janela 3x3 já registrada para este turno';end if;
 if exists(select 1 from public.chaotic_preview_clashes
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_burst_windows
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Outra janela de confronto já foi aberta';end if;
 select * into contact from public.chaotic_preview_3x3_contact_intents
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or contact.attacker_id is distinct from actor
   or contact.defender_id is distinct from enemy_id
   or contact.damage_applied or contact.official_match_modified
 then raise exception 'Contato 3x3 inválido para a reação';end if;
 select * into attack from public.chaotic_preview_3x3_attack_projections
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or attack.actor_id is distinct from actor
   or attack.defender_id is distinct from enemy_id
   or attack.attacker_slot is distinct from contact.attacker_slot
   or attack.defender_slot is distinct from contact.defender_slot
   or attack.training_hp_changed or attack.official_match_modified
 then raise exception 'Ataque 3x3 não corresponde ao contato';end if;
 select * into spent from public.chaotic_preview_3x3_attack_spends
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or spent.actor_id is distinct from actor
   or spent.attack_instance_id is distinct from attack.attack_instance_id
   or spent.training_attack_cost is distinct from attack.attack_cost
   or not spent.training_points_paid or not spent.training_card_spent
   or spent.training_damage_applied or spent.official_match_modified
 then raise exception 'Pague a carta original apenas no treino antes de abrir a janela';end if;
 insert into public.chaotic_preview_3x3_defense_windows(
  lobby_id,turn_no,attacker_id,defender_id,
  attacker_slot,defender_slot,attack_instance_id,training_attack_cost
 ) values(
  p_lobby_id,p_expected_turn,actor,enemy_id,
  contact.attacker_slot,contact.defender_slot,spent.attack_instance_id,spent.training_attack_cost
 ) returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_open_preview_3x3_defense_window(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_open_preview_3x3_defense_window(uuid,integer)
 to authenticated;

create or replace function public.chaotic_pass_preview_3x3_defense(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_3x3_defense_windows
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_3x3_defense_windows;
 result public.chaotic_preview_3x3_defense_windows;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno de reação inválido';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or actor not in(m.host_id,m.guest_id)
 then raise exception 'Partida não está ativa para reação 3x3';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 indisponível';end if;
 select * into w from public.chaotic_preview_3x3_defense_windows
  where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if not found or w.defender_id is distinct from actor
  or w.attacker_id is distinct from m.current_player
  or w.attacker_id is distinct from
    (case when actor=m.host_id then m.guest_id else m.host_id end)
  or w.status<>'awaiting_defender' or w.defender_passed_at is not null
 then raise exception 'Somente o defensor pode passar uma vez na janela 3x3';end if;
 update public.chaotic_preview_3x3_defense_windows
 set status='defender_passed_preview',defender_passed_at=now()
 where lobby_id=p_lobby_id and turn_no=p_expected_turn
 returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_pass_preview_3x3_defense(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_pass_preview_3x3_defense(uuid,integer)
 to authenticated;

-- This guard closes the bypass where the attacker could advance a turn
-- through the existing 1x1-compatible chaotic_pass_turn RPC without a 3x3 reply.
-- Restrict to advancing turns WITH a paid training attack; leave 1x1 and
-- no-attack 3x3 turns unchanged.
create or replace function public.chaotic_guard_preview_3x3_defense_turn_advance()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if new.turn_no is distinct from old.turn_no
   and exists(select 1 from public.chaotic_preview_3x3_attack_spends s
     where s.lobby_id=old.lobby_id and s.turn_no=old.turn_no)
   and not exists(select 1 from public.chaotic_preview_3x3_defense_windows w
     where w.lobby_id=old.lobby_id and w.turn_no=old.turn_no
       and w.status='defender_passed_preview'
       and w.attacker_id=old.current_player
       and w.defender_id in (old.host_id,old.guest_id)
       and w.defender_id<>w.attacker_id)
 then raise exception 'Ataque 3x3 pago: abra a janela e aguarde o passe do defensor antes de passar o turno';end if;
 return new;
end;
$fn$;
revoke all on function public.chaotic_guard_preview_3x3_defense_turn_advance()
 from public,anon,authenticated;
drop trigger if exists chaotic_preview_3x3_defense_turn_guard on public.chaotic_match_turns;
create trigger chaotic_preview_3x3_defense_turn_guard
 before update of turn_no on public.chaotic_match_turns
 for each row execute function public.chaotic_guard_preview_3x3_defense_turn_advance();

do $pub$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
 and schemaname='public' and tablename='chaotic_preview_3x3_defense_windows')
 then alter publication supabase_realtime add table public.chaotic_preview_3x3_defense_windows;end if;
end $pub$;