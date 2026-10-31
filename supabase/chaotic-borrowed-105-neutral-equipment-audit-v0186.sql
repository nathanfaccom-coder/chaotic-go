-- Chaotic GO v0.1.86: defender-private proof of inert equipment under a
-- canonical NEUTRAL borrowed Vento Forte 105. No ownership or stat changes.
create table public.chaotic_preview_3x3_borrowed_105_equipment_audits(
 lobby_id uuid not null,
 turn_no integer not null check(turn_no between 1 and 120),
 borrower_id uuid not null references auth.users(id),
 defender_id uuid not null references auth.users(id),
 defender_slot smallint not null check(defender_slot between 4 and 6),
 equipment_instance_id text not null check(length(equipment_instance_id) between 1 and 48),
 catalog_equipment_id text not null check(catalog_equipment_id in('202','204')),
 rule_code text not null check(rule_code in('immune_to_attacks_involving_air','increase_wisdom_40')),
 canonical_attack_id text not null default '105' check(canonical_attack_id='105'),
 attack_elemental_damage_zero boolean not null check(attack_elemental_damage_zero),
 original_owner_verified boolean not null check(original_owner_verified),
 equipment_effect_applied boolean not null default false check(not equipment_effect_applied),
 official_match_modified boolean not null default false check(not official_match_modified),
 created_at timestamptz not null default now(),
 primary key(lobby_id,turn_no),
 foreign key(lobby_id,turn_no) references
  public.chaotic_preview_3x3_borrowed_105_plans(lobby_id,turn_no)
  on delete cascade,
 check(borrower_id<>defender_id),
 check((catalog_equipment_id='202' and rule_code='immune_to_attacks_involving_air')
    or (catalog_equipment_id='204' and rule_code='increase_wisdom_40'))
);
alter table public.chaotic_preview_3x3_borrowed_105_equipment_audits enable row level security;
revoke all on public.chaotic_preview_3x3_borrowed_105_equipment_audits
 from public,anon,authenticated;
grant select on public.chaotic_preview_3x3_borrowed_105_equipment_audits to authenticated;
create policy chaotic_borrowed_105_equipment_defender_only on
 public.chaotic_preview_3x3_borrowed_105_equipment_audits
 for select to authenticated using ((select auth.uid())=defender_id);
