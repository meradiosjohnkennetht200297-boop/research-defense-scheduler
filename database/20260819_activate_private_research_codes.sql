-- Activate the private 4-character Research Code only after the new public
-- interface is deployed. Existing public IDs are replaced because they were
-- previously visible on public schedule pages.

alter table public.research_groups
  alter column public_code set default public.generate_research_code();

do $$
declare
  v_group record;
begin
  for v_group in
    select id from public.research_groups order by created_at, id
  loop
    update public.research_groups
    set public_code = public.generate_research_code(),
        access_key_hash = null,
        access_key_created_at = null
    where id = v_group.id;
  end loop;
end;
$$;

alter table public.research_groups
  drop constraint if exists research_groups_private_code_format_check;

alter table public.research_groups
  add constraint research_groups_private_code_format_check
  check (public_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$');

-- The code is a private credential. Anonymous visitors may still see the
-- allowed public research fields for a published defense, but never its code.
revoke select(public_code) on public.research_groups from anon;

comment on column public.research_groups.public_code is
  'Private 4-character Research Code used by the research group for status and continuation.';
