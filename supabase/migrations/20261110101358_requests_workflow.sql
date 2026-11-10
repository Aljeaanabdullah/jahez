-- Jahez — Phase 8: requests (punch correction, external mission) and their approval path (PRD 7).
-- Path: employee -> supervisor of the department -> HR. No stage can be skipped; nobody approves their own request.
--  * No supervisor for the department, or the supervisor is the requester: the system admin does the first approval.
--  * Request from an HR employee: the final approval is the system admin's only.
--  * Punch correction: for a shift in the last 7 days. An approved correction enters the record, marked as corrected.
--  * External mission: one date (today .. +30 days), a site not enabled for the employee. Once approved, punching
--    is allowed at that site for the shift of that date only.
-- All writes go through the functions below; clients cannot insert or update requests directly.

-- ---------------------------------------------------------------------------
-- Corrected punches are marked and linked to their request.
-- ---------------------------------------------------------------------------
alter table public.attendance_punches
  add column source text not null default 'device' check (source in ('device', 'correction')),
  add column request_id uuid references public.requests (id) on delete set null;
create index attendance_punches_request_idx on public.attendance_punches (request_id);

alter table public.attendance_days
  add column check_in_corrected boolean not null default false,
  add column check_out_corrected boolean not null default false;

create index requests_employee_idx on public.requests (employee_id, created_at desc);
create index requests_status_date_idx on public.requests (status, shift_date);
create trigger audit after insert or update or delete on public.requests for each row execute function private.audit_row_change();

