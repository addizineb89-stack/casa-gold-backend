-- ============================================
-- CASA GOLD INTELLIGENCE — Supabase Schema
-- ============================================
-- Colle ce SQL dans : Supabase > SQL Editor > New Query

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================
-- 1. PROFILES (lié à auth.users de Supabase)
-- ============================================
create table public.profiles (
  id              uuid references auth.users(id) on delete cascade primary key,
  email           text unique not null,
  full_name       text,
  phone           text,
  role            text not null default 'client' check (role in ('client', 'bijoutier', 'admin')),
  plan            text not null default 'free' check (plan in ('free', 'aura', 'pro_partner')),
  plan_expires_at timestamptz,
  language        text default 'fr' check (language in ('fr', 'en', 'ar')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Créer automatiquement un profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 2. SHOPS (profil bijoutier)
-- ============================================
create table public.shops (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid references public.profiles(id) on delete cascade unique,
  store_name          text not null,
  whatsapp_number     text,
  address             text,
  logo_url            text,
  default_labor_cost  numeric(10,2) default 0,
  directory_listed    boolean default false,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ============================================
-- 3. JEWELRY ITEMS (bijoux scrapés + analysés)
-- ============================================
create table public.jewelry_items (
  id                      uuid default uuid_generate_v4() primary key,
  image_url               text not null,
  source_url              text,
  platform                text check (platform in ('Instagram', 'TikTok', 'Pinterest', 'LuxuryBrand')),
  style                   text check (style in ('Beldi', 'Moderne', 'Luxe', 'Minimaliste', 'Autre')),
  type                    text check (type in ('Bague', 'Bracelet', 'Collier', 'Boucles', 'Pendentif', 'Autre')),
  karat                   text check (karat in ('9k', '14k', '18k', '21k', '22k', '24k')),
  estimated_weight_grams  numeric(6,2),
  setting_type            text,
  description             text,
  estimated_price_mad     numeric(10,2),
  likes                   integer default 0,
  comments                integer default 0,
  viral_score             integer default 0 check (viral_score between 0 and 100),
  pinecone_id             text unique,
  scraped_at              timestamptz,
  created_at              timestamptz default now()
);

create index idx_jewelry_style    on public.jewelry_items(style);
create index idx_jewelry_platform on public.jewelry_items(platform);
create index idx_jewelry_created  on public.jewelry_items(created_at desc);

-- ============================================
-- 4. GOLD PRICE HISTORY (historique 30 jours)
-- ============================================
create table public.gold_price_history (
  id          uuid default uuid_generate_v4() primary key,
  date        date unique not null,
  price_9k    numeric(10,2),
  price_14k   numeric(10,2),
  price_18k   numeric(10,2),
  price_21k   numeric(10,2),
  price_22k   numeric(10,2),
  price_24k   numeric(10,2),
  usd_per_oz  numeric(10,4),
  created_at  timestamptz default now()
);

-- ============================================
-- 5. QUOTES (devis générés par les bijoutiers)
-- ============================================
create table public.quotes (
  id                    uuid default uuid_generate_v4() primary key,
  user_id               uuid references public.profiles(id) on delete cascade,
  shop_id               uuid references public.shops(id) on delete set null,
  jewelry_item_id       uuid references public.jewelry_items(id) on delete set null,
  karat                 text,
  weight_grams          numeric(6,2),
  gold_price_per_gram   numeric(10,2),
  gold_cost             numeric(10,2),
  labor_cost            numeric(10,2),
  profit_margin_pct     numeric(5,2) default 0,
  profit_amount         numeric(10,2),
  total_price           numeric(10,2),
  whatsapp_shared       boolean default false,
  created_at            timestamptz default now()
);

-- ============================================
-- 6. USER CATALOG (bijoux sauvegardés)
-- ============================================
create table public.user_catalog (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references public.profiles(id) on delete cascade,
  jewelry_item_id uuid references public.jewelry_items(id) on delete cascade,
  saved_at        timestamptz default now(),
  unique(user_id, jewelry_item_id)
);

-- ============================================
-- 7. CUSTOMER REQUESTS (clients cherchant bijoutier)
-- ============================================
create table public.customer_requests (
  id                   uuid default uuid_generate_v4() primary key,
  user_id              uuid references public.profiles(id) on delete set null,
  display_name         text not null,
  location             text,
  request_description  text,
  style_preference     text,
  karat_preference     text,
  status               text default 'open' check (status in ('open', 'closed', 'contacted')),
  created_at           timestamptz default now()
);

-- ============================================
-- 8. VISUAL SCANS (historique recherches visuelles)
-- ============================================
create table public.visual_scans (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid references public.profiles(id) on delete set null,
  image_url           text,
  matched_item_id     uuid references public.jewelry_items(id) on delete set null,
  match_confidence    numeric(4,3),
  results_count       integer default 0,
  created_at          timestamptz default now()
);

-- ============================================
-- 9. SUBSCRIPTIONS (abonnements)
-- ============================================
create table public.subscriptions (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid references public.profiles(id) on delete cascade,
  plan                text check (plan in ('aura', 'pro_partner')),
  price_mad           numeric(8,2),
  status              text default 'active' check (status in ('active', 'cancelled', 'expired', 'trial')),
  started_at          timestamptz default now(),
  expires_at          timestamptz,
  payment_reference   text,
  created_at          timestamptz default now()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

alter table public.profiles         enable row level security;
alter table public.shops            enable row level security;
alter table public.quotes           enable row level security;
alter table public.user_catalog     enable row level security;
alter table public.customer_requests enable row level security;
alter table public.visual_scans     enable row level security;
alter table public.subscriptions    enable row level security;

-- Jewelry items et gold_price_history : lecture publique
alter table public.jewelry_items        enable row level security;
alter table public.gold_price_history   enable row level security;

create policy "jewelry public read"
  on public.jewelry_items for select using (true);

create policy "gold history public read"
  on public.gold_price_history for select using (true);

-- Profiles : chaque user voit seulement le sien
create policy "profiles own"
  on public.profiles for all
  using (auth.uid() = id);

-- Shops : bijoutier gère le sien
create policy "shops own"
  on public.shops for all
  using (auth.uid() = user_id);

-- Quotes : bijoutier gère les siennes
create policy "quotes own"
  on public.quotes for all
  using (auth.uid() = user_id);

-- Catalog : user gère le sien
create policy "catalog own"
  on public.user_catalog for all
  using (auth.uid() = user_id);

-- Customer requests : lecture publique pour bijoutiers, écriture pour owner
create policy "requests public read"
  on public.customer_requests for select using (true);

create policy "requests own write"
  on public.customer_requests for insert
  with check (auth.uid() = user_id);

-- Visual scans : user voit les siens
create policy "scans own"
  on public.visual_scans for all
  using (auth.uid() = user_id);

-- Subscriptions : user voit les siennes
create policy "subscriptions own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ============================================
-- STORAGE BUCKETS
-- ============================================
insert into storage.buckets (id, name, public)
values
  ('shop-logos',     'shop-logos',     true),
  ('jewelry-images', 'jewelry-images', true),
  ('quote-photos',   'quote-photos',   false);
