-- First create this account in Supabase Authentication > Users > Add user.
-- Enter its password in Supabase; never put passwords in SQL, source, or Git.
-- Run this script in the Supabase SQL Editor after 001_schema.sql.
begin;
do $$
declare admin_user_id uuid;
begin
  select id into admin_user_id
  from auth.users
  where lower(email) = 'kunalvishwakarma2903@gmail.com';

  if admin_user_id is null then
    raise exception 'Create kunalvishwakarma2903@gmail.com in Authentication > Users first';
  end if;

  update public.profiles set role = 'member'
  where role = 'admin' and id <> admin_user_id;

  insert into public.profiles (id, role)
  values (admin_user_id, 'admin')
  on conflict (id) do update set role = 'admin';
end $$;

-- Enforce one admin profile even if another profile is changed later.
create unique index if not exists profiles_one_admin
on public.profiles (role) where role = 'admin';

-- Admin policies already call this function. Also require the intended Auth email.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid()
      and p.role = 'admin'
      and lower(u.email) = 'kunalvishwakarma2903@gmail.com'
  )
$$;
commit;

-- Should return exactly one row, with role admin.
select u.email, p.role
from auth.users u join public.profiles p on p.id = u.id
where p.role = 'admin';
