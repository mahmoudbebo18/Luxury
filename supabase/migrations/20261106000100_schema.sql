-- The Luxury Club platform: tables (luxury-plan.md section 6).
--
-- Model in one paragraph: a person has a profile. Membership time lives in `memberships`, one row
-- per paid period: an individual year, or one seat of a company contract. A company buys a
-- `contract` (N seats, one end date for all); each seat is a `memberships` row whose holder is set
-- when an employee accepts an `invite`. Money goes through `orders` (one per payment), and
-- `activate_order()` is the only thing that turns a paid order into membership time.

create extension if not exists pgcrypto with schema extensions;

-- Random base62 code: QR links, invite tokens.
create or replace function public.gen_code(len int) returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  chars text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  result text := '';
  b bytea := gen_random_bytes(len);
begin
  for i in 0..len - 1 loop
    result := result || substr(chars, (get_byte(b, i) % 62) + 1, 1);
  end loop;
  return result;
end $$;

-- ---------------------------------------------------------------- Settings
create table public.app_settings (
  id                   int primary key default 1 check (id = 1),
  -- pricing (VAT inclusive)
  price_individual     numeric(10,2) not null default 699 check (price_individual > 0),
  vat_rate             numeric(5,4)  not null default 0.15 check (vat_rate between 0 and 1),
  -- company price tiers: [{"min": 1, "discount": 0}, {"min": 25, "discount": 10}, ...] (discount in %)
  company_tiers        jsonb not null default '[{"min": 1, "discount": 0}]'::jsonb,
  company_min_seats    int not null default 5   check (company_min_seats between 1 and 1000),
  company_online_max   int not null default 50  check (company_online_max between 1 and 100000),
  bank_transfer        boolean not null default true,
  bank_details         text not null default '',
  -- reminders
  renewal_reminder_days int[] not null default '{30,7,1}',
  -- mail
  sender_name          text not null default 'The Luxury Club',
  sender_email         text not null default 'info@the-luxury-club.com',
  reply_to             text not null default 'info@the-luxury-club.com',
  notify_email         text not null default 'info@the-luxury-club.com',
  site_url             text not null default 'https://the-luxury-club.com',
  -- legal: bumped when the terms page is published; stored on each sign-up and order
  terms_version        int not null default 1,
  -- seller details printed on receipts
  seller_name          text not null default 'مؤسسة المسيلة لخدمات الأعمال',
  seller_cr            text not null default '',
  seller_vat           text not null default '',
  seller_address       text not null default 'مركز الجوهرة المكتبي، العليا، الرياض'
);
insert into public.app_settings default values;

-- ---------------------------------------------------------------- People
create sequence public.member_no_seq start 1;

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  member_no     int unique,                               -- given with the first membership (LC-00001)
  member_code   text unique not null default public.gen_code(10),   -- QR / verification link
  full_name     text not null default '',
  phone         text not null default '',
  email         text not null,
  city          text not null default '',
  lang          text not null default 'ar' check (lang in ('ar', 'en')),
  signup_kind   text not null default 'individual' check (signup_kind in ('individual', 'business', 'invite')),
  role          text not null default 'member' check (role in ('member', 'admin')),
  is_active     boolean not null default true,            -- manual suspension by admin
  terms_version int,
  created_at    timestamptz not null default now()
);
alter sequence public.member_no_seq owned by public.profiles.member_no;

-- Private admin notes on a member or a company (kept out of the rows members can read).
create table public.admin_notes (
  entity_type   text not null check (entity_type in ('member', 'company')),
  entity_id     uuid not null,
  body          text not null default '' check (length(body) <= 4000),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id) on delete set null,
  primary key (entity_type, entity_id)
);

-- ---------------------------------------------------------------- Companies
create sequence public.company_no_seq start 1;

create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  company_no    int unique not null default nextval('public.company_no_seq'),   -- LCB-0001
  legal_name    text not null check (length(trim(legal_name)) between 2 and 160),
  card_name     text not null check (length(trim(card_name)) between 2 and 40),  -- printed on employee cards
  cr_number     text not null default '',
  vat_number    text not null default '',
  city          text not null default '',
  address       text not null default '',
  logo_url      text,
  email_domain  text check (email_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),         -- optional: join link only for @domain
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
alter sequence public.company_no_seq owned by public.companies.company_no;

