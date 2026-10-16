-- ===========================================================================
-- 305 Beverages Co. — Initial schema, RLS, and transactional business logic.
-- Money is stored as INTEGER PAISE (bigint). All business dates use Asia/Kolkata.
-- Multi-business ready: every row carries business_id and is isolated by RLS.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Core tables
-- --------------------------------------------------------------------------

create table if not exists businesses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default '305 Beverages Co.',
  currency      text not null default 'INR',
  timezone      text not null default 'Asia/Kolkata',
  receipt_header text,
  receipt_footer text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  business_id uuid references businesses(id) on delete set null,
  full_name   text,
  role        text not null default 'owner' check (role in ('owner','staff')),
  created_at  timestamptz not null default now()
);

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  subgroup    text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists products (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references businesses(id) on delete cascade,
  category_id  uuid not null references categories(id) on delete restrict,
  name         text not null,
  price_paise  bigint not null check (price_paise >= 0),
  cost_paise   bigint check (cost_paise >= 0),           -- null = COGS not configured
  is_available boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  order_number    text not null,
  status          text not null default 'completed' check (status in ('completed','cancelled')),
  payment_status  text not null default 'unpaid' check (payment_status in ('paid','unpaid','partial')),
  payment_method  text not null default 'cash' check (payment_method in ('cash','upi','card','other')),
  gross_amount    bigint not null default 0,   -- sum of line totals, before discount
  discount_type   text not null default 'none' check (discount_type in ('none','flat','percent')),
  discount_value  numeric(14,4) not null default 0,
  discount_amount bigint not null default 0,
  net_amount      bigint not null default 0,   -- gross - discount
  amount_paid     bigint not null default 0,
  refunded_amount bigint not null default 0,
  customer_name   text,
  customer_phone  text,
  notes           text,
  cancel_reason   text,
  client_token    text,                        -- idempotency key (dedupe submissions)
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (business_id, order_number),
  unique (business_id, client_token)
);

create table if not exists order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  business_id   uuid not null references businesses(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,
  product_name  text not null,     -- snapshot (survives product rename/delete)
  category_name text,              -- snapshot
  quantity      int not null check (quantity > 0),
  unit_price    bigint not null,   -- price snapshot, paise
  unit_cost     bigint,            -- cost snapshot, paise (null if unknown)
  line_total    bigint not null,   -- unit_price * quantity
  created_at    timestamptz not null default now()
);

