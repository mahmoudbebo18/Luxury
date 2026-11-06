-- RPCs: public, pricing and orders, member, company portal, admin, scheduled jobs.

create or replace function public.assert_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

create or replace function public.assert_company_admin(p_company uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_company_admin(p_company) or public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create or replace function public.settings() returns public.app_settings
language sql stable security definer set search_path = public as $$
  select * from public.app_settings where id = 1;
$$;

-- ---------------------------------------------------------------- Public
create or replace function public.public_pricing() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'price_individual', s.price_individual, 'vat_rate', s.vat_rate, 'company_tiers', s.company_tiers,
    'company_min_seats', s.company_min_seats, 'company_online_max', s.company_online_max,
    'bank_transfer', s.bank_transfer, 'terms_version', s.terms_version)
  from public.app_settings s where s.id = 1;
$$;

-- The verification page (/v/:code) a service provider opens from the member's QR.
create or replace function public.get_member_card(p_code text) returns json
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; m public.memberships; company text; st text;
begin
  select * into p from public.profiles where member_code = p_code;
  if not found then return json_build_object('ok', false, 'error', 'invalid'); end if;
  m := public.current_membership(p.id);
  st := public.profile_status(p);
  if m.contract_id is not null then
    select co.card_name into company from public.contracts c join public.companies co on co.id = c.company_id
     where c.id = m.contract_id;
  end if;
  return json_build_object('ok', true, 'status', st, 'name', p.full_name,
    'member_no', public.member_label(p.member_no), 'kind', m.kind, 'company', company,
    'expires_at', coalesce(m.expires_at, (select max(expires_at) from public.memberships where holder_id = p.id)));
end $$;

-- What an invite link shows before sign-in.
create or replace function public.check_invite(p_token text) returns json
language plpgsql stable security definer set search_path = public as $$
declare i public.invites; c public.contracts; co public.companies;
begin
  select * into i from public.invites where token = p_token;
  if not found then return json_build_object('ok', false, 'error', 'invalid'); end if;
  select * into c from public.contracts where id = i.contract_id;
  select * into co from public.companies where id = c.company_id;
  if i.status <> 'pending' then return json_build_object('ok', false, 'error', 'used', 'company', co.card_name); end if;
  if c.status <> 'active' or c.expires_at <= now() then
    return json_build_object('ok', false, 'error', 'contract_inactive', 'company', co.card_name); end if;
  return json_build_object('ok', true, 'company', co.card_name, 'email', i.email, 'full_name', i.full_name,
                           'phone', i.phone, 'expires_at', c.expires_at);
end $$;

create or replace function public.check_join_link(p_token text) returns json
language plpgsql stable security definer set search_path = public as $$
declare c public.contracts; co public.companies;
begin
  select * into c from public.contracts where join_token = p_token;
  if not found then return json_build_object('ok', false, 'error', 'invalid'); end if;
  select * into co from public.companies where id = c.company_id;
  if c.status <> 'active' or c.expires_at <= now() then
    return json_build_object('ok', false, 'error', 'contract_inactive', 'company', co.card_name); end if;
  return json_build_object('ok', true, 'company', co.card_name, 'email_domain', co.email_domain, 'expires_at', c.expires_at);
end $$;

