-- PlayLedger stores monetary values as integer USD cents.
create extension if not exists pgcrypto;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('scratch', 'game', 'other')),
  name text not null check (char_length(trim(name)) between 1 and 100),
  category text not null default '' check (char_length(category) <= 60),
  occurred_on date not null,
  spent_cents bigint not null default 0 check (spent_cents between 0 and 100000000000),
  payout_cents bigint not null default 0 check (payout_cents between 0 and 100000000000),
  fees_cents bigint not null default 0 check (fees_cents between 0 and 100000000000),
  quantity integer not null default 1 check (quantity between 1 and 100000),
  duration_minutes integer check (duration_minutes between 0 and 100000),
  status text not null default 'settled' check (status in ('settled', 'pending')),
  location text not null default '' check (char_length(location) <= 120),
  notes text not null default '' check (char_length(notes) <= 2000),
  image_path text,
  created_at timestamptz not null default now(),
  constraint pending_only_other check (status = 'settled' or kind = 'other'),
  constraint image_only_scratch check (image_path is null or kind = 'scratch')
);
create index activities_user_date_idx on public.activities(user_id, occurred_on desc);
create index activities_user_kind_idx on public.activities(user_id, kind);
alter table public.activities enable row level security;
create policy "Users view own activities" on public.activities for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own activities" on public.activities for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own activities" on public.activities for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own activities" on public.activities for delete to authenticated using (auth.uid() = user_id);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly_cents bigint check (weekly_cents is null or weekly_cents > 0),
  monthly_cents bigint check (monthly_cents is null or monthly_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "Users view own settings" on public.user_settings for select to authenticated using (auth.uid() = user_id);
create policy "Users insert own settings" on public.user_settings for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own settings" on public.user_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own settings" on public.user_settings for delete to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-images', 'ticket-images', false, 5000000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "Read own ticket images" on storage.objects for select to authenticated using (bucket_id = 'ticket-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Upload own ticket images" on storage.objects for insert to authenticated with check (bucket_id = 'ticket-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Delete own ticket images" on storage.objects for delete to authenticated using (bucket_id = 'ticket-images' and (storage.foldername(name))[1] = auth.uid()::text);
