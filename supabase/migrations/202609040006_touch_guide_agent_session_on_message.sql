begin;

-- 之前每次学生提问，应用层要在插入消息之后再单独 update 一次 session.updated_at
-- （本地规则分支甚至重复 update 了两次），每次都多等一轮数据库往返。
-- 改成插入消息时用触发器自动顶新 session.updated_at，应用层不再需要手动维护这个字段。

create or replace function private.touch_guide_agent_session_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.guide_agent_sessions
  set updated_at = now()
  where id = new.session_id;
  return new;
end;
$$;

drop trigger if exists guide_agent_messages_touch_session on public.guide_agent_messages;
create trigger guide_agent_messages_touch_session
after insert on public.guide_agent_messages
for each row execute function private.touch_guide_agent_session_on_message();

comment on function private.touch_guide_agent_session_on_message() is
  '导航 Agent 每次写入一条消息时自动顶新所属会话的 updated_at，取代应用层手动 update。';

commit;
