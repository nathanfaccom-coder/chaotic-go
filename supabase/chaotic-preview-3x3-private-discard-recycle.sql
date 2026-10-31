-- Chaotic GO v0.1.40: 3x3 TRAINING-only voluntary discard + recycle used/discarded attacks.
-- Mirrors the isolated 1x1 test, preserving all original cards, HP and resources.
-- The private attack hand remains owner-readable only; no opponent hand leaks.

alter table public.chaotic_preview_3x3_attack_wallets
 add column if not exists recycle_cycles integer not null default 0
  check(recycle_cycles between 0 and 120);

alter table public.chaotic_preview_3x3_attack_hand
 add column if not exists draw_cycle integer not null default 0
  check(draw_cycle between 0 and 120),
 add column if not exists recycle_priority uuid;

alter table public.chaotic_preview_3x3_attack_hand
 drop constraint if exists chaotic_preview_3x3_attack_hand_spent_reason_check;
alter table public.chaotic_preview_3x3_attack_hand
 add constraint chaotic_preview_3x3_attack_hand_spent_reason_check
 check(spent_reason in ('attack','discard'));

alter table public.chaotic_preview_3x3_attack_hand
 drop constraint if exists chaotic_preview_3x3_attack_hand_spent_state_check;
alter table public.chaotic_preview_3x3_attack_hand
 add constraint chaotic_preview_3x3_attack_hand_spent_state_check
 check(
  (card_state='spent' and spent_turn is not null
    and spent_reason in ('attack','discard'))
  or (card_state in ('deck','hand') and spent_turn is null and spent_reason is null)
 );

create table if not exists public.chaotic_preview_3x3_hand_discards(
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 actor_id uuid not null references auth.users(id),
 card_slot smallint not null check(card_slot between 1 and 20),
 attack_instance_id text not null check(length(attack_instance_id) between 1 and 48),
 original_card_consumed boolean not null default false check(original_card_consumed=false),
 training_points_changed boolean not null default false check(training_points_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no,actor_id),
 foreign key(lobby_id,actor_id,card_slot)
  references public.chaotic_preview_3x3_attack_hand(lobby_id,actor_id,card_slot)
);
alter table public.chaotic_preview_3x3_hand_discards enable row level security;
revoke all on public.chaotic_preview_3x3_hand_discards from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_hand_discards to authenticated;
create policy chaotic_preview_3x3_discards_owner_read
 on public.chaotic_preview_3x3_hand_discards for select to authenticated
 using(actor_id=(select auth.uid()));

create table if not exists public.chaotic_preview_3x3_hand_draw_events(
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 actor_id uuid not null references auth.users(id),
 drew_card boolean not null,
 drawn_card_slot smallint check(drawn_card_slot between 1 and 20),
 recycle_cycle integer not null check(recycle_cycle between 0 and 120),
 recycled_count smallint not null default 0 check(recycled_count between 0 and 20),
 hand_count_after smallint not null check(hand_count_after between 0 and 5),
 available_points integer not null check(available_points between 0 and 65),
 official_match_modified boolean not null default false check(official_match_modified=false),
 original_card_consumed boolean not null default false check(original_card_consumed=false),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no,actor_id),
 foreign key(lobby_id,actor_id)
  references public.chaotic_preview_3x3_attack_wallets(lobby_id,actor_id)
  on delete cascade,
 check((drew_card and drawn_card_slot is not null)
   or (not drew_card and drawn_card_slot is null)),
 check((recycled_count=0 and recycle_cycle>=0)
   or (recycled_count>0 and drew_card))
);
alter table public.chaotic_preview_3x3_hand_draw_events enable row level security;
revoke all on public.chaotic_preview_3x3_hand_draw_events from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_hand_draw_events to authenticated;
create policy chaotic_preview_3x3_draw_events_owner_read
 on public.chaotic_preview_3x3_hand_draw_events for select to authenticated
 using(actor_id=(select auth.uid()));

