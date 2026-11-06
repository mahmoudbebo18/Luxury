-- Member account area: seller details for the printable receipt, and the member's own service log.

-- Seller details are printed on every receipt, so they are public like the price.
create or replace function public.public_pricing() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'price_individual', s.price_individual, 'vat_rate', s.vat_rate, 'company_tiers', s.company_tiers,
    'company_min_seats', s.company_min_seats, 'company_online_max', s.company_online_max,
    'bank_transfer', s.bank_transfer, 'terms_version', s.terms_version,
    'seller_name', s.seller_name, 'seller_cr', s.seller_cr, 'seller_vat', s.seller_vat,
    'seller_address', s.seller_address)
  from public.app_settings s where s.id = 1;
$$;

-- The member's own service requests (newest first). Only the caller's rows, and never the admin
-- note; a company admin gets nothing about employees here (legal confidentiality).
create or replace function public.my_service_requests() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', r.id, 'status', r.status, 'channel', r.channel, 'created_at', r.created_at, 'done_at', r.done_at,
    'service_id', s.id, 'icon', s.icon, 'title_ar', s.title_ar, 'title_en', s.title_en
  ) order by r.created_at desc), '[]'::json)
  from public.service_requests r
  join public.services s on s.id = r.service_id
  where r.member_id = auth.uid();
$$;

revoke execute on function public.my_service_requests() from public, anon;
grant execute on function public.my_service_requests() to authenticated;
