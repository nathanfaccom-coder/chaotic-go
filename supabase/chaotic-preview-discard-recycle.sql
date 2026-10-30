-- Chaotic GO v0.1.13: discard and shuffle graveyard into preview deck.
-- No live HP, official card, reward or inventory is modified.
-- Existing spent cards are marked as actual attacks; future voluntary
-- discards cannot be used as a fake proof of paid attack for DNA preview.
alter table public.chaotic_preview_attack_wallets
  add column if not exists recycle_cycles integer not null default 0
  check (recycle_cycles between 0 and 120);
alter table public.chaotic_preview_attack_hand
  add column if not exists spent_reason text
   check (spent_reason in ('attack','discard')),
  add column if not exists draw_cycle integer not null default 0
   check(draw_cycle between 0 and 120),
  add column if not exists recycle_priority uuid;
update public.chaotic_preview_attack_hand set spent_reason='attack'
 where card_state='spent' and spent_reason is null;
alter table public.chaotic_preview_attack_hand
  drop constraint if exists chaotic_preview_hand_spent_reason_consistency;
alter table public.chaotic_preview_attack_hand
  add constraint chaotic_preview_hand_spent_reason_consistency
  check ((card_state='spent')=(spent_reason is not null));

create or replace function public.chaotic_discard_preview_attack(
 p_lobby_id uuid,p_expected_turn integer,p_card_slot smallint
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 w public.chaotic_preview_attack_wallets;
 item public.chaotic_preview_attack_hand;
begin
 if actor is null then raise exception 'Faça login';end if;
 if p_card_slot is null or p_card_slot not between 1 and 20 then
   raise exception 'Posição de carta inválida';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or p_expected_turn is null or m.status<>'active' or
  m.turn_no<>p_expected_turn or m.current_player<>actor or
  actor not in(m.host_id,m.guest_id) then
  raise exception 'Turno ou participante não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or
   l.expires_at<=now() or l.host_id<>m.host_id or
   l.guest_id is distinct from m.guest_id then
   raise exception 'Sala 1x1 não está pronta';end if;
 select * into w from public.chaotic_preview_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor;
 if not found or w.last_draw_turn<>p_expected_turn then
   raise exception 'Sincronize sua mão de teste primeiro';end if;
 select * into item from public.chaotic_preview_attack_hand
   where lobby_id=p_lobby_id and actor_id=actor and card_slot=p_card_slot;
 if not found or item.card_state<>'hand' then
  raise exception 'Carta não disponível para descarte';end if;
 -- If the attack for this turn has already been declared, it cannot be
 -- silently discarded and then pass the original damage-spend guard.
 if exists(select 1 from public.chaotic_preview_attack_instances a
   where a.lobby_id=p_lobby_id and a.turn_no=p_expected_turn
   and a.actor_id=actor and a.attack_instance_id=item.attack_instance_id) then
   raise exception 'Não é permitido descartar o ataque declarado';end if;
 update public.chaotic_preview_attack_hand set card_state='spent',
   spent_reason='discard',spent_turn=p_expected_turn
   where lobby_id=p_lobby_id and actor_id=actor and card_slot=p_card_slot;
 return jsonb_build_object('discarded_slot',p_card_slot,
   'attack_instance_id',item.attack_instance_id,'turn_no',p_expected_turn);
end;
$fn$;
revoke all on function public.chaotic_discard_preview_attack(uuid,integer,smallint)
 from public,anon,authenticated;
grant execute on function public.chaotic_discard_preview_attack(uuid,integer,smallint)
 to authenticated;

create or replace function public.chaotic_sync_preview_hand(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 wallet public.chaotic_preview_attack_wallets;
 next_card record;
 n_hand integer;
 recycle_total integer:=0;
 cycle integer:=0;
 points integer;
 drawn boolean:=false;
begin
 if actor is null then raise exception 'Faça login';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or p_expected_turn is null or m.status<>'active' or
  m.current_player<>actor or m.turn_no<>p_expected_turn
  or actor not in(m.host_id,m.guest_id) then raise exception 'Turno não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now() then
  raise exception 'Sala indisponível';end if;
 select * into wallet from public.chaotic_preview_attack_wallets
  where lobby_id=p_lobby_id and actor_id=actor;
 if not found then raise exception 'Prepare a mão de teste primeiro';end if;
 points:=public.chaotic_preview_points_available(
  p_expected_turn,wallet.prepared_turn,wallet.spent_points);
 if wallet.last_draw_turn>p_expected_turn then raise exception 'Turno antigo';end if;
 if wallet.last_draw_turn<p_expected_turn then
   select count(*) into n_hand from public.chaotic_preview_attack_hand
     where lobby_id=p_lobby_id and actor_id=actor and card_state='hand';
   if n_hand<5 then
     -- If the original draw pile is empty, shuffle ONLY the discard pile.
     -- Every used or voluntarily discarded card may be reused on a new turn.
     select count(*) into recycle_total from public.chaotic_preview_attack_hand
       where lobby_id=p_lobby_id and actor_id=actor and card_state='deck';
     if recycle_total=0 then
       select count(*) into recycle_total from public.chaotic_preview_attack_hand
         where lobby_id=p_lobby_id and actor_id=actor and card_state='spent';
       if recycle_total>0 then
         cycle:=wallet.recycle_cycles+1;
         update public.chaotic_preview_attack_hand
           set card_state='deck',spent_turn=null,spent_reason=null,
               draw_cycle=cycle,recycle_priority=pg_catalog.gen_random_uuid()
           where lobby_id=p_lobby_id and actor_id=actor and card_state='spent';
         update public.chaotic_preview_attack_wallets set recycle_cycles=cycle
           where lobby_id=p_lobby_id and actor_id=actor;
       end if;
     end if;
     select card_slot,attack_instance_id into next_card
       from public.chaotic_preview_attack_hand
       where lobby_id=p_lobby_id and actor_id=actor and card_state='deck'
       order by draw_cycle, recycle_priority nulls first, draw_position limit 1;
     if found then
       update public.chaotic_preview_attack_hand set card_state='hand'
        where lobby_id=p_lobby_id and actor_id=actor and card_slot=next_card.card_slot;
       drawn:=true;
     end if;
   end if;
   update public.chaotic_preview_attack_wallets set last_draw_turn=p_expected_turn
    where lobby_id=p_lobby_id and actor_id=actor;
 end if;
 return jsonb_build_object('available_points',points,'drew_card',drawn,'recycled',cycle>0,'synced_turn',p_expected_turn);
end;
$fn$;



revoke all on function public.chaotic_sync_preview_hand(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_sync_preview_hand(uuid,integer)
 to authenticated;

create or replace function public.chaotic_spend_preview_attack(
 p_lobby_id uuid,p_expected_turn integer
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 wallet public.chaotic_preview_attack_wallets;
 attack public.chaotic_preview_attack_instances;
 hand public.chaotic_preview_attack_hand;
 available integer;
begin
 if actor is null then raise exception 'Faça login';end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found or p_expected_turn is null or m.status<>'active'
   or m.turn_no<>p_expected_turn or m.current_player<>actor
   or actor not in (m.host_id,m.guest_id) then
   raise exception 'Turno não autorizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now() then
   raise exception 'Sala indisponível';end if;
 select * into wallet from public.chaotic_preview_attack_wallets
   where lobby_id=p_lobby_id and actor_id=actor;
 if not found or wallet.last_draw_turn<>p_expected_turn then
   raise exception 'Sincronize sua mão no turno atual';end if;
 select * into attack from public.chaotic_preview_attack_instances
   where lobby_id=p_lobby_id and turn_no=p_expected_turn and actor_id=actor;
 if not found then raise exception 'Valide a carta individual antes de gastar';end if;
 select * into hand from public.chaotic_preview_attack_hand
   where lobby_id=p_lobby_id and actor_id=actor and card_slot=attack.card_slot;
 if not found or hand.attack_instance_id<>attack.attack_instance_id
   or hand.card_state<>'hand' then
   raise exception 'Ataque não está disponível na mão de teste';end if;
 if not exists(select 1 from public.chaotic_preview_clashes
   where lobby_id=p_lobby_id and turn_no=p_expected_turn and attacker_id=actor
    and attack_card=attack.attack_instance_id) then
   raise exception 'Registre o confronto antes de gastar pontos';end if;
 available:=public.chaotic_preview_points_available(
  p_expected_turn,wallet.prepared_turn,wallet.spent_points);
 if available<attack.attack_cost then raise exception 'Pontos de ataque insuficientes';end if;

 update public.chaotic_preview_attack_hand set card_state='spent',spent_turn=p_expected_turn,spent_reason='attack'
  where lobby_id=p_lobby_id and actor_id=actor and card_slot=attack.card_slot;
 update public.chaotic_preview_attack_wallets
  set spent_points=spent_points+attack.attack_cost
  where lobby_id=p_lobby_id and actor_id=actor;
 return jsonb_build_object('attack_instance_id',attack.attack_instance_id,
  'attack_name',attack.attack_name,'spent_cost',attack.attack_cost,
  'points_left',available-attack.attack_cost,'turn_no',p_expected_turn);
end;
$fn$;


revoke all on function public.chaotic_spend_preview_attack(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_spend_preview_attack(uuid,integer)
 to authenticated;

create or replace function public.chaotic_calculate_individual_preview(
 p_lobby_id uuid,p_expected_turn integer
) returns public.chaotic_preview_individual_damage
language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid := auth.uid();
 m public.chaotic_match_turns;
 l public.chaotic_lobbies;
 clash public.chaotic_preview_clashes;
 attack public.chaotic_preview_attack_instances;
 attacker public.chaotic_preview_loadouts;
 defender public.chaotic_preview_loadouts;
 equip_a public.chaotic_preview_equipment_reveals;
 equip_d public.chaotic_preview_equipment_reveals;
 revealed_a boolean:=false;
 revealed_d boolean:=false;
 parts jsonb;
 subtotal integer;
 energy integer;
 result public.chaotic_preview_individual_damage;
begin
 if actor is null then raise exception 'Faça login'; end if;
 if p_lobby_id is null or p_expected_turn is null or p_expected_turn not between 1 and 120 then
   raise exception 'Turno inválido'; end if;
 select * into m from public.chaotic_match_turns where lobby_id=p_lobby_id for update;
 if not found then raise exception 'Partida inexistente';end if;
 if actor<>m.host_id and actor<>m.guest_id then raise exception 'Não é participante';end if;
 if m.status<>'active' or m.current_player<>actor or m.turn_no<>p_expected_turn then
   raise exception 'Não é sua vez ou turno desatualizado';end if;
 select * into l from public.chaotic_lobbies where id=p_lobby_id;
 if not found or l.mode<>'1x1' or l.status<>'ready' or l.expires_at<=now()
    or l.host_id<>m.host_id or l.guest_id is distinct from m.guest_id then
    raise exception 'Sala de teste 1x1 indisponível';end if;
 select * into clash from public.chaotic_preview_clashes
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or clash.attacker_id<>actor then raise exception 'Registre confronto primeiro';end if;
 select * into attack from public.chaotic_preview_attack_instances
    where lobby_id=p_lobby_id and turn_no=p_expected_turn;
 if not found or attack.actor_id<>actor
   or attack.attack_instance_id<>clash.attack_card then
   raise exception 'Ataque individual inválido ou não validado'; end if;
 select * into attacker from public.chaotic_preview_loadouts
    where lobby_id=p_lobby_id and actor_id=actor;
 if not found or attacker.card_instance_id<>clash.attacker_card then
    raise exception 'Ficha individual atacante incompatível';end if;
 select * into defender from public.chaotic_preview_loadouts
    where lobby_id=p_lobby_id and actor_id=clash.defender_id;
 if not found or defender.card_instance_id<>clash.defender_card then
    raise exception 'Ficha individual defensora incompatível';end if;
 if exists(select 1 from public.chaotic_preview_individual_damage
   where lobby_id=p_lobby_id and turn_no=p_expected_turn) then
   raise exception 'Simulação já registrada';end if;
 if not exists(
   select 1 from public.chaotic_preview_attack_hand h
   join public.chaotic_preview_attack_wallets w
    on w.lobby_id=h.lobby_id and w.actor_id=h.actor_id
   where h.lobby_id=p_lobby_id and h.actor_id=actor
     and h.attack_instance_id=attack.attack_instance_id
     and h.card_slot=attack.card_slot
     and h.card_state='spent' and h.spent_reason='attack'
     and h.spent_turn=p_expected_turn
     and w.last_draw_turn=p_expected_turn
 ) then raise exception 'Confirme primeiro o custo e a carta na mão de teste';end if;


 select * into equip_a from public.chaotic_preview_equipment_reveals
   where lobby_id=p_lobby_id and actor_id=actor and revealed_turn<=p_expected_turn;
 revealed_a:=found;
 select * into equip_d from public.chaotic_preview_equipment_reveals
   where lobby_id=p_lobby_id and actor_id=clash.defender_id and revealed_turn<=p_expected_turn;
 revealed_d:=found;

 parts:=public.chaotic_preview_equipment_formula(
   attack.catalog_attack_id,attacker.creature_name,attacker.stats,defender.stats,
   attacker.equipment_name,revealed_a,
   defender.creature_name,defender.equipment_name,revealed_d);
 subtotal:=(parts->>'subtotal')::integer;
 energy:=(defender.stats->>'e')::integer;
 if energy not between 1 and 500 then raise exception 'Energia individual inválida';end if;
 if attack.attack_cost not between 0 and 50 then
    raise exception 'Custo inválido';end if;
 insert into public.chaotic_preview_individual_damage (
   lobby_id,turn_no,attacker_id,defender_id,attack_instance_id,catalog_attack_id,
   attack_name,attacker_instance_id,defender_instance_id,attacker_name,defender_name,
   defender_energy_initial,base_damage,elemental_bonus,attribute_bonus,
   preview_subtotal,preview_energy_remaining,calculation_status,notes,
   attack_cost,cost_status,equipment_bonus,attacker_equipment_revealed,
   defender_equipment_revealed,immunity_reason
 ) values(
   p_lobby_id,p_expected_turn,actor,clash.defender_id,attack.attack_instance_id,
   attack.catalog_attack_id,attack.attack_name,attacker.card_instance_id,
   defender.card_instance_id,attacker.creature_name,defender.creature_name,
   energy,(parts->>'base')::integer,(parts->>'elemental')::integer,
   (parts->>'attribute')::integer,subtotal,
   case when subtotal is null then null else greatest(0,energy-subtotal) end,
   parts->>'status',
   'Prévia NÃO-oficial: pontos e carta da mão verificados e debitados SOMENTE NA SIMULAÇÃO, não no combate oficial. Equipamentos sem efeitos completos, habilidades, imunidades adicionais, locais, Burst e vitórias NÃO são resolvidos. '
    || coalesce(parts->>'explanation',''),
   attack.attack_cost,'test_spent',
   (parts->>'equipment_bonus')::integer,revealed_a,revealed_d,
   parts->>'immunity_reason'
 ) returning * into result;
 return result;
end;
$fn$;


revoke all on function public.chaotic_calculate_individual_preview(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.chaotic_calculate_individual_preview(uuid,integer)
 to authenticated;
