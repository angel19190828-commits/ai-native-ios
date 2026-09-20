create extension if not exists pgcrypto;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  request text not null check (char_length(request) between 1 and 20000),
  phase text not null check (phase in ('draft','planning','needs_decision','ready','executing','completed','partially_completed','failed','stopped')),
  revision integer not null default 0 check (revision >= 0),
  facts jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  pending_decision jsonb,
  confirmed_plan jsonb,
  stop_requested boolean not null default false,
  sync_version integer not null default 1 check (sync_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index tasks_user_updated_idx on public.tasks(user_id, updated_at desc) where deleted_at is null;

create table public.task_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  sequence integer not null check (sequence > 0),
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique(task_id, sequence)
);

create index task_events_user_task_idx on public.task_events(user_id, task_id, sequence);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  installation_id text not null,
  platform text not null check (platform in ('ios','android')),
  push_token text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, installation_id)
);

alter table public.tasks enable row level security;
alter table public.task_events enable row level security;
alter table public.devices enable row level security;

revoke all on public.tasks, public.task_events, public.devices from anon, authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert on public.task_events to authenticated;
grant select, insert, update, delete on public.devices to authenticated;
grant usage, select on sequence public.task_events_id_seq to authenticated;

create policy tasks_select_own on public.tasks for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy tasks_insert_own on public.tasks for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy tasks_update_own on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy tasks_delete_own on public.tasks for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy task_events_select_own on public.task_events for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy task_events_insert_own on public.task_events for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and exists (
      select 1 from public.tasks
      where tasks.id = task_events.task_id and tasks.user_id = (select auth.uid())
    )
  );

create policy devices_select_own on public.devices for select to authenticated using ((select auth.uid()) = user_id);
create policy devices_insert_own on public.devices for insert to authenticated with check ((select auth.uid()) = user_id);
create policy devices_update_own on public.devices for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy devices_delete_own on public.devices for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.sync_task_snapshot(
  p_task jsonb,
  p_event jsonb default null,
  p_expected_sync_version integer default 0
)
returns public.tasks
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_task_id uuid := (p_task->>'id')::uuid;
  v_current_version integer;
  v_next_version integer;
  v_sequence integer;
  v_row public.tasks;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;

  select sync_version into v_current_version
    from public.tasks where id = v_task_id and deleted_at is null for update;

  if not found then
    if p_expected_sync_version <> 0 then
      raise exception 'task_version_conflict' using errcode = '40001';
    end if;
    insert into public.tasks (
      id, user_id, request, phase, revision, facts, steps, pending_decision,
      confirmed_plan, stop_requested, updated_at, sync_version
    ) values (
      v_task_id, auth.uid(), p_task->>'request', p_task->>'phase',
      (p_task->>'revision')::integer, p_task->'facts', p_task->'steps',
      p_task->'pendingDecision', p_task->'confirmedPlan',
      coalesce((p_task->>'stopRequested')::boolean, false),
      (p_task->>'updatedAt')::timestamptz, 1
    ) returning * into v_row;
    v_next_version := 1;
  else
    if v_current_version <> p_expected_sync_version then
      raise exception 'task_version_conflict' using errcode = '40001';
    end if;
    v_next_version := v_current_version + 1;
    update public.tasks set
      request = p_task->>'request', phase = p_task->>'phase',
      revision = (p_task->>'revision')::integer, facts = p_task->'facts',
      steps = p_task->'steps', pending_decision = p_task->'pendingDecision',
      confirmed_plan = p_task->'confirmedPlan',
      stop_requested = coalesce((p_task->>'stopRequested')::boolean, false),
      updated_at = (p_task->>'updatedAt')::timestamptz,
      sync_version = v_next_version
    where id = v_task_id
    returning * into v_row;
  end if;

  if p_event is not null then
    select coalesce(max(sequence), 0) + 1 into v_sequence
      from public.task_events where task_id = v_task_id;
    insert into public.task_events(task_id, user_id, sequence, event_type, payload)
      values (v_task_id, auth.uid(), v_sequence, coalesce(p_event->>'type', 'task.snapshot'), p_event);
  end if;

  return v_row;
end;
$$;

grant execute on function public.sync_task_snapshot(jsonb, jsonb, integer) to authenticated;
