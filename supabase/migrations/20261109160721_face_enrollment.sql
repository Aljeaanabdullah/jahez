-- Jahez — Phase 5: consent and face enrollment.
-- Face descriptors become pgvector vectors (128 numbers) so the server can compare faces fast:
-- here to stop one person being enrolled under two file numbers, and in Phase 6 for punching.

create extension if not exists vector with schema extensions;

-- No real templates exist yet (only test rows, already removed).
delete from public.face_templates;
alter table public.face_templates
  alter column embedding type extensions.vector(128) using embedding::text::extensions.vector;

-- Column grants were per column; re-state them (the embedding stays hidden).
revoke select on public.face_templates from authenticated;
grant select (id, employee_id, model_version, source, enrolled_by, enrolled_at, photo_paths)
  on public.face_templates to authenticated;

-- Consent texts are versioned; the app stores which version the employee accepted.
alter table public.consents
  add constraint consents_version_check check (char_length(consent_version) between 1 and 20);

-- Enrollment status for HR and admin (never the descriptor itself).
create function public.face_enrollment_status(p_employee_id uuid)
returns table (
  has_consent boolean,
  consent_at timestamptz,
  enrolled boolean,
  enrolled_at timestamptz,
  source public.enrollment_source,
  model_version text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role(array['hr', 'admin']::public.app_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select
    c.accepted_at is not null,
    c.accepted_at,
    f.id is not null,
    f.enrolled_at,
    f.source,
    f.model_version
  from (select p_employee_id as id) e
  left join lateral (
    select accepted_at from public.consents where employee_id = e.id order by accepted_at desc limit 1
  ) c on true
  left join public.face_templates f on f.employee_id = e.id;
end;
$$;

revoke all on function public.face_enrollment_status(uuid) from public, anon;
grant execute on function public.face_enrollment_status(uuid) to authenticated;

-- Closest other enrolled face (server use only).
create function public.nearest_other_face(p_embedding extensions.vector(128), p_employee_id uuid)
returns table (employee_id uuid, file_number integer, distance double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select f.employee_id, e.file_number, (f.embedding operator(extensions.<->) p_embedding)::double precision
  from public.face_templates f
  join public.employees e on e.id = f.employee_id
  where f.employee_id <> p_employee_id
  order by f.embedding operator(extensions.<->) p_embedding
  limit 1
$$;

revoke all on function public.nearest_other_face(extensions.vector, uuid) from public, anon, authenticated;
grant execute on function public.nearest_other_face(extensions.vector, uuid) to service_role;