create or replace function public.chaotic_discard_preview_3x3_hand(
 p_lobby_id uuid,p_expected_turn integer,p_card_slot integer
) returns public.chaotic_preview_3x3_hand_discards
 language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_3x3_attack_wallets;
 item public.chaotic_preview_3x3_attack_hand;
 saved public.chaotic_preview_3x3_hand_discards;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
  or p_card_slot is null or p_card_slot not between 1 and 20
 then raise exception 'Turno ou slot de descarte inválido';end if;
 select * into m from public.chaotic_match_turns
 where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor or actor not in(m.host_id,m.guest_id)
 then raise exception 'Descarte permitido apenas na sua vez';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 inválida';end if;
 select * into w from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor for update;
 if not found or w.last_draw_turn<>p_expected_turn
  or w.prepared_turn>p_expected_turn
  or (p_expected_turn-w.prepared_turn)%2<>0
 then raise exception 'Sincronize a mão privada para este turno primeiro';end if;
 if exists(select 1 from public.chaotic_preview_3x3_hand_discards
  where lobby_id=p_lobby_id and actor_id=actor and turn_no=p_expected_turn)
 then raise exception 'Já houve descarte voluntário neste turno';end if;
 -- Prevent discarding a declared/quoted/paid attack behind the cost log.
 if exists(select 1 from public.chaotic_preview_3x3_contact_intents
     where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_3x3_attack_projections
     where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_3x3_cost_inspections
     where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_3x3_attack_spends
     where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_clashes
     where lobby_id=p_lobby_id and turn_no=p_expected_turn)
  or exists(select 1 from public.chaotic_preview_burst_windows
     where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Não descarte depois de declarar confronto ou pagar ataque';end if;
 select * into item from public.chaotic_preview_3x3_attack_hand
  where lobby_id=p_lobby_id and actor_id=actor and card_slot=p_card_slot for update;
 if not found or item.card_state<>'hand' or item.spent_turn is not null
 then raise exception 'Carta inexistente ou fora da sua mão privada';end if;
 update public.chaotic_preview_3x3_attack_hand set
  card_state='spent',spent_turn=p_expected_turn,spent_reason='discard'
 where lobby_id=p_lobby_id and actor_id=actor and card_slot=p_card_slot;
 insert into public.chaotic_preview_3x3_hand_discards(
  lobby_id,turn_no,actor_id,card_slot,attack_instance_id
 ) values(p_lobby_id,p_expected_turn,actor,p_card_slot,item.attack_instance_id)
 returning * into saved;
 return saved;
end;
$fn$;
revoke all on function public.chaotic_discard_preview_3x3_hand(uuid,integer,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_discard_preview_3x3_hand(uuid,integer,integer)
 to authenticated;

create or replace function public.chaotic_sync_preview_3x3_hand(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_3x3_attack_wallets;
 next_card public.chaotic_preview_3x3_attack_hand;
 n_hand integer:=0;
 n_deck integer:=0;
 recycled_count integer:=0;
 cycle integer:=0;
 available integer;
 drawn boolean:=false;
 begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido para compra';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor or actor not in (m.host_id,m.guest_id)
 then raise exception 'Turno 3x3 não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
  or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 3x3 não está pronta';end if;
 select * into w from public.chaotic_preview_3x3_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor for update;
 if not found then raise exception 'Prepare a mão de treino primeiro';end if;
 if p_expected_turn<w.last_draw_turn or p_expected_turn<w.prepared_turn
  or (p_expected_turn-w.prepared_turn)%2<>0
 then raise exception 'Progressão de turnos inválida';end if;
 available:=3+(p_expected_turn-w.prepared_turn)/2-w.spent_points;
 if available not between 0 and 65 then raise exception 'Pontos de treino fora do limite';end if;
 cycle:=w.recycle_cycles;
 if w.last_draw_turn<p_expected_turn then
  select count(*) into n_hand from public.chaotic_preview_3x3_attack_hand
   where lobby_id=p_lobby_id and actor_id=actor and card_state='hand';
  if n_hand<5 then
   select count(*) into n_deck from public.chaotic_preview_3x3_attack_hand
    where lobby_id=p_lobby_id and actor_id=actor and card_state='deck';
   if n_deck=0 then
    select count(*) into recycled_count from public.chaotic_preview_3x3_attack_hand
     where lobby_id=p_lobby_id and actor_id=actor and card_state='spent';
    if recycled_count>0 then
     cycle:=w.recycle_cycles+1;
     if cycle>120 then raise exception 'Limite de reciclagens do treinamento atingido';end if;
     update public.chaotic_preview_3x3_attack_hand set
      card_state='deck',spent_turn=null,spent_reason=null,
      draw_cycle=cycle,recycle_priority=pg_catalog.gen_random_uuid()
      where lobby_id=p_lobby_id and actor_id=actor and card_state='spent';
     update public.chaotic_preview_3x3_attack_wallets
      set recycle_cycles=cycle where lobby_id=p_lobby_id and actor_id=actor;
    end if;
   end if;
   select * into next_card from public.chaotic_preview_3x3_attack_hand
    where lobby_id=p_lobby_id and actor_id=actor and card_state='deck'
    order by draw_cycle,recycle_priority nulls first,draw_position limit 1;
   if found then
    update public.chaotic_preview_3x3_attack_hand set card_state='hand'
    where lobby_id=p_lobby_id and actor_id=actor and card_slot=next_card.card_slot;
    drawn:=true;
   end if;
  end if;
  select count(*) into n_hand from public.chaotic_preview_3x3_attack_hand
   where lobby_id=p_lobby_id and actor_id=actor and card_state='hand';
  update public.chaotic_preview_3x3_attack_wallets
    set last_draw_turn=p_expected_turn where lobby_id=p_lobby_id and actor_id=actor;
  insert into public.chaotic_preview_3x3_hand_draw_events(
   lobby_id,turn_no,actor_id,drew_card,drawn_card_slot,recycle_cycle,
   recycled_count,hand_count_after,available_points
  ) values(p_lobby_id,p_expected_turn,actor,drawn,
    case when drawn then next_card.card_slot else null end,
    cycle,recycled_count,n_hand,available);
 end if;
 return pg_catalog.jsonb_build_object(
  'available_points',available,'drew_card',drawn,'turn_no',p_expected_turn,
  'recycled',recycled_count>0,'recycled_count',recycled_count,
  'recycle_cycle',cycle,'cost_not_paid',true);
end;
$fn$;
revoke all on function public.chaotic_sync_preview_3x3_hand(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_sync_preview_3x3_hand(uuid,integer)
 to authenticated;

do $pub$
begin
 -- Owner-only draw/discard records intentionally stay off Supabase Realtime:
 -- do not publish opponent-sensitive card IDs to the lobby channel.
 if not exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
    and tablename='chaotic_preview_3x3_hand_draw_events')
 then null;end if;
end $pub$;