create table public.company_admins (
  company_id    uuid not null references public.companies(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_admins_user_idx on public.company_admins (user_id);

-- A company's purchase: N seats, all ending on the same date.
create table public.contracts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  seats         int not null default 0 check (seats >= 0),
  starts_at     timestamptz,
  expires_at    timestamptz,
  status        text not null default 'pending' check (status in ('pending', 'active', 'cancelled')),
  join_token    text unique,                              -- shared join link; null = off
  created_at    timestamptz not null default now()
);
create index contracts_company_idx on public.contracts (company_id, created_at desc);

-- ---------------------------------------------------------------- Membership time
create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('individual', 'corporate')),
  holder_id     uuid references public.profiles(id) on delete set null,   -- null = free company seat
  contract_id   uuid references public.contracts(id) on delete cascade,
  order_id      uuid,                                                      -- fk added below
  starts_at     timestamptz not null default now(),
  expires_at    timestamptz not null,
  assigned_at   timestamptz,
  created_at    timestamptz not null default now(),
  check ((kind = 'corporate') = (contract_id is not null)),
  check (kind = 'corporate' or holder_id is not null),
  check (expires_at > starts_at)
);
create index memberships_holder_idx on public.memberships (holder_id, expires_at desc);
create index memberships_contract_idx on public.memberships (contract_id) where contract_id is not null;

-- Who held a company seat and when (a seat can move to another employee).
create table public.seat_history (
  id            bigserial primary key,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  holder_id     uuid references public.profiles(id) on delete set null,
  assigned_at   timestamptz not null,
  released_at   timestamptz,
  released_by   uuid references public.profiles(id) on delete set null
);
create index seat_history_membership_idx on public.seat_history (membership_id);

create table public.invites (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null references public.contracts(id) on delete cascade,
  membership_id uuid references public.memberships(id) on delete set null,  -- the seat held for this invite
  email         text not null check (email ~* '^[^\s@]+@[^\s@]+\.[a-z]{2,}$'),
  full_name     text not null default '',
  phone         text not null default '',
  token         text unique not null default public.gen_code(24),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by    uuid references public.profiles(id) on delete set null,
  accepted_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz
);
create unique index invites_pending_email_idx on public.invites (contract_id, lower(email)) where status = 'pending';
create index invites_token_idx on public.invites (token);

-- ---------------------------------------------------------------- Money
create sequence public.order_no_seq start 1;

