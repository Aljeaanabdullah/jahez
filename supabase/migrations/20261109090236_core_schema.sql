-- Jahez — Phase 1: core schema
-- See docs/PRD.md. Every table has RLS enabled (policies are in the next migration).

create extension if not exists pgcrypto with schema extensions;

-- Helpers live in a schema that the Data API does not expose.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('employee', 'supervisor', 'hr', 'admin');
create type public.work_pattern_kind as enum (
  'morning', 'afternoon', 'evening', 'one_on_two_off', 'two_on_four_off'
);
create type public.punch_type as enum ('check_in', 'check_out');
create type public.punch_result as enum ('accepted', 'rejected');
create type public.request_type as enum ('punch_correction', 'external_mission');
create type public.request_status as enum (
  'pending_supervisor', 'pending_hr', 'approved', 'rejected', 'cancelled'
);
create type public.approval_stage as enum ('supervisor', 'hr');
create type public.approval_decision as enum ('approved', 'rejected');
create type public.enrollment_source as enum ('web', 'mobile');
create type public.hazard_type as enum ('fire', 'gas_leak', 'other');
create type public.emergency_status as enum ('active', 'closed');
create type public.emergency_building_kind as enum ('danger', 'safe');
create type public.emergency_response_status as enum ('arrived', 'safe_elsewhere');

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------------
create table public.work_patterns (
  id uuid primary key default gen_random_uuid(),
  kind public.work_pattern_kind not null,
  name_ar text not null,
  name_en text not null,
  shift_start time not null,
  -- Supports shifts that cross midnight and shifts of 24h or 48h.
  shift_duration interval not null check (shift_duration > interval '0' and shift_duration <= interval '72 hours'),
  -- Rotation patterns (one_on_two_off, two_on_four_off): days on / days off.
  cycle_work_days smallint check (cycle_work_days > 0),
  cycle_off_days smallint check (cycle_off_days > 0),
  -- Fixed patterns: ISO weekdays off (1 = Monday ... 7 = Sunday).
  weekly_off_days smallint[] not null default '{}',
  checkin_opens_before interval not null default interval '1 hour' check (checkin_opens_before >= interval '0'),
  grace_period interval not null default interval '1 hour' check (grace_period >= interval '0'),
  checkout_window_after interval not null default interval '1 hour' check (checkout_window_after >= interval '0'),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_patterns_rotation_check check (
    (kind in ('one_on_two_off', 'two_on_four_off')) = (cycle_work_days is not null and cycle_off_days is not null)
  ),
  constraint work_patterns_weekdays_check check (weekly_off_days <@ array[1,2,3,4,5,6,7]::smallint[])
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  supervisor_id uuid, -- FK added after employees exists
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_m integer not null default 200 check (radius_m between 10 and 5000),
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  name_ar text not null,
  name_en text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_m integer not null default 30 check (radius_m between 5 and 1000),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index buildings_site_id_idx on public.buildings (site_id);

create table public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name_ar text not null,
  name_en text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Employees
-- ---------------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  -- رقم الملف الوظيفي: the business identifier used to log in.
  file_number integer not null unique check (file_number between 100000 and 999999),
  user_id uuid unique references auth.users (id) on delete set null,
  full_name_ar text not null,
  full_name_en text not null,
  phone text,
  role public.app_role not null default 'employee',
  department_id uuid references public.departments (id) on delete set null,
  work_pattern_id uuid references public.work_patterns (id) on delete set null,
  -- First "on" day for rotation patterns.
  cycle_start_date date,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employees_department_id_idx on public.employees (department_id);
create index employees_work_pattern_id_idx on public.employees (work_pattern_id);

alter table public.departments
  add constraint departments_supervisor_id_fkey
  foreign key (supervisor_id) references public.employees (id) on delete set null;
create index departments_supervisor_id_idx on public.departments (supervisor_id);

-- Sites each employee is allowed to punch at (enabled one by one by the admin).
create table public.employee_sites (
  employee_id uuid not null references public.employees (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  enabled_at timestamptz not null default now(),
  primary key (employee_id, site_id)
);
create index employee_sites_site_id_idx on public.employee_sites (site_id);

-- One bound phone per employee.
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees (id) on delete cascade,
  device_identifier text not null,
  platform text not null check (platform in ('android', 'ios')),
  model text,
  bound_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Face data and consent (biometric — readable by no client role)
-- ---------------------------------------------------------------------------
create table public.face_templates (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees (id) on delete cascade,
  embedding real[] not null,
  model_version text not null,
  source public.enrollment_source not null,
  enrolled_by uuid references public.employees (id) on delete set null,
  enrolled_at timestamptz not null default now()
);
create index face_templates_enrolled_by_idx on public.face_templates (enrolled_by);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  consent_version text not null,
  accepted_at timestamptz not null default now()
);
create index consents_employee_id_idx on public.consents (employee_id);

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------
create table public.attendance_punches (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  punch_type public.punch_type not null,
  -- Always server time.
  punched_at timestamptz not null default now(),
  shift_date date not null,
  site_id uuid references public.sites (id) on delete set null,
  latitude double precision,
  longitude double precision,
  accuracy_m real,
  device_id uuid references public.devices (id) on delete set null,
  result public.punch_result not null,
  reject_reason text,
  face_score real,
  liveness_passed boolean,
  photo_path text, -- object in the private "punch-photos" bucket, deleted after 3 months
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index attendance_punches_employee_time_idx on public.attendance_punches (employee_id, punched_at desc);
create index attendance_punches_shift_date_idx on public.attendance_punches (shift_date);
create index attendance_punches_site_id_idx on public.attendance_punches (site_id);
create index attendance_punches_device_id_idx on public.attendance_punches (device_id);

-- ---------------------------------------------------------------------------
-- Requests (punch correction, external mission)
-- ---------------------------------------------------------------------------
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  request_type public.request_type not null,
  status public.request_status not null default 'pending_supervisor',
  shift_date date not null,
  -- punch_correction
  corrected_punch_type public.punch_type,
  corrected_time timestamptz,
  -- external_mission
  mission_site_id uuid references public.sites (id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requests_fields_check check (
    (request_type = 'punch_correction' and corrected_punch_type is not null and corrected_time is not null and mission_site_id is null)
    or
    (request_type = 'external_mission' and mission_site_id is not null and corrected_punch_type is null and corrected_time is null)
  )
);
create index requests_employee_id_idx on public.requests (employee_id);
create index requests_status_idx on public.requests (status);
create index requests_mission_site_id_idx on public.requests (mission_site_id);

create table public.request_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  stage public.approval_stage not null,
  approver_id uuid references public.employees (id) on delete set null,
  decision public.approval_decision not null,
  note text,
  decided_at timestamptz not null default now(),
  unique (request_id, stage)
);
create index request_approvals_approver_id_idx on public.request_approvals (approver_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  kind text not null,
  title_ar text not null,
  title_en text not null,
  body_ar text,
  body_en text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_employee_created_idx on public.notifications (employee_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Emergencies
-- ---------------------------------------------------------------------------
create table public.emergencies (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete restrict,
  hazard public.hazard_type not null,
  message_ar text,
  message_en text,
  status public.emergency_status not null default 'active',
  started_by uuid references public.employees (id) on delete set null,
  started_at timestamptz not null default now(),
  closed_by uuid references public.employees (id) on delete set null,
  closed_at timestamptz,
  constraint emergencies_closed_check check ((status = 'closed') = (closed_at is not null))
);
create index emergencies_site_id_idx on public.emergencies (site_id);
create index emergencies_started_by_idx on public.emergencies (started_by);
create index emergencies_closed_by_idx on public.emergencies (closed_by);

create table public.emergency_buildings (
  emergency_id uuid not null references public.emergencies (id) on delete cascade,
  building_id uuid not null references public.buildings (id) on delete restrict,
  kind public.emergency_building_kind not null,
  primary key (emergency_id, building_id)
);
create index emergency_buildings_building_id_idx on public.emergency_buildings (building_id);

-- Snapshot of who was alerted.
create table public.emergency_targets (
  emergency_id uuid not null references public.emergencies (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  primary key (emergency_id, employee_id)
);
create index emergency_targets_employee_id_idx on public.emergency_targets (employee_id);

create table public.emergency_responses (
  emergency_id uuid not null references public.emergencies (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  status public.emergency_response_status not null,
  latitude double precision,
  longitude double precision,
  responded_at timestamptz not null default now(),
  primary key (emergency_id, employee_id),
  foreign key (emergency_id, employee_id) references public.emergency_targets (emergency_id, employee_id) on delete cascade
);
create index emergency_responses_employee_id_idx on public.emergency_responses (employee_id);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.work_patterns for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.departments for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.sites for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.buildings for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.employees for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.requests for each row execute function private.set_updated_at();

-- Audit: who changed what. Embeddings are never copied into the log.
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
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

create trigger audit after insert or update or delete on public.employees for each row execute function private.audit_row_change();
create trigger audit after insert or update or delete on public.employee_sites for each row execute function private.audit_row_change();
create trigger audit after insert or update or delete on public.devices for each row execute function private.audit_row_change();
create trigger audit after insert or update or delete on public.face_templates for each row execute function private.audit_row_change();
create trigger audit after insert or update or delete on public.consents for each row execute function private.audit_row_change();
create trigger audit after insert or update or delete on public.departments for each row execute function private.audit_row_change();
create trigger audit after insert or update or delete on public.sites for each row execute function private.audit_row_change();
create trigger audit after insert or update or delete on public.buildings for each row execute function private.audit_row_change();
create trigger audit after insert or update or delete on public.work_patterns for each row execute function private.audit_row_change();
create trigger audit after insert or update or delete on public.request_approvals for each row execute function private.audit_row_change();
create trigger audit after insert or update or delete on public.emergencies for each row execute function private.audit_row_change();

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.work_patterns enable row level security;
alter table public.departments enable row level security;
alter table public.sites enable row level security;
alter table public.buildings enable row level security;
alter table public.public_holidays enable row level security;
alter table public.employees enable row level security;
alter table public.employee_sites enable row level security;
alter table public.devices enable row level security;
alter table public.face_templates enable row level security;
alter table public.consents enable row level security;
alter table public.attendance_punches enable row level security;
alter table public.requests enable row level security;
alter table public.request_approvals enable row level security;
alter table public.notifications enable row level security;
alter table public.emergencies enable row level security;
alter table public.emergency_buildings enable row level security;
alter table public.emergency_targets enable row level security;
alter table public.emergency_responses enable row level security;
alter table public.audit_log enable row level security;
