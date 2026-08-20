begin;

-- Certificate numbers are public identifiers, so they must not reveal a user id,
-- email address, database key, or insertion order. pgcrypto's gen_random_bytes()
-- uses PostgreSQL's cryptographically secure random source. Sixteen random bytes
-- provide 128 bits of entropy; the year is only a display aid and is not relied on
-- for secrecy or uniqueness.
create or replace function private.generate_course_completion_certificate_number()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'CERT-' || to_char(clock_timestamp(), 'YYYY') || '-'
    || upper(substr(encoded.value, 1, 8)) || '-'
    || upper(substr(encoded.value, 9, 8)) || '-'
    || upper(substr(encoded.value, 17, 8)) || '-'
    || upper(substr(encoded.value, 25, 8))
  from (
    select encode(extensions.gen_random_bytes(16), 'hex') as value
  ) as encoded;
$$;

comment on function private.generate_course_completion_certificate_number() is
  '使用 pgcrypto 加密安全随机源生成含 128 位随机熵的不可预测证书编号；不包含学生或数据库标识。';

revoke all on function private.generate_course_completion_certificate_number()
  from public, anon, authenticated, service_role;

-- The composite key lets the certificate foreign key prove that all copied
-- tenant/student/app/course ids came from the same evaluation row.
alter table public.student_course_completion_evaluations
  add constraint student_course_completion_evaluations_certificate_source_key
  unique (id, tenant_id, student_id, student_app_id, course_id);

create table public.course_completion_certificates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  student_app_id uuid not null
    references public.student_apps(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  evaluation_id uuid not null,
  certificate_number text not null,
  status text not null default 'issued',
  student_name_snapshot text not null,
  course_title_snapshot text not null,
  policy_snapshot jsonb not null,
  evidence_snapshot jsonb not null,
  overall_score_snapshot numeric(7, 3),
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null,
  revoked_by uuid references public.profiles(id) on delete restrict,
  revoked_at timestamptz,
  revocation_reason text,
  reissued_from_id uuid references public.course_completion_certificates(id)
    on delete restrict,
  created_at timestamptz not null default now(),
  constraint course_completion_certificates_number_key
    unique (certificate_number),
  constraint course_completion_certificates_event_scope_key
    unique (id, tenant_id),
  constraint course_completion_certificates_evaluation_fkey
    foreign key (
      evaluation_id, tenant_id, student_id, student_app_id, course_id
    ) references public.student_course_completion_evaluations (
      id, tenant_id, student_id, student_app_id, course_id
    ) on delete restrict,
  constraint course_completion_certificates_status_check
    check (status in ('issued', 'revoked', 'reissued')),
  constraint course_completion_certificates_number_format_check
    check (
      certificate_number ~ '^CERT-[0-9]{4}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$'
    ),
  constraint course_completion_certificates_student_name_check
    check (char_length(btrim(student_name_snapshot)) between 1 and 200),
  constraint course_completion_certificates_course_title_check
    check (char_length(btrim(course_title_snapshot)) between 1 and 200),
  constraint course_completion_certificates_policy_snapshot_check
    check (jsonb_typeof(policy_snapshot) = 'object'),
  constraint course_completion_certificates_evidence_snapshot_check
    check (jsonb_typeof(evidence_snapshot) = 'object'),
  constraint course_completion_certificates_score_check
    check (overall_score_snapshot is null or overall_score_snapshot between 0 and 100),
  constraint course_completion_certificates_revocation_check check (
    (
      status = 'issued'
      and revoked_by is null
      and revoked_at is null
      and revocation_reason is null
    )
    or
    (
      status in ('revoked', 'reissued')
      and revoked_by is not null
      and revoked_at is not null
      and revocation_reason is not null
      and char_length(btrim(revocation_reason)) between 2 and 1000
    )
  ),
  constraint course_completion_certificates_reissue_self_check
    check (reissued_from_id is null or reissued_from_id <> id)
);

comment on table public.course_completion_certificates is
  '结课证书本体；姓名、课程、政策、证据和综合成绩均固定为颁发时快照。所有业务写入必须经过证书 RPC。';
comment on column public.course_completion_certificates.certificate_number is
  '服务端以 pgcrypto 生成的全局唯一公开编号，含 128 位加密安全随机熵。';
comment on column public.course_completion_certificates.status is
  'issued=有效，revoked=已撤销，reissued=该旧证书已被新证书替代。';
comment on column public.course_completion_certificates.reissued_from_id is
  '重新颁发时指向被替代的旧证书；旧证书保留并改为 reissued。';

