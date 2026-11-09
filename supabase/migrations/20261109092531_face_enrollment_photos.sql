-- Jahez — Phase 1: enrollment photos for admin review (detecting tampering)
-- The embedding (numbers) stays unreadable by every client role.
-- The admin can see who enrolled whom, when, from where, and open the enrollment photos
-- to compare them with punch photos.

alter table public.face_templates
  add column photo_paths text[] not null default '{}';

comment on column public.face_templates.photo_paths is
  'Objects in the private "face-enrollment-photos" bucket, path "<employee_id>/<file>". Deleted on re-enrollment and on termination.';

-- Column-level access: everything except the embedding.
revoke select on public.face_templates from authenticated;
grant select (id, employee_id, model_version, source, enrolled_by, enrolled_at, photo_paths)
  on public.face_templates to authenticated;

create policy "admin reads enrollment details" on public.face_templates
  for select to authenticated
  using ((select private.has_role(array['admin']::public.app_role[])));

-- Private bucket, written only by server code.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('face-enrollment-photos', 'face-enrollment-photos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "admin reads enrollment photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'face-enrollment-photos'
    and (select private.has_role(array['admin']::public.app_role[]))
  );
