-- ============================================================
-- 帮助中心：帮助文章、学生求助工单、双向沟通与负责人授权
-- 后台：负责人、全部 CEO、负责人单独指定的管理员。
-- 学生：只读已发布文章，只能查看和回复自己的求助工单。
-- ============================================================

create table if not exists public.help_center_admin_assignments (
  admin_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz
);

create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  summary text not null default '' check (char_length(summary) <= 500),
  content text not null check (char_length(content) between 2 and 10000),
  category text not null default 'platform' check (
    category in ('platform', 'account', 'course', 'study', 'visa', 'service')
  ),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.help_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 2 and 120),
  description text not null check (char_length(description) between 2 and 5000),
  category text not null default 'other' check (
    category in ('technical', 'account', 'course', 'service', 'other')
  ),
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  resolution text not null default '' check (char_length(resolution) <= 3000),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.help_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.help_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  sender_kind text not null check (sender_kind in ('student', 'staff')),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists help_articles_catalog_idx
  on public.help_articles (status, is_featured desc, sort_order, published_at desc);
create index if not exists help_tickets_user_idx
  on public.help_tickets (user_id, updated_at desc);
create index if not exists help_tickets_status_idx
  on public.help_tickets (status, priority, updated_at desc);
create index if not exists help_ticket_messages_ticket_idx
  on public.help_ticket_messages (ticket_id, created_at);
create index if not exists help_center_admin_assignments_active_idx
  on public.help_center_admin_assignments (admin_id)
  where revoked_at is null;

create or replace function public.current_user_is_help_center_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and coalesce(status, 'active') = 'active'
      and role = 'super_admin'
  );
$$;

create or replace function public.current_user_can_manage_help_center()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles as viewer
    where viewer.id = auth.uid()
      and coalesce(viewer.status, 'active') = 'active'
      and (
        viewer.role in ('super_admin', 'ceo')
        or (
          viewer.role = 'admin'
          and exists (
            select 1 from public.help_center_admin_assignments as assignment
            where assignment.admin_id = viewer.id
              and assignment.revoked_at is null
          )
        )
      )
  );
$$;

create or replace function public.enforce_help_center_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
  target_status text;
begin
  if auth.uid() is null then return new; end if;
  if not public.current_user_is_help_center_owner() then
    raise exception '只有负责人可以指定帮助中心管理员';
  end if;

  select role, coalesce(status, 'active') into target_role, target_status
  from public.profiles where id = new.admin_id;

  if new.revoked_at is null
     and (target_role is distinct from 'admin' or target_status is distinct from 'active') then
    raise exception '只能授权状态正常的管理员账号';
  end if;

  if new.revoked_at is null then
    new.granted_by := auth.uid();
    new.granted_at := now();
    new.revoked_by := null;
  else
    new.revoked_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_help_center_assignment_trigger on public.help_center_admin_assignments;
