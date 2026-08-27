create or replace function public.submit_research_group_v3(
  p_title text,
  p_contact_person text,
  p_contact_email text,
  p_contact_number text,
  p_instructor_id uuid,
  p_adviser_id uuid,
  p_research_file_url text,
  p_program text,
  p_major text,
  p_defense_type text,
  p_members text[],
  p_access_key_hash text,
  p_research_design text,
  p_research_design_other text
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_result jsonb;
  v_design text := btrim(coalesce(p_research_design, ''));
  v_other text := nullif(btrim(coalesce(p_research_design_other, '')), '');
begin
  if v_design not in ('descriptive','experimental','developmental','qualitative','mixed_methods','other') then
    raise exception 'A valid research design is required';
  end if;
  if v_design = 'other' and v_other is null then
    raise exception 'Research design must be specified when Other is selected';
  end if;
  if v_design <> 'other' then v_other := null; end if;

  v_result := public.submit_research_group_v2(
    p_title, p_contact_person, p_contact_email, p_contact_number,
    p_instructor_id, p_adviser_id, p_research_file_url, p_program,
    p_major, p_defense_type, p_members, p_access_key_hash
  );

  if coalesce((v_result->>'ok')::boolean, false) then
    update public.research_groups
    set research_design = v_design,
        research_design_other = v_other
    where public_code = v_result->>'public_code';
  end if;

  return v_result;
end;
$$;

create or replace function public.continue_research_group_v4(
  p_public_code text,
  p_title text,
  p_contact_person text,
  p_contact_email text,
  p_contact_number text,
  p_instructor_id uuid,
  p_adviser_id uuid,
  p_research_file_url text,
  p_program text,
  p_major text,
  p_members text[],
  p_research_design text,
  p_research_design_other text
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_result jsonb;
  v_design text := btrim(coalesce(p_research_design, ''));
  v_other text := nullif(btrim(coalesce(p_research_design_other, '')), '');
begin
  if v_design not in ('descriptive','experimental','developmental','qualitative','mixed_methods','other') then
    return jsonb_build_object('ok', false, 'error', 'A valid research design is required.');
  end if;
  if v_design = 'other' and v_other is null then
    return jsonb_build_object('ok', false, 'error', 'Specify the research design.');
  end if;
  if v_design <> 'other' then v_other := null; end if;

  v_result := public.continue_research_group_v3(
    p_public_code, p_title, p_contact_person, p_contact_email,
    p_contact_number, p_instructor_id, p_adviser_id, p_research_file_url,
    p_program, p_major, p_members
  );

  if coalesce((v_result->>'ok')::boolean, false) then
    update public.research_groups
    set research_design = v_design,
        research_design_other = v_other
    where upper(public_code) = upper(btrim(p_public_code));
  end if;

  return v_result;
end;
$$;

create or replace function public.import_existing_research_v2(
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
  p_is_published boolean,
  p_research_design text,
  p_research_design_other text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_design text := btrim(coalesce(p_research_design, ''));
  v_other text := nullif(btrim(coalesce(p_research_design_other, '')), '');
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required.' using errcode='42501';
  end if;
  if v_design not in ('descriptive','experimental','developmental','qualitative','mixed_methods','other') then
    return jsonb_build_object('ok', false, 'error', 'Select a valid research design.');
  end if;
  if v_design = 'other' and v_other is null then
    return jsonb_build_object('ok', false, 'error', 'Specify the research design.');
  end if;
  if v_design <> 'other' then v_other := null; end if;

  v_result := public.import_existing_research_v1(
    p_title, p_program, p_major, p_contact_person, p_contact_email,
    p_contact_number, p_research_file_url, p_instructor_id, p_adviser_id,
    p_members, p_current_stage, p_has_schedule, p_defense_date, p_start_time,
    p_end_time, p_venue, p_notes, p_chair_id, p_panel_member_ids, p_is_published
  );

  if coalesce((v_result->>'ok')::boolean, false) then
    update public.research_groups
    set research_design = v_design,
        research_design_other = v_other
    where id = (v_result->>'research_group_id')::uuid;
  end if;

  return v_result;
end;
$$;

revoke all on function public.submit_research_group_v3(text,text,text,text,uuid,uuid,text,text,text,text,text[],text,text,text) from public, anon, authenticated;
grant execute on function public.submit_research_group_v3(text,text,text,text,uuid,uuid,text,text,text,text,text[],text,text,text) to service_role;

revoke all on function public.continue_research_group_v4(text,text,text,text,text,uuid,uuid,text,text,text,text[],text,text) from public, anon, authenticated;
grant execute on function public.continue_research_group_v4(text,text,text,text,text,uuid,uuid,text,text,text,text[],text,text) to service_role;

revoke all on function public.import_existing_research_v2(text,text,text,text,text,text,text,uuid,uuid,text[],text,boolean,date,time without time zone,time without time zone,text,text,uuid,uuid[],boolean,text,text) from public, anon;
grant execute on function public.import_existing_research_v2(text,text,text,text,text,text,text,uuid,uuid,text[],text,boolean,date,time without time zone,time without time zone,text,text,uuid,uuid[],boolean,text,text) to authenticated;
