-- Chaotic GO: salas privadas (convite por código).
-- Sem transferência de cartas, ranking nem início de batalha nesta fase.
create table if not exists public.chaotic_lobbies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  mode text not null check (mode in ('1x1','3x3','6x6')),
  status text not null default 'waiting' check (status in ('waiting','ready','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  updated_at timestamptz not null default now(),
  constraint chaotic_lobby_not_self check (guest_id is null or guest_id <> host_id),
  constraint chaotic_lobby_ready_guest check (status <> 'ready' or guest_id is not null),
  constraint chaotic_lobby_code_format check (code ~ '^[A-F0-9]{12}$')
);
create index if not exists chaotic_lobbies_host_date on public.chaotic_lobbies(host_id, created_at desc);
create index if not exists chaotic_lobbies_guest_date on public.chaotic_lobbies(guest_id, created_at desc);
create unique index if not exists chaotic_lobbies_one_active_host
  on public.chaotic_lobbies(host_id) where status in ('waiting','ready');
alter table public.chaotic_lobbies enable row level security;
revoke all on table public.chaotic_lobbies from public, anon, authenticated;
grant select on table public.chaotic_lobbies to authenticated;
drop policy if exists "chaotic_lobby_members_read" on public.chaotic_lobbies;
create policy "chaotic_lobby_members_read" on public.chaotic_lobbies
  for select to authenticated
  using ((select auth.uid()) = host_id or (select auth.uid()) = guest_id);

-- Functions are narrow, auditable RPC endpoints: no public table writes.
-- SECURITY DEFINER is used only because the joining user cannot SELECT a code
-- before joining. Explicit auth.uid() checks, locked search_path, REVOKE+GRANT.
create or replace function public.chaotic_create_lobby(p_mode text)
returns public.chaotic_lobbies
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result public.chaotic_lobbies;
begin
  if actor is null then raise exception 'Faça login para abrir uma sala'; end if;
  if p_mode is null or p_mode not in ('1x1','3x3','6x6') then
    raise exception 'Modo de batalha inválido';
  end if;
  if (select count(*) from public.chaotic_lobbies
      where host_id=actor and created_at>now()-interval '15 minutes') >= 10 then
    raise exception 'Muitas salas criadas. Tente novamente mais tarde';
  end if;

  update public.chaotic_lobbies set status='cancelled', updated_at=now()
    where host_id=actor and status in ('waiting','ready');

  insert into public.chaotic_lobbies (code,host_id,mode)
    values (upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,12)),actor,p_mode)
    returning * into result;
  return result;
end;
$$;

create or replace function public.chaotic_join_lobby(p_code text)
returns public.chaotic_lobbies
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result public.chaotic_lobbies;
begin
  if actor is null then raise exception 'Faça login para entrar na sala'; end if;
  if p_code is null or p_code !~* '^[a-f0-9]{12}$' then
    raise exception 'Código inválido';
  end if;
  update public.chaotic_lobbies
    set guest_id=actor,status='ready',updated_at=now()
    where code=upper(p_code)
      and status='waiting'
      and guest_id is null
      and host_id<>actor
      and expires_at>now()
    returning * into result;
  if not found then raise exception 'Sala indisponível, expirada ou já ocupada'; end if;
  return result;
end;
$$;

create or replace function public.chaotic_close_lobby(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  affected integer;
begin
  if actor is null then raise exception 'Faça login'; end if;
  update public.chaotic_lobbies
    set status='cancelled',updated_at=now()
    where id=p_id and host_id=actor and status in ('waiting','ready');
  get diagnostics affected = row_count;
  return affected=1;
end;
$$;

create or replace function public.chaotic_leave_lobby(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  affected integer;
begin
  if actor is null then raise exception 'Faça login'; end if;
  update public.chaotic_lobbies
    set guest_id=null,status='waiting',updated_at=now()
    where id=p_id and guest_id=actor and status='ready' and expires_at>now();
  get diagnostics affected = row_count;
  return affected=1;
end;
$$;

revoke all on function public.chaotic_create_lobby(text) from public, anon, authenticated;
revoke all on function public.chaotic_join_lobby(text) from public, anon, authenticated;
revoke all on function public.chaotic_close_lobby(uuid) from public, anon, authenticated;
revoke all on function public.chaotic_leave_lobby(uuid) from public, anon, authenticated;
grant execute on function public.chaotic_create_lobby(text),
  public.chaotic_join_lobby(text),public.chaotic_close_lobby(uuid),
  public.chaotic_leave_lobby(uuid) to authenticated;
