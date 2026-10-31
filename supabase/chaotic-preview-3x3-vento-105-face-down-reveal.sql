-- Chaotic GO 0.1.56 — original Vento Forte optional opponent champion reveal,
-- only in the 3x3 TRAINING preview. Creature names are still exposed in the
-- pre-existing allies table; face-down status here is a visual/gameplay flag,
-- NOT cryptographic secrecy. Official battle and original assets unchanged.

create table public.chaotic_preview_3x3_face_states(
 lobby_id uuid not null references public.chaotic_lobbies(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 position smallint not null check(position between 4 and 6),
 face_up boolean not null default false,
 revealed_turn integer check(revealed_turn between 1 and 120),
 reveal_reason text not null default 'face_down'
  check(reveal_reason in('face_down','combat','vento_forte')),
 training_only boolean not null default true check(training_only),
 official_match_modified boolean not null default false check(not official_match_modified),
 created_at timestamptz not null default now(),
 primary key(lobby_id,actor_id,position),
 check((not face_up and revealed_turn is null and reveal_reason='face_down')
    or (face_up and revealed_turn is not null
      and reveal_reason in('combat','vento_forte')))
);
alter table public.chaotic_preview_3x3_face_states enable row level security;
revoke all on public.chaotic_preview_3x3_face_states from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_face_states to authenticated;
create policy chaotic_3x3_face_states_room_players_read
 on public.chaotic_preview_3x3_face_states for select to authenticated
 using(exists(select 1 from public.chaotic_lobbies l where l.id=lobby_id
   and (l.host_id=(select auth.uid()) or l.guest_id=(select auth.uid()))));

create or replace function public.chaotic_mark_preview_3x3_face_down()
 returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 insert into public.chaotic_preview_3x3_face_states(lobby_id,actor_id,position)
 values(new.lobby_id,new.actor_id,new.position)
 on conflict(lobby_id,actor_id,position) do nothing;
 return new;
end;
$fn$;
revoke all on function public.chaotic_mark_preview_3x3_face_down()
 from public,anon,authenticated;
create trigger chaotic_3x3_initialize_face_down
 after insert on public.chaotic_preview_3x3_allies for each row
 execute function public.chaotic_mark_preview_3x3_face_down();

create or replace function public.chaotic_reveal_preview_3x3_contact_champions()
 returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 -- The original 1x1 motor flips participants face up on battle contact.
 update public.chaotic_preview_3x3_face_states set
  face_up=true,reveal_reason='combat',revealed_turn=new.turn_no
  where lobby_id=new.lobby_id and
    ((actor_id=new.attacker_id and position=new.attacker_slot)
     or (actor_id=new.defender_id and position=new.defender_slot))
    and not face_up;
 return new;
end;
$fn$;
revoke all on function public.chaotic_reveal_preview_3x3_contact_champions()
 from public,anon,authenticated;
create trigger chaotic_3x3_contact_reveals_participants
 after insert on public.chaotic_preview_3x3_contact_intents for each row
 execute function public.chaotic_reveal_preview_3x3_contact_champions();

-- Old in-progress previews retain their existing formations and contact history.
insert into public.chaotic_preview_3x3_face_states(lobby_id,actor_id,position)
select lobby_id,actor_id,position from public.chaotic_preview_3x3_allies
on conflict(lobby_id,actor_id,position) do nothing;
update public.chaotic_preview_3x3_face_states f
 set face_up=true,reveal_reason='combat',revealed_turn=(
  select min(c.turn_no) from public.chaotic_preview_3x3_contact_intents c
   where c.lobby_id=f.lobby_id and
    ((c.attacker_id=f.actor_id and c.attacker_slot=f.position)
     or (c.defender_id=f.actor_id and c.defender_slot=f.position))
 )
where not f.face_up and exists(
 select 1 from public.chaotic_preview_3x3_contact_intents c
 where c.lobby_id=f.lobby_id and
  ((c.attacker_id=f.actor_id and c.attacker_slot=f.position)
  or (c.defender_id=f.actor_id and c.defender_slot=f.position))
);

create table public.chaotic_preview_3x3_vento_reveal_events(
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 attacker_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 revealed_slot smallint check(revealed_slot between 4 and 6),
 skipped boolean not null,
 training_only boolean not null default true check(training_only),
 official_match_modified boolean not null default false check(not official_match_modified),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references
  public.chaotic_preview_3x3_training_damage_events(lobby_id,turn_no)
  on delete cascade,
 check((skipped and revealed_slot is null)
    or (not skipped and revealed_slot is not null)),
 check(attacker_id<>defender_id)
);
alter table public.chaotic_preview_3x3_vento_reveal_events enable row level security;
revoke all on public.chaotic_preview_3x3_vento_reveal_events from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_vento_reveal_events to authenticated;
create policy chaotic_3x3_vento_reveal_room_players_read
 on public.chaotic_preview_3x3_vento_reveal_events
 for select to authenticated
 using(exists(select 1 from public.chaotic_lobbies l where l.id=lobby_id
 and (l.host_id=(select auth.uid()) or l.guest_id=(select auth.uid()))));

alter table public.chaotic_preview_3x3_attack_spends
 drop constraint chaotic_preview_3x3_training_settlement_consistency;
alter table public.chaotic_preview_3x3_attack_spends
 add constraint chaotic_preview_3x3_training_settlement_consistency
 check((not training_damage_applied and resolution_status='paid_training_unresolved')
 or (training_damage_applied and resolution_status in(
 'training_base_damage_105_optional_reveal_pending',
 'training_base_damage_105_reveal_resolved',
 'training_base_damage_attack_lock_applied',
 'training_conditional_damage_resolved',
 'training_elemental_acid_101_native_only',
 'training_elemental_vine_107_attack_draw_lock_partial',
 'training_elemental_sonar_110_rex_immunity_search_pending',
 'training_elemental_sonar_110_search_complete')));

alter table public.chaotic_preview_3x3_training_damage_events
 drop constraint chaotic_preview_3x3_training_elemental_attack_catalog_check;
alter table public.chaotic_preview_3x3_training_damage_events
 add constraint chaotic_preview_3x3_training_elemental_attack_catalog_check
 check(
  (catalog_attack_id='101' and base_damage=10 and bonus_damage=0
   and defeated_allies_count=0 and elemental_bonus_damage in(0,5,10)
   and immunity_prevented_damage=0 and not optional_reveal_pending and effects_fully_resolved)
  or (catalog_attack_id='107' and base_damage=5 and bonus_damage=0
   and defeated_allies_count=0 and elemental_bonus_damage in(0,5)
   and immunity_prevented_damage=0 and not optional_reveal_pending and not effects_fully_resolved)
  or (catalog_attack_id='110' and base_damage=0 and bonus_damage=0
   and defeated_allies_count=0
   and elemental_bonus_damage in(0,10,20)
   and immunity_prevented_damage in(0,10,20)
   and elemental_bonus_damage+immunity_prevented_damage<=20
   and not optional_reveal_pending)
  or (catalog_attack_id='105' and base_damage=5 and bonus_damage=0
   and defeated_allies_count=0 and elemental_bonus_damage=0 and immunity_prevented_damage=0
   and ((optional_reveal_pending and not effects_fully_resolved)
        or (not optional_reveal_pending and effects_fully_resolved)))
  or (catalog_attack_id='111' and base_damage=10 and bonus_damage=0
   and defeated_allies_count=0 and elemental_bonus_damage=0 and immunity_prevented_damage=0
   and not optional_reveal_pending and effects_fully_resolved)
  or (catalog_attack_id='112' and base_damage=5 and bonus_damage=0
   and defeated_allies_count=0 and elemental_bonus_damage=0 and immunity_prevented_damage=0
   and not optional_reveal_pending and effects_fully_resolved)
  or (catalog_attack_id='113' and base_damage=0 and elemental_bonus_damage=0
   and immunity_prevented_damage=0 and bonus_damage=5*defeated_allies_count
   and not optional_reveal_pending and effects_fully_resolved)
  or (catalog_attack_id='114' and base_damage=10 and elemental_bonus_damage=0
   and immunity_prevented_damage=0 and bonus_damage=5*defeated_allies_count
   and not optional_reveal_pending and effects_fully_resolved));



create or replace function public.chaotic_resolve_preview_3x3_vento_reveal(
 p_lobby_id uuid,p_expected_turn integer,
 p_target_slot integer default null,p_skip boolean default false
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 spent public.chaotic_preview_3x3_attack_spends;
 dmg public.chaotic_preview_3x3_training_damage_events;
 chosen public.chaotic_preview_3x3_face_states;
 receipt public.chaotic_preview_3x3_vento_reveal_events;
 opponent uuid;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_lobby_id is null or p_expected_turn is null
   or p_expected_turn not between 1 and 120
   or p_skip is null
   or (p_target_slot is not null and p_target_slot not between 4 and 6)
   or (p_skip and p_target_slot is not null)
   or (not p_skip and p_target_slot is null)
 then raise exception 'Escolha um campeão virado para baixo ou dispense a revelação';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or m.status<>'active' or m.turn_no<>p_expected_turn
  or m.current_player is distinct from actor or actor not in(m.host_id,m.guest_id)
 then raise exception 'Apenas o atacante ativo pode revelar com Vento Forte';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'3x3' or l.status<>'ready' or l.expires_at<=now()
   or l.host_id is distinct from m.host_id or l.guest_id is distinct from m.guest_id
 then raise exception 'Sala de treino 3x3 indisponível';end if;
 if exists(select 1 from public.chaotic_preview_3x3_training_outcomes
  where lobby_id=p_lobby_id)
 then raise exception 'Treino concluído: sem revelação tardia';end if;
 opponent:=case when actor=m.host_id then m.guest_id else m.host_id end;
 select * into spent from public.chaotic_preview_3x3_attack_spends
 where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 select * into dmg from public.chaotic_preview_3x3_training_damage_events
 where lobby_id=p_lobby_id and turn_no=p_expected_turn for update;
 if spent.lobby_id is null or dmg.lobby_id is null
  or spent.actor_id is distinct from actor or dmg.attacker_id is distinct from actor
  or dmg.defender_id is distinct from opponent
  or spent.catalog_attack_id<>'105' or dmg.catalog_attack_id<>'105'
  or spent.attack_instance_id is distinct from dmg.attack_instance_id
  or not spent.training_points_paid or not spent.training_card_spent
  or not spent.training_damage_applied
  or spent.resolution_status<>'training_base_damage_105_optional_reveal_pending'
  or not dmg.optional_reveal_pending or dmg.effects_fully_resolved
  or dmg.damage_dealt<=0 or dmg.official_match_modified
 then raise exception 'O Vento Forte precisa acertar e aplicar 5 dano de treino primeiro';end if;
 if exists(select 1 from public.chaotic_preview_3x3_vento_reveal_events
   where lobby_id=p_lobby_id and turn_no=p_expected_turn)
 then raise exception 'Vento Forte já teve revelação decidida neste turno';end if;
 if not p_skip then
  select * into chosen from public.chaotic_preview_3x3_face_states
    where lobby_id=p_lobby_id and actor_id=opponent
    and position=p_target_slot for update;
  if chosen.lobby_id is null or chosen.face_up
   or not exists(select 1 from public.chaotic_preview_3x3_allies a
       join public.chaotic_preview_3x3_hp_wallets h
       on h.lobby_id=a.lobby_id and h.actor_id=a.actor_id
         and h.position=a.position
      where a.lobby_id=p_lobby_id and a.actor_id=opponent
        and a.position=p_target_slot and h.hp_remaining>0)
  then raise exception 'Escolha uma criatura adversária VIVA e ainda virada para baixo';end if;
  update public.chaotic_preview_3x3_face_states
   set face_up=true,reveal_reason='vento_forte',revealed_turn=p_expected_turn
   where lobby_id=p_lobby_id and actor_id=opponent and position=p_target_slot
      and not face_up;
  if not found then raise exception 'Campeão já foi revelado';end if;
 end if;
 insert into public.chaotic_preview_3x3_vento_reveal_events(
 lobby_id,turn_no,attacker_id,defender_id,revealed_slot,skipped)
 values(p_lobby_id,p_expected_turn,actor,opponent,
  case when p_skip then null else p_target_slot end,p_skip)
 returning * into receipt;
 update public.chaotic_preview_3x3_training_damage_events
  set optional_reveal_pending=false,effects_fully_resolved=true
  where lobby_id=p_lobby_id and turn_no=p_expected_turn and catalog_attack_id='105';
 update public.chaotic_preview_3x3_attack_spends
  set resolution_status='training_base_damage_105_reveal_resolved'
  where lobby_id=p_lobby_id and turn_no=p_expected_turn and catalog_attack_id='105';
 return pg_catalog.jsonb_build_object(
  'revealed_slot',receipt.revealed_slot,'skipped',receipt.skipped,
  'effect_resolved',true,'training_only',true,
  'official_match_modified',false);
end;
$fn$;
revoke all on function public.chaotic_resolve_preview_3x3_vento_reveal(uuid,integer,integer,boolean)
 from public,anon,authenticated;
grant execute on function public.chaotic_resolve_preview_3x3_vento_reveal(uuid,integer,integer,boolean)
 to authenticated;
