-- Admin-only migration path for research groups that already existed before
-- the Research Defense Scheduler was adopted. Earlier lifecycle stages are
-- reconstructed as Completed without inventing historical completion dates.

create or replace function public.import_existing_research_v1(
  p_title text,
  p_program text,
  p_major text,
  p_contact_person text,
  p_contact_email text,
  p_contact_number text,
  p_research_file_url text,
  p_instructor_id uuid,
  p_adviser_id uuid,
  p_members text[],
  p_current_stage text,
  p_has_schedule boolean,
  p_defense_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_venue text,
  p_notes text,
  p_chair_id uuid,
  p_panel_member_ids uuid[],
  p_is_published boolean
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_group_id uuid;
  v_research_code text;
  v_current_defense_id uuid;
  v_stage text;
  v_stage_index integer;
  v_current_index integer;
  v_members text[];
  v_schedule_result jsonb;
  v_program text := nullif(upper(btrim(coalesce(p_program,''))), '');
  v_major text := nullif(btrim(coalesce(p_major,'')), '');
  v_file_url text := nullif(btrim(coalesce(p_research_file_url,'')), '');
  v_contact_email text := nullif(btrim(coalesce(p_contact_email,'')), '');
  v_contact_number text := nullif(btrim(coalesce(p_contact_number,'')), '');
  v_stages text[] := array['title','proposal','final'];
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required.' using errcode='42501';
  end if;

  if length(btrim(coalesce(p_title,''))) = 0 then return jsonb_build_object('ok',false,'error','Research title is required.'); end if;
  if length(btrim(coalesce(p_contact_person,''))) = 0 then return jsonb_build_object('ok',false,'error','Contact person is required.'); end if;
  if v_program not in ('BEED','BSED','BSA','BSAIS','BSBA') then return jsonb_build_object('ok',false,'error','Select a valid program.'); end if;
  if v_program = 'BSED' and v_major not in ('English','Filipino','Mathematics','Science') then return jsonb_build_object('ok',false,'error','Select a valid BSED major.'); end if;
  if v_program = 'BSBA' and v_major not in ('MM','FM','HRM') then return jsonb_build_object('ok',false,'error','Select a valid BSBA major.'); end if;
  if v_program in ('BEED','BSA','BSAIS') then v_major := null; end if;
  if p_current_stage not in ('title','proposal','final') then return jsonb_build_object('ok',false,'error','Select the current defense stage.'); end if;
  if v_file_url is not null and v_file_url !~ '^https://(drive|docs)\.google\.com/' then return jsonb_build_object('ok',false,'error','Use a valid Google Drive or Google Docs research file link.'); end if;

  select coalesce(array_agg(x.name order by x.ord), array[]::text[])
  into v_members
  from (
    select btrim(u.name) as name, min(u.ord) as ord
    from unnest(coalesce(p_members,array[]::text[])) with ordinality as u(name,ord)
    where length(btrim(coalesce(u.name,''))) > 0
    group by btrim(u.name)
  ) x;

  if cardinality(v_members) = 0 then return jsonb_build_object('ok',false,'error','Enter at least one group member.'); end if;
  if cardinality(v_members) > 20 then return jsonb_build_object('ok',false,'error','A maximum of 20 group members is allowed.'); end if;

  if p_instructor_id is not null and not exists(select 1 from public.faculty f where f.id=p_instructor_id and f.is_active and f.can_teach_research) then
    return jsonb_build_object('ok',false,'error','The selected research instructor is unavailable or not eligible.');
  end if;
  if p_adviser_id is not null and not exists(select 1 from public.faculty f where f.id=p_adviser_id and f.is_active and f.can_advise) then
    return jsonb_build_object('ok',false,'error','The selected research adviser is unavailable or not eligible.');
  end if;

  v_current_index := array_position(v_stages,p_current_stage);

  insert into public.research_groups(title,contact_person,contact_email,contact_number,instructor_id,adviser_id,status,research_file_url,program,major,defense_type)
  values(btrim(p_title),btrim(p_contact_person),v_contact_email,v_contact_number,p_instructor_id,p_adviser_id,'pending',v_file_url,v_program,v_major,p_current_stage)
  returning id,public_code into v_group_id,v_research_code;

  insert into public.group_members(research_group_id,full_name,sort_order)
  select v_group_id,u.name,(u.ord-1)::smallint from unnest(v_members) with ordinality as u(name,ord);

  for v_stage_index in 1..v_current_index loop
    v_stage := v_stages[v_stage_index];
    insert into public.research_defenses(research_group_id,defense_type,status,title_snapshot,program_snapshot,major_snapshot,research_file_url,adviser_id_snapshot,instructor_id_snapshot,members_snapshot,completed_at,source)
    values(v_group_id,v_stage,case when v_stage_index<v_current_index then 'completed' else 'pending' end,btrim(p_title),v_program,v_major,v_file_url,p_adviser_id,p_instructor_id,v_members,null,'admin')
    returning id into v_current_defense_id;
  end loop;

  if coalesce(p_has_schedule,false) then
    v_schedule_result := public.save_defense_schedule_checked_v2(v_current_defense_id,p_defense_date,p_start_time,p_end_time,p_venue,p_notes,p_chair_id,coalesce(p_panel_member_ids,array[]::uuid[]),coalesce(p_is_published,false));
    if coalesce((v_schedule_result->>'ok')::boolean,false)=false then
      delete from public.research_groups where id=v_group_id;
      return v_schedule_result || jsonb_build_object('phase','schedule');
    end if;
  else
    update public.research_groups set status='pending',defense_type=p_current_stage where id=v_group_id;
  end if;

  return jsonb_build_object('ok',true,'research_group_id',v_group_id,'research_code',v_research_code,'current_defense_id',v_current_defense_id,'current_stage',p_current_stage,'status',case when coalesce(p_has_schedule,false) then 'scheduled' else 'pending' end);
end;
$function$;

revoke all on function public.import_existing_research_v1(text,text,text,text,text,text,text,uuid,uuid,text[],text,boolean,date,time without time zone,time without time zone,text,text,uuid,uuid[],boolean) from public;
grant execute on function public.import_existing_research_v1(text,text,text,text,text,text,text,uuid,uuid,text[],text,boolean,date,time without time zone,time without time zone,text,text,uuid,uuid[],boolean) to authenticated;
