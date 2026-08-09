begin;

-- digital_textbook_modules/nodes/activities 的读策略之前是 qual = true，任何登录用户
-- 都能读到还在编辑中、没有正式发布的教材草稿内容——章节/教材本身的读策略已经是
-- "已发布或者是内容管理员"（digital_textbook_chapters/digital_textbooks），这里补齐
-- 到同一标准，顺着 module→chapter、node→module→chapter、activity→node→module→chapter
-- 查到所属章节是否已发布。
drop policy if exists "authenticated read textbook modules" on public.digital_textbook_modules;

create policy "authenticated read textbook modules"
on public.digital_textbook_modules for select to authenticated
using (
  current_user_can_manage_standard_question_bank()
  or exists (
    select 1
    from public.digital_textbook_chapters as chapter
    where chapter.id = digital_textbook_modules.chapter_id
      and chapter.status = 'published'
  )
);

drop policy if exists "authenticated read textbook nodes" on public.digital_textbook_nodes;

create policy "authenticated read textbook nodes"
on public.digital_textbook_nodes for select to authenticated
using (
  current_user_can_manage_standard_question_bank()
  or exists (
    select 1
    from public.digital_textbook_modules as module
    join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
    where module.id = digital_textbook_nodes.module_id
      and chapter.status = 'published'
  )
);

drop policy if exists "authenticated read textbook activities" on public.digital_textbook_activities;

create policy "authenticated read textbook activities"
on public.digital_textbook_activities for select to authenticated
using (
  current_user_can_manage_standard_question_bank()
  or exists (
    select 1
    from public.digital_textbook_nodes as node
    join public.digital_textbook_modules as module on module.id = node.module_id
    join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
    where node.id = digital_textbook_activities.node_id
      and chapter.status = 'published'
  )
);

commit;