create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  method      text not null check (method in ('cash','upi','card','other')),
  amount      bigint not null check (amount > 0),
  note        text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create table if not exists refunds (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  amount      bigint not null check (amount > 0),
  reason      text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create table if not exists expense_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists expenses (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete cascade,
  title          text not null,
  amount         bigint not null check (amount >= 0),  -- paise
  category_id    uuid references expense_categories(id) on delete set null,
  category_name  text,                                 -- snapshot
  payment_method text not null default 'cash' check (payment_method in ('cash','upi','card','other')),
  vendor         text,
  description    text,
  receipt_url    text,
  is_recurring   boolean not null default false,
  recurrence     text check (recurrence in ('daily','weekly','monthly')),
  incurred_at    timestamptz not null default now(),
  deleted_at     timestamptz,                          -- soft delete (audit trail)
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists daily_closings (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  business_date date not null,
  snapshot      jsonb not null,
  generated_by  uuid references auth.users(id),
  generated_at  timestamptz not null default now(),
  unique (business_id, business_date)
);

create table if not exists order_counters (
  business_id uuid not null references businesses(id) on delete cascade,
  biz_date    date not null,
  seq         int not null default 0,
  primary key (business_id, biz_date)
);

create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  actor       uuid references auth.users(id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Indexes for reporting/filtering
-- --------------------------------------------------------------------------
create index if not exists idx_orders_biz_created on orders (business_id, created_at);
create index if not exists idx_orders_biz_status  on orders (business_id, status);
create index if not exists idx_orders_number      on orders (business_id, order_number);
create index if not exists idx_order_items_order   on order_items (order_id);
create index if not exists idx_order_items_product on order_items (business_id, product_id);
create index if not exists idx_payments_order      on payments (order_id);
create index if not exists idx_refunds_order       on refunds (order_id);
create index if not exists idx_products_biz_cat    on products (business_id, category_id);
create index if not exists idx_expenses_biz_incurred on expenses (business_id, incurred_at);
create index if not exists idx_audit_biz_created   on audit_logs (business_id, created_at);

-- --------------------------------------------------------------------------
-- updated_at trigger
-- --------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['businesses','categories','products','orders','expenses'] loop
    execute format('drop trigger if exists trg_%s_updated on %I;', t, t);
    execute format('create trigger trg_%s_updated before update on %I for each row execute function set_updated_at();', t, t);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- Tenancy helper
-- --------------------------------------------------------------------------
create or replace function app_current_business_id() returns uuid
language sql stable security definer set search_path = public as $$
  select business_id from profiles where id = auth.uid();
$$;

-- ===========================================================================
-- Row Level Security — every table isolated by business_id.
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'businesses','profiles','categories','products','orders','order_items',
    'payments','refunds','expense_categories','expenses','daily_closings',
    'order_counters','audit_logs'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- Businesses: a user sees only their own business.
drop policy if exists biz_select on businesses;
create policy biz_select on businesses for select
  using (id = app_current_business_id());
drop policy if exists biz_update on businesses;
create policy biz_update on businesses for update
  using (id = app_current_business_id());

-- Profiles: a user can read/update their own profile row.
drop policy if exists prof_select on profiles;
create policy prof_select on profiles for select using (id = auth.uid());
drop policy if exists prof_upsert on profiles;
create policy prof_upsert on profiles for insert with check (id = auth.uid());
drop policy if exists prof_update on profiles;
create policy prof_update on profiles for update using (id = auth.uid());

-- Generic per-business policies for the data tables.
do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','orders','order_items','payments','refunds',
    'expense_categories','expenses','daily_closings','order_counters','audit_logs'
  ] loop
    execute format('drop policy if exists %s_all on %I;', t, t);
    execute format(
      'create policy %s_all on %I for all using (business_id = app_current_business_id()) with check (business_id = app_current_business_id());',
      t, t);
  end loop;
end $$;

-- ===========================================================================
-- Bootstrap + idempotent seed
-- ===========================================================================

-- Seed the full menu + default expense categories for a business. Idempotent:
-- re-running never duplicates (natural keys + ON CONFLICT DO NOTHING).
create or replace function seed_business(p_business uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_cat uuid;
begin
  -- Categories
  insert into categories (business_id, name, subgroup, sort_order) values
    (p_business,'SODAWISE',null,1),
    (p_business,'ICE TEA',null,2),
    (p_business,'305 Signature',null,3),
    (p_business,'MATCH',null,4),
    (p_business,'MOCKTAILS','Fruit Crush',5),
    (p_business,'SYRUPS',null,6),
    (p_business,'Coffee Menu',null,7)
  on conflict (business_id, name) do nothing;

  -- Helper to insert a product under a category by name.
  -- SODAWISE
  select id into v_cat from categories where business_id=p_business and name='SODAWISE';
  insert into products (business_id, category_id, name, price_paise) values
    (p_business,v_cat,'Lemon',6000),(p_business,v_cat,'Kala Khatta',6000),
    (p_business,v_cat,'Jeera Masala',6000),(p_business,v_cat,'Paan',6000),
    (p_business,v_cat,'Aam Panna',6000),(p_business,v_cat,'Ginger Ale',6000)
  on conflict (business_id, name) do nothing;

  -- ICE TEA
  select id into v_cat from categories where business_id=p_business and name='ICE TEA';
  insert into products (business_id, category_id, name, price_paise) values
    (p_business,v_cat,'Peach Ice Tea',12000),(p_business,v_cat,'Lemon Ice Tea',12000)
  on conflict (business_id, name) do nothing;

  -- 305 Signature
  select id into v_cat from categories where business_id=p_business and name='305 Signature';
  insert into products (business_id, category_id, name, price_paise) values
    (p_business,v_cat,'Kiwi Tropical',12000),(p_business,v_cat,'Island Crush',12000),
    (p_business,v_cat,'Peach Gold',12000),(p_business,v_cat,'Mango Tango',12000),
    (p_business,v_cat,'Litchi Lemon',12000),(p_business,v_cat,'Apple Pineapple Cooler',12000),
    (p_business,v_cat,'Fridge Cigarette',14000)
  on conflict (business_id, name) do nothing;

  -- MATCH
  select id into v_cat from categories where business_id=p_business and name='MATCH';
  insert into products (business_id, category_id, name, price_paise) values
    (p_business,v_cat,'Classic Matcha',16000),(p_business,v_cat,'Strawberry matcha',18000),
    (p_business,v_cat,'Mango Matcha',18000),(p_business,v_cat,'Watermelon Match',20000),
    (p_business,v_cat,'Blueberry Matcha',20000),(p_business,v_cat,'Tender Coconut Matcha',20000)
  on conflict (business_id, name) do nothing;

  -- MOCKTAILS (Fruit Crush)
  select id into v_cat from categories where business_id=p_business and name='MOCKTAILS';
  insert into products (business_id, category_id, name, price_paise) values
    (p_business,v_cat,'Pineapple',8000),(p_business,v_cat,'Orange',8000),
    (p_business,v_cat,'Black Current',8000),(p_business,v_cat,'Strawberry',8000),
    (p_business,v_cat,'Litchi',8000),(p_business,v_cat,'Mango',8000),
    (p_business,v_cat,'Watermelon',8000),(p_business,v_cat,'Tender Coconut',10000),
    (p_business,v_cat,'Blueberry',10000),(p_business,v_cat,'Kiwi',10000),
    (p_business,v_cat,'Custard Apple',10000),(p_business,v_cat,'Cranberry',12000),
    (p_business,v_cat,'Raspberry',12000)
  on conflict (business_id, name) do nothing;

  -- SYRUPS
  select id into v_cat from categories where business_id=p_business and name='SYRUPS';
  insert into products (business_id, category_id, name, price_paise) values
    (p_business,v_cat,'Bubblegum',8000),(p_business,v_cat,'Blue Curacao',8000),
    (p_business,v_cat,'Pinacolada',8000),(p_business,v_cat,'Mint Mojito',8000),
    (p_business,v_cat,'Virgin Mojito',8000)
  on conflict (business_id, name) do nothing;

  -- Coffee Menu
  select id into v_cat from categories where business_id=p_business and name='Coffee Menu';
  insert into products (business_id, category_id, name, price_paise) values
    (p_business,v_cat,'Iced Americano',8000),(p_business,v_cat,'Classic Iced Lattee',10000),
    (p_business,v_cat,'Spanish Lattee',12000),(p_business,v_cat,'Caramel Iced Lattee',12000),
    (p_business,v_cat,'Vanilla Iced Lattee',12000),(p_business,v_cat,'Hazelnut Iced Lattee',12000),
    (p_business,v_cat,'Iced Mocha',12000)
  on conflict (business_id, name) do nothing;

  -- Default expense categories
  insert into expense_categories (business_id, name) values
    (p_business,'Ingredients and Raw Materials'),(p_business,'Milk and Dairy'),
    (p_business,'Fruits'),(p_business,'Syrups and Flavours'),
    (p_business,'Tea, Coffee and Matcha'),(p_business,'Cups, Lids and Packaging'),
    (p_business,'Ice and Water'),(p_business,'Staff Salaries'),(p_business,'Rent'),
    (p_business,'Electricity and Utilities'),(p_business,'Transportation and Delivery'),
    (p_business,'Marketing and Advertising'),(p_business,'Equipment and Maintenance'),
    (p_business,'Repairs'),(p_business,'Miscellaneous')
  on conflict (business_id, name) do nothing;
end; $$;

-- Ensure the current user has a business; create + seed on first use. Idempotent.
create or replace function ensure_business(p_name text default '305 Beverages Co.')
returns businesses
language plpgsql security definer set search_path = public as $$
declare v_biz businesses; v_business_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select business_id into v_business_id from profiles where id = auth.uid();

  if v_business_id is null then
    insert into businesses (name) values (coalesce(p_name,'305 Beverages Co.'))
      returning id into v_business_id;
    insert into profiles (id, business_id, role, full_name)
      values (auth.uid(), v_business_id, 'owner', null)
      on conflict (id) do update set business_id = excluded.business_id;
    perform seed_business(v_business_id);
  end if;

  select * into v_biz from businesses where id = v_business_id;
  return v_biz;
end; $$;
