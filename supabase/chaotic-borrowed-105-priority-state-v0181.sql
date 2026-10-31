-- Chaotic GO v0.1.81: reaction priority for borrowed Vento Forte, no payment/damage.
alter table public.chaotic_preview_3x3_borrowed_105_plans
 drop constraint chaotic_preview_3x3_borrowed_105_plans_state_check;
alter table public.chaotic_preview_3x3_borrowed_105_plans
 add constraint chaotic_preview_3x3_borrowed_105_plans_state_check
 check(state in ('planned','awaiting_defender','defender_passed_preview','cancelled'));
alter table public.chaotic_preview_3x3_borrowed_105_plans
 add column priority_opened_at timestamptz,
 add column defender_passed_at timestamptz;
alter table public.chaotic_preview_3x3_borrowed_105_plans
 add constraint chaotic_preview_3x3_borrowed_105_priority_consistency check (
  (state='planned' and priority_opened_at is null and defender_passed_at is null)
  or (state='awaiting_defender' and priority_opened_at is not null and defender_passed_at is null)
  or (state='defender_passed_preview' and priority_opened_at is not null and defender_passed_at is not null)
  or state='cancelled'
 );
