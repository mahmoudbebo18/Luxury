-- Helpers, sign-up triggers, row level security and admin views.

create or replace function public.member_label(n int) returns text
language sql immutable set search_path = public as $$
  select case when n is null then null else 'LC-' || lpad(n::text, 5, '0') end;
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_company_admin(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_admins where company_id = p_company and user_id = auth.uid());
$$;

-- A membership row counts only while its dates cover now and, for a seat, its contract is active.
create or replace function public.membership_live(m public.memberships) returns boolean
language sql stable security definer set search_path = public as $$
  select m.holder_id is not null and m.starts_at <= now() and m.expires_at > now()
     and (m.contract_id is null or exists (select 1 from public.contracts c where c.id = m.contract_id and c.status = 'active'));
$$;

-- The membership shown on the card: the live one that lasts longest (corporate wins a tie).
create or replace function public.current_membership(p_user uuid) returns public.memberships
language sql stable security definer set search_path = public as $$
  select m.* from public.memberships m
   where m.holder_id = p_user and public.membership_live(m)
   order by m.expires_at desc, (m.kind = 'corporate') desc
   limit 1;
$$;

-- suspended | active | expired (had one) | none (never had one: unpaid individual)
create or replace function public.profile_status(p public.profiles) returns text
language sql stable security definer set search_path = public as $$
  select case
    when not p.is_active then 'suspended'
    when (public.current_membership(p.id)).id is not null then 'active'
    when exists (select 1 from public.memberships m where m.holder_id = p.id) then 'expired'
    else 'none' end;
$$;

-- ---------------------------------------------------------------- Sign-up
-- Profile from the sign-up metadata. A business sign-up also creates the company and makes the
-- person its admin. Bad company data must never block the account, so it falls back to safe values.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  co jsonb := coalesce(meta->'company', '{}'::jsonb);
  kind text := case when meta->>'signup_kind' in ('individual', 'business', 'invite') then meta->>'signup_kind' else 'individual' end;
  legal text;
  cid uuid;
begin
  insert into public.profiles (id, email, full_name, phone, city, lang, signup_kind, terms_version)
  values (new.id, new.email,
    left(trim(coalesce(meta->>'full_name', '')), 120), left(trim(coalesce(meta->>'phone', '')), 30),
    left(trim(coalesce(meta->>'city', '')), 60),
    case when meta->>'lang' = 'en' then 'en' else 'ar' end,
    kind, nullif(meta->>'terms_version', '')::int);

  if kind = 'business' then
    legal := left(trim(coalesce(co->>'legal_name', '')), 160);
    if length(legal) < 2 then legal := coalesce(nullif(trim(meta->>'full_name'), ''), new.email); end if;
    insert into public.companies (legal_name, card_name, cr_number, vat_number, city, address, created_by)
    values (legal,
      left(coalesce(nullif(trim(co->>'card_name'), ''), legal), 40),
      left(trim(coalesce(co->>'cr_number', '')), 30), left(trim(coalesce(co->>'vat_number', '')), 30),
      left(trim(coalesce(co->>'city', meta->>'city', '')), 60), left(trim(coalesce(co->>'address', '')), 200),
      new.id)
    returning id into cid;
    insert into public.company_admins (company_id, user_id) values (cid, new.id);
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_updated after update on auth.users
for each row execute function public.handle_user_updated();

-- Members edit their personal fields only.
create or replace function public.protect_profile_columns() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.id            := old.id;
    new.member_no     := old.member_no;
    new.member_code   := old.member_code;
    new.email         := old.email;
    new.role          := old.role;
    new.is_active     := old.is_active;
    new.signup_kind   := old.signup_kind;
    new.terms_version := old.terms_version;
    new.created_at    := old.created_at;
  end if;
  return new;
end $$;

create trigger protect_profile_columns before update on public.profiles
for each row execute function public.protect_profile_columns();

