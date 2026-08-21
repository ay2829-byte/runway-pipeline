-- Runway database schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query > paste > Run)

-- Live job postings, refreshed by scripts/collect-jobs.js
create table if not exists jobs (
  id text primary key,                 -- stable id, e.g. "greenhouse:airbnb:12345"
  company text not null,
  title text not null,
  description text,
  url text,
  source text default 'live',          -- 'live' or 'sample'
  posted_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Real H1B filing counts per company + job title, refreshed by scripts/collect-sponsors.js
-- One row per (company, job_title) combination found on h1bdata.info.
create table if not exists sponsor_titles (
  id bigint generated always as identity primary key,
  company text not null,
  company_query text not null,         -- the exact query string used against h1bdata.info
  job_title text not null,
  lca_count int not null default 0,
  median_salary int,
  updated_at timestamptz default now(),
  unique (company_query, job_title)
);

-- Company-level totals (mirrors the Top Sponsors tab), refreshed by scripts/collect-sponsors.js
create table if not exists sponsor_companies (
  id bigint generated always as identity primary key,
  company text not null unique,
  company_query text not null,
  domain text,
  total_lca_count int not null default 0,
  updated_at timestamptz default now()
);

-- Read-only public access: the frontend reads with the anon key, only the
-- GitHub Action (using the service key) writes.
alter table jobs enable row level security;
alter table sponsor_titles enable row level security;
alter table sponsor_companies enable row level security;

create policy "public read jobs" on jobs for select using (true);
create policy "public read sponsor_titles" on sponsor_titles for select using (true);
create policy "public read sponsor_companies" on sponsor_companies for select using (true);

-- ---------------------------------------------------------------------------
-- Site-wide visit counter, shown on the homepage below the status line.
-- Anyone loading the page increments this by calling the RPC function below
-- with the public anon key. The table itself stays locked down (no direct
-- insert/update from the browser) — only the function can change it, and the
-- function is the only thing granted to anon, so this can't be abused to
-- write arbitrary data.
-- ---------------------------------------------------------------------------
create table if not exists site_visits (
  id int primary key default 1,
  count bigint not null default 0,
  check (id = 1) -- enforces a single row
);
insert into site_visits (id, count) values (1, 0) on conflict (id) do nothing;

alter table site_visits enable row level security;
create policy "public read site_visits" on site_visits for select using (true);
-- No insert/update/delete policy for site_visits — writes only happen
-- through the increment_visit_count() function below.

create or replace function increment_visit_count()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  update site_visits set count = count + 1 where id = 1
    returning count into new_count;
  return new_count;
end;
$$;

grant execute on function increment_visit_count() to anon, authenticated;
