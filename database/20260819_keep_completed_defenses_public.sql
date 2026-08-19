-- Keep published defenses visible after completion so the public calendar
-- serves as both an upcoming schedule and a historical defense record.

create or replace function public.complete_defense_schedule_v2(
  p_defense_id uuid,
  p_completion_note text default null::text
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_schedule public.defense_schedules%rowtype;
  v_defense public.research_defenses%rowtype;
  v_user_id uuid;
  v_is_latest boolean;
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required.' using errcode='42501';
  end if;

  v_user_id := (select auth.uid());

  select rd.* into v_defense
  from public.research_defenses rd
  where rd.id=p_defense_id
  for update;

  if not found then return jsonb_build_object('ok',false,'error','Defense stage not found.'); end if;
  if v_defense.status='completed' then return jsonb_build_object('ok',false,'error','This defense stage is already completed.'); end if;
  if v_defense.status<>'scheduled' then return jsonb_build_object('ok',false,'error','Only a scheduled defense stage can be confirmed completed.'); end if;

  select ds.* into v_schedule
  from public.defense_schedules ds
  where ds.research_defense_id=p_defense_id
  for update;

  if not found then return jsonb_build_object('ok',false,'error','No schedule was found for this defense stage.'); end if;
  if ((v_schedule.defense_date+v_schedule.end_time) at time zone 'Asia/Manila') > now() then
    return jsonb_build_object('ok',false,'error','This defense has not reached its scheduled end time yet.');
  end if;

  -- Preserve is_published. A public defense remains visible as Completed;
  -- a private defense remains private.
  update public.defense_schedules ds
  set completed_at=now(),
      completion_note=nullif(btrim(left(coalesce(p_completion_note,''),500)),''),
      completed_by=v_user_id
  where ds.id=v_schedule.id;

  update public.research_defenses rd
  set status='completed',completed_at=now()
  where rd.id=p_defense_id;

  select exists(
    select 1
    from public.research_defenses rd
    where rd.research_group_id=v_defense.research_group_id
      and rd.id=p_defense_id
      and not exists(
        select 1
        from public.research_defenses newer
        where newer.research_group_id=rd.research_group_id
          and (newer.requested_at,newer.created_at,newer.id)>(rd.requested_at,rd.created_at,rd.id)
      )
  ) into v_is_latest;

  if v_is_latest then
    update public.research_groups rg
    set status='completed',defense_type=v_defense.defense_type
    where rg.id=v_defense.research_group_id;
  end if;

  return jsonb_build_object(
    'ok',true,
    'completed_at',now(),
    'schedule_id',v_schedule.id,
    'defense_id',p_defense_id,
    'research_group_id',v_defense.research_group_id,
    'published',v_schedule.is_published
  );
end;
$function$;

-- Existing completed schedules were automatically hidden by the previous
-- completion behavior. Restore them as historical calendar entries.
update public.defense_schedules ds
set is_published=true
from public.research_defenses rd
where rd.id=ds.research_defense_id
  and rd.status='completed'
  and ds.is_published=false;
