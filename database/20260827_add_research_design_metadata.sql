alter table public.research_groups
  add column if not exists research_design text,
  add column if not exists research_design_other text;

alter table public.research_groups
  drop constraint if exists research_groups_research_design_check;

alter table public.research_groups
  add constraint research_groups_research_design_check
  check (
    research_design is null
    or research_design in (
      'descriptive',
      'experimental',
      'developmental',
      'qualitative',
      'mixed_methods',
      'other'
    )
  );

alter table public.research_groups
  drop constraint if exists research_groups_research_design_other_check;

alter table public.research_groups
  add constraint research_groups_research_design_other_check
  check (
    (research_design is null and research_design_other is null)
    or (research_design = 'other' and length(btrim(coalesce(research_design_other, ''))) > 0)
    or (research_design is not null and research_design <> 'other' and research_design_other is null)
  );

grant select (research_design, research_design_other) on public.research_groups to authenticated;
grant update (research_design, research_design_other) on public.research_groups to authenticated;

comment on column public.research_groups.research_design is
  'Research design classification used as record metadata only.';
comment on column public.research_groups.research_design_other is
  'Free-text research design used only when research_design is other.';
