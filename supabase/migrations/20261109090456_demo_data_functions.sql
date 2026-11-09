-- Jahez — Phase 1: demo data (dummy employees) — seed and reset
-- Only the service role can run these. Remove before go-live (Phase 13).
--   3,500 random employees, file numbers 710000..713499
--   system admin 735043 (kept by reset)
--   8 departments with a supervisor each, 5 work patterns, 2 demo sites with 2 buildings each

-- Let the seed skip the audit log for its bulk inserts.
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if coalesce(current_setting('jahez.skip_audit', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'face_templates' then
    v_old := v_old - 'embedding';
    v_new := v_new - 'embedding';
  end if;
  insert into public.audit_log (actor_user_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'employee_id', v_old ->> 'employee_id'),
    v_old,
    v_new
  );
  return coalesce(new, old);
end;
$$;

create function public.demo_seed()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_ar text[] := array['محمد','أحمد','عبدالله','خالد','فهد','سعد','يوسف','علي','حمد','ناصر',
                           'سالم','بدر','مشعل','عبدالعزيز','فيصل','نورة','مريم','فاطمة','سارة','دانة',
                           'هيا','شيخة','لولوة','منيرة','العنود'];
  first_en text[] := array['Mohammed','Ahmed','Abdullah','Khaled','Fahad','Saad','Yousef','Ali','Hamad','Nasser',
                           'Salem','Bader','Meshal','Abdulaziz','Faisal','Noura','Maryam','Fatima','Sara','Dana',
                           'Haya','Sheikha','Lulwa','Munira','Alanoud'];
  family_ar text[] := array['العتيبي','المطيري','العجمي','الرشيدي','الشمري','الهاجري','العنزي','الكندري',
                            'الصباح','الفضلي','البناي','الخالدي','السبيعي','الدوسري','القحطاني','الحربي',
                            'الظفيري','المري','الشطي','الغانم'];
  family_en text[] := array['Al-Otaibi','Al-Mutairi','Al-Ajmi','Al-Rashidi','Al-Shammari','Al-Hajri','Al-Enezi','Al-Kandari',
                            'Al-Sabah','Al-Fadhli','Al-Bannai','Al-Khaldi','Al-Subaie','Al-Dosari','Al-Qahtani','Al-Harbi',
                            'Al-Dhafiri','Al-Marri','Al-Shatti','Al-Ghanim'];
  v_site1 uuid;
  v_site2 uuid;
  v_patterns uuid[];
  v_rotation uuid[];
  v_departments uuid[];
  v_counts jsonb;
begin
  if exists (select 1 from public.employees where is_demo) then
    raise exception 'Demo data already exists. Run demo_reset() first.';
  end if;

  perform set_config('jahez.skip_audit', 'on', true);
  perform setseed(0.71);

  -- Work patterns (Kuwait weekend: Friday = 5, Saturday = 6)
  insert into public.work_patterns (kind, name_ar, name_en, shift_start, shift_duration, cycle_work_days, cycle_off_days, weekly_off_days, is_demo)
  values
    ('morning',          'صباحي',         'Morning',         '07:00', interval '8 hours',  null, null, '{5,6}', true),
    ('afternoon',        'عصري',          'Afternoon',       '14:00', interval '8 hours',  null, null, '{5,6}', true),
    ('evening',          'مسائي',         'Evening',         '22:00', interval '8 hours',  null, null, '{5,6}', true),
    ('one_on_two_off',   'يوم بيومين',    'One on, two off', '07:00', interval '24 hours', 1, 2, '{}', true),
    ('two_on_four_off',  'يومين بأربعة',  'Two on, four off','07:00', interval '48 hours', 2, 4, '{}', true);

  select array_agg(id order by kind) into v_patterns from public.work_patterns where is_demo;
  select array_agg(id) into v_rotation from public.work_patterns
    where is_demo and kind in ('one_on_two_off', 'two_on_four_off');

  -- Departments
  insert into public.departments (name_ar, name_en, is_demo)
  values
    ('الموارد البشرية', 'Human Resources', true),
    ('تقنية المعلومات', 'Information Technology', true),
    ('المالية', 'Finance', true),
    ('العمليات', 'Operations', true),
    ('الصيانة', 'Maintenance', true),
    ('الأمن والسلامة', 'Security and Safety', true),
    ('خدمة العملاء', 'Customer Service', true),
    ('اللوجستيات', 'Logistics', true);

  select array_agg(id order by name_en) into v_departments from public.departments where is_demo;

  -- Demo sites in Kuwait City, 200 m radius, two buildings each
  insert into public.sites (name_ar, name_en, latitude, longitude, radius_m, is_demo)
  values ('موقع تجريبي ١ — شرق', 'Demo site 1 — Sharq', 29.3790, 47.9890, 200, true)
  returning id into v_site1;
  insert into public.sites (name_ar, name_en, latitude, longitude, radius_m, is_demo)
  values ('موقع تجريبي ٢ — الشويخ', 'Demo site 2 — Shuwaikh', 29.3470, 47.9370, 200, true)
  returning id into v_site2;

  insert into public.buildings (site_id, name_ar, name_en, latitude, longitude, radius_m, is_demo)
  values
    (v_site1, 'المبنى أ', 'Building A', 29.3794, 47.9886, 30, true),
    (v_site1, 'المبنى ب', 'Building B', 29.3785, 47.9896, 30, true),
    (v_site2, 'المبنى أ', 'Building A', 29.3474, 47.9366, 30, true),
    (v_site2, 'المبنى ب', 'Building B', 29.3465, 47.9376, 30, true);

  -- Public holidays (demo)
  insert into public.public_holidays (holiday_date, name_ar, name_en, is_demo)
  values
    ('2026-02-25', 'العيد الوطني', 'National Day', true),
    ('2026-02-26', 'عيد التحرير', 'Liberation Day', true),
    ('2027-01-01', 'رأس السنة الميلادية', 'New Year''s Day', true),
    ('2027-02-25', 'العيد الوطني', 'National Day', true),
    ('2027-02-26', 'عيد التحرير', 'Liberation Day', true)
  on conflict (holiday_date) do nothing;

  -- 3,500 random employees: 710000 .. 713499
  insert into public.employees (
    file_number, full_name_ar, full_name_en, phone, role,
    department_id, work_pattern_id, cycle_start_date, is_demo
  )
  select
    710000 + g,
    first_ar[f] || ' ' || first_ar[s] || ' ' || family_ar[l],
    first_en[f] || ' ' || first_en[s] || ' ' || family_en[l],
    '+965' || (5 + floor(random() * 5))::int::text || lpad(floor(random() * 10000000)::int::text, 7, '0'),
    'employee',
    v_departments[1 + floor(random() * array_length(v_departments, 1))::int],
    p.pattern_id,
    case when p.pattern_id = any (v_rotation)
      then date '2026-11-01' + floor(random() * 6)::int end,
    true
  from generate_series(0, 3499) as g
  cross join lateral (
    select
      1 + floor(random() * 25)::int as f,
      1 + floor(random() * 15)::int as s,  -- father's name: first 15 entries are male names
      1 + floor(random() * 20)::int as l
    where g >= 0 -- reference g so a new random name is drawn for every row
  ) n
  cross join lateral (
    select v_patterns[1 + floor(random() * array_length(v_patterns, 1))::int] as pattern_id
    where g >= 0
  ) p;

  -- One supervisor per department: its lowest file number
  with firsts as (
    select distinct on (department_id) id, department_id
    from public.employees
    where is_demo and department_id is not null
    order by department_id, file_number
  )
  update public.employees e set role = 'supervisor'
  from firsts where e.id = firsts.id;

  update public.departments d set supervisor_id = e.id
  from public.employees e
  where d.is_demo and e.department_id = d.id and e.role = 'supervisor';

  -- Enabled sites: one random site each; about 10% (field staff) get both
  insert into public.employee_sites (employee_id, site_id)
  select id, case when random() < 0.5 then v_site1 else v_site2 end
  from public.employees where is_demo;

  insert into public.employee_sites (employee_id, site_id)
  select e.id, s.id
  from public.employees e
  cross join (values (v_site1), (v_site2)) as s (id)
  where e.is_demo and random() < 0.10
  on conflict do nothing;

  -- System admin (not demo, so reset keeps it)
  insert into public.employees (file_number, full_name_ar, full_name_en, role, is_demo)
  values (735043, 'مدير النظام', 'System Admin', 'admin', false)
  on conflict (file_number) do nothing;

  -- Sample punches for the first 50 employees over the last 3 days
  insert into public.attendance_punches (
    employee_id, punch_type, punched_at, shift_date, site_id, latitude, longitude,
    accuracy_m, result, face_score, liveness_passed, is_demo
  )
  select
    e.id, t.punch_type,
    (d.day + time '07:00' + (random() * interval '50 minutes') + t.shift_offset) at time zone 'Asia/Kuwait',
    d.day, es.site_id, s.latitude, s.longitude, 8, 'accepted', 0.92, true, true
  from public.employees e
  join lateral (
    select site_id from public.employee_sites where employee_id = e.id limit 1
  ) es on true
  join public.sites s on s.id = es.site_id
  cross join (
    select (current_date - k) as day from generate_series(1, 3) as k
  ) d
  cross join (values ('check_in'::public.punch_type, interval '0'), ('check_out'::public.punch_type, interval '8 hours')) as t (punch_type, shift_offset)
  where e.is_demo and e.file_number < 710050;

  select jsonb_build_object(
    'employees', (select count(*) from public.employees where is_demo),
    'supervisors', (select count(*) from public.employees where is_demo and role = 'supervisor'),
    'departments', (select count(*) from public.departments where is_demo),
    'work_patterns', (select count(*) from public.work_patterns where is_demo),
    'sites', (select count(*) from public.sites where is_demo),
    'buildings', (select count(*) from public.buildings where is_demo),
    'employee_sites', (select count(*) from public.employee_sites es join public.employees e on e.id = es.employee_id where e.is_demo),
    'punches', (select count(*) from public.attendance_punches where is_demo),
    'admin_exists', exists (select 1 from public.employees where file_number = 735043 and role = 'admin')
  ) into v_counts;

  return v_counts;
end;
$$;

create function public.demo_reset()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employees int;
begin
  perform set_config('jahez.skip_audit', 'on', true);

  delete from public.attendance_punches where is_demo;
  update public.departments set supervisor_id = null where is_demo;
  delete from public.employees where is_demo;
  get diagnostics v_employees = row_count;
  delete from public.departments where is_demo;
  delete from public.buildings where is_demo;
  delete from public.sites where is_demo;
  delete from public.work_patterns where is_demo;
  delete from public.public_holidays where is_demo;

  return jsonb_build_object('deleted_employees', v_employees);
end;
$$;

revoke all on function public.demo_seed() from public, anon, authenticated;
revoke all on function public.demo_reset() from public, anon, authenticated;
grant execute on function public.demo_seed() to service_role;
grant execute on function public.demo_reset() to service_role;
