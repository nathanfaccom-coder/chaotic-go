-- Prévia isolada: declarações de criatura/ataque do Decks salvo pelo usuário.
-- Nunca aplica efeitos, dano, vitória, moedas, XP ou trocas.
create table if not exists public.chaotic_combat_declarations (
  lobby_id uuid not null references public.chaotic_match_turns(lobby_id) on delete cascade,
  turn_no integer not null check (turn_no between 1 and 120),
  actor_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('creature','attack')),
  deck_slot smallint not null check (deck_slot between 1 and 3),
  card_slot smallint not null check (card_slot between 1 and 20),
  card_id text not null check (length(card_id) between 1 and 48),
  created_at timestamptz not null default now(),
  primary key(lobby_id,turn_no)
);
create index if not exists chaotic_declarations_lobby_actor
  on public.chaotic_combat_declarations(lobby_id,actor_id);
alter table public.chaotic_combat_declarations enable row level security;
revoke all on public.chaotic_combat_declarations from public, anon, authenticated;
grant select on public.chaotic_combat_declarations to authenticated;
drop policy if exists chaotic_declarations_players_read on public.chaotic_combat_declarations;
create policy chaotic_declarations_players_read on public.chaotic_combat_declarations
  for select to authenticated using (
    exists (
      select 1 from public.chaotic_match_turns mt
      where mt.lobby_id=chaotic_combat_declarations.lobby_id
        and ((select auth.uid())=mt.host_id or (select auth.uid())=mt.guest_id)
    )
  );

-- Autoridade de turno no PostgreSQL; o cliente não envia card_id.
-- O cartão é retirado do deck privado do próprio jogador pelo servidor.
create or replace function public.chaotic_declare_combat_action(
  p_lobby_id uuid,p_expected_turn integer,p_kind text,p_deck_slot integer,p_card_slot integer
) returns public.chaotic_combat_declarations
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid:=auth.uid();
  m public.chaotic_match_turns;
  l public.chaotic_lobbies;
  deck jsonb;
  cards jsonb;
  card_text text;
  result public.chaotic_combat_declarations;
begin
  if actor is null then raise exception 'Faça login'; end if;
  if p_kind is null or p_kind not in ('creature','attack') then
    raise exception 'Ação inválida'; end if;
  if p_expected_turn is null or p_expected_turn not between 1 and 120 then
    raise exception 'Turno inválido'; end if;
  if p_deck_slot is null or p_deck_slot not between 1 and 3 then
    raise exception 'Escolha um slot de deck válido'; end if;
  if p_card_slot is null or p_card_slot not between 1 and 20 then
    raise exception 'Posição de carta inválida'; end if;

  select * into m from public.chaotic_match_turns
    where lobby_id=p_lobby_id for update;
  if not found then raise exception 'Partida de teste inexistente'; end if;
  if actor<>m.host_id and actor<>m.guest_id then
    raise exception 'Você não participa deste teste'; end if;
  if m.status<>'active' or m.current_player<>actor or m.turn_no<>p_expected_turn then
    raise exception 'Não é sua vez ou o turno mudou'; end if;

  select * into l from public.chaotic_lobbies where id=p_lobby_id;
  if not found or l.status<>'ready' or l.expires_at<=now()
    or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
    raise exception 'Sala indisponível ou jogadores alterados'; end if;

  if exists (select 1 from public.chaotic_combat_declarations d
    where d.lobby_id=p_lobby_id and d.turn_no=m.turn_no) then
    raise exception 'Já foi registrada uma ação neste turno'; end if;

  if p_kind='attack' and not exists (
    select 1 from public.chaotic_combat_declarations d
    where d.lobby_id=p_lobby_id and d.actor_id=actor and d.kind='creature'
  ) then raise exception 'Primeiro selecione uma criatura em um turno anterior'; end if;

  if p_kind='creature' and exists (
    select 1 from public.chaotic_combat_declarations d
    where d.lobby_id=p_lobby_id and d.actor_id=actor and d.kind='creature'
  ) then raise exception 'A criatura de teste já foi selecionada'; end if;

  select g.data into deck from public.chaotic_game_nodes g
    where g.user_id=actor
      and g.node_path='decks/'||l.mode||'_'||p_deck_slot::text;
  if deck is null then raise exception 'Salve um deck para este modo e slot primeiro'; end if;
  cards := deck->case when p_kind='creature' then 'criaturas' else 'ataques' end;
  if cards is null or jsonb_typeof(cards)<>'array'
    or p_card_slot>jsonb_array_length(cards) then
    raise exception 'Posição não existe no deck'; end if;
  card_text:=cards->>(p_card_slot-1);
  if card_text is null or card_text='' or card_text='null'
    or length(card_text)>48 or card_text !~ '^[a-zA-Z0-9_-]+$' then
    raise exception 'A posição do deck não contém uma carta válida'; end if;
  insert into public.chaotic_combat_declarations(
    lobby_id,turn_no,actor_id,kind,deck_slot,card_slot,card_id
  ) values(p_lobby_id,m.turn_no,actor,p_kind,p_deck_slot,p_card_slot,card_text)
    returning * into result;
  return result;
end;
$$;
revoke all on function public.chaotic_declare_combat_action(uuid,integer,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.chaotic_declare_combat_action(uuid,integer,text,integer,integer)
  to authenticated;