create trigger enforce_help_center_assignment_trigger
before insert or update on public.help_center_admin_assignments
for each row execute function public.enforce_help_center_assignment();

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
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.current_user_can_manage_help_center() then
    raise exception '当前账号没有帮助中心管理权限';
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

  if p_id is null then
    insert into public.help_articles (
      title, summary, content, category, is_featured, sort_order, status,
      published_at, created_by, updated_by
    ) values (
      trim(p_title), trim(coalesce(p_summary, '')), trim(p_content), p_category,
      coalesce(p_is_featured, false), p_sort_order, p_status,
      case when p_status = 'published' then now() else null end,
      auth.uid(), auth.uid()
    ) returning id into v_id;
  else
    update public.help_articles
    set title = trim(p_title), summary = trim(coalesce(p_summary, '')),
        content = trim(p_content), category = p_category,
        is_featured = coalesce(p_is_featured, false), sort_order = p_sort_order,
        status = p_status,
        published_at = case
          when p_status = 'published' and status <> 'published' then now()
          when p_status = 'draft' then null
          else published_at
        end,
        updated_by = auth.uid(), updated_at = now()
    where id = p_id returning id into v_id;
    if v_id is null then raise exception '帮助文章不存在'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.change_help_article_status(p_article_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_can_manage_help_center() then
    raise exception '当前账号没有帮助中心管理权限';
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
      updated_by = auth.uid(), updated_at = now()
  where id = p_article_id;
  if not found then raise exception '帮助文章不存在'; end if;
end;
$$;

create or replace function public.create_help_ticket(
  p_subject text,
  p_description text,
  p_category text,
  p_priority text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_ticket_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
      and coalesce(status, 'active') = 'active'
  ) then
    raise exception '只有正常状态的学生账号可以提交求助';
  end if;
  if char_length(trim(coalesce(p_subject, ''))) not between 2 and 120
     or char_length(trim(coalesce(p_description, ''))) not between 2 and 5000 then
    raise exception '求助标题或问题描述长度不正确';
  end if;
  if p_category not in ('technical', 'account', 'course', 'service', 'other')
     or p_priority not in ('normal', 'urgent') then
    raise exception '求助分类或紧急程度不正确';
  end if;

  insert into public.help_tickets (user_id, subject, description, category, priority)
  values (auth.uid(), trim(p_subject), trim(p_description), p_category, p_priority)
  returning id into v_ticket_id;
  return v_ticket_id;
end;
$$;

create or replace function public.add_help_ticket_message(p_ticket_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status text;
  v_message_id uuid;
  v_is_manager boolean;
begin
  v_is_manager := public.current_user_can_manage_help_center();
  select user_id, status into v_owner, v_status
  from public.help_tickets where id = p_ticket_id;
  if v_owner is null then raise exception '求助记录不存在'; end if;
  if not v_is_manager and v_owner <> auth.uid() then raise exception '无权回复该求助'; end if;
  if not v_is_manager and v_status = 'closed' then raise exception '该求助已经关闭'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception '回复内容需要填写 1 至 5000 个字';
  end if;

  insert into public.help_ticket_messages (ticket_id, sender_id, sender_kind, body)
  values (p_ticket_id, auth.uid(), case when v_is_manager then 'staff' else 'student' end, trim(p_body))
  returning id into v_message_id;

  update public.help_tickets
  set status = case when v_is_manager and status = 'open' then 'in_progress' else status end,
      assigned_to = case when v_is_manager then coalesce(assigned_to, auth.uid()) else assigned_to end,
      updated_at = now()
  where id = p_ticket_id;
  return v_message_id;
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
set search_path = public
as $$
begin
  if not public.current_user_can_manage_help_center() then
    raise exception '当前账号没有帮助中心管理权限';
  end if;
  if p_status not in ('open', 'in_progress', 'resolved', 'closed')
     or p_priority not in ('normal', 'urgent')
     or char_length(coalesce(p_resolution, '')) > 3000 then
    raise exception '求助状态、紧急程度或处理结果不正确';
  end if;
  update public.help_tickets
  set status = p_status, priority = p_priority,
      resolution = trim(coalesce(p_resolution, '')),
      assigned_to = coalesce(assigned_to, auth.uid()),
      resolved_at = case when p_status in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end,
      updated_at = now()
  where id = p_ticket_id;
  if not found then raise exception '求助记录不存在'; end if;
end;
$$;

alter table public.help_center_admin_assignments enable row level security;
alter table public.help_articles enable row level security;
alter table public.help_tickets enable row level security;
alter table public.help_ticket_messages enable row level security;

create policy "help assignments visible to owner or assignee"
on public.help_center_admin_assignments for select to authenticated
using (public.current_user_is_help_center_owner() or admin_id = auth.uid());
create policy "owner manages help assignments"
on public.help_center_admin_assignments for all to authenticated
using (public.current_user_is_help_center_owner())
with check (public.current_user_is_help_center_owner());

create policy "active users read published help articles"
on public.help_articles for select to authenticated
using (
  public.current_user_can_manage_help_center()
  or (
    status = 'published'
    and exists (
      select 1 from public.profiles as viewer
      where viewer.id = auth.uid() and coalesce(viewer.status, 'active') = 'active'
    )
  )
);

create policy "managers or owners read help tickets"
on public.help_tickets for select to authenticated
using (public.current_user_can_manage_help_center() or user_id = auth.uid());
create policy "managers or owners read help messages"
on public.help_ticket_messages for select to authenticated
using (
  public.current_user_can_manage_help_center()
  or exists (
    select 1 from public.help_tickets as ticket
    where ticket.id = help_ticket_messages.ticket_id and ticket.user_id = auth.uid()
  )
);

grant select on public.help_articles, public.help_tickets, public.help_ticket_messages to authenticated;
grant select, insert, update on public.help_center_admin_assignments to authenticated;
revoke insert, update, delete on public.help_articles, public.help_tickets, public.help_ticket_messages from authenticated;
revoke delete on public.help_center_admin_assignments from authenticated;

revoke all on function public.save_help_article(uuid, text, text, text, text, boolean, integer, text) from public, anon;
revoke all on function public.change_help_article_status(uuid, text) from public, anon;
revoke all on function public.create_help_ticket(text, text, text, text) from public, anon;
revoke all on function public.add_help_ticket_message(uuid, text) from public, anon;
revoke all on function public.update_help_ticket(uuid, text, text, text) from public, anon;

grant execute on function public.current_user_is_help_center_owner() to authenticated;
grant execute on function public.current_user_can_manage_help_center() to authenticated;
grant execute on function public.save_help_article(uuid, text, text, text, text, boolean, integer, text) to authenticated;
grant execute on function public.change_help_article_status(uuid, text) to authenticated;
grant execute on function public.create_help_ticket(text, text, text, text) to authenticated;
grant execute on function public.add_help_ticket_message(uuid, text) to authenticated;
grant execute on function public.update_help_ticket(uuid, text, text, text) to authenticated;

comment on table public.help_articles is '学生端帮助中心的可发布知识文章';
comment on table public.help_tickets is '学生求助工单及后台处理状态';
comment on table public.help_ticket_messages is '学生与帮助中心后台之间的双向沟通记录';
comment on table public.help_center_admin_assignments is '负责人指定的帮助中心普通管理员权限';
