-- Jahez — Phase 1: row level security
-- Roles (docs/PRD.md section 2):
--   employee   : own data only
--   supervisor : reads every employee's punches; approves own department's requests (Phase 8)
--   hr         : reads everything; enrolls faces and gives final approval (via server functions)
--   admin      : manages organisation, employees, sites, devices; reads audit log
-- Punches, face templates and approvals are written only by server code (service role).

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so they can read employees under RLS)
-- ---------------------------------------------------------------------------
create function private.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  where e.user_id = auth.uid() and e.is_active
$$;

create function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select e.role
  from public.employees e
  where e.user_id = auth.uid() and e.is_active
$$;

create function private.has_role(roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = any (roles), false)
$$;

-- supervisor, hr or admin
create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role(array['supervisor', 'hr', 'admin']::public.app_role[])
$$;

create function private.is_emergency_target(p_emergency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.emergency_targets t
    where t.emergency_id = p_emergency_id
      and t.employee_id = private.current_employee_id()
  )
$$;

create function private.is_emergency_active(p_emergency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.emergencies e
    where e.id = p_emergency_id and e.status = 'active'
  )
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function
  private.current_employee_id(),
  private.current_app_role(),
  private.has_role(public.app_role[]),
  private.is_staff(),
  private.is_emergency_target(uuid),
  private.is_emergency_active(uuid)
to authenticated;

-- Anonymous visitors get nothing.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Organisation: everyone signed in can read; only admin writes
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['work_patterns', 'departments', 'sites', 'buildings', 'public_holidays'] loop
    execute format(
      'create policy "signed-in users can read" on public.%I for select to authenticated using (true)', t);
    execute format(
      'create policy "admin can insert" on public.%I for insert to authenticated with check ((select private.has_role(array[''admin'']::public.app_role[])))', t);
    execute format(
      'create policy "admin can update" on public.%I for update to authenticated using ((select private.has_role(array[''admin'']::public.app_role[]))) with check ((select private.has_role(array[''admin'']::public.app_role[])))', t);
    execute format(
      'create policy "admin can delete" on public.%I for delete to authenticated using ((select private.has_role(array[''admin'']::public.app_role[])))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Employees
-- ---------------------------------------------------------------------------
create policy "read own row or staff reads all" on public.employees
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

create policy "admin can insert" on public.employees
  for insert to authenticated
  with check ((select private.has_role(array['admin']::public.app_role[])));

create policy "admin can update" on public.employees
  for update to authenticated
  using ((select private.has_role(array['admin']::public.app_role[])))
  with check ((select private.has_role(array['admin']::public.app_role[])));

create policy "admin can delete" on public.employees
  for delete to authenticated
  using ((select private.has_role(array['admin']::public.app_role[])));

-- Enabled sites
create policy "read own or staff reads all" on public.employee_sites
  for select to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_staff()));

create policy "admin can insert" on public.employee_sites
  for insert to authenticated
  with check ((select private.has_role(array['admin']::public.app_role[])));

create policy "admin can delete" on public.employee_sites
  for delete to authenticated
  using ((select private.has_role(array['admin']::public.app_role[])));

-- Devices: binding happens through a server function (Phase 2); admin can unbind.
create policy "read own or admin reads all" on public.devices
  for select to authenticated
  using (
    employee_id = (select private.current_employee_id())
    or (select private.has_role(array['admin']::public.app_role[]))
  );

create policy "admin can delete" on public.devices
  for delete to authenticated
  using ((select private.has_role(array['admin']::public.app_role[])));

-- face_templates: RLS on, no policies => no client role can read or write.

-- Consents: the employee accepts for themself; HR and admin can read.
create policy "read own or hr and admin read all" on public.consents
  for select to authenticated
  using (
    employee_id = (select private.current_employee_id())
    or (select private.has_role(array['hr', 'admin']::public.app_role[]))
  );

create policy "employee records own consent" on public.consents
  for insert to authenticated
  with check (employee_id = (select private.current_employee_id()));

-- ---------------------------------------------------------------------------
-- Attendance: read only for clients
-- ---------------------------------------------------------------------------
create policy "read own or staff reads all" on public.attendance_punches
  for select to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Requests: employee creates own; decisions go through server functions (Phase 8)
-- ---------------------------------------------------------------------------
create policy "read own or staff reads all" on public.requests
  for select to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_staff()));

create policy "employee creates own request" on public.requests
  for insert to authenticated
  with check (
    employee_id = (select private.current_employee_id())
    and status = 'pending_supervisor'
  );

create policy "read approvals of own requests or staff reads all" on public.request_approvals
  for select to authenticated
  using (
    (select private.is_staff())
    or exists (
      select 1 from public.requests r
      where r.id = request_id
        and r.employee_id = (select private.current_employee_id())
    )
  );

-- ---------------------------------------------------------------------------
-- Notifications: read own, mark as read
-- ---------------------------------------------------------------------------
create policy "read own" on public.notifications
  for select to authenticated
  using (employee_id = (select private.current_employee_id()));

create policy "mark own as read" on public.notifications
  for update to authenticated
  using (employee_id = (select private.current_employee_id()))
  with check (employee_id = (select private.current_employee_id()));

revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Emergencies: admin and supervisors start and close; targets read and respond
-- ---------------------------------------------------------------------------
create policy "staff or targets read" on public.emergencies
  for select to authenticated
  using ((select private.is_staff()) or (select private.is_emergency_target(id)));

create policy "admin and supervisors start" on public.emergencies
  for insert to authenticated
  with check ((select private.has_role(array['admin', 'supervisor']::public.app_role[])));

create policy "admin and supervisors update" on public.emergencies
  for update to authenticated
  using ((select private.has_role(array['admin', 'supervisor']::public.app_role[])))
  with check ((select private.has_role(array['admin', 'supervisor']::public.app_role[])));

create policy "staff or targets read" on public.emergency_buildings
  for select to authenticated
  using ((select private.is_staff()) or (select private.is_emergency_target(emergency_id)));

create policy "admin and supervisors insert" on public.emergency_buildings
  for insert to authenticated
  with check ((select private.has_role(array['admin', 'supervisor']::public.app_role[])));

create policy "read own or staff reads all" on public.emergency_targets
  for select to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_staff()));

create policy "admin and supervisors insert" on public.emergency_targets
  for insert to authenticated
  with check ((select private.has_role(array['admin', 'supervisor']::public.app_role[])));

create policy "read own or staff reads all" on public.emergency_responses
  for select to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_staff()));

create policy "target responds while active" on public.emergency_responses
  for insert to authenticated
  with check (
    employee_id = (select private.current_employee_id())
    and (select private.is_emergency_active(emergency_id))
  );

create policy "target changes response while active" on public.emergency_responses
  for update to authenticated
  using (employee_id = (select private.current_employee_id()))
  with check (
    employee_id = (select private.current_employee_id())
    and (select private.is_emergency_active(emergency_id))
  );

-- ---------------------------------------------------------------------------
-- Audit log: admin reads; rows come only from triggers
-- ---------------------------------------------------------------------------
create policy "admin reads" on public.audit_log
  for select to authenticated
  using ((select private.has_role(array['admin']::public.app_role[])));

revoke insert, update, delete on public.audit_log from authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for punch photos (written by server code only)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('punch-photos', 'punch-photos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "staff read punch photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'punch-photos' and (select private.is_staff()));
