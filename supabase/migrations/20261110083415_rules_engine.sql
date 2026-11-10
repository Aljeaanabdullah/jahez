-- Jahez — Phase 7: work rules engine (PRD section 6). One set of rules, in the database,
-- used by the punch function, the 10-minute job, the app and the web panel.
-- All shift times are Kuwait time (Asia/Kuwait, UTC+3, no daylight saving).
--
-- Rules (owner decisions):
--  * check-in opens `checkin_opens_before` before the shift and stays open until the shift ends;
--  * the first `grace_period` (1 hour) is not late; late minutes count from the end of the grace;
--  * no check-in by the end of the shift = absent;
--  * check-out allowed until `checkout_window_after` (1 hour) after the shift; none = missing check-out;
--  * check-out before the shift ends is recorded as early-leave minutes (for reference only);
--  * shifts crossing midnight and 24/48-hour shifts are one shift: one check-in, one check-out;
--  * public holidays excuse morning/afternoon/evening patterns only; rotation staff work them.

create type public.arrival_status as enum ('pending', 'on_time', 'late', 'absent');
create type public.departure_status as enum ('pending', 'done', 'missing', 'not_applicable');

create table public.attendance_days (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  shift_date date not null,               -- Kuwait date the shift starts on
  shift_start timestamptz not null,
  shift_end timestamptz not null,
  checkout_closes timestamptz not null,
  work_pattern_id uuid references public.work_patterns (id) on delete set null,
  arrival public.arrival_status not null default 'pending',
  departure public.departure_status not null default 'pending',
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_punch_id uuid references public.attendance_punches (id) on delete set null,
  check_out_punch_id uuid references public.attendance_punches (id) on delete set null,
  late_minutes integer not null default 0 check (late_minutes >= 0),
  early_leave_minutes integer not null default 0 check (early_leave_minutes >= 0),
  updated_at timestamptz not null default now(),
  unique (employee_id, shift_start)
);
create index attendance_days_shift_date_idx on public.attendance_days (shift_date);
create index attendance_days_pattern_idx on public.attendance_days (work_pattern_id);
create index attendance_days_in_punch_idx on public.attendance_days (check_in_punch_id);
create index attendance_days_out_punch_idx on public.attendance_days (check_out_punch_id);
create trigger set_updated_at before update on public.attendance_days for each row execute function private.set_updated_at();

alter table public.attendance_days enable row level security;
create policy "read own or staff reads all" on public.attendance_days
  for select to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_staff()));
revoke insert, update, delete on public.attendance_days from authenticated, anon;

