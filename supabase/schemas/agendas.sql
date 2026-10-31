-- Server-only corpus. Apply this reviewed schema once; do not expose service credentials in browsers.
create extension if not exists vector with schema extensions;

create table if not exists public.agenda_documents (
  id text primary key,
  title text not null,
  body text not null,
  meeting_date timestamptz not null,
  url text not null,
  meeting_url text not null,
  kind text not null check (kind in ('agenda','minutes')),
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.agenda_chunks (
  id text primary key,
  document_id text not null references public.agenda_documents(id) on delete cascade,
  item text,
  page integer not null check(page>0),
  title text not null,
  content text not null,
  embedding extensions.vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists agenda_chunks_document_idx on public.agenda_chunks(document_id);
create index if not exists agenda_documents_meeting_idx on public.agenda_documents(meeting_date);
alter table public.agenda_documents enable row level security;
alter table public.agenda_chunks enable row level security;
revoke all on public.agenda_documents,public.agenda_chunks from public,anon,authenticated;
grant select,insert,update,delete on public.agenda_documents,public.agenda_chunks to service_role;

create or replace function public.replace_agenda_document(p_document jsonb,p_chunks jsonb)
returns void language plpgsql security invoker set search_path=public,extensions as $$
begin
  insert into public.agenda_documents(id,title,body,meeting_date,url,meeting_url,kind,content_hash,metadata)
  values(p_document->>'id',p_document->>'title',p_document->>'body',(p_document->>'meeting_date')::timestamptz,p_document->>'url',p_document->>'meeting_url',p_document->>'kind',p_document->>'content_hash',p_document->'metadata')
  on conflict(id) do update set title=excluded.title,body=excluded.body,meeting_date=excluded.meeting_date,url=excluded.url,meeting_url=excluded.meeting_url,kind=excluded.kind,content_hash=excluded.content_hash,metadata=excluded.metadata,updated_at=now();
  delete from public.agenda_chunks where document_id=p_document->>'id';
  insert into public.agenda_chunks(id,document_id,item,page,title,content,embedding,metadata)
  select x->>'id',p_document->>'id',x->>'item',(x->>'page')::integer,x->>'title',x->>'text',(x->'embedding')::text::extensions.vector,x->'metadata'
  from jsonb_array_elements(p_chunks) x;
end $$;

create or replace function public.match_agenda_chunks(query_embedding extensions.vector(1536),match_count integer default 6,match_threshold double precision default 0.2,period_filter text default 'all',as_of timestamptz default now())
returns table(id text,title text,content text,meeting_date timestamptz,metadata jsonb,similarity double precision)
language sql stable security invoker set search_path=public,extensions as $$
  select c.id,c.title,c.content,d.meeting_date,c.metadata,1-(c.embedding <=> query_embedding) as similarity
  from public.agenda_chunks c join public.agenda_documents d on d.id=c.document_id
  where (period_filter='all' or (period_filter='upcoming' and d.meeting_date>=as_of) or (period_filter='past' and d.meeting_date<as_of))
    and 1-(c.embedding <=> query_embedding)>=match_threshold
  order by c.embedding <=> query_embedding limit least(greatest(match_count,1),12)
$$;
revoke all on function public.replace_agenda_document(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.match_agenda_chunks(extensions.vector,integer,double precision,text,timestamptz) from public,anon,authenticated;
grant execute on function public.replace_agenda_document(jsonb,jsonb) to service_role;
grant execute on function public.match_agenda_chunks(extensions.vector,integer,double precision,text,timestamptz) to service_role;
notify pgrst,'reload schema';
