-- A household invitation is valid only while its creator remains an admin.
create or replace function public.accept_household_invitation(invite_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.household_invitations%rowtype; member_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into inv from public.household_invitations
  where token=invite_token and revoked_at is null and accepted_at is null and expires_at>now()
  for update;
  if not found then raise exception 'invitation expired or invalid'; end if;
  if not private.is_household_admin(inv.household_id)
     or inv.created_by<>(select auth.uid()) then
    raise exception 'invitation expired or invalid';
  end if;
  perform 1 from public.households where id=inv.household_id for update;
  if exists(select 1 from public.household_members where household_id=inv.household_id and user_id=auth.uid()) then
    raise exception 'already a member';
  end if;
  select count(*) into member_count from public.household_members where household_id=inv.household_id;
  if member_count>=2 then raise exception 'this home is already connected to two people'; end if;
  if exists(select 1 from public.household_members where user_id=auth.uid()) then
    raise exception 'this account already belongs to a home';
  end if;
  insert into public.household_members(household_id,user_id,role)
  values(inv.household_id,auth.uid(),'member');
  update public.household_invitations set accepted_by=auth.uid(),accepted_at=now() where id=inv.id;
  return inv.household_id;
end $$;

drop policy if exists "admins update invitations" on public.household_invitations;
drop policy if exists "admins revoke invitations" on public.household_invitations;
create policy "admins revoke invitations" on public.household_invitations for update to authenticated
using(private.is_household_admin(household_id) and created_by=(select auth.uid())
  and accepted_at is null and revoked_at is null)
with check(private.is_household_admin(household_id) and created_by=(select auth.uid())
  and accepted_by is null and accepted_at is null and revoked_at is not null and token is not null);