-- ---------------------------------------------------------------- Pricing
-- All prices are VAT inclusive. The browser never sends a price: orders take it from here.
create or replace function public.quote_price(p_type text, p_quantity int, p_contract uuid default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  s public.app_settings := public.settings();
  c public.contracts;
  qty int := greatest(coalesce(p_quantity, 1), 1);
  tier_qty int;
  disc numeric := 0;
  factor numeric := 1;
  months int;
  unit numeric;
  total numeric;
  sub numeric;
begin
  if p_type not in ('individual', 'company_new', 'company_add_seats', 'company_renew') then
    raise exception 'bad_type'; end if;
  if p_type = 'individual' then
    qty := 1;
  else
    tier_qty := qty;
    if p_contract is not null then select * into c from public.contracts where id = p_contract; end if;
    if p_type = 'company_add_seats' then
      if c.id is null or c.status <> 'active' or c.expires_at <= now() then raise exception 'contract_inactive'; end if;
      tier_qty := c.seats + qty;
      -- Added seats end with the contract: charge the remaining whole months.
      months := least(12, greatest(1, ceil(extract(epoch from (c.expires_at - now())) / (30.4375 * 86400))::int));
      factor := round(months / 12.0, 4);
    end if;
    select coalesce(max((t->>'discount')::numeric), 0) into disc
      from jsonb_array_elements(s.company_tiers) t where (t->>'min')::int <= tier_qty;
  end if;
  unit := round(s.price_individual * (1 - disc / 100), 2);
  total := round(unit * qty * factor, 2);
  sub := round(total / (1 + s.vat_rate), 2);
  return json_build_object('type', p_type, 'quantity', qty, 'unit_price', unit, 'discount_pct', disc,
    'period_factor', factor, 'months', months, 'total', total, 'subtotal', sub, 'vat_amount', total - sub,
    'vat_rate', s.vat_rate, 'online', p_type = 'individual' or qty <= s.company_online_max);
end $$;

-- ---------------------------------------------------------------- Orders
-- Creates an order priced by quote_price(). Companies above the online limit (or asking for an
-- offer / bank transfer) get a 'quote' the admin follows up; everyone else gets 'pending' and the
-- create-payment Edge Function attaches the MyFatoorah link.
create or replace function public.create_order(
  p_type text, p_quantity int default 1, p_company uuid default null, p_contract uuid default null,
  p_request_quote boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s public.app_settings := public.settings();
  c public.contracts;
  q json;
  o public.orders;
  st text := 'pending';
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = uid and is_active and role = 'member') then
    raise exception 'forbidden' using errcode = '42501'; end if;

  if p_type = 'individual' then
    p_company := null; p_contract := null;
  else
    if p_company is null then raise exception 'company_required'; end if;
    perform public.assert_company_admin(p_company);
    if p_type = 'company_new' then
      if coalesce(p_quantity, 0) < s.company_min_seats then
        raise exception 'min_seats' using detail = s.company_min_seats::text; end if;
      -- one contract per company: reuse a pending one, refuse if one is active
      if exists (select 1 from public.contracts where company_id = p_company and status = 'active' and expires_at > now()) then
        raise exception 'contract_exists'; end if;
      select * into c from public.contracts where company_id = p_company and status = 'pending' order by created_at desc limit 1;
      if c.id is null then
        insert into public.contracts (company_id) values (p_company) returning * into c;
      end if;
    else
      select * into c from public.contracts where id = p_contract and company_id = p_company;
      if c.id is null then raise exception 'contract_not_found'; end if;
      if p_type = 'company_renew' and coalesce(p_quantity, 0) < c.seats then
        raise exception 'renew_fewer_seats' using detail = c.seats::text; end if;
    end if;
  end if;

  q := public.quote_price(p_type, p_quantity, c.id);
  if p_type <> 'individual' and (p_request_quote or not (q->>'online')::boolean) then st := 'quote'; end if;

  -- An unpaid order for the same thing is replaced, so there is one open order at a time.
  update public.orders set status = 'cancelled'
   where user_id = uid and type = p_type and status in ('pending', 'quote') and paid_at is null
     and coalesce(company_id::text, '') = coalesce(p_company::text, '');

  insert into public.orders (type, user_id, company_id, contract_id, quantity, unit_price, discount_pct, period_factor,
                             total, subtotal, vat_amount, status, terms_version, created_by)
  values (p_type, uid, p_company, c.id, (q->>'quantity')::int, (q->>'unit_price')::numeric, (q->>'discount_pct')::numeric,
          (q->>'period_factor')::numeric, (q->>'total')::numeric, (q->>'subtotal')::numeric, (q->>'vat_amount')::numeric,
          st, s.terms_version, uid)
  returning * into o;

  if st = 'quote' then
    insert into public.email_queue (kind, to_email, to_name, vars)
    select 'admin_quote', s.notify_email, 'The Luxury Club',
           jsonb_build_object('order_no', o.order_no, 'company', co.legal_name, 'quantity', o.quantity::text,
                              'total', o.total::text, 'contact', p.full_name, 'phone', p.phone, 'email', p.email)
      from public.companies co, public.profiles p where co.id = p_company and p.id = uid;
  end if;

  return json_build_object('id', o.id, 'order_no', o.order_no, 'status', o.status, 'total', o.total);
end $$;

-- The only place a paid order becomes membership time. Idempotent: a second call does nothing.
-- Called by the payment Edge Functions (service role) and by the admin (bank transfer / manual).
create or replace function public.activate_order(p_order uuid, p_method text, p_payment_id text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  c public.contracts;
  start_at timestamptz;
  new_expiry timestamptz;
  i int;
  p public.profiles;
begin
  -- Inside a security definer function current_user is the owner, so the caller is read from the JWT.
  if coalesce(auth.role(), '') <> 'service_role' then perform public.assert_admin(); end if;
  if p_method not in ('myfatoorah', 'bank_transfer', 'manual') then raise exception 'bad_method'; end if;

  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'paid' then return json_build_object('ok', true, 'already', true, 'order_no', o.order_no); end if;
  if o.status in ('refunded') then raise exception 'order_refunded'; end if;

  if o.type = 'individual' then
    select greatest(now(), coalesce(max(m.expires_at), now())) into start_at
      from public.memberships m where m.holder_id = o.user_id and m.kind = 'individual' and m.expires_at > now();
    insert into public.memberships (kind, holder_id, order_id, starts_at, expires_at)
    values ('individual', o.user_id, o.id, start_at, start_at + interval '1 year')
    returning expires_at into new_expiry;

  else
    select * into c from public.contracts where id = o.contract_id for update;
    if o.type = 'company_new' then
      new_expiry := now() + interval '1 year';
      update public.contracts set status = 'active', starts_at = now(), expires_at = new_expiry, seats = o.quantity
       where id = c.id;
      insert into public.memberships (kind, contract_id, order_id, starts_at, expires_at)
      select 'corporate', c.id, o.id, now(), new_expiry from generate_series(1, o.quantity);

    elsif o.type = 'company_add_seats' then
      new_expiry := c.expires_at;
      update public.contracts set seats = seats + o.quantity where id = c.id;
      insert into public.memberships (kind, contract_id, order_id, starts_at, expires_at)
      select 'corporate', c.id, o.id, now(), c.expires_at from generate_series(1, o.quantity);

    elsif o.type = 'company_renew' then
      new_expiry := greatest(c.expires_at, now()) + interval '1 year';
      update public.contracts set status = 'active', expires_at = new_expiry,
             starts_at = case when c.expires_at <= now() then now() else c.starts_at end,
             seats = greatest(c.seats, o.quantity)
       where id = c.id;
      -- Existing seats keep their holders and move to the new end date; extra seats are added.
      -- A lapsed contract restarts the year, so seats also restart (and their service quota with them).
      update public.memberships set expires_at = new_expiry,
             starts_at = case when expires_at <= now() then now() else starts_at end
       where contract_id = c.id;
      i := o.quantity - c.seats;
      if i > 0 then
        insert into public.memberships (kind, contract_id, order_id, starts_at, expires_at)
        select 'corporate', c.id, o.id, now(), new_expiry from generate_series(1, i);
      end if;
    end if;
  end if;

  update public.orders set status = 'paid', method = p_method, paid_at = now(),
         mf_payment_id = coalesce(p_payment_id, mf_payment_id)
   where id = o.id;

  -- Receipt to the buyer, notice to the club.
  select * into p from public.profiles where id = o.user_id;
  if p.id is not null then
    insert into public.email_queue (kind, member_id, to_email, to_name, lang, vars)
    values ('payment_receipt', p.id, p.email, p.full_name, p.lang,
      jsonb_build_object('order_no', o.order_no, 'order_type', o.type, 'quantity', o.quantity::text,
        'total', o.total::text, 'subtotal', o.subtotal::text, 'vat_amount', o.vat_amount::text,
        'expires_at', new_expiry, 'paid_at', now()));
  end if;
  insert into public.email_queue (kind, to_email, to_name, vars)
  values ('admin_payment', (public.settings()).notify_email, 'The Luxury Club',
    jsonb_build_object('order_no', o.order_no, 'order_type', o.type, 'total', o.total::text,
      'name', coalesce(p.full_name, ''), 'method', p_method, 'quantity', o.quantity::text));

  return json_build_object('ok', true, 'order_no', o.order_no, 'expires_at', new_expiry);
end $$;

-- ---------------------------------------------------------------- Member
create or replace function public.my_account() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles;
  m public.memberships;
  company text;
  last_exp timestamptz;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then return null; end if;
  m := public.current_membership(p.id);
  if m.contract_id is not null then
    select co.card_name into company from public.contracts c join public.companies co on co.id = c.company_id where c.id = m.contract_id;
  end if;
  select max(expires_at) into last_exp from public.memberships where holder_id = p.id;
  return json_build_object(
    'id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone, 'city', p.city, 'lang', p.lang,
    'role', p.role, 'signup_kind', p.signup_kind, 'member_no', public.member_label(p.member_no),
    'member_code', p.member_code, 'status', public.profile_status(p), 'created_at', p.created_at,
    'membership', case when m.id is null then null else json_build_object(
        'id', m.id, 'kind', m.kind, 'starts_at', m.starts_at, 'expires_at', m.expires_at, 'company', company) end,
    'last_expires_at', last_exp,
    -- a renewal already paid for (individual year starting after the current one)
    'next_starts_at', (select min(starts_at) from public.memberships
                        where holder_id = p.id and starts_at > now()),
    'companies', coalesce((select json_agg(json_build_object('id', co.id, 'name', co.legal_name, 'card_name', co.card_name))
                             from public.company_admins ca join public.companies co on co.id = ca.company_id
                            where ca.user_id = p.id), '[]'::json),
    'reminder_days', (public.settings()).renewal_reminder_days[1]);
end $$;

-- Services with the member's remaining quota on the current membership.
create or replace function public.list_services() returns json
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; m public.memberships; live boolean;
begin
  select * into p from public.profiles where id = auth.uid() and role = 'member';
  if not found then return '[]'::json; end if;
  m := public.current_membership(p.id);
  live := m.id is not null and p.is_active;
  return coalesce((
    select json_agg(json_build_object(
      'id', s.id, 'slug', s.slug, 'icon', s.icon,
      'title_ar', s.title_ar, 'title_en', s.title_en, 'summary_ar', s.summary_ar, 'summary_en', s.summary_en,
      'features_ar', s.features_ar, 'features_en', s.features_en, 'how_ar', s.how_ar, 'how_en', s.how_en,
      'message_ar', s.message_ar, 'message_en', s.message_en, 'ask_location', s.ask_location,
      'quota', s.annual_quota, 'quota_label_ar', s.quota_label_ar, 'quota_label_en', s.quota_label_en,
      'used', case when live then (select count(*) from public.service_requests r
                                    where r.membership_id = m.id and r.service_id = s.id and r.status = 'done') else 0 end,
      'email', case when live then s.email end,
      'whatsapp', case when live then s.whatsapp end,
      'has_contact', s.email is not null or s.whatsapp is not null
    ) order by s.sort_order, s.created_at)
    from public.services s where s.is_published), '[]'::json);
end $$;

-- One row per click; the same button within 10 minutes counts once.
create or replace function public.log_service_request(p_service_id uuid, p_channel text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.memberships;
begin
  if p_channel not in ('email', 'whatsapp') then return; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and is_active and role = 'member') then return; end if;
  m := public.current_membership(auth.uid());
  if m.id is null then return; end if;
  if not exists (select 1 from public.services where id = p_service_id and is_published) then return; end if;
  if exists (select 1 from public.service_requests
              where member_id = auth.uid() and service_id = p_service_id and channel = p_channel
                and created_at > now() - interval '10 minutes') then return; end if;
  insert into public.service_requests (service_id, member_id, membership_id, channel)
  values (p_service_id, auth.uid(), m.id, p_channel);
end $$;

-- Accept a personal invite. The signed-in email must be the invited one (the token alone is not enough).
create or replace function public.accept_invite(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  i public.invites;
  c public.contracts;
  seat uuid;
begin
  select * into p from public.profiles where id = uid;
  if not found then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select * into i from public.invites where token = p_token for update;
  if not found then return json_build_object('ok', false, 'error', 'invalid'); end if;
  if i.status = 'accepted' and i.accepted_by = uid then return json_build_object('ok', true, 'already', true); end if;
  if i.status <> 'pending' then return json_build_object('ok', false, 'error', 'used'); end if;
  if lower(i.email) <> lower(p.email) then return json_build_object('ok', false, 'error', 'email_mismatch', 'email', i.email); end if;
  select * into c from public.contracts where id = i.contract_id for update;
  if c.status <> 'active' or c.expires_at <= now() then return json_build_object('ok', false, 'error', 'contract_inactive'); end if;
  if exists (select 1 from public.memberships where contract_id = c.id and holder_id = uid) then
    update public.invites set status = 'accepted', accepted_by = uid, accepted_at = now(), membership_id = null where id = i.id;
    return json_build_object('ok', true, 'already', true);
  end if;

  seat := i.membership_id;
  if seat is null or exists (select 1 from public.memberships where id = seat and holder_id is not null) then
    select m.id into seat from public.memberships m
     where m.contract_id = c.id and m.holder_id is null
       and not exists (select 1 from public.invites x where x.membership_id = m.id and x.status = 'pending' and x.id <> i.id)
     limit 1 for update skip locked;
  end if;
  if seat is null then return json_build_object('ok', false, 'error', 'no_seats'); end if;

  update public.memberships set holder_id = uid where id = seat;
  update public.invites set status = 'accepted', accepted_by = uid, accepted_at = now(), membership_id = seat where id = i.id;
  if p.full_name = '' and i.full_name <> '' then update public.profiles set full_name = i.full_name where id = uid; end if;
  if p.phone = '' and i.phone <> '' then update public.profiles set phone = i.phone where id = uid; end if;
  perform public.queue_seat_activated(uid, c.id);
  return json_build_object('ok', true);
end $$;

-- Join through the company's shared link.
create or replace function public.join_by_link(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  c public.contracts;
  dom text;
  seat uuid;
begin
  select * into p from public.profiles where id = uid;
  if not found then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select * into c from public.contracts where join_token = p_token for update;
  if not found then return json_build_object('ok', false, 'error', 'invalid'); end if;
  if c.status <> 'active' or c.expires_at <= now() then return json_build_object('ok', false, 'error', 'contract_inactive'); end if;
  select email_domain into dom from public.companies where id = c.company_id;
  if dom is not null and split_part(lower(p.email), '@', 2) <> dom then
    return json_build_object('ok', false, 'error', 'domain', 'domain', dom); end if;
  if exists (select 1 from public.memberships where contract_id = c.id and holder_id = uid) then
    return json_build_object('ok', true, 'already', true); end if;
  select m.id into seat from public.memberships m
   where m.contract_id = c.id and m.holder_id is null
     and not exists (select 1 from public.invites x where x.membership_id = m.id and x.status = 'pending')
   limit 1 for update skip locked;
  if seat is null then return json_build_object('ok', false, 'error', 'no_seats'); end if;
  update public.memberships set holder_id = uid where id = seat;
  perform public.queue_seat_activated(uid, c.id);
  return json_build_object('ok', true);
end $$;

create or replace function public.queue_seat_activated(p_user uuid, p_contract uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.email_queue (kind, member_id, to_email, to_name, lang, vars)
  select 'seat_activated', p.id, p.email, p.full_name, p.lang,
         jsonb_build_object('company', co.card_name, 'expires_at', c.expires_at)
    from public.profiles p, public.contracts c join public.companies co on co.id = c.company_id
   where p.id = p_user and c.id = p_contract;
$$;

-- ---------------------------------------------------------------- Company portal
create or replace function public.company_overview(p_company uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare co public.companies; c public.contracts;
begin
  perform public.assert_company_admin(p_company);
  select * into co from public.companies where id = p_company;
  select * into c from public.contracts where company_id = p_company and status <> 'cancelled'
   order by (status = 'active') desc, created_at desc limit 1;
  return json_build_object(
    'company', json_build_object('id', co.id, 'company_no', 'LCB-' || lpad(co.company_no::text, 4, '0'),
       'legal_name', co.legal_name, 'card_name', co.card_name, 'cr_number', co.cr_number, 'vat_number', co.vat_number,
       'city', co.city, 'address', co.address, 'logo_url', co.logo_url, 'email_domain', co.email_domain),
    'contract', case when c.id is null then null else json_build_object(
       'id', c.id, 'status', c.status, 'seats', c.seats, 'starts_at', c.starts_at, 'expires_at', c.expires_at,
       'expired', c.status = 'active' and c.expires_at <= now(), 'join_token', c.join_token,
       'used', (select count(*) from public.memberships where contract_id = c.id and holder_id is not null),
       'reserved', (select count(*) from public.invites where contract_id = c.id and status = 'pending')) end,
    -- Names and status only: what each employee does with the services is private.
    'members', coalesce((select json_agg(json_build_object(
         'membership_id', m.id, 'user_id', pr.id, 'full_name', pr.full_name, 'email', pr.email, 'phone', pr.phone,
         'member_no', public.member_label(pr.member_no), 'assigned_at', m.assigned_at) order by m.assigned_at desc)
       from public.memberships m join public.profiles pr on pr.id = m.holder_id
      where m.contract_id = c.id), '[]'::json),
    'invites', coalesce((select json_agg(json_build_object(
         'id', i.id, 'email', i.email, 'full_name', i.full_name, 'phone', i.phone, 'created_at', i.created_at)
         order by i.created_at desc)
       from public.invites i where i.contract_id = c.id and i.status = 'pending'), '[]'::json),
    'orders', coalesce((select json_agg(json_build_object(
         'id', o.id, 'order_no', o.order_no, 'type', o.type, 'quantity', o.quantity, 'total', o.total,
         'subtotal', o.subtotal, 'vat_amount', o.vat_amount, 'status', o.status, 'method', o.method,
         'payment_url', o.payment_url, 'paid_at', o.paid_at, 'created_at', o.created_at) order by o.created_at desc)
       from public.orders o where o.company_id = p_company and o.status <> 'cancelled'), '[]'::json),
    'admins', coalesce((select json_agg(json_build_object('user_id', pr.id, 'full_name', pr.full_name, 'email', pr.email))
       from public.company_admins ca join public.profiles pr on pr.id = ca.user_id where ca.company_id = p_company), '[]'::json));
end $$;

create or replace function public.company_update(
  p_company uuid, p_card_name text, p_cr_number text, p_vat_number text, p_city text, p_address text, p_email_domain text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_company_admin(p_company);
  update public.companies set
    card_name = left(trim(p_card_name), 40), cr_number = left(trim(coalesce(p_cr_number, '')), 30),
    vat_number = left(trim(coalesce(p_vat_number, '')), 30), city = left(trim(coalesce(p_city, '')), 60),
    address = left(trim(coalesce(p_address, '')), 200),
    email_domain = nullif(lower(trim(coalesce(p_email_domain, ''))), '')
  where id = p_company;
end $$;

-- Invite employees: [{email, full_name, phone}]. Each invite holds a free seat until accepted or revoked.
create or replace function public.company_invite(p_contract uuid, p_people jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  c public.contracts;
  co public.companies;
  inviter public.profiles;
  person jsonb;
  em text;
  seat uuid;
  inv public.invites;
  invited int := 0;
  skipped jsonb := '[]'::jsonb;
begin
  select * into c from public.contracts where id = p_contract for update;
  if not found then raise exception 'contract_not_found'; end if;
  perform public.assert_company_admin(c.company_id);
  if c.status <> 'active' or c.expires_at <= now() then raise exception 'contract_inactive'; end if;
  if jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) > 1000 then raise exception 'bad_list'; end if;
  select * into co from public.companies where id = c.company_id;
  select * into inviter from public.profiles where id = auth.uid();

  for person in select * from jsonb_array_elements(p_people) loop
    em := lower(trim(coalesce(person->>'email', '')));
    if em !~ '^[^\s@]+@[^\s@]+\.[a-z]{2,}$' then
      skipped := skipped || jsonb_build_object('email', em, 'reason', 'invalid_email'); continue; end if;
    if exists (select 1 from public.invites where contract_id = c.id and lower(email) = em and status = 'pending') then
      skipped := skipped || jsonb_build_object('email', em, 'reason', 'already_invited'); continue; end if;
    if exists (select 1 from public.memberships m join public.profiles pr on pr.id = m.holder_id
                where m.contract_id = c.id and lower(pr.email) = em) then
      skipped := skipped || jsonb_build_object('email', em, 'reason', 'already_member'); continue; end if;

    select m.id into seat from public.memberships m
     where m.contract_id = c.id and m.holder_id is null
       and not exists (select 1 from public.invites x where x.membership_id = m.id and x.status = 'pending')
     limit 1;
    if seat is null then
      skipped := skipped || jsonb_build_object('email', em, 'reason', 'no_seats'); continue; end if;

    insert into public.invites (contract_id, membership_id, email, full_name, phone, invited_by)
    values (c.id, seat, em, left(trim(coalesce(person->>'full_name', '')), 120), left(trim(coalesce(person->>'phone', '')), 30), auth.uid())
    returning * into inv;
    insert into public.email_queue (kind, to_email, to_name, vars)
    values ('invite', em, nullif(inv.full_name, ''),
      jsonb_build_object('company', co.card_name, 'inviter', coalesce(inviter.full_name, ''), 'token', inv.token,
                         'expires_at', c.expires_at));
    invited := invited + 1;
  end loop;
  return json_build_object('invited', invited, 'skipped', skipped);
end $$;

create or replace function public.company_revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select c.company_id into cid from public.invites i join public.contracts c on c.id = i.contract_id where i.id = p_invite;
  if cid is null then raise exception 'not_found'; end if;
  perform public.assert_company_admin(cid);
  update public.invites set status = 'revoked', membership_id = null where id = p_invite and status = 'pending';
end $$;

create or replace function public.company_resend_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i public.invites; c public.contracts; co public.companies; inviter text;
begin
  select * into i from public.invites where id = p_invite and status = 'pending';
  if not found then raise exception 'not_found'; end if;
  select * into c from public.contracts where id = i.contract_id;
  perform public.assert_company_admin(c.company_id);
  if exists (select 1 from public.email_queue where kind = 'invite' and vars->>'token' = i.token
              and created_at > now() - interval '10 minutes') then raise exception 'too_soon'; end if;
  select * into co from public.companies where id = c.company_id;
  select full_name into inviter from public.profiles where id = auth.uid();
  insert into public.email_queue (kind, to_email, to_name, vars)
  values ('invite', i.email, nullif(i.full_name, ''),
    jsonb_build_object('company', co.card_name, 'inviter', coalesce(inviter, ''), 'token', i.token, 'expires_at', c.expires_at));
end $$;

-- Free a seat (employee left); it can be given to someone else.
create or replace function public.company_release_seat(p_membership uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.memberships; c public.contracts; co public.companies;
begin
  select * into m from public.memberships where id = p_membership for update;
  if not found or m.contract_id is null then raise exception 'not_found'; end if;
  select * into c from public.contracts where id = m.contract_id;
  perform public.assert_company_admin(c.company_id);
  if m.holder_id is null then return; end if;
  select * into co from public.companies where id = c.company_id;
  insert into public.email_queue (kind, member_id, to_email, to_name, lang, vars)
  select 'seat_released', p.id, p.email, p.full_name, p.lang, jsonb_build_object('company', co.card_name)
    from public.profiles p where p.id = m.holder_id;
  update public.memberships set holder_id = null where id = m.id;
  update public.invites set membership_id = null where membership_id = m.id and status = 'accepted';
end $$;

create or replace function public.company_set_join_link(p_contract uuid, p_on boolean) returns text
language plpgsql security definer set search_path = public as $$
declare c public.contracts; tok text;
begin
  select * into c from public.contracts where id = p_contract;
  if not found then raise exception 'not_found'; end if;
  perform public.assert_company_admin(c.company_id);
  tok := case when p_on then public.gen_code(20) end;
  update public.contracts set join_token = tok where id = c.id;
  return tok;
end $$;

-- ---------------------------------------------------------------- Admin
create or replace function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
declare result json; month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh';
begin
  perform public.assert_admin();
  select json_build_object(
    'members_total',   (select count(*) from public.profiles where role = 'member'),
    'active_individual', (select count(distinct holder_id) from public.memberships m where m.kind = 'individual' and public.membership_live(m)),
    'active_corporate',  (select count(distinct holder_id) from public.memberships m where m.kind = 'corporate' and public.membership_live(m)),
    'unpaid',          (select count(*) from public.profiles p where p.role = 'member' and p.signup_kind = 'individual'
                          and not exists (select 1 from public.memberships m where m.holder_id = p.id)),
    'expiring_30',     (select count(*) from public.profiles p where p.role = 'member'
                          and (public.current_membership(p.id)).expires_at <= now() + interval '30 days'),
    'companies',       (select count(*) from public.companies),
    'seats_total',     (select coalesce(sum(seats), 0) from public.contracts where status = 'active' and expires_at > now()),
    'seats_used',      (select count(*) from public.memberships m where m.kind = 'corporate' and public.membership_live(m)),
    'quotes_open',     (select count(*) from public.orders where status = 'quote'),
    'revenue_month',   (select coalesce(sum(total), 0) from public.orders where status = 'paid' and paid_at >= month_start),
    'revenue_total',   (select coalesce(sum(total), 0) from public.orders where status = 'paid'),
    'requests_open',   (select count(*) from public.service_requests where status = 'requested'),
    'emails_pending',  (select count(*) from public.email_queue where status = 'pending')
  ) into result;
  return result;
end $$;

create or replace function public.admin_set_active(p_member uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.profiles set is_active = p_active where id = p_member;
end $$;

-- A complimentary or offline individual year (no payment through the site).
create or replace function public.admin_grant_membership(p_member uuid, p_days int, p_note text default null)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare start_at timestamptz; new_expiry timestamptz;
begin
  perform public.assert_admin();
  if p_days not between 1 and 3650 then raise exception 'bad_days'; end if;
  select greatest(now(), coalesce(max(expires_at), now())) into start_at
    from public.memberships where holder_id = p_member and kind = 'individual' and expires_at > now();
  insert into public.memberships (kind, holder_id, starts_at, expires_at)
  values ('individual', p_member, start_at, start_at + make_interval(days => p_days))
  returning expires_at into new_expiry;
  if p_note is not null and trim(p_note) <> '' then
    perform public.admin_save_note('member', p_member,
      coalesce((select body from public.admin_notes where entity_type = 'member' and entity_id = p_member) || E'\n', '')
      || to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD') || ': ' || trim(p_note));
  end if;
  return new_expiry;
end $$;

create or replace function public.admin_save_note(p_type text, p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  insert into public.admin_notes (entity_type, entity_id, body, updated_by) values (p_type, p_id, coalesce(p_body, ''), auth.uid())
  on conflict (entity_type, entity_id) do update set body = excluded.body, updated_at = now(), updated_by = auth.uid();
end $$;

-- Set the price of a company quote (custom offer); it becomes payable.
create or replace function public.admin_price_quote(p_order uuid, p_quantity int, p_unit_price numeric, p_notes text default null)
returns json language plpgsql security definer set search_path = public as $$
declare o public.orders; vat numeric := (public.settings()).vat_rate; v_total numeric; v_sub numeric;
begin
  perform public.assert_admin();
  select * into o from public.orders where id = p_order for update;
  if not found or o.status not in ('quote', 'pending') or o.type = 'individual' then raise exception 'not_editable'; end if;
  if p_quantity < 1 or p_unit_price <= 0 then raise exception 'bad_values'; end if;
  v_total := round(p_unit_price * p_quantity * o.period_factor, 2);
  v_sub := round(v_total / (1 + vat), 2);
  update public.orders set quantity = p_quantity, unit_price = round(p_unit_price, 2),
         discount_pct = round(greatest(0, 100 * (1 - p_unit_price / (public.settings()).price_individual)), 2),
         total = v_total, subtotal = v_sub, vat_amount = v_total - v_sub, status = 'pending',
         mf_invoice_id = null, payment_url = null, notes = coalesce(p_notes, notes)
   where id = o.id returning * into o;
  return json_build_object('id', o.id, 'total', o.total);
end $$;

-- Admin creates a company (and its admin account must already exist, e.g. registered as business).
create or replace function public.admin_add_company_admin(p_company uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  perform public.assert_admin();
  select id into uid from public.profiles where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'user_not_found'; end if;
  insert into public.company_admins (company_id, user_id) values (p_company, uid) on conflict do nothing;
end $$;

create or replace function public.admin_set_request(p_request uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  if p_status not in ('requested', 'done', 'cancelled') then raise exception 'bad_status'; end if;
  update public.service_requests set status = p_status, note = coalesce(p_note, note),
         done_at = case when p_status = 'done' then coalesce(done_at, now()) end,
         done_by = case when p_status = 'done' then coalesce(done_by, auth.uid()) end
   where id = p_request;
end $$;

-- A service delivered outside the site (phone call): recorded as done on the current membership.
create or replace function public.admin_record_service(p_member uuid, p_service uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare m public.memberships; rid uuid;
begin
  perform public.assert_admin();
  m := public.current_membership(p_member);
  if m.id is null then raise exception 'no_membership'; end if;
  insert into public.service_requests (service_id, member_id, membership_id, channel, status, note, done_at, done_by)
  values (p_service, p_member, m.id, 'admin', 'done', p_note, now(), auth.uid()) returning id into rid;
  return rid;
end $$;

create or replace function public.admin_create_campaign(p_subject text, p_body_html text, p_audience text, p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; n int;
begin
  perform public.assert_admin();
  insert into public.email_campaigns (subject, body_html, audience, created_by)
  values (p_subject, p_body_html, p_audience, auth.uid()) returning id into cid;
  insert into public.email_queue (campaign_id, kind, member_id, to_email, to_name, lang, subject, body_html)
  select cid, 'campaign', p.id, p.email, p.full_name, p.lang, p_subject, p_body_html
    from public.profiles p where p.id = any(p_member_ids);
  get diagnostics n = row_count;
  update public.email_campaigns set total = n, status = case when n = 0 then 'done' else 'queued' end where id = cid;
  return cid;
end $$;

-- ---------------------------------------------------------------- Scheduled (mail worker, service role)
create or replace function public.queue_daily_notices() returns json
language plpgsql security definer set search_path = public as $$
declare
  s public.app_settings := public.settings();
  d int;
  k int;
  renew int := 0; expired int := 0; company int := 0; unpaid int := 0; stale int := 0;
begin
  -- Individuals: a reminder on each configured day before the end of their last year.
  foreach d in array s.renewal_reminder_days loop
    insert into public.email_queue (kind, member_id, to_email, to_name, lang, vars)
    select 'renewal_reminder', p.id, p.email, p.full_name, p.lang,
           jsonb_build_object('expires_at', m.expires_at, 'days', d::text)
      from public.profiles p
      join lateral (select max(expires_at) as expires_at from public.memberships
                     where holder_id = p.id and kind = 'individual') m on true
     where p.role = 'member' and p.is_active and m.expires_at is not null
       and m.expires_at > now() and m.expires_at <= now() + make_interval(days => d)
       and m.expires_at > now() + make_interval(days => d - 1)
       and not exists (select 1 from public.email_queue q where q.member_id = p.id and q.kind = 'renewal_reminder'
                         and q.vars->>'days' = d::text and q.vars->>'expires_at' = to_jsonb(m.expires_at) #>> '{}');
    get diagnostics k = row_count; renew := renew + k;
  end loop;

  insert into public.email_queue (kind, member_id, to_email, to_name, lang, vars)
  select 'expired', p.id, p.email, p.full_name, p.lang, jsonb_build_object('expires_at', m.expires_at)
    from public.profiles p
    join lateral (select max(expires_at) as expires_at from public.memberships
                   where holder_id = p.id and kind = 'individual') m on true
   where p.role = 'member' and p.is_active
     and m.expires_at <= now() and m.expires_at > now() - interval '7 days'
     and (public.current_membership(p.id)).id is null
     and not exists (select 1 from public.email_queue q where q.member_id = p.id and q.kind = 'expired'
                       and q.vars->>'expires_at' = to_jsonb(m.expires_at) #>> '{}');
  get diagnostics expired = row_count;

  -- Company contracts: their admins, 30 and 7 days before.
  foreach d in array array[30, 7] loop
    insert into public.email_queue (kind, member_id, to_email, to_name, lang, vars)
    select 'company_renewal', p.id, p.email, p.full_name, p.lang,
           jsonb_build_object('company', co.legal_name, 'expires_at', c.expires_at, 'days', d::text, 'seats', c.seats::text)
      from public.contracts c
      join public.companies co on co.id = c.company_id
      join public.company_admins ca on ca.company_id = co.id
      join public.profiles p on p.id = ca.user_id
     where c.status = 'active' and c.expires_at > now() + make_interval(days => d - 1)
       and c.expires_at <= now() + make_interval(days => d)
       and not exists (select 1 from public.email_queue q where q.member_id = p.id and q.kind = 'company_renewal'
                         and q.vars->>'days' = d::text and q.vars->>'expires_at' = to_jsonb(c.expires_at) #>> '{}');
    get diagnostics k = row_count; company := company + k;
  end loop;

  -- Signed up but never paid: one reminder after a day, one after three.
  insert into public.email_queue (kind, member_id, to_email, to_name, lang, vars)
  select 'unpaid_reminder', p.id, p.email, p.full_name, p.lang, jsonb_build_object('step', x.step::text)
    from public.profiles p
    join auth.users u on u.id = p.id and u.email_confirmed_at is not null
    cross join (values (1), (3)) x(step)
   where p.role = 'member' and p.is_active and p.signup_kind = 'individual'
     and p.created_at <= now() - make_interval(days => x.step)
     and p.created_at > now() - make_interval(days => x.step + 2)
     and not exists (select 1 from public.memberships m where m.holder_id = p.id)
     and not exists (select 1 from public.email_queue q where q.member_id = p.id and q.kind = 'unpaid_reminder'
                       and q.vars->>'step' = x.step::text);
  get diagnostics unpaid = row_count;

  -- Unpaid online orders older than 3 days are closed (a fresh one is made at checkout).
  update public.orders set status = 'cancelled'
   where status = 'pending' and paid_at is null and created_at < now() - interval '3 days' and method is distinct from 'bank_transfer';
  get diagnostics stale = row_count;

  return json_build_object('renewal', renew, 'expired', expired, 'company', company, 'unpaid', unpaid, 'stale_orders', stale);
end $$;

-- ---------------------------------------------------------------- Grants
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.public_pricing()                                   to anon, authenticated;
grant execute on function public.get_member_card(text)                              to anon, authenticated;
grant execute on function public.check_invite(text)                                 to anon, authenticated;
grant execute on function public.check_join_link(text)                              to anon, authenticated;
grant execute on function public.quote_price(text, int, uuid)                       to anon, authenticated;
grant execute on function public.member_label(int)                                  to anon, authenticated;

grant execute on function public.is_admin()                                         to authenticated;
grant execute on function public.is_company_admin(uuid)                             to authenticated;
grant execute on function public.membership_live(public.memberships)                to authenticated;
grant execute on function public.current_membership(uuid)                           to authenticated;
grant execute on function public.profile_status(public.profiles)                    to authenticated;
grant execute on function public.create_order(text, int, uuid, uuid, boolean)       to authenticated;
grant execute on function public.my_account()                                       to authenticated;
grant execute on function public.list_services()                                    to authenticated;
grant execute on function public.log_service_request(uuid, text)                    to authenticated;
grant execute on function public.accept_invite(text)                                to authenticated;
grant execute on function public.join_by_link(text)                                 to authenticated;
grant execute on function public.company_overview(uuid)                             to authenticated;
grant execute on function public.company_update(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.company_invite(uuid, jsonb)                        to authenticated;
grant execute on function public.company_revoke_invite(uuid)                        to authenticated;
grant execute on function public.company_resend_invite(uuid)                        to authenticated;
grant execute on function public.company_release_seat(uuid)                         to authenticated;
grant execute on function public.company_set_join_link(uuid, boolean)               to authenticated;
grant execute on function public.activate_order(uuid, text, text)                   to authenticated, service_role;
grant execute on function public.admin_stats()                                      to authenticated;
grant execute on function public.admin_set_active(uuid, boolean)                    to authenticated;
grant execute on function public.admin_grant_membership(uuid, int, text)            to authenticated;
grant execute on function public.admin_save_note(text, uuid, text)                  to authenticated;
grant execute on function public.admin_price_quote(uuid, int, numeric, text)        to authenticated;
grant execute on function public.admin_add_company_admin(uuid, text)                to authenticated;
grant execute on function public.admin_set_request(uuid, text, text)                to authenticated;
grant execute on function public.admin_record_service(uuid, uuid, text)            to authenticated;
grant execute on function public.admin_create_campaign(text, text, text, uuid[])    to authenticated;

grant execute on function public.gen_code(int)                                      to service_role;
grant execute on function public.queue_daily_notices()                              to service_role;
grant execute on function public.settings()                                         to service_role;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
