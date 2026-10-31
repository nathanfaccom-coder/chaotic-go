-- Chaotic GO v0.1.61: non-invasive two-player PvP connection preflight.
-- This is a 3x3 TRAINING diagnostic only. It does not authorize an attack,
-- mark a participant's turn, change HP, award XP, finish official combat or
-- inspect a player's private deck. Freshness is server-clock derived.
create table public.chaotic_preview_3x3_player_presence (
 lobby_id uuid not null references public.chaotic_lobbies(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 last_seen_at timestamptz not null default now(),
 ready_for_test boolean not null default false,
 last_seen_turn integer not null check(last_seen_turn between 1 and 120),
 primary key(lobby_id,actor_id)
);
alter table public.chaotic_preview_3x3_player_presence enable row level security;
revoke all on public.chaotic_preview_3x3_player_presence from public,anon,authenticated;
-- Deliberately NO direct client table grants, no SELECT policy and no Realtime.
-- A SECURITY DEFINER RPC exposes only two booleans and the active turn;
-- not the other member's identity, deck, timestamps or cards.

create or replace function public.chaotic_ping_preview_3x3_player(
 p_lobby_id uuid,p_ready boolean default null
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 lobby public.chaotic_lobbies;
 turn_state public.chaotic_match_turns;
 peer uuid;
 self_ready boolean;
 peer_ready boolean;
 peer_present boolean;
 self_present boolean;
 match_finished boolean;
 winner uuid;
 fresh_cutoff timestamptz:=statement_timestamp()-interval '25 seconds';
 current_stamp timestamptz:=statement_timestamp();
begin
 if actor is null or p_lobby_id is null
 then raise exception 'Entre na sala com uma conta autenticada';end if;
 select * into lobby from public.chaotic_lobbies
 where id=p_lobby_id;
 select * into turn_state from public.chaotic_match_turns
 where lobby_id=p_lobby_id;
 if lobby.id is null or turn_state.lobby_id is null
  or lobby.mode<>'3x3' or lobby.status<>'ready'
  or turn_state.status<>'active'
  or lobby.expires_at<=current_stamp
  or lobby.host_id is distinct from turn_state.host_id
  or lobby.guest_id is distinct from turn_state.guest_id
  or actor not in(lobby.host_id,lobby.guest_id)
 then raise exception 'Diagnóstico disponível somente para dois membros ativos do treino 3x3';end if;
 peer:=case when actor=lobby.host_id then lobby.guest_id else lobby.host_id end;
 if peer is null or peer=actor then
  raise exception 'Ainda não existem dois jogadores distintos nesta sala';end if;
 select exists(select 1 from public.chaotic_preview_3x3_training_outcomes
  where lobby_id=p_lobby_id),winner_id into match_finished,winner
 from public.chaotic_preview_3x3_training_outcomes
 where lobby_id=p_lobby_id;
 -- A completed training outcome is still reportable, but cannot reset
 -- the ready status or make a defeated pair look ready to start over.
 if coalesce(match_finished,false) and p_ready is true then
  raise exception 'Treinamento encerrado: crie outra sala para testar';end if;
 insert into public.chaotic_preview_3x3_player_presence(
  lobby_id,actor_id,last_seen_at,ready_for_test,last_seen_turn)
 values(p_lobby_id,actor,current_stamp,coalesce(p_ready,false),turn_state.turn_no)
 on conflict(lobby_id,actor_id) do update set
 last_seen_at=excluded.last_seen_at,
 last_seen_turn=excluded.last_seen_turn,
 ready_for_test=case when p_ready is null
   then public.chaotic_preview_3x3_player_presence.ready_for_test
   else excluded.ready_for_test end;
 select ready_for_test,last_seen_at>=fresh_cutoff
 into self_ready,self_present
 from public.chaotic_preview_3x3_player_presence
 where lobby_id=p_lobby_id and actor_id=actor;
 select ready_for_test,last_seen_at>=fresh_cutoff
 into peer_ready,peer_present
 from public.chaotic_preview_3x3_player_presence
 where lobby_id=p_lobby_id and actor_id=peer;
 return pg_catalog.jsonb_build_object(
   'self_active',coalesce(self_present,false),
   'peer_active',coalesce(peer_present,false),
   'self_ready',coalesce(self_ready,false),
   'peer_ready',coalesce(peer_ready,false),
   'both_ready_now',coalesce(self_ready,false) and coalesce(peer_ready,false)
     and coalesce(self_present,false) and coalesce(peer_present,false)
     and not coalesce(match_finished,false),
   'active_turn',turn_state.turn_no,
   'your_turn',turn_state.current_player=actor,
   'training_finished',coalesce(match_finished,false),
   'you_won_training',case when coalesce(match_finished,false)
     then winner=actor else null end,
   'presence_window_seconds',25,
   'server_time',current_stamp,
   'training_only',true,
   'official_match_modified',false
 );
end;
$fn$;
revoke all on function public.chaotic_ping_preview_3x3_player(uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.chaotic_ping_preview_3x3_player(uuid,boolean)
 to authenticated;
