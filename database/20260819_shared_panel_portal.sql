-- One shared private access link for the read-only panel portal.
-- The raw token is stored server-side so an authenticated administrator can
-- copy the current link again later. The table is never exposed to browser
-- roles; only the server-side service role can read or rotate it.

create table if not exists public.panel_portal_access (
  id smallint primary key default 1 check (id = 1),
  access_token text not null check (char_length(access_token) >= 40),
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  rotated_by uuid
);

alter table public.panel_portal_access enable row level security;

revoke all on table public.panel_portal_access from public;
revoke all on table public.panel_portal_access from anon;
revoke all on table public.panel_portal_access from authenticated;
grant select, insert, update on table public.panel_portal_access to service_role;

insert into public.panel_portal_access (id, access_token)
values (1, 'pnl_' || encode(gen_random_bytes(24), 'hex'))
on conflict (id) do nothing;

comment on table public.panel_portal_access is
  'Server-only singleton holding the current shared private Panel Portal token.';
comment on column public.panel_portal_access.access_token is
  'Private shared token. Never expose through public or authenticated table grants.';
