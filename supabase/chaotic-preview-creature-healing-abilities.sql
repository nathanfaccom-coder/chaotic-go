-- Chaotic GO v0.1.31 - controlled ability effects in isolated 1x1 TRAINING ONLY.
-- Canonical abilities per cartas.js + efeitos.js: Lion (+10 max/current energy),
-- Vidal (heal 15 up to max), Xamã (heal 10 up to max); each costs 1 ability token.
-- No official battle state, rewards, card contents, or actual HP changes.
-- Not a Burst response: only before a clash/Burst opens this turn.

create table if not exists public.chaotic_preview_ability_heal_events (
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 actor_id uuid not null references auth.users(id),
 target_actor_id uuid not null references auth.users(id),
 source_creature_instance_id text not null check(length(source_creature_instance_id) between 1 and 48),
 target_creature_instance_id text not null check(length(target_creature_instance_id) between 1 and 48),
 source_creature_name text not null check(source_creature_name in ('Lion','Vidal','Xamã')),
 ability_code text not null check(ability_code in ('lion_energy_10','vidal_heal_15','xama_heal_10')),
 token_cost smallint not null default 1 check(token_cost=1),
 tokens_before smallint not null check(tokens_before between 1 and 20),
 tokens_after smallint not null check(tokens_after between 0 and 20),
 hp_before integer not null check(hp_before between 1 and 550),
 hp_after integer not null check(hp_after between 1 and 550),
 hp_max_before integer not null check(hp_max_before between 1 and 550),
 hp_max_after integer not null check(hp_max_after between 1 and 550),
 applied_to_training boolean not null default true check(applied_to_training=true),
 official_match_modified boolean not null default false check(official_match_modified=false),
 official_hp_changed boolean not null default false check(official_hp_changed=false),
 official_tokens_consumed boolean not null default false check(official_tokens_consumed=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no,actor_id),
 foreign key(lobby_id,actor_id) references public.chaotic_preview_mugic_token_wallets(lobby_id,actor_id) on delete cascade,
 foreign key(lobby_id,target_actor_id) references public.chaotic_preview_hp_wallets(lobby_id,actor_id) on delete cascade,
 check(tokens_after=tokens_before-1),
 check(hp_after<=hp_max_after),
 check(
   (source_creature_name='Lion' and ability_code='lion_energy_10' and actor_id=target_actor_id
    and hp_max_after=hp_max_before+10 and hp_after=hp_before+10)
   or (source_creature_name='Vidal' and ability_code='vidal_heal_15'
    and hp_max_after=hp_max_before and hp_after=least(hp_before+15,hp_max_before))
   or (source_creature_name='Xamã' and ability_code='xama_heal_10'
    and hp_max_after=hp_max_before and hp_after=least(hp_before+10,hp_max_before))
 )
);
alter table public.chaotic_preview_ability_heal_events enable row level security;
revoke all on public.chaotic_preview_ability_heal_events from public,anon,authenticated;
grant select on public.chaotic_preview_ability_heal_events to authenticated;
drop policy if exists chaotic_preview_ability_heal_members on public.chaotic_preview_ability_heal_events;
create policy chaotic_preview_ability_heal_members on public.chaotic_preview_ability_heal_events
 for select to authenticated using (
  exists(select 1 from public.chaotic_match_turns m
    where m.lobby_id=chaotic_preview_ability_heal_events.lobby_id
      and (m.host_id=(select auth.uid()) or m.guest_id=(select auth.uid())))
 );

