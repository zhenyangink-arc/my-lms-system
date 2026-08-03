begin;

-- 工单角色固定为：学生提问；教师、机构负责人和运营负责人处理。
-- 旧的“帮助中心管理员授权”退出权限链，但保留历史表，避免破坏审计记录。
create or replace function public.current_user_can_handle_help_tickets()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_account()
    and private.current_tenant_id() is not null
    and public.current_profile_role() in ('teacher', 'ceo', 'tenant_super_admin');
$$;

create or replace function public.current_user_can_manage_help_articles()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_account()
    and private.current_tenant_id() is not null
    and public.current_profile_role() in ('ceo', 'tenant_super_admin');
$$;

create or replace function public.current_user_can_manage_help_center()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_can_handle_help_tickets();
$$;

drop policy if exists "tenant help assignments visible to owner or assignee"
  on public.help_center_admin_assignments;
drop policy if exists "tenant owner manages help assignments"
  on public.help_center_admin_assignments;
revoke all on public.help_center_admin_assignments from authenticated;

-- 学生确认环节单独标记，避免“老师已回复”和“问题已彻底关闭”混为一谈。
alter table public.help_tickets
  drop constraint if exists help_tickets_status_check;
alter table public.help_tickets
  add constraint help_tickets_status_check
  check (status in ('open', 'in_progress', 'waiting_student', 'resolved', 'closed'));

drop policy if exists "tenant users read help articles" on public.help_articles;
drop policy if exists "tenant managers or owners read help tickets" on public.help_tickets;
drop policy if exists "tenant managers or owners read help messages" on public.help_ticket_messages;

create policy "tenant users read help articles"
on public.help_articles for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_can_manage_help_articles())
    or (status = 'published' and (select public.is_active_account()))
  )
);

create policy "tenant handlers or owners read help tickets"
on public.help_tickets for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_can_handle_help_tickets())
    or user_id = (select auth.uid())
  )
);

create policy "tenant handlers or owners read help messages"
on public.help_ticket_messages for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_can_handle_help_tickets())
    or exists (
      select 1
      from public.help_tickets as ticket
      where ticket.id = help_ticket_messages.ticket_id
        and ticket.tenant_id = help_ticket_messages.tenant_id
        and ticket.user_id = (select auth.uid())
    )
  )
);

