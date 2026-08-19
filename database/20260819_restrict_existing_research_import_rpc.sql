-- The import RPC is callable only from authenticated admin sessions.
revoke execute on function public.import_existing_research_v1(text,text,text,text,text,text,text,uuid,uuid,text[],text,boolean,date,time without time zone,time without time zone,text,text,uuid,uuid[],boolean) from anon;
