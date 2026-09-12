begin;
create table public.institution_learning_followups (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  app_id uuid not null references public.student_apps(id) on delete cascade,
  topic text not null check (topic in ('grades','records','conversation')),
  status text not null check (status in ('pending','in_progress','resolved')),
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  actor_id uuid not null,
  created_at timestamptz not null default clock_timestamp()
);
create index institution_learning_followups_lookup on public.institution_learning_followups(tenant_id,app_id,topic,sequence desc);
alter table public.institution_learning_followups enable row level security;
revoke all on public.institution_learning_followups from public, anon, authenticated;
grant select on public.institution_learning_followups to authenticated;
create policy platform_managers_read on public.institution_learning_followups for select to authenticated
using (coalesce(private.is_platform_tenant_manager(),false) and private.current_tenant_id() is null);
create function public.append_institution_learning_followup(p_tenant_id uuid,p_app_id uuid,p_topic text,p_status text,p_note text,p_expected_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_latest uuid; v_id uuid;
begin
  if auth.uid() is null or not coalesce(private.is_platform_tenant_manager(),false) or private.current_tenant_id() is not null then
    raise exception '当前账号没有机构跟进权限' using errcode='42501';
  end if;
  if p_topic is null or p_topic not in ('grades','records','conversation') or p_status is null or p_status not in ('pending','in_progress','resolved') or p_note is null or char_length(btrim(p_note)) not between 1 and 2000 then
    raise exception '请选择有效状态并填写 1–2000 字处理说明' using errcode='22023';
  end if;
  -- Serialize writes even when there is no previous event; never overwrite history.
  perform 1 from public.tenant_student_apps where tenant_id=p_tenant_id and app_id=p_app_id for update;
  if not found then raise exception '机构未注册当前应用' using errcode='22023'; end if;
  select id into v_latest from public.institution_learning_followups where tenant_id=p_tenant_id and app_id=p_app_id and topic=p_topic order by sequence desc limit 1;
  if v_latest is distinct from p_expected_id then
    raise exception '跟进记录已更新，请刷新后核对最新记录再保存' using errcode='40001';
  end if;
  insert into public.institution_learning_followups(tenant_id,app_id,topic,status,note,actor_id)
  values(p_tenant_id,p_app_id,p_topic,p_status,btrim(p_note),auth.uid()) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.append_institution_learning_followup(uuid,uuid,text,text,text,uuid) from public,anon;
grant execute on function public.append_institution_learning_followup(uuid,uuid,text,text,text,uuid) to authenticated;
commit;