-- One evaluation may have only one initial certificate, one replacement may
-- have only one direct successor, and an evaluation may never have two valid
-- certificates. These indexes are the final concurrency guard even if callers
-- race across separate database sessions.
create unique index course_completion_certificates_initial_evaluation_key
  on public.course_completion_certificates (evaluation_id)
  where reissued_from_id is null;
create unique index course_completion_certificates_reissued_from_key
  on public.course_completion_certificates (reissued_from_id)
  where reissued_from_id is not null;
create unique index course_completion_certificates_one_issued_evaluation_key
  on public.course_completion_certificates (evaluation_id)
  where status = 'issued';
create index course_completion_certificates_tenant_status_idx
  on public.course_completion_certificates
  (tenant_id, student_app_id, course_id, status, issued_at desc);
create index course_completion_certificates_student_timeline_idx
  on public.course_completion_certificates
  (student_id, issued_at desc);

create or replace function private.enforce_course_completion_certificate_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception '结课证书不可删除，只能通过 RPC 撤销或重新颁发';
  end if;

  if tg_op = 'INSERT' then
    -- Always overwrite the value. No insert path, including a future trusted
    -- server path, can smuggle in a caller-selected certificate number.
    new.certificate_number := private.generate_course_completion_certificate_number();
    if new.status <> 'issued'
      or new.revoked_by is not null
      or new.revoked_at is not null
      or new.revocation_reason is not null then
      raise exception '新证书必须以 issued 状态创建且不得预填撤销信息';
    end if;

    if new.reissued_from_id is not null and not exists (
      select 1
      from public.course_completion_certificates as previous
      where previous.id = new.reissued_from_id
        and previous.tenant_id = new.tenant_id
        and previous.student_id = new.student_id
        and previous.student_app_id = new.student_app_id
        and previous.course_id = new.course_id
        and previous.status = 'revoked'
    ) then
      raise exception '重新颁发来源必须是同一学生、机构和课程下已撤销的证书';
    end if;
    return new;
  end if;

  if (
    to_jsonb(new) - array[
      'status', 'revoked_by', 'revoked_at', 'revocation_reason'
    ]
  ) is distinct from (
    to_jsonb(old) - array[
      'status', 'revoked_by', 'revoked_at', 'revocation_reason'
    ]
  ) then
    raise exception '证书编号、身份、来源和颁发时快照均不可修改';
  end if;

  if old.status = 'issued' and new.status = 'revoked' then
    if new.revoked_by is null
      or new.revoked_at is null
      or new.revocation_reason is null
      or char_length(btrim(new.revocation_reason)) not between 2 and 1000 then
      raise exception '撤销证书必须保存操作者、时间和明确原因';
    end if;
  elsif old.status = 'revoked' and new.status = 'reissued' then
    if new.revoked_by is distinct from old.revoked_by
      or new.revoked_at is distinct from old.revoked_at
      or new.revocation_reason is distinct from old.revocation_reason then
      raise exception '重新颁发不能改写原证书的撤销记录';
    end if;
  else
    raise exception '无效的证书状态转换：% -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_course_completion_certificate_state()
  from public, anon, authenticated, service_role;

create trigger course_completion_certificates_enforce_state
before insert or update or delete on public.course_completion_certificates
for each row execute function private.enforce_course_completion_certificate_state();

create table public.course_completion_certificate_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  certificate_id uuid not null,
  event_type text not null,
  actor_id uuid references public.profiles(id) on delete restrict,
  actor_name_snapshot text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint course_completion_certificate_events_certificate_fkey
    foreign key (certificate_id, tenant_id)
    references public.course_completion_certificates(id, tenant_id)
    on delete restrict,
  constraint course_completion_certificate_events_type_check
    check (event_type in (
      'issued', 'revoked', 'reissued', 'downloaded', 'verification_viewed'
    )),
  constraint course_completion_certificate_events_actor_check check (
    event_type not in ('issued', 'revoked', 'reissued')
    or (
      actor_id is not null
      and actor_name_snapshot is not null
      and char_length(btrim(actor_name_snapshot)) between 1 and 200
    )
  ),
  constraint course_completion_certificate_events_reason_check check (
    event_type not in ('revoked', 'reissued')
    or (
      reason is not null
      and char_length(btrim(reason)) between 2 and 1000
    )
  ),
  constraint course_completion_certificate_events_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.course_completion_certificate_events is
  '证书只追加审计事件；历史事件禁止 UPDATE/DELETE。下载与公开查验事件类型预留给后续功能。';

create index course_completion_certificate_events_certificate_timeline_idx
  on public.course_completion_certificate_events
  (certificate_id, created_at, id);
