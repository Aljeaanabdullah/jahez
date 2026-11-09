-- PRD 4.4: punch photos are seen only by supervisors and the system admin.
drop policy "staff read punch photos" on storage.objects;

create policy "supervisors and admin read punch photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'punch-photos'
    and (select private.has_role(array['supervisor', 'admin']::public.app_role[]))
  );
