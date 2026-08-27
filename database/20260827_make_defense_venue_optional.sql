alter table public.defense_schedules
  alter column venue drop not null;

create or replace function public.check_defense_schedule_conflicts(
  p_group_id uuid,
  p_defense_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_venue text,
  p_chair_id uuid,
  p_member_ids uuid[],
  p_status text
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_instructor_id uuid;
  v_adviser_id uuid;
  v_member_ids uuid[] := array[]::uuid[];
  v_selected_faculty uuid[] := array[]::uuid[];
  v_conflicts jsonb := '[]'::jsonb;
  v_other record;
  v_faculty_id uuid;
  v_faculty_name text;
  v_panel_role text;
  v_existing_roles text[];
  v_new_roles text[];
  v_venue text := nullif(btrim(coalesce(p_venue, '')), '');
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  if p_group_id is null then
    return jsonb_build_object('ok', false, 'error', 'Research group is required.');
  end if;
  if p_status not in ('pending','scheduled','completed','cancelled') then
    return jsonb_build_object('ok', false, 'error', 'Invalid research status.');
  end if;
  if p_status <> 'scheduled' then
    return jsonb_build_object('ok', true, 'conflicts', '[]'::jsonb);
  end if;
  if p_defense_date is null or p_start_time is null or p_end_time is null or p_end_time <= p_start_time then
    return jsonb_build_object('ok', false, 'error', 'A valid defense date and time range are required.');
  end if;
  if p_chair_id is null then
    return jsonb_build_object('ok', false, 'error', 'Panel chair is required.');
  end if;

  select
    coalesce(active_stage.instructor_id_snapshot, rg.instructor_id),
    coalesce(active_stage.adviser_id_snapshot, rg.adviser_id)
  into v_instructor_id, v_adviser_id
  from public.research_groups rg
  left join lateral (
    select rd.instructor_id_snapshot, rd.adviser_id_snapshot
    from public.research_defenses rd
    where rd.research_group_id = rg.id
      and rd.status in ('pending','scheduled')
    order by rd.requested_at desc, rd.created_at desc
    limit 1
  ) active_stage on true
  where rg.id = p_group_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Research group not found.');
  end if;

  select coalesce(array_agg(s.id order by s.first_ord), array[]::uuid[])
  into v_member_ids
  from (
    select u.id, min(u.ord) as first_ord
    from unnest(coalesce(p_member_ids, array[]::uuid[])) with ordinality as u(id, ord)
    where u.id is not null and u.id <> p_chair_id
    group by u.id
  ) s;

  if cardinality(v_member_ids) > 4 then
    return jsonb_build_object('ok', false, 'error', 'A maximum of four panel members is allowed.');
  end if;

  select coalesce(array_agg(distinct u.id), array[]::uuid[])
  into v_selected_faculty
  from unnest(array_cat(array[p_chair_id, v_instructor_id, v_adviser_id], v_member_ids)) as u(id)
  where u.id is not null;

  for v_other in
    select
      ds.id as schedule_id,
      ds.research_group_id,
      ds.defense_date,
      ds.start_time,
      ds.end_time,
      ds.venue,
      rg.public_code,
      coalesce(rd.title_snapshot, rg.title) as title,
      coalesce(rd.instructor_id_snapshot, rg.instructor_id) as instructor_id,
      coalesce(rd.adviser_id_snapshot, rg.adviser_id) as adviser_id
    from public.defense_schedules ds
    join public.research_groups rg on rg.id = ds.research_group_id
    join public.research_defenses rd on rd.id = ds.research_defense_id
    where ds.research_group_id <> p_group_id
      and rd.status = 'scheduled'
      and ds.defense_date = p_defense_date
      and ds.start_time < p_end_time
      and ds.end_time > p_start_time
    order by ds.start_time, rg.public_code
  loop
    if v_venue is not null
       and v_other.venue is not null
       and lower(btrim(v_other.venue)) = lower(v_venue) then
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
        'kind','venue','public_code',v_other.public_code,'title',v_other.title,
        'defense_date',v_other.defense_date,'start_time',v_other.start_time,
        'end_time',v_other.end_time,'venue',v_other.venue
      ));
    end if;

    foreach v_faculty_id in array v_selected_faculty loop
      v_existing_roles := array[]::text[];
      if v_other.instructor_id = v_faculty_id then v_existing_roles := array_append(v_existing_roles,'Research Instructor'); end if;
      if v_other.adviser_id = v_faculty_id then v_existing_roles := array_append(v_existing_roles,'Research Adviser'); end if;

      v_panel_role := null;
      select pa.panel_role into v_panel_role
      from public.panel_assignments pa
      where pa.defense_schedule_id = v_other.schedule_id and pa.faculty_id = v_faculty_id
      limit 1;
      if v_panel_role = 'chair' then v_existing_roles := array_append(v_existing_roles,'Panel Chair');
      elsif v_panel_role = 'member' then v_existing_roles := array_append(v_existing_roles,'Panel Member'); end if;

      if cardinality(v_existing_roles) > 0 then
        v_new_roles := array[]::text[];
        if v_instructor_id = v_faculty_id then v_new_roles := array_append(v_new_roles,'Research Instructor'); end if;
        if v_adviser_id = v_faculty_id then v_new_roles := array_append(v_new_roles,'Research Adviser'); end if;
        if p_chair_id = v_faculty_id then v_new_roles := array_append(v_new_roles,'Panel Chair'); end if;
        if v_faculty_id = any(v_member_ids) then v_new_roles := array_append(v_new_roles,'Panel Member'); end if;

        select f.full_name into v_faculty_name from public.faculty f where f.id = v_faculty_id;
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
          'kind','faculty','faculty_id',v_faculty_id,'faculty_name',coalesce(v_faculty_name,'Faculty member'),
          'new_roles',v_new_roles,'existing_roles',v_existing_roles,
          'public_code',v_other.public_code,'title',v_other.title,
          'defense_date',v_other.defense_date,'start_time',v_other.start_time,
          'end_time',v_other.end_time,'venue',v_other.venue
        ));
      end if;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'conflicts', v_conflicts);