-- First membership gives the member number; seat assignment is stamped and kept in history.
create or replace function public.memberships_holder() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.holder_id is not null then
    update public.profiles set member_no = nextval('public.member_no_seq')
     where id = new.holder_id and member_no is null;
  end if;
  if tg_op = 'INSERT' then
    if new.holder_id is not null then new.assigned_at := coalesce(new.assigned_at, now()); end if;
  elsif new.holder_id is distinct from old.holder_id then
    new.assigned_at := case when new.holder_id is null then null else now() end;
  end if;
  return new;
end $$;

create trigger memberships_holder before insert or update of holder_id on public.memberships
for each row execute function public.memberships_holder();

create or replace function public.memberships_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind <> 'corporate' then return new; end if;
  if tg_op = 'UPDATE' and old.holder_id is not null and new.holder_id is distinct from old.holder_id then
    update public.seat_history set released_at = now(), released_by = auth.uid()
     where membership_id = new.id and holder_id = old.holder_id and released_at is null;
  end if;
  if new.holder_id is not null and (tg_op = 'INSERT' or new.holder_id is distinct from old.holder_id) then
    insert into public.seat_history (membership_id, holder_id, assigned_at) values (new.id, new.holder_id, now());
  end if;
  return new;
end $$;

create trigger memberships_history after insert or update of holder_id on public.memberships
for each row execute function public.memberships_history();

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create or replace function public.services_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.email := nullif(lower(trim(new.email)), '');
  new.whatsapp := nullif(new.whatsapp, '');
  return new;
end $$;

create trigger services_touch before insert or update on public.services
for each row execute function public.services_touch();

-- Every published change of a legal page bumps its version and keeps the previous text.
create or replace function public.site_pages_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.title_ar, new.title_en, new.body_ar, new.body_en) is not distinct from (old.title_ar, old.title_en, old.body_ar, old.body_en) then
    return new;
  end if;
  insert into public.site_page_versions (slug, version, title_ar, title_en, body_ar, body_en, saved_at, saved_by)
  values (old.slug, old.version, old.title_ar, old.title_en, old.body_ar, old.body_en, old.updated_at, old.updated_by)
  on conflict (slug, version) do nothing;
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.slug = 'terms' then
    update public.app_settings set terms_version = new.version where id = 1;
  end if;
  return new;
end $$;

create trigger site_pages_version before update on public.site_pages
for each row execute function public.site_pages_version();

-- ---------------------------------------------------------------- RLS
alter table public.app_settings       enable row level security;
alter table public.profiles           enable row level security;
alter table public.companies          enable row level security;
alter table public.company_admins     enable row level security;
alter table public.contracts          enable row level security;
alter table public.memberships        enable row level security;
alter table public.seat_history       enable row level security;
alter table public.invites            enable row level security;
alter table public.orders             enable row level security;
alter table public.payment_events     enable row level security;
alter table public.services           enable row level security;
alter table public.service_requests   enable row level security;
alter table public.site_pages         enable row level security;
alter table public.site_page_versions enable row level security;
alter table public.email_templates    enable row level security;
alter table public.email_campaigns    enable row level security;
alter table public.email_queue        enable row level security;
alter table public.keep_alive         enable row level security;

create policy "own or admin: read"   on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "own or admin: update" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

create policy "company admin or admin: read" on public.companies for select to authenticated
  using ((select public.is_company_admin(id)) or (select public.is_admin()));
create policy "admin: write" on public.companies for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "own or admin: read" on public.company_admins for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "admin: write" on public.company_admins for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "company admin or admin: read" on public.contracts for select to authenticated
  using ((select public.is_company_admin(company_id)) or (select public.is_admin()));
create policy "admin: write" on public.contracts for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "own or admin: read" on public.memberships for select to authenticated
  using (holder_id = (select auth.uid()) or (select public.is_admin()));
create policy "admin: write" on public.memberships for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "own, company admin or admin: read" on public.orders for select to authenticated
  using (user_id = (select auth.uid())
         or (company_id is not null and (select public.is_company_admin(company_id)))
         or (select public.is_admin()));

create policy "admin: all" on public.seat_history       for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.invites            for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: read" on public.payment_events    for select to authenticated using ((select public.is_admin()));
create policy "admin: all" on public.services           for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.service_requests   for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.app_settings       for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.email_templates    for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.email_campaigns    for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: read" on public.email_queue       for select to authenticated using ((select public.is_admin()));
create policy "admin: read" on public.site_page_versions for select to authenticated using ((select public.is_admin()));

