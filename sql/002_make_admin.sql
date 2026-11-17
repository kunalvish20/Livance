-- First create both accounts in Supabase Authentication > Users > Add user.
-- Set their passwords in Supabase; never put passwords in SQL, source, or Git.
-- Run this script in the Supabase SQL Editor after 001_schema.sql.
begin;
-- Remove the old one-admin limit before granting the second account access.
drop index if exists public.profiles_one_admin;
do $$
declare missing_email text;
begin
  select allowed.email into missing_email
  from (values
    ('kunalvishwakarma2903@gmail.com'),
    ('shwetaansh@livance.co.in')
  ) as allowed(email)
  left join auth.users u on lower(u.email) = allowed.email
  where u.id is null
  limit 1;

  if missing_email is not null then
    raise exception 'Create % in Authentication > Users first', missing_email;
  end if;

  update public.profiles set role = 'member'
  where role = 'admin'
    and id not in (
      select u.id from auth.users u
      where lower(u.email) in ('kunalvishwakarma2903@gmail.com', 'shwetaansh@livance.co.in')
    );

  insert into public.profiles (id, role)
  select u.id, 'admin' from auth.users u
  where lower(u.email) in ('kunalvishwakarma2903@gmail.com', 'shwetaansh@livance.co.in')
  on conflict (id) do update set role = 'admin';
end $$;

-- Admin policies already call this function. Only these two Auth users qualify.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid()
      and p.role = 'admin'
      and lower(u.email) in ('kunalvishwakarma2903@gmail.com', 'shwetaansh@livance.co.in')
  )
$$;
commit;

-- Should return exactly two rows, both with role admin.
select u.email, p.role
from auth.users u join public.profiles p on p.id = u.id
where p.role = 'admin';
