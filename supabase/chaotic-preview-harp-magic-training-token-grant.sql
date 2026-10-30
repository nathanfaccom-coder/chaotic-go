-- Chaotic GO 0.1.32 -- Arpa Mágica (original ID 203) grants 1 token when
-- the equipped harp is DISCARD-MARKED in ISOLATED 1x1 TRAINING ONLY.
-- Never changes album, deck, official equipment, official tokens, XP or HP.
-- Original card art remains at cartas/equips/arpa_magica.jpg.

alter table public.chaotic_preview_mugic_token_wallets
  add column if not exists bonus_tokens smallint not null default 0
  check(bonus_tokens between 0 and 1);
alter table public.chaotic_preview_mugic_token_wallets
  drop constraint if exists chaotic_preview_mugic_token_wallets_check;
alter table public.chaotic_preview_mugic_token_wallets
  add constraint chaotic_preview_mugic_token_wallets_check
  check(remaining_tokens<=starting_tokens+bonus_tokens);

create table if not exists public.chaotic_preview_harp_token_events(
 lobby_id uuid not null,
 actor_id uuid not null references auth.users(id),
 turn_no integer not null check(turn_no between 1 and 120),
 creature_instance_id text not null check(length(creature_instance_id) between 1 and 48),
 equipment_instance_id text not null check(length(equipment_instance_id) between 1 and 48),
 equipment_name text not null default 'Arpa Mágica' check(equipment_name='Arpa Mágica'),
 token_gain smallint not null default 1 check(token_gain=1),
 tokens_before smallint not null check(tokens_before between 0 and 19),
 tokens_after smallint not null check(tokens_after between 1 and 20),
 equipment_discarded_training boolean not null default true
   check(equipment_discarded_training=true),
 original_equipment_discarded boolean not null default false
   check(original_equipment_discarded=false),
 official_tokens_changed boolean not null default false check(official_tokens_changed=false),
 official_match_modified boolean not null default false check(official_match_modified=false),
 effect_scope text not null default 'training_only'
   check(effect_scope='training_only'),
 created_at timestamptz not null default now(),
 primary key(lobby_id,actor_id),
 foreign key(lobby_id,actor_id)
 references public.chaotic_preview_mugic_token_wallets(lobby_id,actor_id) on delete cascade,
 check(tokens_after=tokens_before+token_gain)
);
alter table public.chaotic_preview_harp_token_events enable row level security;
revoke all on public.chaotic_preview_harp_token_events from public,anon,authenticated;
grant select on public.chaotic_preview_harp_token_events to authenticated;
create policy chaotic_preview_harp_token_members_read
 on public.chaotic_preview_harp_token_events for select to authenticated using(
  exists(select 1 from public.chaotic_match_turns m
  where m.lobby_id=chaotic_preview_harp_token_events.lobby_id
  and ((select auth.uid())=m.host_id or (select auth.uid())=m.guest_id))
);

create or replace function public.chaotic_discard_preview_harp_for_token(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_harp_token_events
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 unit public.chaotic_preview_loadouts;
 revelation public.chaotic_preview_equipment_reveals;
 wallet public.chaotic_preview_mugic_token_wallets;
 event_row public.chaotic_preview_harp_token_events;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120
 then raise exception 'Turno inválido';end if;
 select * into m from public.chaotic_match_turns
 where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor
  or actor not in (m.host_id,m.guest_id)
 then raise exception 'Somente durante seu próprio turno';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
   or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala 1x1 de treinamento inválida';end if;
 if exists(select 1 from public.chaotic_preview_clashes
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
   or exists(select 1 from public.chaotic_preview_burst_windows
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
   or exists(select 1 from public.chaotic_preview_individual_damage
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Arpa deve ser descartada no treino antes do Clash e Burst';end if;
 if exists(select 1 from public.chaotic_preview_harp_token_events
   where lobby_id=p_lobby_id and actor_id=actor)
 then raise exception 'Arpa já descartada neste treinamento';end if;
 select * into unit from public.chaotic_preview_loadouts
 where lobby_id=p_lobby_id and actor_id=actor;
 if not found or unit.position<>6
   or unit.equipment_name is distinct from 'Arpa Mágica'
   or nullif(unit.equipment_instance_id,'') is null
 then raise exception 'A criatura selecionada não tem a Arpa Mágica original equipada';end if;
 select * into revelation from public.chaotic_preview_equipment_reveals
 where lobby_id=p_lobby_id and actor_id=actor;
 if not found or revelation.equipment_name is distinct from 'Arpa Mágica'
   or revelation.equipment_instance_id is distinct from unit.equipment_instance_id
   or revelation.revealed_turn>p_expected_turn
 then raise exception 'É necessário revelar a própria Arpa Mágica equipada primeiro';end if;
 select * into wallet from public.chaotic_preview_mugic_token_wallets
 where lobby_id=p_lobby_id and actor_id=actor for update;
 if not found or wallet.creature_instance_id is distinct from unit.card_instance_id
   or wallet.creature_name is distinct from unit.creature_name
   or wallet.bonus_tokens<>0
   or wallet.remaining_tokens>=20
 then raise exception 'Carteira inválida, Arpa já usada ou limite de fichas atingido';end if;
 update public.chaotic_preview_mugic_token_wallets
 set remaining_tokens=wallet.remaining_tokens+1,
   bonus_tokens=wallet.bonus_tokens+1, updated_at=now()
 where lobby_id=p_lobby_id and actor_id=actor;
 insert into public.chaotic_preview_harp_token_events(
 lobby_id,actor_id,turn_no,creature_instance_id,equipment_instance_id,tokens_before,tokens_after
 ) values(p_lobby_id,actor,p_expected_turn,unit.card_instance_id,
   unit.equipment_instance_id,wallet.remaining_tokens,wallet.remaining_tokens+1)
 returning * into event_row;
 return event_row;
end;
$fn$;
revoke all on function public.chaotic_discard_preview_harp_for_token(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_discard_preview_harp_for_token(uuid,integer)
 to authenticated;

do $pub$
begin
 if not exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
   and tablename='chaotic_preview_harp_token_events')
 then alter publication supabase_realtime add table public.chaotic_preview_harp_token_events;
 end if;
end $pub$;