create index course_completion_certificate_events_tenant_timeline_idx
  on public.course_completion_certificate_events
  (tenant_id, created_at desc, id desc);

create or replace function private.enforce_completion_certificate_event_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception '证书审计事件只允许追加，历史事件不可修改或删除';
end;
$$;

revoke all on function private.enforce_completion_certificate_event_append_only()
  from public, anon, authenticated, service_role;

create trigger course_completion_certificate_events_append_only
before update or delete on public.course_completion_certificate_events
for each row execute function private.enforce_completion_certificate_event_append_only();

create or replace function private.current_actor_can_issue_tenant_certificate(
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_tenant_id = private.current_tenant_id()
    and private.has_tenant_role(
      p_tenant_id,
      array['tenant_super_admin', 'ceo']::text[]
    );
$$;

revoke all on function private.current_actor_can_issue_tenant_certificate(uuid)
  from public, anon;
grant execute on function private.current_actor_can_issue_tenant_certificate(uuid)
  to authenticated, service_role;

create or replace function public.issue_course_completion_certificate(
  p_evaluation_id uuid
)
returns public.course_completion_certificates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_evaluation public.student_course_completion_evaluations;
  v_existing public.course_completion_certificates;
  v_certificate public.course_completion_certificates;
  v_student_name text;
  v_course_title text;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor_id is null then
    raise exception '必须登录后颁发证书';
  end if;

  select evaluation.* into v_evaluation
  from public.student_course_completion_evaluations as evaluation
  where evaluation.id = p_evaluation_id
  for update;

  if not found then
    raise exception '结课资格记录不存在';
  end if;
  if not private.current_actor_can_issue_tenant_certificate(v_evaluation.tenant_id) then
    raise exception '只有对应机构负责人可以颁发本机构证书';
  end if;
  if v_evaluation.status <> 'eligible' or not v_evaluation.eligible then
    raise exception '只有 eligible 状态的结课资格记录可以颁发证书';
  end if;

  select certificate.* into v_existing
  from public.course_completion_certificates as certificate
  where certificate.evaluation_id = p_evaluation_id
    and certificate.status = 'issued';

  if found then
    return v_existing;
  end if;

  select certificate.* into v_existing
  from public.course_completion_certificates as certificate
  where certificate.evaluation_id = p_evaluation_id
    and certificate.reissued_from_id is null;

  if found then
    raise exception '该资格记录的原证书已撤销或被替代，请使用重新颁发 RPC';
  end if;

  select nullif(btrim(profile.full_name), '') into v_student_name
  from public.profiles as profile
  where profile.id = v_evaluation.student_id;
  if v_student_name is null then
    raise exception '颁发证书前必须填写学生姓名';
  end if;

  select nullif(btrim(course.title), '') into v_course_title
  from public.courses as course
  where course.id = v_evaluation.course_id
    and course.student_app_id = v_evaluation.student_app_id;
  if v_course_title is null then
    raise exception '资格记录对应的课程不存在或课程名称为空';
  end if;

  select coalesce(nullif(btrim(profile.full_name), ''), '机构负责人')
  into v_actor_name
  from public.profiles as profile
  where profile.id = v_actor_id;

  insert into public.course_completion_certificates (
    tenant_id, student_id, student_app_id, course_id, evaluation_id,
    status, student_name_snapshot, course_title_snapshot,
    policy_snapshot, evidence_snapshot, overall_score_snapshot,
    issued_by, issued_at, created_at
  ) values (
    v_evaluation.tenant_id,
    v_evaluation.student_id,
    v_evaluation.student_app_id,
    v_evaluation.course_id,
    v_evaluation.id,
    'issued',
    v_student_name,
    v_course_title,
    jsonb_build_object(
      'policyId', v_evaluation.policy_id,
      'policyVersion', v_evaluation.policy_version,
      'evaluationVersion', v_evaluation.evaluation_version,
      'evaluatedAt', v_evaluation.evaluated_at,
      'requirements', v_evaluation.requirements_snapshot
    ),
    v_evaluation.evidence_snapshot,
    v_evaluation.overall_score,
    v_actor_id,
    v_now,
    v_now
  ) returning * into v_certificate;

  insert into public.course_completion_certificate_events (
    tenant_id, certificate_id, event_type, actor_id,
    actor_name_snapshot, metadata, created_at
  ) values (
    v_certificate.tenant_id,
    v_certificate.id,
    'issued',
    v_actor_id,
    v_actor_name,
    jsonb_build_object('evaluationId', v_evaluation.id),
    v_now
  );

  return v_certificate;
end;
$$;

create or replace function public.revoke_course_completion_certificate(
  p_certificate_id uuid,
  p_reason text
)
returns public.course_completion_certificates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_certificate public.course_completion_certificates;
  v_reason text := nullif(btrim(p_reason), '');
  v_now timestamptz := clock_timestamp();
begin
  if v_actor_id is null then
    raise exception '必须登录后撤销证书';
  end if;
  if v_reason is null or char_length(v_reason) not between 2 and 1000 then
    raise exception '撤销证书必须提供 2 至 1000 字的明确原因';
  end if;

  select certificate.* into v_certificate
  from public.course_completion_certificates as certificate
  where certificate.id = p_certificate_id
  for update;

  if not found then
    raise exception '证书不存在';
  end if;
  if not (
    private.current_actor_can_issue_tenant_certificate(v_certificate.tenant_id)
    or private.is_platform_owner()
  ) then
    raise exception '只有对应机构负责人或平台负责人可以撤销该证书';
  end if;
  if v_certificate.status <> 'issued' then
    raise exception '只有 issued 状态的有效证书可以撤销';
  end if;

  select coalesce(nullif(btrim(profile.full_name), ''), '负责人')
  into v_actor_name
  from public.profiles as profile
  where profile.id = v_actor_id;

  update public.course_completion_certificates
  set status = 'revoked',
      revoked_by = v_actor_id,
      revoked_at = v_now,
      revocation_reason = v_reason
  where id = v_certificate.id
  returning * into v_certificate;

  insert into public.course_completion_certificate_events (
    tenant_id, certificate_id, event_type, actor_id,
    actor_name_snapshot, reason, metadata, created_at
  ) values (
    v_certificate.tenant_id,
    v_certificate.id,
    'revoked',
    v_actor_id,
    v_actor_name,
    v_reason,
    jsonb_build_object('previousStatus', 'issued'),
    v_now
  );

  return v_certificate;
end;
$$;

create or replace function public.reissue_course_completion_certificate(
  p_certificate_id uuid,
  p_reason text,
  p_evaluation_id uuid default null
)
returns public.course_completion_certificates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_previous public.course_completion_certificates;
  v_existing public.course_completion_certificates;
  v_evaluation public.student_course_completion_evaluations;
  v_certificate public.course_completion_certificates;
  v_student_name text;
  v_course_title text;
  v_reason text := nullif(btrim(p_reason), '');
  v_now timestamptz := clock_timestamp();
begin
  if v_actor_id is null then
    raise exception '必须登录后重新颁发证书';
  end if;
  if v_reason is null or char_length(v_reason) not between 2 and 1000 then
    raise exception '重新颁发必须提供 2 至 1000 字的审核原因';
  end if;

  select certificate.* into v_previous
  from public.course_completion_certificates as certificate
  where certificate.id = p_certificate_id
  for update;

  if not found then
    raise exception '原证书不存在';
  end if;
  if not private.current_actor_can_issue_tenant_certificate(v_previous.tenant_id) then
    raise exception '只有对应机构负责人可以重新颁发本机构证书';
  end if;

  if v_previous.status = 'reissued' then
    select certificate.* into v_existing
    from public.course_completion_certificates as certificate
    where certificate.reissued_from_id = v_previous.id;
    if found then
      return v_existing;
    end if;
  end if;
  if v_previous.status <> 'revoked' then
    raise exception '只有 revoked 状态的证书可以重新颁发';
  end if;

  select evaluation.* into v_evaluation
  from public.student_course_completion_evaluations as evaluation
  where evaluation.id = coalesce(p_evaluation_id, v_previous.evaluation_id)
  for update;

  if not found then
    raise exception '重新颁发使用的结课资格记录不存在';
  end if;
  if v_evaluation.status <> 'eligible' or not v_evaluation.eligible then
    raise exception '重新颁发仍必须使用 eligible 状态的结课资格记录';
  end if;
  if (
    v_evaluation.tenant_id,
    v_evaluation.student_id,
    v_evaluation.student_app_id,
    v_evaluation.course_id
  ) is distinct from (
    v_previous.tenant_id,
    v_previous.student_id,
    v_previous.student_app_id,
    v_previous.course_id
  ) then
    raise exception '重新颁发资格必须属于原证书的同一机构、学生和课程';
  end if;

  select nullif(btrim(profile.full_name), '') into v_student_name
  from public.profiles as profile
  where profile.id = v_previous.student_id;
  if v_student_name is null then
    raise exception '重新颁发证书前必须填写学生姓名';
  end if;

  select nullif(btrim(course.title), '') into v_course_title
  from public.courses as course
  where course.id = v_previous.course_id
    and course.student_app_id = v_previous.student_app_id;
  if v_course_title is null then
    raise exception '原证书对应的课程不存在或课程名称为空';
  end if;

  select coalesce(nullif(btrim(profile.full_name), ''), '机构负责人')
  into v_actor_name
  from public.profiles as profile
  where profile.id = v_actor_id;

  insert into public.course_completion_certificates (
    tenant_id, student_id, student_app_id, course_id, evaluation_id,
    status, student_name_snapshot, course_title_snapshot,
    policy_snapshot, evidence_snapshot, overall_score_snapshot,
    issued_by, issued_at, reissued_from_id, created_at
  ) values (
    v_evaluation.tenant_id,
    v_evaluation.student_id,
    v_evaluation.student_app_id,
    v_evaluation.course_id,
    v_evaluation.id,
    'issued',
    v_student_name,
    v_course_title,
    jsonb_build_object(
      'policyId', v_evaluation.policy_id,
      'policyVersion', v_evaluation.policy_version,
      'evaluationVersion', v_evaluation.evaluation_version,
      'evaluatedAt', v_evaluation.evaluated_at,
      'requirements', v_evaluation.requirements_snapshot
    ),
    v_evaluation.evidence_snapshot,
    v_evaluation.overall_score,
    v_actor_id,
    v_now,
    v_previous.id,
    v_now
  ) returning * into v_certificate;

  update public.course_completion_certificates
  set status = 'reissued'
  where id = v_previous.id;

  insert into public.course_completion_certificate_events (
    tenant_id, certificate_id, event_type, actor_id,
    actor_name_snapshot, reason, metadata, created_at
  ) values (
    v_certificate.tenant_id,
    v_certificate.id,
    'reissued',
    v_actor_id,
    v_actor_name,
    v_reason,
    jsonb_build_object(
      'reissuedFromId', v_previous.id,
      'previousCertificateNumber', v_previous.certificate_number,
      'evaluationId', v_evaluation.id
    ),
    v_now
  );

  return v_certificate;
end;
$$;

alter table public.course_completion_certificates enable row level security;
alter table public.course_completion_certificates force row level security;
alter table public.course_completion_certificate_events enable row level security;
alter table public.course_completion_certificate_events force row level security;

create policy "students read own completion certificates"
on public.course_completion_certificates for select to authenticated
using (student_id = (select auth.uid()));

create policy "institution leaders read tenant completion certificates"
on public.course_completion_certificates for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select private.has_current_tenant_role(
    array['tenant_super_admin', 'ceo']::text[]
  ))
);

