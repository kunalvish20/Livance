-- LIVANCE exact-design live bridge. Run AFTER 001_schema.sql and 002_make_admin.sql.
-- No service-role key in the browser; RLS is the authoritative access control.
create extension if not exists pgcrypto;

create table if not exists public.livance_state (
 id int primary key default 1 check(id=1),
 version bigint not null default 1,
 payload jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table if not exists public.livance_public_state (
 id int primary key default 1 check(id=1),
 version bigint not null default 1,
 payload jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table if not exists public.livance_enquiries (
 id uuid primary key default gen_random_uuid(),
 name varchar(100) not null, email varchar(254) not null, phone varchar(20) not null,
 company varchar(140), solution varchar(80), vo_plan varchar(50),
 seats int check(seats between 1 and 500), centre varchar(60), message varchar(1500),
 source varchar(150), marketing_opt_in boolean not null default false,
 created_at timestamptz not null default now(),
 check(char_length(trim(name))>=2), check(email ~* '^[^ @]+@[^ @]+\.[^ @]+$')
);
create index if not exists livance_enquiries_created_at_idx on public.livance_enquiries(created_at desc);
create table if not exists public.livance_booking_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 member_email varchar(254),
 kind varchar(40) not null check(kind in ('meeting_room','day_pass','virtual_office','credits')),
 centre varchar(80), room_id varchar(80), booking_date date,
 start_hour int check(start_hour between 0 and 23),
 end_hour int check(end_hour between 1 and 24),
 quantity int check(quantity between 1 and 20),
 business varchar(180),
 requested_total_paise bigint not null default 0 check(requested_total_paise>=0),
 parameters jsonb not null default '{}'::jsonb,
 billing jsonb not null default '{}'::jsonb,
 status varchar(30) not null default 'requested' check(status in ('requested','confirmed','rejected','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(kind <> 'meeting_room' or (room_id is not null and booking_date is not null and start_hour < end_hour))
);
create index if not exists livance_booking_user_idx on public.livance_booking_requests(user_id,created_at desc);
create table if not exists public.livance_email_logs (
 id uuid primary key default gen_random_uuid(),
 event_key varchar(160) unique, recipient varchar(254) not null,
 subject varchar(300) not null, kind varchar(50) not null default 'transactional',
 status varchar(30) not null default 'pending', provider_id text,
 error text, created_at timestamptz not null default now()
);
create table if not exists public.livance_suppressions (
 email varchar(254) primary key, created_at timestamptz not null default now()
);

alter table public.livance_state enable row level security;
alter table public.livance_public_state enable row level security;
alter table public.livance_enquiries enable row level security;
alter table public.livance_booking_requests enable row level security;
alter table public.livance_email_logs enable row level security;
alter table public.livance_suppressions enable row level security;

-- Admins can edit the original app JSON state, guests cannot read private data.
drop policy if exists "livance_state_admin" on public.livance_state;
create policy "livance_state_admin" on public.livance_state for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "livance_public_read" on public.livance_public_state;
create policy "livance_public_read" on public.livance_public_state for select to anon,authenticated using(true);
drop policy if exists "livance_enquiries_insert" on public.livance_enquiries;
create policy "livance_enquiries_insert" on public.livance_enquiries for insert to anon,authenticated with check(true);
drop policy if exists "livance_enquiries_admin" on public.livance_enquiries;
create policy "livance_enquiries_admin" on public.livance_enquiries for select to authenticated using(public.is_admin());
drop policy if exists "livance_booking_read" on public.livance_booking_requests;
create policy "livance_booking_read" on public.livance_booking_requests for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "livance_booking_insert" on public.livance_booking_requests;
create policy "livance_booking_insert" on public.livance_booking_requests for insert to authenticated with check(user_id=auth.uid() and status='requested');
drop policy if exists "livance_booking_admin_update" on public.livance_booking_requests;
create policy "livance_booking_admin_update" on public.livance_booking_requests for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "livance_email_log_admin" on public.livance_email_logs;
create policy "livance_email_log_admin" on public.livance_email_logs for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "livance_suppress_admin" on public.livance_suppressions;
create policy "livance_suppress_admin" on public.livance_suppressions for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Only publish non-sensitive catalogue fields. No user, order, lead, KYC, or CRM fields are public.
create or replace function public.livance_publish_state() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.livance_public_state(id,version,payload,updated_at)
  values(1,new.version,jsonb_build_object(
    'centres',coalesce(new.payload->'centres','[]'::jsonb),
    'rooms',coalesce(new.payload->'rooms','[]'::jsonb),
    'posts',coalesce(new.payload->'posts','[]'::jsonb),
    'clients',coalesce(new.payload->'clients','[]'::jsonb),
    'docs',(select coalesce(jsonb_agg(d.elem),'[]'::jsonb) from jsonb_array_elements(coalesce(new.payload->'docs','[]'::jsonb)) d(elem) where d.elem->>'public'='true'),
    'seo',coalesce(new.payload->'seo','{}'::jsonb),
    'redirects',coalesce(new.payload->'redirects','[]'::jsonb)
  ),now())
  on conflict(id) do update set version=excluded.version,payload=excluded.payload,updated_at=now();
  return new;
end$$;
drop trigger if exists livance_state_publish on public.livance_state;
create trigger livance_state_publish after insert or update of payload on public.livance_state
for each row execute function public.livance_publish_state();

-- Read raw snapshots only through admin RLS and never grant clients an admin bypass.
grant usage on schema public to anon,authenticated;
grant select on public.livance_public_state to anon,authenticated;
grant select,insert on public.livance_enquiries to anon,authenticated;
grant select,insert on public.livance_booking_requests to authenticated;
grant select,insert,update,delete on public.livance_state to authenticated;
grant select on public.livance_email_logs to authenticated;
grant insert,update on public.livance_email_logs to authenticated;
grant select on public.livance_suppressions to authenticated;
grant insert on public.livance_suppressions to authenticated;
grant select on public.livance_enquiries to authenticated;
grant update on public.livance_booking_requests to authenticated;

-- Unsubscribe tokens: a recipient can opt out ONLY with a token generated for them.
create table if not exists public.livance_unsubscribe_tokens(
  token uuid primary key default gen_random_uuid(),
  email varchar(254) not null,
  created_at timestamptz not null default now()
);
alter table public.livance_unsubscribe_tokens enable row level security;
drop policy if exists "livance_tokens_admin" on public.livance_unsubscribe_tokens;
create policy "livance_tokens_admin" on public.livance_unsubscribe_tokens for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert on public.livance_unsubscribe_tokens to authenticated;
create or replace function public.livance_unsubscribe(p_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_email text;
begin
 select t.email into v_email from public.livance_unsubscribe_tokens t where t.token=p_token;
 if v_email is null then return false; end if;
 insert into public.livance_suppressions(email) values(v_email) on conflict(email) do nothing;
 delete from public.livance_unsubscribe_tokens where token=p_token;
 return true;
end$$;
revoke all on function public.livance_unsubscribe(uuid) from public;
grant execute on function public.livance_unsubscribe(uuid) to anon,authenticated;

-- Prevent two confirmed meeting room requests with overlapping times. Requested slots are not paid or reserved.
create extension if not exists btree_gist;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='livance_no_confirmed_overlap') then
   alter table public.livance_booking_requests add constraint livance_no_confirmed_overlap exclude using gist
   (room_id with =, booking_date with =, int4range(start_hour,end_hour,'[)') with &&)
   where (kind='meeting_room' and status='confirmed');
 end if;
end$$;