create or replace function public.chaotic_apply_preview_ability_heal(
 p_lobby_id uuid,p_expected_turn integer,p_target_actor_id uuid
) returns public.chaotic_preview_ability_heal_events
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 src public.chaotic_preview_loadouts;
 dst public.chaotic_preview_loadouts;
 wallet public.chaotic_preview_mugic_token_wallets;
 hp public.chaotic_preview_hp_wallets;
 code text;
 new_hp integer;
 new_max integer;
 result public.chaotic_preview_ability_heal_events;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
  or p_target_actor_id is null
 then raise exception 'Turno ou alvo inválido';end if;
 select * into m from public.chaotic_match_turns
  where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor
  or actor not in (m.host_id,m.guest_id)
  or p_target_actor_id not in (m.host_id,m.guest_id)
 then raise exception 'Só pode ativar habilidade em sua vez contra/alvo de um participante';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.status<>'ready' or l.mode<>'1x1'
  or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 indisponível';end if;
 if exists(select 1 from public.chaotic_preview_clashes
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_burst_windows
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_individual_damage
    where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Habilidade de treino precisa ser usada antes do confronto e Burst';end if;
 if exists(select 1 from public.chaotic_preview_ability_heal_events
   where lobby_id=p_lobby_id and turn_no=p_expected_turn and actor_id=actor)
 then raise exception 'Habilidade já foi ativada neste turno';end if;
 select * into src from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=actor;
 select * into dst from public.chaotic_preview_loadouts
  where lobby_id=p_lobby_id and actor_id=p_target_actor_id;
 if src.card_instance_id is null or dst.card_instance_id is null
  or src.position<>6 or dst.position<>6
 then raise exception 'Fichas de ambas as criaturas 1x1 devem estar preparadas';end if;
 if src.creature_name='Lion' then
  code:='lion_energy_10';
  if actor is distinct from p_target_actor_id then
    raise exception 'Lion só pode aumentar sua própria energia';end if;
 elsif src.creature_name='Vidal' then code:='vidal_heal_15';
 elsif src.creature_name='Xamã' then code:='xama_heal_10';
 else raise exception 'Habilidade ainda não portada para o motor de treinamento';end if;
 select * into wallet from public.chaotic_preview_mugic_token_wallets
  where lobby_id=p_lobby_id and actor_id=actor for update;
 if not found or wallet.creature_instance_id is distinct from src.card_instance_id
   or wallet.creature_name is distinct from src.creature_name
   or wallet.remaining_tokens is null or wallet.remaining_tokens<1
 then raise exception 'Fichas insuficientes ou carteira da criatura incompatível';end if;
 select * into hp from public.chaotic_preview_hp_wallets
  where lobby_id=p_lobby_id and actor_id=p_target_actor_id for update;
 if not found or hp.creature_instance_id is distinct from dst.card_instance_id
  or hp.hp_remaining<1
 then raise exception 'HP de treinamento não preparado ou criatura já zerada';end if;
 if code='lion_energy_10' then
   if hp.hp_max>540 or hp.hp_remaining>540 then
    raise exception 'Energia de Lion ultrapassaria o limite seguro de treino';end if;
   new_max:=hp.hp_max+10;
   new_hp:=hp.hp_remaining+10;
 elsif code='vidal_heal_15' then
   new_max:=hp.hp_max;
   new_hp:=least(hp.hp_remaining+15,hp.hp_max);
 else
   new_max:=hp.hp_max;
   new_hp:=least(hp.hp_remaining+10,hp.hp_max);
 end if;
 update public.chaotic_preview_mugic_token_wallets
   set remaining_tokens=wallet.remaining_tokens-1,updated_at=now()
   where lobby_id=p_lobby_id and actor_id=actor;
 update public.chaotic_preview_hp_wallets
   set hp_remaining=new_hp,hp_max=new_max
   where lobby_id=p_lobby_id and actor_id=p_target_actor_id;
 insert into public.chaotic_preview_ability_heal_events(
  lobby_id,turn_no,actor_id,target_actor_id,
  source_creature_instance_id,target_creature_instance_id,
  source_creature_name,ability_code,
  tokens_before,tokens_after,hp_before,hp_after,hp_max_before,hp_max_after
 ) values(
  p_lobby_id,p_expected_turn,actor,p_target_actor_id,
  src.card_instance_id,dst.card_instance_id,
  src.creature_name,code,
  wallet.remaining_tokens,wallet.remaining_tokens-1,
  hp.hp_remaining,new_hp,hp.hp_max,new_max
 ) returning * into result;
 return result;
end;
$fn$;
revoke all on function public.chaotic_apply_preview_ability_heal(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.chaotic_apply_preview_ability_heal(uuid,integer,uuid) to authenticated;

do $pub$
begin
 if not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='chaotic_preview_ability_heal_events')
 then alter publication supabase_realtime add table public.chaotic_preview_ability_heal_events;
 end if;
end $pub$;