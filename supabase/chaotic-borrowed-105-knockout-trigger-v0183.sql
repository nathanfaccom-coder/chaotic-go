-- v0.1.83: preserve the original knockout trigger for own-hand 105.
-- Borrowed 105 has a separate, strictly authenticated KO branch.
create or replace function public.chaotic_record_preview_3x3_training_knockout()
 returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=auth.uid();
 m public.chaotic_match_turns;
 w public.chaotic_preview_3x3_defense_windows;
 paid public.chaotic_preview_3x3_attack_spends;
 borrowed public.chaotic_preview_3x3_borrowed_105_plans;
 source_loan public.chaotic_preview_3x3_temporary_card_custody;
 n integer;
 dead_count integer;
begin
 if new.hp_remaining<>0 or old.hp_remaining<=0
 then return new;end if;

 select * into m from public.chaotic_match_turns
 where lobby_id=new.lobby_id for update;
 if actor is null or m.lobby_id is null or m.status<>'active'
 or m.current_player is distinct from actor
 or actor not in(m.host_id,m.guest_id)
 or new.actor_id not in(m.host_id,m.guest_id)
 or actor=new.actor_id
 then raise exception 'Nocaute de treino exige atacante autenticado na partida';end if;

 -- Borrowed Vento Forte is not an owned Attack hand slot. Its atomic
 -- settlement records KO in a separate, authenticated training-only ledger.
 -- Never fabricate a paid owned-card attack or modify existing KO FK rules.
 select * into borrowed from public.chaotic_preview_3x3_borrowed_105_plans
  where lobby_id=new.lobby_id and turn_no=m.turn_no for update;
 if borrowed.lobby_id is not null
  and borrowed.borrower_id=actor
  and borrowed.state='defender_passed_preview' then
   select * into source_loan from public.chaotic_preview_3x3_temporary_card_custody
    where id=borrowed.custody_id and lobby_id=new.lobby_id for update;
   if source_loan.id is null or source_loan.borrower_id is distinct from actor
    or source_loan.source_actor_id is distinct from new.actor_id
    or source_loan.custody_state<>'held'
    or source_loan.catalog_attack_id<>'105'
    or not source_loan.training_only
    or borrowed.defender_id is distinct from new.actor_id
    or borrowed.defender_slot is distinct from new.position
    or borrowed.hp_before is distinct from old.hp_remaining
    or borrowed.hp_base_after<>0
    or borrowed.payment_applied or borrowed.damage_applied
    or borrowed.priority_opened_at is null or borrowed.defender_passed_at is null
    or old.hp_remaining not between 1 and 5
    or new.hp_remaining<>0
    or new.damage_events is distinct from old.damage_events+1
    or old.creature_instance_id is distinct from new.creature_instance_id
    or old.creature_name is distinct from new.creature_name
    or old.hp_max is distinct from new.hp_max
    or exists(select 1 from public.chaotic_preview_3x3_training_knockouts k
     where k.lobby_id=new.lobby_id and k.defender_id=new.actor_id and k.defender_slot=new.position)
    or exists(select 1 from public.chaotic_preview_3x3_borrowed_105_knockouts k
     where k.lobby_id=new.lobby_id and k.defender_id=new.actor_id and k.defender_slot=new.position)
   then raise exception 'Nocaute do ataque emprestado 105 não é íntegro';end if;
   -- Team-ending KO requires full outcome handling and is explicitly
   -- denied BEFORE cost can commit. The whole RPC rolls back on failure.
   if not exists(select 1 from public.chaotic_preview_3x3_hp_wallets h
     where h.lobby_id=new.lobby_id and h.actor_id=new.actor_id
       and h.position<>new.position and h.hp_remaining>0)
   then raise exception 'Nocaute final de equipe com carta emprestada ainda não habilitado';end if;
   insert into public.chaotic_preview_3x3_borrowed_105_knockouts(
     lobby_id,turn_no,borrower_id,defender_id,defender_slot,
     defender_creature_instance_id,defender_creature_name,custody_id,hp_before
   ) values(
     new.lobby_id,m.turn_no,actor,new.actor_id,new.position,
     new.creature_instance_id,new.creature_name,borrowed.custody_id,old.hp_remaining
   );
   return new;
 end if;
 select * into w from public.chaotic_preview_3x3_defense_windows
 where lobby_id=new.lobby_id and turn_no=m.turn_no for update;
 select * into paid from public.chaotic_preview_3x3_attack_spends
 where lobby_id=new.lobby_id and turn_no=m.turn_no for update;
 if w.lobby_id is null or paid.lobby_id is null
 or w.attacker_id is distinct from actor
 or w.defender_id is distinct from new.actor_id
 or w.defender_slot is distinct from new.position
 or w.status<>'defender_passed_preview'
 or paid.actor_id is distinct from actor
 or paid.catalog_attack_id<>'105'
 or paid.attack_instance_id is distinct from w.attack_instance_id
 or not paid.training_points_paid or not paid.training_card_spent
 or paid.training_damage_applied
 or old.creature_instance_id is distinct from new.creature_instance_id
 or old.creature_name is distinct from new.creature_name
 or old.hp_max is distinct from new.hp_max
 or new.hp_remaining is distinct from greatest(0,old.hp_remaining-5)
 or new.damage_events is distinct from old.damage_events+1
 then raise exception 'Nocaute 3x3 deve resultar do dano-base validado de Vento Forte';end if;

 insert into public.chaotic_preview_3x3_training_knockouts(
  lobby_id,turn_no,attacker_id,defender_id,defender_slot,
  defender_creature_instance_id,defender_creature_name,attack_instance_id,hp_before
 ) values(
  new.lobby_id,m.turn_no,actor,new.actor_id,new.position,
  new.creature_instance_id,new.creature_name,w.attack_instance_id,old.hp_remaining
 );

 select count(*), count(*) filter(where hp_remaining=0)
 into n,dead_count from public.chaotic_preview_3x3_hp_wallets
 where lobby_id=new.lobby_id and actor_id=new.actor_id;
 if n=3 and dead_count=3 then
  insert into public.chaotic_preview_3x3_training_outcomes(
    lobby_id,decided_turn,winner_id,defeated_id
  ) values(new.lobby_id,m.turn_no,actor,new.actor_id)
  on conflict(lobby_id) do nothing;
 end if;
 return new;
end;
$fn$;
