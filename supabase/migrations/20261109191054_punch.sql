-- Jahez — Phase 6: punching. Server-side helpers for the punch Edge Function.

-- What the phone reported about itself for each attempt (VPN, mock location, rooted, liveness challenge…).
alter table public.attendance_punches
  add column client_report jsonb not null default '{}';

-- Distance between a punch descriptor and the employee's enrolled face (server use only).
create function public.face_distance(p_employee_id uuid, p_embedding extensions.vector(128))
returns double precision
language sql
stable
security definer
set search_path = ''
as $$
  select (f.embedding operator(extensions.<->) p_embedding)::double precision
  from public.face_templates f
  where f.employee_id = p_employee_id
$$;

revoke all on function public.face_distance(uuid, extensions.vector) from public, anon, authenticated;
grant execute on function public.face_distance(uuid, extensions.vector) to service_role;

-- Sites the employee may punch at, with the distance from a point (metres, haversine).
create function public.sites_near(p_employee_id uuid, p_lat double precision, p_lng double precision)
returns table (site_id uuid, name_ar text, name_en text, radius_m integer, distance_m double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name_ar, s.name_en, s.radius_m,
    2 * 6371000 * asin(sqrt(
      power(sin(radians(s.latitude - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(s.latitude)) * power(sin(radians(s.longitude - p_lng) / 2), 2)
    )) as distance_m
  from public.employee_sites es
  join public.sites s on s.id = es.site_id
  where es.employee_id = p_employee_id and s.is_active
  order by distance_m
$$;

revoke all on function public.sites_near(uuid, double precision, double precision) from public, anon, authenticated;
grant execute on function public.sites_near(uuid, double precision, double precision) to service_role;

create index attendance_punches_employee_result_time_idx
  on public.attendance_punches (employee_id, result, punched_at desc);
