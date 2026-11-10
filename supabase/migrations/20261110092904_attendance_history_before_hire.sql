-- Phase 7: days before the employee was added are shown as "before_hire", not as pending or absent.
create or replace function public.attendance_history(p_employee uuid, p_from date, p_to date)
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
    coalesce(a.early_leave_minutes, 0)
  from days
  left join lateral (
    select sh.shift_start, sh.shift_end from sh where sh.shift_date = days.d order by sh.shift_start limit 1
  ) s on true
  left join public.attendance_days a on a.employee_id = p_employee and a.shift_start = s.shift_start
  order by days.d;
end;
$$;
