-- IMPORTANT: First create the user in Supabase Auth > Users > Add user.
-- Set their password in Supabase Auth, not in application source code.
-- Then execute this SQL after replacing the email as needed.
update public.profiles set role='admin'
where id in (select id from auth.users where lower(email)='kunalvishwakarma@gmail.com');
-- Verify (should return one row):
select u.email,p.role from auth.users u join public.profiles p on p.id=u.id where lower(u.email)='kunalvishwakarma@gmail.com';
