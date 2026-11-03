-- ROOMMIE v1.0. Install only on project xcfltowyckznlhqnioqi after reviewing existing schema.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Roommie' check (char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  primary key (household_id,user_id)
);
create index if not exists household_members_user_idx on public.household_members(user_id);
create unique index if not exists household_members_one_home_per_user_idx on public.household_members(user_id);
create table if not exists public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz
);
create index if not exists household_invitations_household_idx on public.household_invitations(household_id);
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60), created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  unique (household_id,name)
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100), category text, image_path text,
  status text not null default 'available' check(status in ('available','replenish')), active boolean not null default true,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,household_id)
);
create unique index if not exists products_household_name_active_idx on public.products(household_id, lower(name)) where active;
create index if not exists products_household_idx on public.products(household_id,active);
create table if not exists public.purchase_records (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null, created_by uuid not null references auth.users(id),
  purchased_at timestamptz not null default now(), quantity numeric(10,2) check(quantity is null or quantity > 0), unit text,
  photo_path text, notes text check(notes is null or char_length(notes)<=1000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id,household_id), foreign key(product_id,household_id) references public.products(id,household_id) on delete restrict
);
create index if not exists purchase_household_date_idx on public.purchase_records(household_id,purchased_at desc);
create index if not exists purchase_product_date_idx on public.purchase_records(product_id,purchased_at desc);
create table if not exists public.product_status_events (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null, status text not null check(status in ('available','replenish')),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), note text,
  foreign key(product_id,household_id) references public.products(id,household_id) on delete cascade
);
create index if not exists product_status_household_date_idx on public.product_status_events(household_id,created_at desc);
create table if not exists public.household_tasks (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 100), frequency_days integer check(frequency_days is null or frequency_days between 1 and 3650),
  active boolean not null default true, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,household_id)
);
create unique index if not exists tasks_household_name_active_idx on public.household_tasks(household_id,lower(name)) where active;
create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  task_id uuid not null, created_by uuid not null references auth.users(id),
  completed_at timestamptz not null default now(), photo_path text, notes text check(notes is null or char_length(notes)<=1000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(task_id,household_id) references public.household_tasks(id,household_id) on delete restrict
);
create index if not exists task_completions_household_date_idx on public.task_completions(household_id,completed_at desc);
create index if not exists task_completions_task_date_idx on public.task_completions(task_id,completed_at desc);
create table if not exists public.electric_meters (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null default 'Medidor principal', meter_number text, distributor text, reminder_day smallint not null default 20 check(reminder_day between 1 and 28),
  unit text not null default 'kWh' check(unit='kWh'), created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(household_id,name), unique(id,household_id)
);
create table if not exists public.meter_readings (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  meter_id uuid not null, created_by uuid not null references auth.users(id),
  read_at timestamptz not null, value_kwh numeric(12,3) not null check(value_kwh>=0), photo_path text not null,
  notes text check(notes is null or char_length(notes)<=1000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(meter_id,read_at), unique(meter_id,value_kwh,read_at), foreign key(meter_id,household_id) references public.electric_meters(id,household_id) on delete restrict
);
create index if not exists readings_household_date_idx on public.meter_readings(household_id,read_at desc);
create index if not exists readings_meter_date_idx on public.meter_readings(meter_id,read_at desc);
create table if not exists public.electricity_bills (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id), distributor text, issued_at date not null, period_start date not null, period_end date not null check(period_end>=period_start),
  initial_reading_kwh numeric(12,3), final_reading_kwh numeric(12,3), billed_kwh numeric(12,3) check(billed_kwh is null or billed_kwh>=0),
  amount_clp bigint check(amount_clp is null or amount_clp>=0), other_charges_clp bigint check(other_charges_clp is null or other_charges_clp>=0),
  photo_path text, notes text check(notes is null or char_length(notes)<=1000), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists bills_household_period_idx on public.electricity_bills(household_id,period_start,period_end);

create or replace function private.is_household_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.household_members m where m.household_id=target and m.user_id=(select auth.uid()));
$$;
create or replace function private.is_household_admin(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.household_members m where m.household_id=target and m.user_id=(select auth.uid()) and m.role='admin');
$$;
revoke all on function private.is_household_member(uuid) from public, anon;
revoke all on function private.is_household_admin(uuid) from public, anon;
grant execute on function private.is_household_member(uuid), private.is_household_admin(uuid) to authenticated;

