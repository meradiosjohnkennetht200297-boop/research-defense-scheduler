-- Public calendar visibility rule:
-- - published scheduled defenses remain public until their scheduled end time;
-- - published completed defenses remain public as historical records;
-- - unpublished defenses remain private.

create schema if not exists private;

create or replace function private.is_public_defense_schedule(p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.defense_schedules ds
    join public.research_defenses rd on rd.id = ds.research_defense_id
    where ds.id = p_schedule_id
      and ds.is_published = true
      and (
        rd.status = 'completed'
        or ((ds.defense_date + ds.end_time) at time zone 'Asia/Manila') > now()
      )
  );
$function$;

create or replace function private.is_public_research_defense(p_defense_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.research_defenses rd
    join public.defense_schedules ds on ds.research_defense_id = rd.id
    where rd.id = p_defense_id
      and ds.is_published = true
      and (
        rd.status = 'completed'
        or ((ds.defense_date + ds.end_time) at time zone 'Asia/Manila') > now()
      )
  );
$function$;

revoke all on function private.is_public_defense_schedule(uuid) from public;
revoke all on function private.is_public_research_defense(uuid) from public;
grant execute on function private.is_public_defense_schedule(uuid) to anon;
grant execute on function private.is_public_research_defense(uuid) to anon;

drop policy if exists "Public can view active published schedules" on public.defense_schedules;
create policy "Public can view published schedule history"
on public.defense_schedules
for select
to anon
using (private.is_public_defense_schedule(id));

drop policy if exists "Public can view active published defense stages" on public.research_defenses;
create policy "Public can view published defense stage history"
on public.research_defenses
for select
to anon
using (private.is_public_research_defense(id));

drop policy if exists "Public can view published panel assignments" on public.panel_assignments;
create policy "Public can view published panel assignment history"
on public.panel_assignments
for select
to anon
using (private.is_public_defense_schedule(defense_schedule_id));