-- Legal pages are public: the build reads them with the publishable key.
create policy "public read" on public.site_pages for select to anon, authenticated using (true);
create policy "admin: update" on public.site_pages for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read" on public.keep_alive for select to anon, authenticated using (true);

alter table public.admin_notes enable row level security;
create policy "admin: all" on public.admin_notes for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Members change only their personal fields; everything else goes through functions.
revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, phone, city, lang) on public.profiles to authenticated;
revoke all on public.admin_notes, public.profiles, public.companies, public.contracts, public.memberships, public.orders,
              public.invites, public.seat_history, public.payment_events, public.services, public.service_requests,
              public.site_page_versions, public.email_templates, public.email_campaigns, public.email_queue,
              public.app_settings, public.company_admins
  from anon;

-- ---------------------------------------------------------------- Admin views (RLS of the caller applies)
create view public.admin_members with (security_invoker = on) as
select p.id, p.member_no, public.member_label(p.member_no) as member_label, p.member_code,
       p.full_name, p.phone, p.email, p.city, p.lang, p.signup_kind, p.role, p.is_active, p.created_at,
       public.profile_status(p) as status,
       cm.id as membership_id, cm.kind as membership_kind, cm.expires_at,
       co.id as company_id, co.legal_name as company_name,
       (select max(m.expires_at) from public.memberships m where m.holder_id = p.id) as last_expires_at,
       (select count(*) from public.service_requests r where r.member_id = p.id and r.status = 'done')::int as services_done
from public.profiles p
left join lateral (select * from public.current_membership(p.id)) cm on cm.id is not null
left join public.contracts ct on ct.id = cm.contract_id
left join public.companies co on co.id = ct.company_id;

create view public.admin_companies with (security_invoker = on) as
select co.*,
       'LCB-' || lpad(co.company_no::text, 4, '0') as company_label,
       ct.id as contract_id, ct.seats, ct.starts_at, ct.expires_at, ct.status as contract_status,
       (select count(*) from public.memberships m where m.contract_id = ct.id and m.holder_id is not null)::int as seats_used,
       (select count(*) from public.invites i where i.contract_id = ct.id and i.status = 'pending')::int as invites_pending,
       (select string_agg(pr.full_name, '، ') from public.company_admins ca join public.profiles pr on pr.id = ca.user_id
         where ca.company_id = co.id) as admins,
       (select count(*) from public.orders o where o.company_id = co.id and o.status = 'quote')::int as quotes_open
from public.companies co
left join lateral (select * from public.contracts c where c.company_id = co.id and c.status <> 'cancelled'
                    order by (c.status = 'active') desc, c.created_at desc limit 1) ct on true;

create view public.admin_orders with (security_invoker = on) as
select o.*, p.full_name as user_name, p.email as user_email, public.member_label(p.member_no) as member_label,
       co.legal_name as company_name
from public.orders o
left join public.profiles p on p.id = o.user_id
left join public.companies co on co.id = o.company_id;

create view public.admin_services with (security_invoker = on) as
select s.*,
       (select count(*) from public.service_requests r where r.service_id = s.id)::int as requests_total,
       (select count(*) from public.service_requests r where r.service_id = s.id and r.status = 'requested')::int as requests_open,
       (select count(*) from public.service_requests r where r.service_id = s.id
           and r.created_at > now() - interval '30 days')::int as requests_30d
from public.services s;

create view public.admin_service_requests with (security_invoker = on) as
select r.*, s.title_ar as service_title, s.annual_quota,
       m.full_name as member_name, public.member_label(m.member_no) as member_label, m.phone as member_phone,
       d.full_name as done_by_name
from public.service_requests r
join public.services s on s.id = r.service_id
join public.profiles m on m.id = r.member_id
left join public.profiles d on d.id = r.done_by;

revoke all on public.admin_members, public.admin_companies, public.admin_orders, public.admin_services,
              public.admin_service_requests from anon;