-- ---------------------------------------------------------------------------
-- The employee's shifts whose windows touch [p_from, p_to].
-- ---------------------------------------------------------------------------
create function private.employee_shifts(p_employee uuid, p_from timestamptz, p_to timestamptz)
returns table (
  shift_date date,
  shift_start timestamptz,
  shift_end timestamptz,
  checkin_opens timestamptz,
  grace_end timestamptz,
  checkout_closes timestamptz,
  pattern_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pattern uuid;
  v_cycle_start date;
  p public.work_patterns%rowtype;
  d date;
  d_to date;
  cyc integer;
  pos integer;
  step integer;
  s timestamptz;
  works boolean;
begin
  select e.work_pattern_id, e.cycle_start_date into v_pattern, v_cycle_start
  from public.employees e where e.id = p_employee;
  if v_pattern is null then return; end if;
  select * into p from public.work_patterns w where w.id = v_pattern;

  d := ((p_from - p.shift_duration - p.checkout_window_after) at time zone 'Asia/Kuwait')::date - 1;
  d_to := ((p_to + p.checkin_opens_before) at time zone 'Asia/Kuwait')::date;

  while d <= d_to loop
    works := false;
    if p.kind in ('one_on_two_off', 'two_on_four_off') then
      if v_cycle_start is not null then
        cyc := p.cycle_work_days + p.cycle_off_days;
        pos := (((d - v_cycle_start) % cyc) + cyc) % cyc;
        -- A 48-hour shift covers both work days with a single shift.
        step := greatest(1, ceil(extract(epoch from p.shift_duration) / 86400.0)::integer);
        works := pos < p.cycle_work_days and pos % step = 0;
      end if;
    else
      works := not (extract(isodow from d)::smallint = any (p.weekly_off_days))
        and not exists (select 1 from public.public_holidays h where h.holiday_date = d);
    end if;

    if works then
      s := (d + p.shift_start) at time zone 'Asia/Kuwait';
      if s + p.shift_duration + p.checkout_window_after >= p_from and s - p.checkin_opens_before <= p_to then
        shift_date := d;
        shift_start := s;
        shift_end := s + p.shift_duration;
        checkin_opens := s - p.checkin_opens_before;
        grace_end := s + p.grace_period;
        checkout_closes := s + p.shift_duration + p.checkout_window_after;
        pattern_id := p.id;
        return next;
      end if;
    end if;
    d := d + 1;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Which punch is allowed at p_at: check-in / check-out for a shift, or a refusal reason.
-- ---------------------------------------------------------------------------
create function public.punch_slot(p_employee uuid, p_at timestamptz)
returns table (shift_date date, shift_start timestamptz, punch_type public.punch_type, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  sh record;
  a public.attendance_days%rowtype;
  v_reason text := 'no_shift_now';
begin
  if not exists (select 1 from public.employees e where e.id = p_employee and e.work_pattern_id is not null) then
    return query select null::date, null::timestamptz, null::public.punch_type, 'no_work_pattern'::text;
    return;
  end if;

  -- 1. An open shift (checked in, not out) whose check-out window contains p_at.
  for sh in select * from private.employee_shifts(p_employee, p_at, p_at) s order by s.shift_start loop
    select * into a from public.attendance_days x where x.employee_id = p_employee and x.shift_start = sh.shift_start;
    if found and a.check_in_at is not null and a.check_out_at is null
       and p_at >= a.check_in_at and p_at <= sh.checkout_closes then
      return query select sh.shift_date, sh.shift_start, 'check_out'::public.punch_type, null::text;
      return;
    end if;
  end loop;

  -- 2. A shift whose check-in window contains p_at, not checked in yet.
  for sh in select * from private.employee_shifts(p_employee, p_at, p_at) s order by s.shift_start loop
    select * into a from public.attendance_days x where x.employee_id = p_employee and x.shift_start = sh.shift_start;
    if (not found or a.check_in_at is null) and p_at >= sh.checkin_opens and p_at < sh.shift_end then
      return query select sh.shift_date, sh.shift_start, 'check_in'::public.punch_type, null::text;
      return;
    end if;
  end loop;

  -- 3. Explain why not.
  for sh in select * from private.employee_shifts(p_employee, p_at, p_at) s order by s.shift_start loop
    select * into a from public.attendance_days x where x.employee_id = p_employee and x.shift_start = sh.shift_start;
    if found and a.check_out_at is not null and p_at <= sh.checkout_closes then
      v_reason := 'already_checked_out';
    elsif (not found or a.check_in_at is null) and p_at >= sh.shift_end and p_at <= sh.checkout_closes then
      v_reason := 'checkin_window_closed';
    end if;
  end loop;
  return query select null::date, null::timestamptz, null::public.punch_type, v_reason;
end;
$$;

-- ---------------------------------------------------------------------------
-- Apply an accepted punch to its shift (called by the punch function).
-- ---------------------------------------------------------------------------
create function public.attendance_apply_punch(p_punch_id uuid, p_shift_start timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pu public.attendance_punches%rowtype;
  sh record;
begin
  select * into pu from public.attendance_punches where id = p_punch_id and result = 'accepted';
  if not found then return; end if;
  select * into sh from private.employee_shifts(pu.employee_id, pu.punched_at - interval '3 days', pu.punched_at) s
  where s.shift_start = p_shift_start;
  if not found then return; end if;

  if pu.punch_type = 'check_in' then
    insert into public.attendance_days as t (
      employee_id, shift_date, shift_start, shift_end, checkout_closes, work_pattern_id,
      arrival, check_in_at, check_in_punch_id, late_minutes
    ) values (
      pu.employee_id, sh.shift_date, sh.shift_start, sh.shift_end, sh.checkout_closes, sh.pattern_id,
      case when pu.punched_at > sh.grace_end then 'late'::public.arrival_status else 'on_time'::public.arrival_status end,
      pu.punched_at, pu.id,
      greatest(0, ceil(extract(epoch from (pu.punched_at - sh.grace_end)) / 60))::integer
    )
    on conflict (employee_id, shift_start) do update set
      arrival = excluded.arrival,
      check_in_at = excluded.check_in_at,
      check_in_punch_id = excluded.check_in_punch_id,
      late_minutes = excluded.late_minutes
    where t.check_in_at is null;
  else
    update public.attendance_days set
      departure = 'done',
      check_out_at = pu.punched_at,
      check_out_punch_id = pu.id,
      early_leave_minutes = greatest(0, ceil(extract(epoch from (sh.shift_end - pu.punched_at)) / 60))::integer
    where employee_id = pu.employee_id and shift_start = p_shift_start and check_out_at is null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Every 10 minutes: absences (shift over, no check-in) and missing check-outs.
-- Looks back 3 days so a missed run is caught up. Safe to run repeatedly.
-- ---------------------------------------------------------------------------
create function public.attendance_finalize(p_at timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  sh record;
  v_absent integer := 0;
  v_missing integer := 0;
  n integer;
begin
  for e in
    select id, created_at from public.employees where is_active and work_pattern_id is not null
  loop
    for sh in
      select * from private.employee_shifts(e.id, p_at - interval '3 days', p_at) s
      where s.shift_end <= p_at and s.shift_start >= e.created_at
    loop
      insert into public.attendance_days (
        employee_id, shift_date, shift_start, shift_end, checkout_closes, work_pattern_id, arrival, departure
      ) values (
        e.id, sh.shift_date, sh.shift_start, sh.shift_end, sh.checkout_closes, sh.pattern_id, 'absent', 'not_applicable'
      ) on conflict (employee_id, shift_start) do nothing;
      get diagnostics n = row_count;
      v_absent := v_absent + n;
    end loop;
  end loop;

  update public.attendance_days set departure = 'missing'
  where departure = 'pending' and check_in_at is not null and checkout_closes <= p_at;
  get diagnostics v_missing = row_count;

  return jsonb_build_object('absent', v_absent, 'missing_checkout', v_missing);
end;
$$;

-- ---------------------------------------------------------------------------
-- The signed-in employee's current or next shift (for the app's home screen).
-- ---------------------------------------------------------------------------
create function public.my_shift_now()
returns table (
  shift_date date, shift_start timestamptz, shift_end timestamptz, checkin_opens timestamptz,
  checkout_closes timestamptz, arrival public.arrival_status, departure public.departure_status,
  check_in_at timestamptz, check_out_at timestamptz, late_minutes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.shift_date, s.shift_start, s.shift_end, s.checkin_opens, s.checkout_closes,
         coalesce(a.arrival, 'pending'), coalesce(a.departure, 'pending'),
         a.check_in_at, a.check_out_at, coalesce(a.late_minutes, 0)
  from private.employee_shifts(private.current_employee_id(), now(), now() + interval '2 days') s
  left join public.attendance_days a on a.employee_id = private.current_employee_id() and a.shift_start = s.shift_start
  where s.checkout_closes >= now()
  order by s.shift_start
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Day-by-day record for one employee (self, or supervisor / HR / admin).
-- kind: work | continued (inside a multi-day shift) | holiday | off
-- ---------------------------------------------------------------------------
create function public.attendance_history(p_employee uuid, p_from date, p_to date)
returns table (
  day date, kind text, shift_start timestamptz, shift_end timestamptz,
  arrival public.arrival_status, departure public.departure_status,
  check_in_at timestamptz, check_out_at timestamptz, late_minutes integer, early_leave_minutes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_employee is distinct from private.current_employee_id() and not private.is_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

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
      when s.shift_start is not null then 'work'
      when exists (select 1 from sh where sh.shift_start < days.d_end and sh.shift_end > days.d_start) then 'continued'
      when exists (select 1 from public.public_holidays h where h.holiday_date = days.d) then 'holiday'
      else 'off'
    end,
    s.shift_start,
    s.shift_end,
    case when s.shift_start is null then null else coalesce(a.arrival, 'pending'::public.arrival_status) end,
    case when s.shift_start is null then null else coalesce(a.departure, 'pending'::public.departure_status) end,
    a.check_in_at,
    a.check_out_at,
    coalesce(a.late_minutes, 0),
    coalesce(a.early_leave_minutes, 0)
  from days
  left join lateral (
    select sh.shift_start, sh.shift_end from sh where sh.shift_date = days.d order by sh.shift_start limit 1
  ) s on true
  left join public.attendance_days a on a.employee_id = p_employee and a.shift_start = s.shift_start
  order by days.d;
end;
$$;

-- Permissions: the punch helpers and the job are server-only; the app and web read via the last two.
revoke all on function private.employee_shifts(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.punch_slot(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.attendance_apply_punch(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.attendance_finalize(timestamptz) from public, anon, authenticated;
grant execute on function public.punch_slot(uuid, timestamptz) to service_role;
grant execute on function public.attendance_apply_punch(uuid, timestamptz) to service_role;
grant execute on function public.attendance_finalize(timestamptz) to service_role;
revoke all on function public.my_shift_now() from public, anon;
grant execute on function public.my_shift_now() to authenticated;
revoke all on function public.attendance_history(uuid, date, date) from public, anon;
grant execute on function public.attendance_history(uuid, date, date) to authenticated;

-- The 10-minute job.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('attendance-finalize', '*/10 * * * *', $job$select public.attendance_finalize(now())$job$);