create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text unique not null
                 default 'LC-' || to_char(now() at time zone 'Asia/Riyadh', 'YYYY') || '-' || lpad(nextval('public.order_no_seq')::text, 5, '0'),
  type           text not null check (type in ('individual', 'company_new', 'company_add_seats', 'company_renew')),
  user_id        uuid references public.profiles(id) on delete set null,     -- who pays / requested
  company_id     uuid references public.companies(id) on delete set null,
  contract_id    uuid references public.contracts(id) on delete set null,
  quantity       int not null default 1 check (quantity >= 1),
  unit_price     numeric(10,2) not null,                                      -- VAT inclusive, after discount
  discount_pct   numeric(5,2) not null default 0,
  period_factor  numeric(6,4) not null default 1,                             -- months left / 12 for added seats
  total          numeric(12,2) not null,                                      -- VAT inclusive
  subtotal       numeric(12,2) not null,
  vat_amount     numeric(12,2) not null,
  currency       text not null default 'SAR',
  -- quote: a company asked for an offer (no payment link yet)
  status         text not null default 'pending'
                 check (status in ('quote', 'pending', 'paid', 'failed', 'cancelled', 'refunded')),
  method         text check (method in ('myfatoorah', 'bank_transfer', 'manual')),
  terms_version  int,
  mf_invoice_id  text,
  mf_payment_id  text,
  payment_url    text,
  paid_at        timestamptz,
  notes          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter sequence public.order_no_seq owned by public.orders.order_no;
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_company_idx on public.orders (company_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create unique index orders_mf_invoice_idx on public.orders (mf_invoice_id) where mf_invoice_id is not null;

alter table public.memberships add constraint memberships_order_fk
  foreign key (order_id) references public.orders(id) on delete set null;

-- Every webhook / status check exactly as received, for audit and de-duplication.
create table public.payment_events (
  id            bigserial primary key,
  source        text not null,                            -- webhook | callback | admin
  reference     text unique,
  order_id      uuid references public.orders(id) on delete set null,
  payload       jsonb not null,
  received_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- Services
create table public.services (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  sort_order     int not null default 0,
  icon           text not null default 'sparkle' check (icon in ('legal', 'roadside', 'passport', 'shield', 'sparkle', 'phone', 'car')),
  title_ar       text not null check (length(trim(title_ar)) between 2 and 80),
  title_en       text not null default '' check (length(title_en) <= 80),
  summary_ar     text not null default '' check (length(summary_ar) <= 600),
  summary_en     text not null default '' check (length(summary_en) <= 600),
  features_ar    text[] not null default '{}' check (cardinality(features_ar) <= 12),
  features_en    text[] not null default '{}' check (cardinality(features_en) <= 12),
  how_ar         text not null default '' check (length(how_ar) <= 600),
  how_en         text not null default '' check (length(how_en) <= 600),
  message_ar     text not null default '' check (length(message_ar) <= 500),
  message_en     text not null default '' check (length(message_en) <= 500),
  annual_quota   int check (annual_quota between 1 and 1000),             -- null = no limit
  quota_label_ar text not null default '' check (length(quota_label_ar) <= 60),   -- e.g. "استشارة"
  quota_label_en text not null default '' check (length(quota_label_en) <= 60),
  email          text check (email ~* '^[^\s@]+@[^\s@]+\.[a-z]{2,}$'),
  whatsapp       text check (whatsapp ~ '^[1-9][0-9]{9,14}$'),
  ask_location   boolean not null default false,
  is_published   boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- A click on a request button (requested) that the team later marks done; done rows use the quota.
create table public.service_requests (
  id             uuid primary key default gen_random_uuid(),
  service_id     uuid not null references public.services(id) on delete cascade,
  member_id      uuid not null references public.profiles(id) on delete cascade,
  membership_id  uuid references public.memberships(id) on delete set null,
  channel        text not null check (channel in ('email', 'whatsapp', 'admin')),
  status         text not null default 'requested' check (status in ('requested', 'done', 'cancelled')),
  note           text check (length(note) <= 500),                         -- admin only
  done_at        timestamptz,
  done_by        uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index service_requests_service_idx on public.service_requests (service_id, created_at desc);
create index service_requests_member_idx on public.service_requests (member_id, created_at desc);
create index service_requests_membership_idx on public.service_requests (membership_id, status);

-- ---------------------------------------------------------------- Site content (legal pages, FAQ)
-- Edited from the admin; read at build time to write the static pages (luxury-plan.md, decision).
create table public.site_pages (
  slug          text primary key check (slug in ('terms', 'privacy', 'refund', 'rules', 'faq')),
  title_ar      text not null,
  title_en      text not null,
  body_ar       text not null default '',      -- Markdown
  body_en       text not null default '',
  version       int not null default 1,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id) on delete set null
);

create table public.site_page_versions (
  id            bigserial primary key,
  slug          text not null references public.site_pages(slug) on delete cascade,
  version       int not null,
  title_ar      text not null,
  title_en      text not null,
  body_ar       text not null,
  body_en       text not null,
  saved_at      timestamptz not null,
  saved_by      uuid references public.profiles(id) on delete set null,
  unique (slug, version)
);

-- ---------------------------------------------------------------- Mail
create table public.email_templates (
  kind          text primary key,
  label         text not null,
  subject       text not null,
  body_html     text not null,
  subject_en    text not null default '',
  body_html_en  text not null default '',
  updated_at    timestamptz not null default now()
);

create table public.email_campaigns (
  id            uuid primary key default gen_random_uuid(),
  subject       text not null,
  body_html     text not null,
  audience      text not null,
  total         int not null default 0,
  sent          int not null default 0,
  failed        int not null default 0,
  status        text not null default 'queued' check (status in ('queued', 'sending', 'done', 'failed')),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.email_queue (
  id            bigserial primary key,
  campaign_id   uuid references public.email_campaigns(id) on delete cascade,
  member_id     uuid references public.profiles(id) on delete set null,
  kind          text not null default 'campaign',
  to_email      text not null,
  to_name       text,
  lang          text not null default 'ar',
  subject       text,
  body_html     text,
  vars          jsonb not null default '{}'::jsonb,
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error         text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index email_queue_pending_idx on public.email_queue (status, id) where status = 'pending';
create index email_queue_sent_idx on public.email_queue (sent_at) where sent_at is not null;
create index email_queue_campaign_idx on public.email_queue (campaign_id);
create index email_queue_member_idx on public.email_queue (member_id, kind);

create table public.keep_alive (id int primary key);
insert into public.keep_alive values (1);