end;
$function$;

create or replace function public.save_defense_schedule_checked_v2(
  p_defense_id uuid,
  p_defense_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_venue text,
  p_notes text,
  p_chair_id uuid,
  p_member_ids uuid[],
  p_is_published boolean
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_defense public.research_defenses%rowtype;
  v_member_ids uuid[] := array[]::uuid[];
  v_check jsonb;
  v_schedule_id uuid;
  v_publish boolean;
  v_venue text := nullif(btrim(coalesce(p_venue, '')), '');
begin
  if not (select private.is_admin()) then raise exception 'Admin access required.' using errcode='42501'; end if;

  select rd.* into v_defense from public.research_defenses rd where rd.id=p_defense_id for update;
  if not found then return jsonb_build_object('ok',false,'error','Defense stage not found.'); end if;
  if v_defense.status not in ('pending','scheduled') then return jsonb_build_object('ok',false,'error','Only Pending or Scheduled defense stages can be scheduled.'); end if;
  if v_defense.defense_type not in ('title','proposal','final') then return jsonb_build_object('ok',false,'error','Set a valid defense type before scheduling.'); end if;
  if p_defense_date is null or p_start_time is null or p_end_time is null or p_end_time <= p_start_time then return jsonb_build_object('ok',false,'error','End time must be later than start time.'); end if;
  if ((p_defense_date + p_end_time) at time zone 'Asia/Manila') <= now() then return jsonb_build_object('ok',false,'error','Schedule the defense for a future end time.'); end if;
  if p_chair_id is null then return jsonb_build_object('ok',false,'error','Panel chair is required.'); end if;

  select coalesce(array_agg(s.id order by s.first_ord),array[]::uuid[]) into v_member_ids
  from (select u.id,min(u.ord) as first_ord from unnest(coalesce(p_member_ids,array[]::uuid[])) with ordinality as u(id,ord) where u.id is not null and u.id<>p_chair_id group by u.id) s;
  if cardinality(v_member_ids)>4 then return jsonb_build_object('ok',false,'error','A maximum of four panel members is allowed.'); end if;
  if not exists(select 1 from public.faculty f where f.id=p_chair_id and f.is_active and f.can_chair) then return jsonb_build_object('ok',false,'error','The selected panel chair is unavailable or is not enabled to chair defenses.'); end if;
  if exists(select 1 from unnest(v_member_ids) x(id) left join public.faculty f on f.id=x.id where f.id is null or not f.is_active or not f.can_serve_panel) then return jsonb_build_object('ok',false,'error','One or more selected panel members are unavailable or not enabled for panel service.'); end if;

  perform pg_advisory_xact_lock(hashtext('defense:'||p_defense_date::text)::bigint);
  v_check := public.check_defense_schedule_conflicts(v_defense.research_group_id,p_defense_date,p_start_time,p_end_time,v_venue,p_chair_id,v_member_ids,'scheduled');
  if coalesce((v_check->>'ok')::boolean,false)=false then return v_check; end if;
  if jsonb_array_length(coalesce(v_check->'conflicts','[]'::jsonb))>0 then return jsonb_build_object('ok',false,'conflicts',v_check->'conflicts'); end if;

  v_publish := coalesce(p_is_published,false);
  insert into public.defense_schedules(research_group_id,research_defense_id,defense_date,start_time,end_time,venue,notes,is_published)
  values(v_defense.research_group_id,v_defense.id,p_defense_date,p_start_time,p_end_time,v_venue,nullif(btrim(p_notes),''),v_publish)
  on conflict(research_defense_id) do update set defense_date=excluded.defense_date,start_time=excluded.start_time,end_time=excluded.end_time,venue=excluded.venue,notes=excluded.notes,is_published=excluded.is_published,completed_at=null,completion_note=null,completed_by=null
  returning id into v_schedule_id;

  delete from public.panel_assignments pa where pa.defense_schedule_id=v_schedule_id;
  insert into public.panel_assignments(defense_schedule_id,faculty_id,panel_role,sort_order) values(v_schedule_id,p_chair_id,'chair',0);
  insert into public.panel_assignments(defense_schedule_id,faculty_id,panel_role,sort_order)
  select v_schedule_id,u.id,'member',u.ord::smallint from unnest(v_member_ids) with ordinality u(id,ord);

  update public.research_defenses rd set status='scheduled' where rd.id=v_defense.id;
  update public.research_groups rg set status='scheduled',defense_type=v_defense.defense_type where rg.id=v_defense.research_group_id;

  return jsonb_build_object('ok',true,'schedule_id',v_schedule_id,'defense_id',v_defense.id,'published',v_publish,'conflicts','[]'::jsonb);
end;
$function$;
