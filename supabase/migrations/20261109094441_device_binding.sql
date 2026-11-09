-- Jahez — Phase 2: one phone per employee, one employee per phone.
-- The app calls bind_device() after every log-in on the phone.
--   'bound'        first log-in: this phone is now bound to the employee
--   'ok'           this is the employee's bound phone
--   'other_device' the employee is bound to a different phone (admin must unbind)
--   'device_taken' this phone is already bound to another employee

create unique index devices_device_identifier_key on public.devices (device_identifier);

create function public.bind_device(
  p_device_identifier text,
  p_platform text,
  p_model text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee uuid := private.current_employee_id();
  v_bound text;
begin
  if v_employee is null then
    raise exception 'not_an_active_employee' using errcode = '42501';
  end if;
  if p_device_identifier is null or char_length(p_device_identifier) not between 8 and 200 then
    raise exception 'invalid_device_identifier' using errcode = '22023';
  end if;
  if p_platform not in ('android', 'ios') then
    raise exception 'invalid_platform' using errcode = '22023';
  end if;

  select device_identifier into v_bound from public.devices where employee_id = v_employee;

  if v_bound is not null then
    return case when v_bound = p_device_identifier then 'ok' else 'other_device' end;
  end if;

  if exists (select 1 from public.devices where device_identifier = p_device_identifier) then
    return 'device_taken';
  end if;

  insert into public.devices (employee_id, device_identifier, platform, model)
  values (v_employee, p_device_identifier, p_platform, left(p_model, 100));
  return 'bound';
end;
$$;

revoke all on function public.bind_device(text, text, text) from public, anon;
grant execute on function public.bind_device(text, text, text) to authenticated;