create or replace function public.create_household(household_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(trim(household_name)) not between 1 and 80 then raise exception 'invalid household name'; end if;
  if exists(select 1 from public.household_members where user_id=auth.uid()) then raise exception 'already belongs to a household'; end if;
  insert into public.households(name,created_by) values(trim(household_name),auth.uid()) returning id into new_id;
  insert into public.household_members(household_id,user_id,role) values(new_id,auth.uid(),'admin');
  insert into public.electric_meters(household_id,created_by) values(new_id,auth.uid());
  return new_id;
end $$;
revoke all on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;

create or replace function public.accept_household_invitation(invite_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.household_invitations%rowtype; member_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into inv from public.household_invitations where token=invite_token and revoked_at is null and accepted_at is null and expires_at>now() for update;
  if not found then raise exception 'invitation expired or invalid'; end if;
  if not private.is_household_admin(inv.household_id) or inv.created_by<>(select auth.uid()) then
    raise exception 'invitation expired or invalid';
  end if;
  perform 1 from public.households where id=inv.household_id for update;
  if exists(select 1 from public.household_members where household_id=inv.household_id and user_id=auth.uid()) then raise exception 'already a member'; end if;
  select count(*) into member_count from public.household_members where household_id=inv.household_id;
  if member_count>=2 then raise exception 'this home is already connected to two people'; end if;
  if exists(select 1 from public.household_members where user_id=auth.uid()) then raise exception 'this account already belongs to a home'; end if;
  insert into public.household_members(household_id,user_id,role) values(inv.household_id,auth.uid(),'member');
  update public.household_invitations set accepted_by=auth.uid(),accepted_at=now() where id=inv.id;
  return inv.household_id;
end $$;
revoke all on function public.accept_household_invitation(text) from public, anon;
grant execute on function public.accept_household_invitation(text) to authenticated;

create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Roommie')) on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created_roommie on auth.users;
create trigger on_auth_user_created_roommie after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.set_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end $$;
create or replace function private.keep_record_author() returns trigger language plpgsql set search_path = '' as $$
begin if new.created_by is distinct from old.created_by then raise exception 'record author cannot be changed'; end if; return new; end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','product_categories','products','purchase_records','household_tasks','task_completions','electric_meters','meter_readings','electricity_bills'] loop
    execute format('drop trigger if exists set_updated_at on public.%I',t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',t);
    if t <> 'profiles' then
      execute format('drop trigger if exists keep_record_author on public.%I',t);
      execute format('create trigger keep_record_author before update on public.%I for each row execute function private.keep_record_author()',t);
    end if;
  end loop;
end $$;

create or replace function private.log_product_status() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    insert into public.product_status_events(household_id,product_id,status,created_by) values(new.household_id,new.id,new.status,new.created_by);
  elsif new.status is distinct from old.status then
    insert into public.product_status_events(household_id,product_id,status,created_by) values(new.household_id,new.id,new.status,auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists log_product_status on public.products;
create trigger log_product_status after insert or update of status on public.products for each row execute function private.log_product_status();
drop trigger if exists keep_household_creator on public.households;
create trigger keep_household_creator before update on public.households for each row execute function private.keep_record_author();

create or replace function private.refresh_product_after_purchase() returns trigger language plpgsql security definer set search_path = '' as $$
begin update public.products set status='available' where id=new.product_id and household_id=new.household_id; return new; end $$;
drop trigger if exists refresh_product_after_purchase on public.purchase_records;
create trigger refresh_product_after_purchase after insert on public.purchase_records for each row execute function private.refresh_product_after_purchase();
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_household_member(uuid), private.is_household_admin(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.purchase_records enable row level security;
alter table public.product_status_events enable row level security;
alter table public.household_tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.electric_meters enable row level security;
alter table public.meter_readings enable row level security;
alter table public.electricity_bills enable row level security;

drop policy if exists "profiles shared within home" on public.profiles;
create policy "profiles shared within home" on public.profiles for select to authenticated using (id=(select auth.uid()) or exists(select 1 from public.household_members me join public.household_members them on them.household_id=me.household_id where me.user_id=(select auth.uid()) and them.user_id=id));
drop policy if exists "profile update own" on public.profiles;
create policy "profile update own" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists "household read members" on public.households;
create policy "household read members" on public.households for select to authenticated using(private.is_household_member(id));
drop policy if exists "household update admins" on public.households;
create policy "household update admins" on public.households for update to authenticated using(private.is_household_admin(id)) with check(private.is_household_admin(id));
drop policy if exists "members see own household" on public.household_members;
create policy "members see own household" on public.household_members for select to authenticated using(private.is_household_member(household_id));
drop policy if exists "admins manage members" on public.household_members;
create policy "admins manage members" on public.household_members for delete to authenticated using(private.is_household_admin(household_id) and user_id<>(select auth.uid()));
drop policy if exists "admins read invitations" on public.household_invitations;
create policy "admins read invitations" on public.household_invitations for select to authenticated using(private.is_household_admin(household_id));
drop policy if exists "admins create invitations" on public.household_invitations;
create policy "admins create invitations" on public.household_invitations for insert to authenticated with check(private.is_household_admin(household_id) and created_by=(select auth.uid()) and expires_at<=now()+interval '8 days' and expires_at>now());
drop policy if exists "admins update invitations" on public.household_invitations;
create policy "admins revoke invitations" on public.household_invitations for update to authenticated
using(private.is_household_admin(household_id) and created_by=(select auth.uid()) and accepted_at is null and revoked_at is null)
with check(private.is_household_admin(household_id) and created_by=(select auth.uid()) and accepted_by is null and accepted_at is null and revoked_at is not null and token is not null);

do $$ declare t text; begin
 foreach t in array array['product_categories','products','purchase_records','product_status_events','household_tasks','task_completions','electric_meters','meter_readings','electricity_bills'] loop
   execute format('drop policy if exists "home members read" on public.%I',t);
   execute format('create policy "home members read" on public.%I for select to authenticated using(private.is_household_member(household_id))',t);
   execute format('drop policy if exists "home members insert own" on public.%I',t);
   execute format('create policy "home members insert own" on public.%I for insert to authenticated with check(private.is_household_member(household_id) and created_by=(select auth.uid()))',t);
   execute format('drop policy if exists "home members update" on public.%I',t);
   execute format('create policy "home members update" on public.%I for update to authenticated using(private.is_household_member(household_id)) with check(private.is_household_member(household_id) and created_by=(select auth.uid()))',t);
   execute format('drop policy if exists "home members delete" on public.%I',t);
 end loop;
end $$;
-- Product and task catalogs can be corrected by any home member; activity records stay attributable to their author.
drop policy if exists "home members update" on public.products;
create policy "home members update" on public.products for update to authenticated using(private.is_household_member(household_id)) with check(private.is_household_member(household_id));
drop policy if exists "home members update" on public.household_tasks;
create policy "home members update" on public.household_tasks for update to authenticated using(private.is_household_member(household_id)) with check(private.is_household_member(household_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('roommie-private','roommie-private',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];
drop policy if exists "roommie private read household" on storage.objects;
create policy "roommie private read household" on storage.objects for select to authenticated using(bucket_id='roommie-private' and private.is_household_member((storage.foldername(name))[1]::uuid));
drop policy if exists "roommie private upload household" on storage.objects;
create policy "roommie private upload household" on storage.objects for insert to authenticated with check(bucket_id='roommie-private' and private.is_household_member((storage.foldername(name))[1]::uuid) and (storage.foldername(name))[2]=(select auth.uid())::text);
drop policy if exists "roommie private update own" on storage.objects;
create policy "roommie private update own" on storage.objects for update to authenticated using(bucket_id='roommie-private' and private.is_household_member((storage.foldername(name))[1]::uuid) and (storage.foldername(name))[2]=(select auth.uid())::text) with check(bucket_id='roommie-private' and private.is_household_member((storage.foldername(name))[1]::uuid) and (storage.foldername(name))[2]=(select auth.uid())::text);
drop policy if exists "roommie private delete own" on storage.objects;
create policy "roommie private delete own" on storage.objects for delete to authenticated using(bucket_id='roommie-private' and private.is_household_member((storage.foldername(name))[1]::uuid) and (storage.foldername(name))[2]=(select auth.uid())::text);

grant select,insert,update,delete on public.profiles,public.households,public.household_members,public.household_invitations,
 public.product_categories,public.products,public.purchase_records,public.product_status_events,public.household_tasks,
 public.task_completions,public.electric_meters,public.meter_readings,public.electricity_bills to authenticated;
revoke delete on public.profiles,public.households,public.household_members,public.household_invitations,
 public.product_categories,public.products,public.purchase_records,public.product_status_events,public.household_tasks,
 public.task_completions,public.electric_meters,public.meter_readings,public.electricity_bills from authenticated;
revoke insert,update,delete on public.product_status_events from authenticated;
drop policy if exists "home members insert own" on public.product_status_events;
drop policy if exists "home members update" on public.product_status_events;
grant usage on schema public to authenticated;
-- Realtime is optional: the client also refreshes data when a tab regains focus.
do $$ begin alter publication supabase_realtime add table public.products; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.purchase_records; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.product_status_events; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.household_tasks; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.task_completions; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.meter_readings; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.electricity_bills; exception when duplicate_object then null; when undefined_object then null; end $$;