create or replace function public.add_help_ticket_message(p_ticket_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket_owner uuid;
  ticket_status text;
  message_id uuid;
  is_handler boolean;
  current_tenant uuid;
begin
  current_tenant := private.current_tenant_id();
  is_handler := public.current_user_can_handle_help_tickets();

  select user_id, status
  into ticket_owner, ticket_status
  from public.help_tickets
  where id = p_ticket_id and tenant_id = current_tenant;

  if ticket_owner is null then raise exception '求助记录不存在'; end if;
  if not is_handler and ticket_owner <> auth.uid() then raise exception '无权回复该求助'; end if;
  if not is_handler and ticket_status = 'closed' then raise exception '该求助已经关闭'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception '回复内容需要填写 1 至 5000 个字';
  end if;

  insert into public.help_ticket_messages (
    tenant_id, ticket_id, sender_id, sender_kind, body
  ) values (
    current_tenant,
    p_ticket_id,
    auth.uid(),
    case when is_handler then 'staff' else 'student' end,
    trim(p_body)
  ) returning id into message_id;

  update public.help_tickets
  set status = case
        when is_handler and status = 'open' then 'in_progress'
        when not is_handler and status = 'waiting_student' then 'in_progress'
        else status
      end,
      assigned_to = case
        when is_handler then coalesce(assigned_to, auth.uid())
        else assigned_to
      end,
      updated_at = now()
  where id = p_ticket_id and tenant_id = current_tenant;

  return message_id;
end;
$$;

create or replace function public.update_help_ticket(
  p_ticket_id uuid,
  p_status text,
  p_priority text,
  p_resolution text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_user_can_handle_help_tickets() then
    raise exception '当前账号没有工单处理权限';
  end if;
  if p_status not in ('open', 'in_progress', 'waiting_student', 'resolved', 'closed')
     or p_priority not in ('normal', 'urgent')
     or char_length(coalesce(p_resolution, '')) > 3000 then
    raise exception '求助状态、紧急程度或处理结果不正确';
  end if;

  update public.help_tickets
  set status = p_status,
      priority = p_priority,
      resolution = trim(coalesce(p_resolution, '')),
      assigned_to = coalesce(assigned_to, auth.uid()),
      resolved_at = case
        when p_status in ('resolved', 'closed') then coalesce(resolved_at, now())
        else null
      end,
      updated_at = now()
  where id = p_ticket_id
    and tenant_id = private.current_tenant_id();

  if not found then raise exception '求助记录不存在'; end if;
end;
$$;

create or replace function public.assign_help_ticket(
  p_ticket_id uuid,
  p_teacher_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_tenant uuid;
begin
  current_tenant := private.current_tenant_id();
  if not (
    public.is_active_account()
    and current_tenant is not null
    and public.current_profile_role() in ('ceo', 'tenant_super_admin')
  ) then
    raise exception '只有机构负责人可以分配工单';
  end if;

  if p_teacher_id is not null and not exists (
    select 1
    from public.tenant_memberships as membership
    where membership.tenant_id = current_tenant
      and membership.user_id = p_teacher_id
      and membership.role = 'teacher'
      and membership.status = 'active'
  ) then
    raise exception '只能分配给本机构正常状态的教师';
  end if;

  update public.help_tickets
  set assigned_to = p_teacher_id,
      updated_at = now()
  where id = p_ticket_id and tenant_id = current_tenant;

  if not found then raise exception '求助记录不存在'; end if;
end;
$$;

create or replace function public.confirm_help_ticket_resolved(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.help_tickets
  set status = 'closed',
      resolved_at = coalesce(resolved_at, now()),
      updated_at = now()
  where id = p_ticket_id
    and tenant_id = private.current_tenant_id()
    and user_id = auth.uid()
    and status in ('waiting_student', 'resolved');

  if not found then raise exception '当前求助不能确认完成'; end if;
end;
$$;

create or replace function public.change_help_article_status(
  p_article_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_user_can_manage_help_articles() then
    raise exception '当前账号没有帮助文章管理权限';
  end if;
  if p_status not in ('draft', 'published', 'archived') then
    raise exception '帮助文章状态不正确';
  end if;

  update public.help_articles
  set status = p_status,
      published_at = case
        when p_status = 'published' and status <> 'published' then now()
        when p_status = 'draft' then null
        else published_at
      end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_article_id
    and tenant_id = private.current_tenant_id();

  if not found then raise exception '帮助文章不存在'; end if;
end;
$$;

create or replace function public.save_help_article(
  p_id uuid,
  p_title text,
  p_summary text,
  p_content text,
  p_category text,
  p_is_featured boolean,
  p_sort_order integer,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
  current_tenant uuid;
begin
  if not public.current_user_can_manage_help_articles() then
    raise exception '当前账号没有帮助文章管理权限';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 2 and 120
     or char_length(trim(coalesce(p_content, ''))) not between 2 and 10000
     or char_length(coalesce(p_summary, '')) > 500 then
    raise exception '帮助文章标题、摘要或正文长度不正确';
  end if;
  if p_category not in ('platform', 'account', 'course', 'study', 'visa', 'service')
     or p_status not in ('draft', 'published', 'archived')
     or p_sort_order not between 0 and 100000 then
    raise exception '帮助文章分类、状态或排序值不正确';
  end if;

  current_tenant := private.current_tenant_id();
  if p_id is null then
    insert into public.help_articles (
      tenant_id, title, summary, content, category, is_featured, sort_order,
      status, published_at, created_by, updated_by
    ) values (
      current_tenant,
      trim(p_title),
      trim(coalesce(p_summary, '')),
      trim(p_content),
      p_category,
      coalesce(p_is_featured, false),
      p_sort_order,
      p_status,
      case when p_status = 'published' then now() else null end,
      auth.uid(),
      auth.uid()
    ) returning id into saved_id;
  else
    update public.help_articles
    set title = trim(p_title),
        summary = trim(coalesce(p_summary, '')),
        content = trim(p_content),
        category = p_category,
        is_featured = coalesce(p_is_featured, false),
        sort_order = p_sort_order,
        status = p_status,
        published_at = case
          when p_status = 'published' and status <> 'published' then now()
          when p_status = 'draft' then null
          else published_at
        end,
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_id and tenant_id = current_tenant
    returning id into saved_id;

    if saved_id is null then raise exception '帮助文章不存在'; end if;
  end if;

  return saved_id;
end;
$$;

create or replace function public.get_platform_help_center_overview()
returns table (
  tenant_id uuid,
  tenant_name text,
  tenant_status text,
  active_members bigint,
  total_tickets bigint,
  open_tickets bigint,
  in_progress_tickets bigint,
  waiting_student_tickets bigint,
  resolved_tickets bigint,
  closed_tickets bigint,
  urgent_pending_tickets bigint,
  overdue_tickets bigint,
  resolution_rate numeric,
  oldest_waiting_at timestamptz,
  last_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_owner() then
    raise exception '只有平台负责人可以查看机构帮助中心总览';
  end if;

  return query
  select
    tenant.id,
    tenant.name,
    tenant.status,
    coalesce(member_stats.active_members, 0),
    coalesce(ticket_stats.total_tickets, 0),
    coalesce(ticket_stats.open_tickets, 0),
    coalesce(ticket_stats.in_progress_tickets, 0),
    coalesce(ticket_stats.waiting_student_tickets, 0),
    coalesce(ticket_stats.resolved_tickets, 0),
    coalesce(ticket_stats.closed_tickets, 0),
    coalesce(ticket_stats.urgent_pending_tickets, 0),
    coalesce(ticket_stats.overdue_tickets, 0),
    coalesce(ticket_stats.resolution_rate, 0),
    ticket_stats.oldest_waiting_at,
    ticket_stats.last_updated_at
  from public.tenants as tenant
  left join lateral (
    select count(distinct membership.user_id)::bigint as active_members
    from public.tenant_memberships as membership
    where membership.tenant_id = tenant.id
      and membership.status = 'active'
  ) as member_stats on true
  left join lateral (
    select
      count(*)::bigint as total_tickets,
      count(*) filter (where ticket.status = 'open')::bigint as open_tickets,
      count(*) filter (where ticket.status = 'in_progress')::bigint as in_progress_tickets,
      count(*) filter (where ticket.status = 'waiting_student')::bigint as waiting_student_tickets,
      count(*) filter (where ticket.status = 'resolved')::bigint as resolved_tickets,
      count(*) filter (where ticket.status = 'closed')::bigint as closed_tickets,
      count(*) filter (
        where ticket.priority = 'urgent'
          and ticket.status in ('open', 'in_progress')
      )::bigint as urgent_pending_tickets,
      count(*) filter (
        where (ticket.status = 'open' and ticket.created_at < now() - interval '24 hours')
           or (ticket.status = 'in_progress' and ticket.updated_at < now() - interval '72 hours')
      )::bigint as overdue_tickets,
      round(
        100.0 * count(*) filter (where ticket.status in ('resolved', 'closed'))
        / nullif(count(*), 0),
        1
      ) as resolution_rate,
      min(ticket.created_at) filter (where ticket.status = 'open') as oldest_waiting_at,
      max(ticket.updated_at) as last_updated_at
    from public.help_tickets as ticket
    where ticket.tenant_id = tenant.id
  ) as ticket_stats on true
  where tenant.status <> 'archived'
  order by tenant.name, tenant.id;
end;
$$;

revoke all on function public.current_user_can_handle_help_tickets() from public, anon;
revoke all on function public.current_user_can_manage_help_articles() from public, anon;
revoke all on function public.assign_help_ticket(uuid, uuid) from public, anon;
revoke all on function public.confirm_help_ticket_resolved(uuid) from public, anon;
revoke all on function public.get_platform_help_center_overview() from public, anon;

grant execute on function public.current_user_can_handle_help_tickets() to authenticated;
grant execute on function public.current_user_can_manage_help_articles() to authenticated;
grant execute on function public.assign_help_ticket(uuid, uuid) to authenticated;
grant execute on function public.confirm_help_ticket_resolved(uuid) to authenticated;
grant execute on function public.get_platform_help_center_overview() to authenticated;

comment on function public.get_platform_help_center_overview() is
  '平台负责人只读取机构级帮助工单统计，不返回学生或工单正文。';

notify pgrst, 'reload schema';

commit;
