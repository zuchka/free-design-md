-- Per-operation diagnostics; URLs never become high-cardinality metric labels.
create table app.fdmd_extraction_requests (
  request_id uuid primary key,
  url text check (length(url) <= 2048),
  completed_at timestamptz not null default now(),
  caller text not null check (caller in ('http', 'direct')),
  status text not null check (status in ('success', 'error')),
  code text not null,
  stage text not null,
  duration_ms integer not null check (duration_ms >= 0),
  upstream_status integer,
  retried boolean not null
);

create index fdmd_extraction_requests_completed_idx
  on app.fdmd_extraction_requests (completed_at desc, request_id desc);
create index fdmd_extraction_requests_http_status_idx
  on app.fdmd_extraction_requests (status, completed_at desc, request_id desc)
  where caller = 'http';

-- Private operational history: inaccessible to Supabase's public API roles.
revoke all on app.fdmd_extraction_requests from public, anon, authenticated;
revoke all on app.fdmd_extraction_requests from free_design_app;
grant select, insert, delete on app.fdmd_extraction_requests to free_design_app;
alter table app.fdmd_extraction_requests enable row level security;
create policy extraction_history_runtime on app.fdmd_extraction_requests
  to free_design_app using (true) with check (true);