-- Writes only through the functions.
drop policy "employee creates own request" on public.requests;
revoke insert, update, delete on public.requests from authenticated, anon;
revoke insert, update, delete on public.request_approvals from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Apply a punch to its shift. Corrections overwrite what the device recorded.
-- ---------------------------------------------------------------------------
create or replace function public.attendance_apply_punch(p_punch_id uuid, p_shift_start timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pu public.attendance_punches%rowtype;
  sh record;
  v_fix boolean;
begin
  select * into pu from public.attendance_punches where id = p_punch_id and result = 'accepted';
  if not found then return; end if;
  v_fix := pu.source = 'correction';
  select * into sh from private.employee_shifts(pu.employee_id, pu.punched_at - interval '3 days', pu.punched_at) s
  where s.shift_start = p_shift_start;
  if not found then return; end if;

  if pu.punch_type = 'check_in' then
    insert into public.attendance_days as t (
      employee_id, shift_date, shift_start, shift_end, checkout_closes, work_pattern_id,
      arrival, check_in_at, check_in_punch_id, late_minutes, check_in_corrected, departure
    ) values (
      pu.employee_id, sh.shift_date, sh.shift_start, sh.shift_end, sh.checkout_closes, sh.pattern_id,
      case when pu.punched_at > sh.grace_end then 'late'::public.arrival_status else 'on_time'::public.arrival_status end,
      pu.punched_at, pu.id,
      greatest(0, ceil(extract(epoch from (pu.punched_at - sh.grace_end)) / 60))::integer,
      v_fix,
      case when sh.checkout_closes <= now() then 'missing'::public.departure_status else 'pending'::public.departure_status end
    )
    on conflict (employee_id, shift_start) do update set
      arrival = excluded.arrival,
      check_in_at = excluded.check_in_at,
      check_in_punch_id = excluded.check_in_punch_id,
      late_minutes = excluded.late_minutes,
      check_in_corrected = excluded.check_in_corrected,
      -- an absent day that gets a check-in now waits for (or misses) its check-out
      departure = case
        when t.check_out_at is not null then 'done'::public.departure_status
        when t.departure = 'not_applicable' then excluded.departure
        else t.departure end
    where t.check_in_at is null or v_fix;
  else
    update public.attendance_days set
      departure = 'done',
      check_out_at = pu.punched_at,
      check_out_punch_id = pu.id,
      check_out_corrected = v_fix,
      early_leave_minutes = greatest(0, ceil(extract(epoch from (sh.shift_end - pu.punched_at)) / 60))::integer
    where employee_id = pu.employee_id and shift_start = p_shift_start
      and check_in_at is not null and (check_out_at is null or v_fix);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sites where the employee may punch: enabled sites, plus a site of an approved mission for that shift date.
-- ---------------------------------------------------------------------------
drop function public.sites_near(uuid, double precision, double precision);
create function public.sites_near(p_employee_id uuid, p_lat double precision, p_lng double precision, p_on date)
returns table (site_id uuid, name_ar text, name_en text, radius_m integer, distance_m double precision, by_mission boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with allowed as (
    select es.site_id, false as by_mission from public.employee_sites es where es.employee_id = p_employee_id
    union all
    select r.mission_site_id, true from public.requests r
    where r.employee_id = p_employee_id and r.request_type = 'external_mission'
      and r.status = 'approved' and r.shift_date = p_on
  ),
  dedup as (select a.site_id, bool_and(a.by_mission) as by_mission from allowed a group by a.site_id)
  select s.id, s.name_ar, s.name_en, s.radius_m,
    2 * 6371000 * asin(sqrt(
      power(sin(radians(s.latitude - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(s.latitude)) * power(sin(radians(s.longitude - p_lng) / 2), 2)
    )) as distance_m,
    d.by_mission
  from dedup d
  join public.sites s on s.id = d.site_id
  where s.is_active
  order by distance_m
$$;
revoke all on function public.sites_near(uuid, double precision, double precision, date) from public, anon, authenticated;
grant execute on function public.sites_near(uuid, double precision, double precision, date) to service_role;

-- ---------------------------------------------------------------------------
-- Kuwait "today".
-- ---------------------------------------------------------------------------
create function private.kuwait_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Kuwait')::date $$;

-- ---------------------------------------------------------------------------
-- Submit a request (the signed-in employee).
-- ---------------------------------------------------------------------------
create function public.submit_request(
  p_type public.request_type,
  p_shift_date date,
  p_reason text,
  p_punch_type public.punch_type default null,
  p_time timestamptz default null,
  p_site uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_employee_id();
  sh record;
  a public.attendance_days%rowtype;
  v_id uuid;
  v_today date := private.kuwait_today();
begin
  if v_me is null or not exists (select 1 from public.employees where id = v_me and is_active) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 or char_length(p_reason) > 1000 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  if p_type = 'punch_correction' then
    if p_punch_type is null or p_time is null or p_site is not null then
      raise exception 'invalid_request' using errcode = '22023';
    end if;
    if p_shift_date < v_today - 7 or p_shift_date > v_today then
      raise exception 'correction_too_old' using errcode = '22023';
    end if;
    if p_time > now() then
      raise exception 'time_in_future' using errcode = '22023';
    end if;
    select * into sh from private.employee_shifts(
      v_me, (p_shift_date::timestamp) at time zone 'Asia/Kuwait', ((p_shift_date + 1)::timestamp) at time zone 'Asia/Kuwait') s
    where s.shift_date = p_shift_date order by s.shift_start limit 1;
    if not found then
      raise exception 'no_shift_that_day' using errcode = '22023';
    end if;
    if p_punch_type = 'check_in' and not (p_time >= sh.checkin_opens and p_time < sh.shift_end) then
      raise exception 'time_outside_shift' using errcode = '22023';
    end if;
    if p_punch_type = 'check_out' and not (p_time > sh.shift_start and p_time <= sh.checkout_closes) then
      raise exception 'time_outside_shift' using errcode = '22023';
    end if;
    if p_punch_type = 'check_out' then
      select * into a from public.attendance_days x where x.employee_id = v_me and x.shift_start = sh.shift_start;
      if not ((found and a.check_in_at is not null and p_time > a.check_in_at)
              or exists (select 1 from public.requests r where r.employee_id = v_me and r.shift_date = p_shift_date
                         and r.request_type = 'punch_correction' and r.corrected_punch_type = 'check_in'
                         and r.status in ('pending_supervisor', 'pending_hr') and r.corrected_time < p_time)) then
        raise exception 'check_in_first' using errcode = '22023';
      end if;
    end if;
    if exists (select 1 from public.requests r where r.employee_id = v_me and r.shift_date = p_shift_date
               and r.request_type = 'punch_correction' and r.corrected_punch_type = p_punch_type
               and r.status in ('pending_supervisor', 'pending_hr')) then
      raise exception 'duplicate_request' using errcode = '23505';
    end if;
  else
    if p_site is null or p_punch_type is not null or p_time is not null then
      raise exception 'invalid_request' using errcode = '22023';
    end if;
    if p_shift_date < v_today or p_shift_date > v_today + 30 then
      raise exception 'mission_date_out_of_range' using errcode = '22023';
    end if;
    if not exists (select 1 from public.sites s where s.id = p_site and s.is_active) then
      raise exception 'site_not_found' using errcode = '22023';
    end if;
    if exists (select 1 from public.employee_sites es where es.employee_id = v_me and es.site_id = p_site) then
      raise exception 'site_already_enabled' using errcode = '22023';
    end if;
    if exists (select 1 from public.requests r where r.employee_id = v_me and r.shift_date = p_shift_date
               and r.request_type = 'external_mission' and r.mission_site_id = p_site
               and r.status in ('pending_supervisor', 'pending_hr', 'approved')) then
      raise exception 'duplicate_request' using errcode = '23505';
    end if;
  end if;

  insert into public.requests (employee_id, request_type, shift_date, corrected_punch_type, corrected_time, mission_site_id, reason)
  values (v_me, p_type, p_shift_date, p_punch_type, p_time, p_site, btrim(p_reason))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancel one's own request before the final decision.
-- ---------------------------------------------------------------------------
create function public.cancel_request(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.requests set status = 'cancelled'
  where id = p_request and employee_id = private.current_employee_id()
    and status in ('pending_supervisor', 'pending_hr');
  if not found then
    raise exception 'cannot_cancel' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- May this employee decide this request at its current stage?
-- ---------------------------------------------------------------------------
create function private.can_decide(p_actor uuid, p_request uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.requests%rowtype;
  v_role public.app_role;
  v_requester_role public.app_role;
  v_supervisor uuid;
  v_supervisor_ok boolean;
begin
  select * into r from public.requests where id = p_request;
  if not found or p_actor is null or r.employee_id = p_actor then return false; end if;
  select role into v_role from public.employees where id = p_actor and is_active;
  if v_role is null then return false; end if;
  select e.role, d.supervisor_id into v_requester_role, v_supervisor
  from public.employees e left join public.departments d on d.id = e.department_id
  where e.id = r.employee_id;

  if r.status = 'pending_supervisor' then
    -- The department's supervisor; the system admin when there is none (or it is the requester, or inactive).
    v_supervisor_ok := v_supervisor is not null and v_supervisor <> r.employee_id
      and exists (select 1 from public.employees s where s.id = v_supervisor and s.is_active);
    if v_supervisor_ok then return p_actor = v_supervisor; end if;
    return v_role = 'admin';
  elsif r.status = 'pending_hr' then
    if v_requester_role = 'hr' then return v_role = 'admin'; end if;
    return v_role = 'hr';
  end if;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Approve or reject at the current stage. The final approval applies the request.
-- ---------------------------------------------------------------------------
create function public.decide_request(p_request uuid, p_approve boolean, p_note text default null)
returns public.request_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_employee_id();
  r public.requests%rowtype;
  v_stage public.approval_stage;
  v_status public.request_status;
  sh record;
  v_punch uuid;
begin
  select * into r from public.requests where id = p_request for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not private.can_decide(v_me, p_request) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'note_too_long' using errcode = '22023';
  end if;
  v_stage := case r.status when 'pending_supervisor' then 'supervisor'::public.approval_stage else 'hr'::public.approval_stage end;

  if not p_approve then
    v_status := 'rejected';
  elsif v_stage = 'supervisor' then
    v_status := 'pending_hr';
  else
    v_status := 'approved';
    if r.request_type = 'punch_correction' then
      select * into sh from private.employee_shifts(
        r.employee_id, (r.shift_date::timestamp) at time zone 'Asia/Kuwait', ((r.shift_date + 1)::timestamp) at time zone 'Asia/Kuwait') s
      where s.shift_date = r.shift_date order by s.shift_start limit 1;
      if not found then raise exception 'no_shift_that_day' using errcode = '22023'; end if;
      if r.corrected_punch_type = 'check_out' and not exists (
        select 1 from public.attendance_days a where a.employee_id = r.employee_id and a.shift_start = sh.shift_start
          and a.check_in_at is not null and a.check_in_at < r.corrected_time) then
        raise exception 'check_in_first' using errcode = '22023';
      end if;
      insert into public.attendance_punches (
        employee_id, punch_type, punched_at, shift_date, result, source, request_id
      ) values (
        r.employee_id, r.corrected_punch_type, r.corrected_time, r.shift_date, 'accepted', 'correction', r.id
      ) returning id into v_punch;
      perform public.attendance_apply_punch(v_punch, sh.shift_start);
    end if;
  end if;

  insert into public.request_approvals (request_id, stage, approver_id, decision, note)
  values (p_request, v_stage, v_me, case when p_approve then 'approved'::public.approval_decision else 'rejected'::public.approval_decision end,
          nullif(btrim(coalesce(p_note, '')), ''));
  update public.requests set status = v_status where id = p_request;
  return v_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- The approvals inbox: requests the signed-in user can decide now.
-- ---------------------------------------------------------------------------
create function public.approval_inbox()
returns table (
  id uuid, request_type public.request_type, status public.request_status, shift_date date,
  corrected_punch_type public.punch_type, corrected_time timestamptz, mission_site_id uuid,
  reason text, created_at timestamptz,
  employee_id uuid, file_number integer, full_name_ar text, full_name_en text,
  department_ar text, department_en text, site_ar text, site_en text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.request_type, r.status, r.shift_date, r.corrected_punch_type, r.corrected_time, r.mission_site_id,
         r.reason, r.created_at, e.id, e.file_number, e.full_name_ar, e.full_name_en,
         d.name_ar, d.name_en, s.name_ar, s.name_en
  from public.requests r
  join public.employees e on e.id = r.employee_id
  left join public.departments d on d.id = e.department_id
  left join public.sites s on s.id = r.mission_site_id
  where r.status in ('pending_supervisor', 'pending_hr')
    and private.can_decide(private.current_employee_id(), r.id)
  order by r.created_at
$$;

-- ---------------------------------------------------------------------------
-- History: who decided what (adds approver names, which employees cannot read directly).
-- ---------------------------------------------------------------------------
create function public.request_timeline(p_request uuid)
returns table (stage public.approval_stage, decision public.approval_decision, note text, decided_at timestamptz,
               approver_ar text, approver_en text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.requests r where r.id = p_request
                 and (r.employee_id = private.current_employee_id() or private.is_staff())) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select a.stage, a.decision, a.note, a.decided_at, e.full_name_ar, e.full_name_en
  from public.request_approvals a left join public.employees e on e.id = a.approver_id
  where a.request_id = p_request
  order by a.decided_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Day-by-day record: now also says which times were corrected by a request.
-- ---------------------------------------------------------------------------
drop function public.attendance_history(uuid, date, date);
create function public.attendance_history(p_employee uuid, p_from date, p_to date)
returns table (
  day date, kind text, shift_start timestamptz, shift_end timestamptz,
  arrival public.arrival_status, departure public.departure_status,
  check_in_at timestamptz, check_out_at timestamptz, late_minutes integer, early_leave_minutes integer,
  check_in_corrected boolean, check_out_corrected boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_created timestamptz;
begin
  if p_employee is distinct from private.current_employee_id() and not private.is_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;
  select e.created_at into v_created from public.employees e where e.id = p_employee;

  return query
  with sh as (
    select * from private.employee_shifts(
      p_employee,
      (p_from::timestamp) at time zone 'Asia/Kuwait',
      ((p_to + 1)::timestamp) at time zone 'Asia/Kuwait')
  ),
  days as (
    select g::date as d,
           (g::date::timestamp) at time zone 'Asia/Kuwait' as d_start,
           ((g::date + 1)::timestamp) at time zone 'Asia/Kuwait' as d_end
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g
  )
  select
    days.d,
    case
      when s.shift_start is not null and a.id is null and s.shift_start < v_created then 'before_hire'
      when s.shift_start is not null then 'work'
      when exists (select 1 from sh where sh.shift_start < days.d_end and sh.shift_end > days.d_start) then 'continued'
      when exists (select 1 from public.public_holidays h where h.holiday_date = days.d) then 'holiday'
      else 'off'
    end,
    s.shift_start,
    s.shift_end,
    case when s.shift_start is null or (a.id is null and s.shift_start < v_created) then null
         else coalesce(a.arrival, 'pending'::public.arrival_status) end,
    case when s.shift_start is null or (a.id is null and s.shift_start < v_created) then null
         else coalesce(a.departure, 'pending'::public.departure_status) end,
    a.check_in_at,
    a.check_out_at,
    coalesce(a.late_minutes, 0),
    coalesce(a.early_leave_minutes, 0),
    coalesce(a.check_in_corrected, false),
    coalesce(a.check_out_corrected, false)
  from days
  left join lateral (
    select sh.shift_start, sh.shift_end from sh where sh.shift_date = days.d order by sh.shift_start limit 1
  ) s on true
  left join public.attendance_days a on a.employee_id = p_employee and a.shift_start = s.shift_start
  order by days.d;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke all on function private.kuwait_today() from public, anon, authenticated;
revoke all on function private.can_decide(uuid, uuid) from public, anon, authenticated;
revoke all on function public.submit_request(public.request_type, date, text, public.punch_type, timestamptz, uuid) from public, anon;
grant execute on function public.submit_request(public.request_type, date, text, public.punch_type, timestamptz, uuid) to authenticated;
revoke all on function public.cancel_request(uuid) from public, anon;
grant execute on function public.cancel_request(uuid) to authenticated;
revoke all on function public.decide_request(uuid, boolean, text) from public, anon;
grant execute on function public.decide_request(uuid, boolean, text) to authenticated;
revoke all on function public.approval_inbox() from public, anon;
grant execute on function public.approval_inbox() to authenticated;
revoke all on function public.request_timeline(uuid) from public, anon;
grant execute on function public.request_timeline(uuid) to authenticated;
revoke all on function public.attendance_history(uuid, date, date) from public, anon;
grant execute on function public.attendance_history(uuid, date, date) to authenticated;
