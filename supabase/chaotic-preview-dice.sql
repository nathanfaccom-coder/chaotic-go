-- Chaotic GO / DROME original: Fogo Primordial 2.0 rolamento de dado d6.
-- This is a non-destructive server-authoritative PREVIEW of the legacy dice rule.
-- The result NEVER changes HP, cards, wins, inventory or rewards.
create table if not exists public.chaotic_preview_dice (
  lobby_id uuid not null,
  turn_no integer not null check(turn_no between 1 and 120),
  actor_id uuid not null references auth.users(id) on delete cascade,
  attack_id text not null check(attack_id='104'),
  die_faces smallint not null default 6 check(die_faces=6),
  rolled_value smallint not null check(rolled_value between 1 and 6),
  original_base integer not null check(original_base between 0 and 500),
  multiplied_base integer not null check(multiplied_base between 0 and 3000),
  created_at timestamptz not null default now(),
  primary key(lobby_id,turn_no),
  foreign key(lobby_id,turn_no)
    references public.chaotic_preview_modifiers(lobby_id,turn_no) on delete cascade
);
alter table public.chaotic_preview_dice enable row level security;
revoke all on public.chaotic_preview_dice from public,anon,authenticated;
grant select on public.chaotic_preview_dice to authenticated;
drop policy if exists chaotic_preview_dice_members_read on public.chaotic_preview_dice;
create policy chaotic_preview_dice_members_read
  on public.chaotic_preview_dice for select to authenticated using (
    exists(select 1 from public.chaotic_match_turns mt
      where mt.lobby_id=chaotic_preview_dice.lobby_id
        and ((select auth.uid())=mt.host_id or (select auth.uid())=mt.guest_id))
  );

create or replace function public.chaotic_roll_preview_die(
  p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_dice
language plpgsql security definer set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  match public.chaotic_match_turns;
  lobby public.chaotic_lobbies;
  clash public.chaotic_preview_clashes;
  modifier public.chaotic_preview_modifiers;
  roll integer;
  result public.chaotic_preview_dice;
begin
  if actor is null then raise exception 'Faça login'; end if;
  if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
    raise exception 'Turno inválido'; end if;
  -- Serializes simultaneous requests, preventing rerolls and out-of-turn execution.
  select * into match from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
  if not found then raise exception 'Partida de teste inexistente'; end if;
  if actor<>match.host_id and actor<>match.guest_id then
    raise exception 'Você não participa desta partida'; end if;
  if match.status<>'active' or match.current_player<>actor
    or match.turn_no<>p_expected_turn then
    raise exception 'Não é sua vez ou o turno mudou'; end if;
  select * into lobby from public.chaotic_lobbies where id=p_lobby_id;
  if not found or lobby.status<>'ready' or lobby.expires_at<=now()
    or lobby.host_id<>match.host_id
    or lobby.guest_id is distinct from match.guest_id then
    raise exception 'Sala indisponível'; end if;
  select * into clash from public.chaotic_preview_clashes
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
  if not found or clash.attacker_id<>actor or clash.attack_card<>'104' then
    raise exception 'O dado é exclusivo do ataque Fogo Primordial 2.0'; end if;
  select * into modifier from public.chaotic_preview_modifiers
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
  if not found or modifier.attacker_id<>actor
    or modifier.attack_card_id<>'104'
    or modifier.formula_status<>'roll_or_special_required'
    or modifier.base_damage is null then
    raise exception 'Calcule os bônus do ataque antes de rolar o dado'; end if;
  if exists(select 1 from public.chaotic_preview_dice
    where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
    raise exception 'O dado já foi rolado neste turno'; end if;
  -- The original batalha.js rolls 1d6 and multiplies danoBase by that number.
  -- random() executes inside PostgreSQL; the browser cannot pick the result.
  roll:=pg_catalog.floor(pg_catalog.random()*6)::integer+1;
  insert into public.chaotic_preview_dice(
    lobby_id,turn_no,actor_id,attack_id,rolled_value,original_base,multiplied_base
  ) values(
    p_lobby_id,p_expected_turn,actor,'104',roll,modifier.base_damage,roll*modifier.base_damage
  ) returning * into result;
  return result;
end;
$$;
revoke all on function public.chaotic_roll_preview_die(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.chaotic_roll_preview_die(uuid,integer) to authenticated;
do $$
begin
  if not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='chaotic_preview_dice') then
    alter publication supabase_realtime add table public.chaotic_preview_dice;
  end if;
end $$;
