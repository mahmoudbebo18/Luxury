-- Admin panel additions: company adjustments, offline company orders, sending a quote's payment link,
-- recording a refund. Every function starts with assert_admin() (see CLAUDE.md: security definer).

-- ---------------------------------------------------------------- Companies
-- Free seats and/or extra days on the active contract (compensation or an offline agreement).
create or replace function public.admin_company_adjust(p_company uuid, p_add_seats int, p_add_days int, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare c public.contracts;
begin
  perform public.assert_admin();
  p_add_seats := coalesce(p_add_seats, 0);
  p_add_days := coalesce(p_add_days, 0);
  if p_add_seats not between 0 and 1000 or p_add_days not between 0 and 3650 or (p_add_seats = 0 and p_add_days = 0) then
    raise exception 'bad_values'; end if;
  select * into c from public.contracts
   where company_id = p_company and status = 'active' and expires_at > now()
   order by created_at desc limit 1 for update;
  if not found then raise exception 'contract_inactive'; end if;

  if p_add_days > 0 then
    update public.contracts set expires_at = expires_at + make_interval(days => p_add_days) where id = c.id returning * into c;
    update public.memberships set expires_at = c.expires_at where contract_id = c.id;
  end if;
  if p_add_seats > 0 then
    update public.contracts set seats = seats + p_add_seats where id = c.id returning * into c;
    insert into public.memberships (kind, contract_id, starts_at, expires_at)
    select 'corporate', c.id, now(), c.expires_at from generate_series(1, p_add_seats);
  end if;

  perform public.admin_save_note('company', p_company,
    coalesce((select body || E'\n' from public.admin_notes where entity_type = 'company' and entity_id = p_company), '')
    || to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD') || ': '
    || concat_ws('، ', case when p_add_seats > 0 then '+' || p_add_seats || ' مقعد' end,
                        case when p_add_days > 0 then '+' || p_add_days || ' يوم' end)
    || coalesce(' (' || nullif(trim(p_note), '') || ')', ''));
  return json_build_object('seats', c.seats, 'expires_at', c.expires_at);
end $$;

-- An order the club prepares for a company (offline deal): new contract, extra seats or renewal,
-- at a price the admin sets. It is then paid by link or recorded as a bank transfer.
create or replace function public.admin_create_company_order(p_company uuid, p_type text, p_quantity int, p_unit_price numeric, p_notes text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  c public.contracts;
  payer uuid;
  q json;
  v_total numeric;
  v_sub numeric;
  vat numeric := (public.settings()).vat_rate;
  o public.orders;
begin
  perform public.assert_admin();
  if p_type not in ('company_new', 'company_add_seats', 'company_renew') then raise exception 'bad_type'; end if;
  if coalesce(p_quantity, 0) < 1 or coalesce(p_unit_price, 0) <= 0 then raise exception 'bad_values'; end if;
  select user_id into payer from public.company_admins where company_id = p_company order by created_at limit 1;
  if payer is null then raise exception 'no_company_admin'; end if;

  if p_type = 'company_new' then
    if exists (select 1 from public.contracts where company_id = p_company and status = 'active' and expires_at > now()) then
      raise exception 'contract_exists'; end if;
    select * into c from public.contracts where company_id = p_company and status = 'pending' order by created_at desc limit 1;
    if c.id is null then insert into public.contracts (company_id) values (p_company) returning * into c; end if;
  else
    select * into c from public.contracts where company_id = p_company and status = 'active' order by created_at desc limit 1;
    if c.id is null then raise exception 'contract_not_found'; end if;
    if p_type = 'company_renew' and p_quantity < c.seats then raise exception 'renew_fewer_seats' using detail = c.seats::text; end if;
  end if;

  -- The period factor (remaining months for added seats) still comes from quote_price.
  q := public.quote_price(p_type, p_quantity, c.id);
  v_total := round(p_unit_price * p_quantity * (q->>'period_factor')::numeric, 2);
  v_sub := round(v_total / (1 + vat), 2);

  update public.orders set status = 'cancelled'
   where company_id = p_company and type = p_type and status in ('pending', 'quote') and paid_at is null;

  insert into public.orders (type, user_id, company_id, contract_id, quantity, unit_price, discount_pct, period_factor,
                             total, subtotal, vat_amount, status, terms_version, notes, created_by)
  values (p_type, payer, p_company, c.id, p_quantity, round(p_unit_price, 2),
          round(greatest(0, 100 * (1 - p_unit_price / (public.settings()).price_individual)), 2),
          (q->>'period_factor')::numeric, v_total, v_sub, v_total - v_sub, 'pending',
          (public.settings()).terms_version, nullif(trim(coalesce(p_notes, '')), ''), auth.uid())
  returning * into o;
  return json_build_object('id', o.id, 'order_no', o.order_no, 'total', o.total);
end $$;

-- ---------------------------------------------------------------- Orders
-- After the payment link exists (create-payment), email it to the company contact.
create or replace function public.admin_send_payment_link(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders; p public.profiles; co public.companies;
begin
  perform public.assert_admin();
  select * into o from public.orders where id = p_order;
  if not found or o.status <> 'pending' or o.payment_url is null then raise exception 'no_link'; end if;
  select * into p from public.profiles where id = o.user_id;
  if p.id is null then raise exception 'no_payer'; end if;
  select * into co from public.companies where id = o.company_id;
  insert into public.email_queue (kind, member_id, to_email, to_name, lang, vars)
  values ('payment_link', p.id, p.email, p.full_name, p.lang,
    jsonb_build_object('order_no', o.order_no, 'order_type', o.type, 'quantity', o.quantity::text,
      'total', o.total::text, 'company', coalesce(co.legal_name, ''), 'payment_url', o.payment_url));
end $$;

-- A refund is made in the MyFatoorah portal (or by bank); this records it. An individual year bought
-- by the order ends now; company seats are adjusted by hand if needed.
create or replace function public.admin_mark_refunded(p_order uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  perform public.assert_admin();
  select * into o from public.orders where id = p_order for update;
  if not found or o.status <> 'paid' then raise exception 'not_refundable'; end if;
  update public.orders set status = 'refunded',
         notes = concat_ws(E'\n', notes, to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD') || ': استرجاع'
                          || coalesce(' (' || nullif(trim(p_note), '') || ')', ''))
   where id = o.id;
  if o.type = 'individual' then
    -- a year not started yet is removed; the running one ends now
    delete from public.memberships where order_id = o.id and starts_at > now();
    update public.memberships set expires_at = greatest(starts_at + interval '1 second', now())
     where order_id = o.id and expires_at > now();
  end if;
end $$;

-- ---------------------------------------------------------------- Email template
insert into public.email_templates (kind, label, subject, body_html, subject_en, body_html_en) values
('payment_link', 'رابط الدفع (عرض سعر)', 'عرض السعر جاهز: {{order_no}}',
 '<p>مرحبًا {{name}}،</p>
<p>جهّزنا عرض السعر لـ<strong>{{company}}</strong>:</p>
<table class="receipt"><tr><td>رقم الطلب</td><td>{{order_no}}</td></tr><tr><td>النوع</td><td>{{order_type_label}}</td></tr><tr><td>العدد</td><td>{{quantity}}</td></tr><tr><td>الإجمالي شامل الضريبة</td><td>{{total}} ريال</td></tr></table>
<p><a class="btn" href="{{payment_url}}">ادفع الآن</a></p>
<p>تستطيع الدفع أيضًا من لوحة شركتك. وللتحويل البنكي رد على هذه الرسالة.</p>',
 'Your quote is ready: {{order_no}}',
 '<p>Hello {{name}},</p>
<p>Your quote for <strong>{{company}}</strong> is ready:</p>
<table class="receipt"><tr><td>Order</td><td>{{order_no}}</td></tr><tr><td>Type</td><td>{{order_type_label}}</td></tr><tr><td>Quantity</td><td>{{quantity}}</td></tr><tr><td>Total incl. VAT</td><td>SAR {{total}}</td></tr></table>
<p><a class="btn" href="{{payment_url}}">Pay now</a></p>
<p>You can also pay from your company dashboard. For a bank transfer, reply to this email.</p>')
on conflict (kind) do nothing;

-- ---------------------------------------------------------------- Grants
revoke execute on function public.admin_company_adjust(uuid, int, int, text) from public, anon;
revoke execute on function public.admin_create_company_order(uuid, text, int, numeric, text) from public, anon;
revoke execute on function public.admin_send_payment_link(uuid) from public, anon;
revoke execute on function public.admin_mark_refunded(uuid, text) from public, anon;
grant execute on function public.admin_company_adjust(uuid, int, int, text)             to authenticated;
grant execute on function public.admin_create_company_order(uuid, text, int, numeric, text) to authenticated;
grant execute on function public.admin_send_payment_link(uuid)                          to authenticated;
grant execute on function public.admin_mark_refunded(uuid, text)                        to authenticated;
