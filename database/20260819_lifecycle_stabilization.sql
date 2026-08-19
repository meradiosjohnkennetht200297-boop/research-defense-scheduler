-- Research Defense Scheduler lifecycle stabilization
-- Applied to Supabase production on 2026-08-19.
-- This file records the live migrations for repository traceability.

-- 1) Keep normal admin research-group access while protecting the private
--    access_key_hash from authenticated browser/server-session clients.
revoke select, insert, update on table public.research_groups from authenticated;

grant select (
  id,
  public_code,
  title,
  contact_person,
  contact_email,
  contact_number,
  instructor_id,
  adviser_id,
  status,
  submitted_at,
  created_at,
  updated_at,
  research_file_url,
  program,
  major,
  defense_type,
  access_key_created_at
) on table public.research_groups to authenticated;

grant update (
  title,
  contact_person,
  contact_email,
  contact_number,
  instructor_id,
  adviser_id,
  status,
  research_file_url,
  program,
  major,
  defense_type
) on table public.research_groups to authenticated;

-- 2) Guarantee strictly increasing requested_at values for successive
--    defense stages in the same research. PostgreSQL now() is transaction-
--    stable, so very fast same-transaction lifecycle tests can otherwise
--    produce equal timestamps and ambiguous "latest stage" ordering.
create or replace function private.ensure_research_defense_monotonic_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_latest_requested_at timestamptz;
begin
  select max(rd.requested_at)
    into v_latest_requested_at
  from public.research_defenses rd
  where rd.research_group_id = new.research_group_id;

  if v_latest_requested_at is not null and new.requested_at <= v_latest_requested_at then
    new.requested_at := v_latest_requested_at + interval '1 microsecond';
  end if;

  if new.created_at < new.requested_at then
    new.created_at := new.requested_at;
  end if;

  if new.updated_at < new.created_at then
    new.updated_at := new.created_at;
  end if;

  return new;
end;
$$;

drop trigger if exists research_defenses_monotonic_timestamps on public.research_defenses;
create trigger research_defenses_monotonic_timestamps
before insert on public.research_defenses
for each row execute function private.ensure_research_defense_monotonic_timestamps();
