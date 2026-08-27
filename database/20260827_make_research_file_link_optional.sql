create or replace function public.submit_research_group_v2(
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
  p_access_key_hash text
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_group_id uuid;
  v_defense_id uuid;
  v_public_code text;
  v_member text;
  v_order smallint := 0;
  v_member_values text[] := array[]::text[];
  v_file_url text := nullif(btrim(coalesce(p_research_file_url, '')), '');
  v_program text := upper(btrim(coalesce(p_program, '')));
  v_major text := nullif(btrim(coalesce(p_major, '')), '');
  v_defense_type text := lower(btrim(coalesce(p_defense_type, '')));
begin
  if length(btrim(coalesce(p_title, ''))) = 0 then raise exception 'Research title is required'; end if;
  if length(btrim(coalesce(p_contact_person, ''))) = 0 then raise exception 'Contact person is required'; end if;
  if v_file_url is not null and v_file_url !~ '^https://(drive|docs)\.google\.com/' then raise exception 'Research file link must be a valid Google Drive or Google Docs URL'; end if;
  if v_program not in ('BEED','BSED','BSA','BSAIS','BSBA') then raise exception 'A valid program is required'; end if;
  if v_program = 'BSED' and coalesce(v_major, '') not in ('English','Filipino','Mathematics','Science') then raise exception 'A valid BSED major is required'; end if;
  if v_program = 'BSBA' and coalesce(v_major, '') not in ('MM','FM','HRM') then raise exception 'A valid BSBA major is required'; end if;
  if v_program in ('BEED','BSA','BSAIS') then v_major := null; end if;
  if v_defense_type not in ('title','proposal','final') then raise exception 'A valid defense type is required'; end if;
  if p_access_key_hash is not null and p_access_key_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid access credential'; end if;

  if p_instructor_id is not null and not exists (
    select 1 from public.faculty f where f.id = p_instructor_id and f.is_active and f.can_teach_research
  ) then raise exception 'Selected research instructor is unavailable'; end if;
  if p_adviser_id is not null and not exists (
    select 1 from public.faculty f where f.id = p_adviser_id and f.is_active and f.can_advise
  ) then raise exception 'Selected research adviser is unavailable'; end if;
  if coalesce(array_length(p_members, 1), 0) = 0 then raise exception 'At least one group member is required'; end if;

  insert into public.research_groups (
    title, contact_person, contact_email, contact_number, instructor_id, adviser_id,
    research_file_url, program, major, defense_type, status, access_key_hash, access_key_created_at
  ) values (
    btrim(p_title), btrim(p_contact_person), nullif(btrim(coalesce(p_contact_email, '')), ''),
    nullif(btrim(coalesce(p_contact_number, '')), ''), p_instructor_id, p_adviser_id,
    v_file_url, v_program, v_major, v_defense_type, 'pending', p_access_key_hash,
    case when p_access_key_hash is null then null else now() end
  ) returning id, public_code into v_group_id, v_public_code;

  foreach v_member in array p_members loop
    if length(btrim(coalesce(v_member, ''))) > 0 then
      insert into public.group_members (research_group_id, full_name, sort_order)
      values (v_group_id, btrim(v_member), v_order);
      v_member_values := array_append(v_member_values, btrim(v_member));
      v_order := v_order + 1;
    end if;
  end loop;
  if v_order = 0 then raise exception 'At least one non-empty group member is required'; end if;

  insert into public.research_defenses (
    research_group_id, defense_type, status, title_snapshot, program_snapshot, major_snapshot,
    research_file_url, adviser_id_snapshot, instructor_id_snapshot, members_snapshot, source
  ) values (
    v_group_id, v_defense_type, 'pending', btrim(p_title), v_program, v_major,
    v_file_url, p_adviser_id, p_instructor_id, v_member_values, 'initial'
  ) returning id into v_defense_id;

  return jsonb_build_object('ok', true, 'public_code', v_public_code, 'defense_id', v_defense_id, 'defense_type', v_defense_type);
end;
$function$;

create or replace function public.continue_research_group_v3(
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
  p_members text[]
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_group public.research_groups%rowtype;
  v_last public.research_defenses%rowtype;
  v_next_type text;
  v_defense_id uuid;
  v_member text;
  v_order smallint := 0;
  v_member_values text[] := array[]::text[];
  v_file_url text := nullif(btrim(coalesce(p_research_file_url, '')), '');
  v_program text := upper(btrim(coalesce(p_program, '')));
  v_major text := nullif(btrim(coalesce(p_major, '')), '');
begin
  select rg.* into v_group
  from public.research_groups rg
  where upper(rg.public_code) = upper(btrim(p_public_code))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Research Code not found.');
  end if;

  select rd.* into v_last
  from public.research_defenses rd
  where rd.research_group_id = v_group.id
  order by rd.requested_at desc,
           rd.created_at desc,
           case rd.defense_type when 'final' then 3 when 'proposal' then 2 when 'title' then 1 else 0 end desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'No defense stage is recorded for this research. Please contact the administrator.');
  end if;
  if v_last.status in ('pending','scheduled') then
    return jsonb_build_object('ok', false, 'error', 'This research already has an active defense request. Check its status instead of submitting again.');
  end if;
  if v_last.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'The latest defense record is cancelled. Please contact the administrator.');
  end if;
  if v_last.status <> 'completed' then
    return jsonb_build_object('ok', false, 'error', 'The previous defense must be completed before requesting the next stage.');
  end if;

  if v_last.defense_type = 'title' then v_next_type := 'proposal';
  elsif v_last.defense_type = 'proposal' then v_next_type := 'final';
  elsif v_last.defense_type = 'final' then
    return jsonb_build_object('ok', false, 'error', 'All three defense stages are already completed.');
  else
    return jsonb_build_object('ok', false, 'error', 'The previous defense type is not recorded. Please contact the administrator.');
  end if;

  if exists (select 1 from public.research_defenses rd where rd.research_group_id = v_group.id and rd.defense_type = v_next_type) then
    return jsonb_build_object('ok', false, 'error', 'The next defense stage already exists. Check the research status instead.');
  end if;

  if length(btrim(coalesce(p_title, ''))) = 0 then return jsonb_build_object('ok', false, 'error', 'Research title is required.'); end if;
  if length(btrim(coalesce(p_contact_person, ''))) = 0 then return jsonb_build_object('ok', false, 'error', 'Contact person is required.'); end if;
  if v_file_url is not null and v_file_url !~ '^https://(drive|docs)\.google\.com/' then return jsonb_build_object('ok', false, 'error', 'Research file link must be a valid Google Drive or Google Docs URL.'); end if;
  if v_program not in ('BEED','BSED','BSA','BSAIS','BSBA') then return jsonb_build_object('ok', false, 'error', 'A valid program is required.'); end if;
  if v_program = 'BSED' and coalesce(v_major, '') not in ('English','Filipino','Mathematics','Science') then return jsonb_build_object('ok', false, 'error', 'A valid BSED major is required.'); end if;
  if v_program = 'BSBA' and coalesce(v_major, '') not in ('MM','FM','HRM') then return jsonb_build_object('ok', false, 'error', 'A valid BSBA major is required.'); end if;
  if v_program in ('BEED','BSA','BSAIS') then v_major := null; end if;
  if p_instructor_id is not null and not exists (select 1 from public.faculty f where f.id=p_instructor_id and f.is_active and f.can_teach_research) then return jsonb_build_object('ok', false, 'error', 'Selected research instructor is unavailable.'); end if;
  if p_adviser_id is not null and not exists (select 1 from public.faculty f where f.id=p_adviser_id and f.is_active and f.can_advise) then return jsonb_build_object('ok', false, 'error', 'Selected research adviser is unavailable.'); end if;
  if coalesce(array_length(p_members, 1), 0) = 0 then return jsonb_build_object('ok', false, 'error', 'At least one group member is required.'); end if;

  delete from public.group_members gm where gm.research_group_id = v_group.id;
  foreach v_member in array p_members loop
    if length(btrim(coalesce(v_member, ''))) > 0 then
      insert into public.group_members (research_group_id, full_name, sort_order)
      values (v_group.id, btrim(v_member), v_order);
      v_member_values := array_append(v_member_values, btrim(v_member));
      v_order := v_order + 1;
    end if;
  end loop;
  if v_order = 0 then raise exception 'At least one non-empty group member is required'; end if;

  update public.research_groups rg set
    title = btrim(p_title),
    contact_person = btrim(p_contact_person),
    contact_email = nullif(btrim(coalesce(p_contact_email, '')), ''),
    contact_number = nullif(btrim(coalesce(p_contact_number, '')), ''),
    instructor_id = p_instructor_id,
    adviser_id = p_adviser_id,
    research_file_url = v_file_url,
    program = v_program,
    major = v_major,
    defense_type = v_next_type,
    status = 'pending'
  where rg.id = v_group.id;

  insert into public.research_defenses (
    research_group_id, defense_type, status, title_snapshot, program_snapshot, major_snapshot,
    research_file_url, adviser_id_snapshot, instructor_id_snapshot, members_snapshot, source
  ) values (
    v_group.id, v_next_type, 'pending', btrim(p_title), v_program, v_major,
    v_file_url, p_adviser_id, p_instructor_id, v_member_values, 'continuation'
  ) returning id into v_defense_id;

  return jsonb_build_object('ok', true, 'public_code', v_group.public_code, 'defense_id', v_defense_id, 'defense_type', v_next_type);
end;
$function$;
