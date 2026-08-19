-- Retire the shared Panel Access feature.
-- Panel members are not system users; manuscript sharing remains an admin workflow.

drop table if exists public.panel_portal_access;
