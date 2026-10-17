create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  share_id text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  joined_at date not null,
  note text,
  color text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.gym_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  total integer not null check (total > 0),
  start_date date not null,
  end_date date,
  note text,
  status text not null check (status in ('active', 'completed', 'ended')),
  created_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  card_id uuid not null references public.gym_cards(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  used_date date not null,
  used_time time not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_share_id_idx on public.workspaces(share_id);
create index if not exists users_workspace_id_idx on public.users(workspace_id);
create index if not exists gym_cards_workspace_id_idx on public.gym_cards(workspace_id);
create index if not exists check_ins_workspace_id_idx on public.check_ins(workspace_id);
create index if not exists check_ins_card_id_idx on public.check_ins(card_id);

alter table public.workspaces enable row level security;
alter table public.users enable row level security;
alter table public.gym_cards enable row level security;
alter table public.check_ins enable row level security;
