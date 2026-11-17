-- Run once in Supabase SQL Editor. Uses Supabase Auth; no hardcoded passwords.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,full_name text,role text not null default 'member' check(role in('member','admin','staff')),created_at timestamptz default now());
create or replace function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict(id) do nothing;return new;end$$;
drop trigger if exists auth_new_profile on auth.users;
create trigger auth_new_profile after insert on auth.users for each row execute procedure public.new_profile();
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=auth.uid() and p.role='admin' and lower(u.email) in ('kunalvishwakarma2903@gmail.com','shwetaansh@livance.co.in'))$$;
create table if not exists public.locations(id uuid primary key default gen_random_uuid(),name text not null,slug text unique not null,city text not null,address text not null default '',description text default '',image text,desk_price integer not null default 7000,active boolean default true,created_at timestamptz default now());
create table if not exists public.rooms(id uuid primary key default gen_random_uuid(),location_id uuid not null references public.locations(id) on delete cascade,name text not null,capacity int not null default 4 check(capacity>0),price_hour integer not null default 1000 check(price_hour>=0),image text,active boolean default true,created_at timestamptz default now());
create table if not exists public.bookings(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),room_id uuid references public.rooms(id),location_id uuid references public.locations(id),booking_date date not null,start_time time,end_time time,type text not null check(type in('meeting','day_pass','virtual_office','desk')),status text not null default 'pending' check(status in('pending','confirmed','cancelled','completed')),total_amount integer not null default 0,notes text default '',created_at timestamptz default now(),constraint valid_meeting_times check(type<>'meeting' or(room_id is not null and start_time<end_time)));
-- Prevent double booking of confirmed/pending meeting rooms even under concurrent requests.
alter table public.bookings drop constraint if exists no_meeting_overlap;
alter table public.bookings add constraint no_meeting_overlap exclude using gist(room_id with =,booking_date with =,tsrange(booking_date + start_time,booking_date + end_time,'[)') with &&) where(type='meeting' and status in('pending','confirmed'));
create table if not exists public.leads(id uuid primary key default gen_random_uuid(),name text not null,email text not null,phone text default '',message text not null,status text not null default 'new',created_at timestamptz default now());
create table if not exists public.tickets(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),subject text not null,message text not null,status text not null default 'open',created_at timestamptz default now());
create table if not exists public.content(id uuid primary key default gen_random_uuid(),title text not null,slug text unique not null,excerpt text default '',body text default '',type text not null default 'blog',published boolean default false,created_at timestamptz default now());
create table if not exists public.coupons(id uuid primary key default gen_random_uuid(),code text unique not null,discount_percent int not null default 0 check(discount_percent between 0 and 100),active boolean default true,created_at timestamptz default now());
-- RLS on ALL application tables, including future admin direct-client queries.
do $$declare t text;begin foreach t in array array['profiles','locations','rooms','bookings','leads','tickets','content','coupons'] loop execute format('alter table public.%I enable row level security',t); end loop;end$$;
create policy "profiles_self_or_admin_read" on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy "locations_public_read" on public.locations for select to anon,authenticated using(active=true or public.is_admin());
create policy "locations_admin_write" on public.locations for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "rooms_public_read" on public.rooms for select to anon,authenticated using(active=true or public.is_admin());
create policy "rooms_admin_write" on public.rooms for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "bookings_own_or_admin_read" on public.bookings for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "bookings_member_create" on public.bookings for insert to authenticated with check(user_id=auth.uid() and status='pending');
create policy "bookings_admin_update" on public.bookings for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "leads_public_insert" on public.leads for insert to anon,authenticated with check(char_length(name)>=2 and char_length(message)>=5);
create policy "leads_admin_read" on public.leads for select to authenticated using(public.is_admin());
create policy "leads_admin_update" on public.leads for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "tickets_own_or_admin_read" on public.tickets for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "tickets_own_insert" on public.tickets for insert to authenticated with check(user_id=auth.uid());
create policy "tickets_admin_update" on public.tickets for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "content_public_read" on public.content for select to anon,authenticated using(published or public.is_admin());
create policy "content_admin_write" on public.content for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "coupons_admin_all" on public.coupons for all to authenticated using(public.is_admin()) with check(public.is_admin());
insert into public.locations(name,slug,city,address,description,image,desk_price) values
('Cyber City, Gurugram','cyber-city-gurugram','Gurugram','Enkay Tower, Udyog Vihar Phase V, Gurugram, Haryana 122016','Vibrant workspace near Cyber City with dedicated desks, premium meeting rooms and flexible plans.','/images/cc-open-desks.jpg',7000),
('Ghitorni, New Delhi','ghitorni-delhi','New Delhi','Ghitorni, New Delhi, Delhi','Flexible offices, elegant meeting areas and creative spaces for ambitious teams.','/images/gh-workspace.jpg',6500)
on conflict(slug) do nothing;
insert into public.rooms(location_id,name,capacity,price_hour,image)
select l.id,'Meeting Room A',4,1000,'/images/cc-meeting-room-a.jpg' from public.locations l where l.slug='cyber-city-gurugram' and not exists(select 1 from public.rooms where location_id=l.id and name='Meeting Room A');
insert into public.rooms(location_id,name,capacity,price_hour,image)
select l.id,'Meeting Room B',6,1500,'/images/cc-meeting-room-b.jpg' from public.locations l where l.slug='cyber-city-gurugram' and not exists(select 1 from public.rooms where location_id=l.id and name='Meeting Room B');
insert into public.rooms(location_id,name,capacity,price_hour,image)
select l.id,'Boardroom',10,2400,'/images/gh-boardroom.jpg' from public.locations l where l.slug='ghitorni-delhi' and not exists(select 1 from public.rooms where location_id=l.id and name='Boardroom');
