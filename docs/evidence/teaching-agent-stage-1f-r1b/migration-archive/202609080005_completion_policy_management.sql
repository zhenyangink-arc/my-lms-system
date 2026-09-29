begin;
create function public.save_completion_policy_draft(p_id uuid, p_course_id uuid, p_title text, p_requirements jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_app uuid; v_id uuid; v_version integer;
begin
  if auth.uid() is null or not coalesce(private.is_platform_owner(),false) then raise exception '只有平台负责人可以维护结课政策'; end if;
  select c.student_app_id into v_app from public.courses c join public.student_apps a on a.id = c.student_app_id
    where c.id = p_course_id and a.slug = 'korean' and c.content_scope = 'platform';
  if v_app is null or not coalesce(private.completion_policy_requirements_are_valid(p_requirements),false) then raise exception '课程或结课要求无效'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_course_id::text, 19));
  if p_id is not null then
    update public.course_completion_policies set title = p_title, requirements = p_requirements
      where id = p_id and course_id = p_course_id and status = 'draft' returning id into v_id;
    if v_id is null then raise exception '只能修改此课程的草稿政策'; end if;
  else
    select coalesce(max(version),0)+1 into v_version from public.course_completion_policies where course_id = p_course_id;
    insert into public.course_completion_policies(student_app_id,course_id,policy_code,version,title,requirements,created_by)
      values(v_app,p_course_id,'COURSE_' || upper(replace(p_course_id::text,'-','')),v_version,p_title,p_requirements,auth.uid()) returning id into v_id;
  end if;
  return v_id;
end $$;
create function public.publish_completion_policy_draft(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.course_completion_policies%rowtype;
begin
  if auth.uid() is null or not coalesce(private.is_platform_owner(),false) then raise exception '只有平台负责人可以发布结课政策'; end if;
  select * into p from public.course_completion_policies where id = p_id;
  if p.id is null then raise exception '政策不存在'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p.course_id::text,19));
  select * into p from public.course_completion_policies where id = p_id for update;
  if p.status <> 'draft' then raise exception '只能发布草稿政策'; end if;
  -- Replacement is atomic. A validation failure rolls the retirement back too.
  update public.course_completion_policies set status = 'retired' where course_id = p.course_id and status = 'published' and is_default;
  update public.course_completion_policies set status = 'published', is_default = true, effective_from = now(), effective_until = null where id = p.id;
end $$;
create function public.get_completion_refresh_health() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(private.is_platform_owner(),false) then raise exception '只有平台负责人可以查看刷新任务'; end if;
  return (select jsonb_build_object('pending',count(*) filter(where status = 'pending'),
    'failed',count(*) filter(where status in ('failed','partial_failed')), 'processing',count(*) filter(where status = 'processing'),
    'lastFinishedAt',max(finished_at)) from public.course_completion_refresh_tasks);
end $$;
create function public.retry_failed_completion_refresh() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null or not coalesce(private.is_platform_owner(),false) then raise exception '只有平台负责人可以重试刷新任务'; end if;
  update public.course_completion_refresh_tasks t set status='pending',available_at=now(),worker_token=null,finished_at=null
    where t.id in (select f.id from public.course_completion_refresh_tasks f
      where f.status in ('failed','partial_failed') and not exists(select 1 from public.course_completion_refresh_tasks a
        where a.dedupe_key=f.dedupe_key and a.status in ('pending','processing'))
      order by f.created_at limit 10 for update skip locked);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.save_completion_policy_draft(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.publish_completion_policy_draft(uuid) from public,anon,authenticated;
revoke all on function public.get_completion_refresh_health() from public,anon,authenticated;
grant execute on function public.save_completion_policy_draft(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.publish_completion_policy_draft(uuid) to authenticated;
grant execute on function public.get_completion_refresh_health() to authenticated;
revoke all on function public.retry_failed_completion_refresh() from public,anon,authenticated;
grant execute on function public.retry_failed_completion_refresh() to authenticated;
commit;