create policy "platform owner reads all completion certificates"
on public.course_completion_certificates for select to authenticated
using ((select private.is_platform_owner()));

create policy "institution leaders read tenant certificate events"
on public.course_completion_certificate_events for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select private.has_current_tenant_role(
    array['tenant_super_admin', 'ceo']::text[]
  ))
);

create policy "platform owner reads all certificate events"
on public.course_completion_certificate_events for select to authenticated
using ((select private.is_platform_owner()));

-- Authenticated users receive read privilege only; RLS narrows those reads.
-- No application database role, including service_role, can write either table
-- directly. SECURITY DEFINER RPCs owned by the migration owner are the sole
-- business write path.
revoke all on public.course_completion_certificates
  from public, anon, authenticated, service_role;
grant select on public.course_completion_certificates
  to authenticated, service_role;

revoke all on public.course_completion_certificate_events
  from public, anon, authenticated, service_role;
grant select on public.course_completion_certificate_events
  to authenticated, service_role;

revoke all on function public.issue_course_completion_certificate(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.revoke_course_completion_certificate(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.reissue_course_completion_certificate(uuid, text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.issue_course_completion_certificate(uuid)
  to authenticated;
grant execute on function public.revoke_course_completion_certificate(uuid, text)
  to authenticated;
grant execute on function public.reissue_course_completion_certificate(uuid, text, uuid)
  to authenticated;

comment on function public.issue_course_completion_certificate(uuid) is
  '对应机构负责人为 eligible 资格原子颁发证书；并发重复调用返回同一张有效证书。';
comment on function public.revoke_course_completion_certificate(uuid, text) is
  '对应机构负责人或平台负责人提供明确原因后撤销有效证书并追加审计事件。';
comment on function public.reissue_course_completion_certificate(uuid, text, uuid) is
  '对应机构负责人基于 eligible 资格重新颁发新编号；第三参数可指定同一学生课程的新版资格。';

commit;
