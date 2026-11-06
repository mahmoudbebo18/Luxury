-- Club admins managed from Settings → Admins. Inviting is done by the Edge Function admin-invite
-- (it needs the Auth Admin API); listing and removing are plain admin RPCs.

-- Every admin, with the Auth facts the page shows: last sign-in, and whether the invite is still
-- waiting (an invited user has no password until they open the link and set one).
create or replace function public.admin_list_admins() returns json
language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public.assert_admin();
  return (
    select coalesce(json_agg(json_build_object(
      'id', p.id, 'full_name', p.full_name, 'email', p.email, 'created_at', p.created_at,
      'invited_at', u.invited_at, 'last_sign_in_at', u.last_sign_in_at,
      'pending', coalesce(u.encrypted_password, '') = '',
      'is_self', p.id = auth.uid()
    ) order by coalesce(u.encrypted_password, '') = '', p.created_at), '[]'::json)
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'admin'
  );
end $$;

-- Takes admin rights away (back to an ordinary account). Never yourself, never the last admin.
-- Returns whether the account is an untouched pending invite (no password, no memberships, orders,
-- companies or service requests): admin-invite then deletes it instead of leaving an empty account.
create or replace function public.admin_remove_admin(p_user uuid) returns json
language plpgsql security definer set search_path = public, auth as $$
declare
  admins int;
  is_pending boolean;
  is_bare boolean;
begin
  perform public.assert_admin();
  if p_user = auth.uid() then raise exception 'cannot_remove_self' using errcode = 'P0001'; end if;
  -- lock the admin rows so two removals at once can't leave nobody
  perform 1 from public.profiles where role = 'admin' for update;
  if not exists (select 1 from public.profiles where id = p_user and role = 'admin') then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  select count(*) into admins from public.profiles where role = 'admin';
  if admins <= 1 then raise exception 'last_admin' using errcode = 'P0001'; end if;

  update public.profiles set role = 'member' where id = p_user;

  select coalesce(u.encrypted_password, '') = '' into is_pending from auth.users u where u.id = p_user;
  is_bare := not exists (select 1 from public.memberships where holder_id = p_user)
         and not exists (select 1 from public.orders where user_id = p_user)
         and not exists (select 1 from public.company_admins where user_id = p_user)
         and not exists (select 1 from public.service_requests where member_id = p_user);
  return json_build_object('pending', coalesce(is_pending, false), 'bare', is_bare);
end $$;

revoke execute on function public.admin_list_admins() from public, anon;
revoke execute on function public.admin_remove_admin(uuid) from public, anon;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_remove_admin(uuid) to authenticated;
