do $$
declare
  pattern_order_id uuid;
  pattern_node_id uuid;
begin
  select activity.id, node.id into pattern_order_id, pattern_node_id
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and module.module_code = 'patterns'
    and node.node_code = 'introduce-yourself'
    and activity.activity_key = 'pattern-order'
  order by version.version_number desc
  limit 1;

  if pattern_order_id is null then
    raise exception 'Cannot present expression path: pattern-order activity is missing';
  end if;

  update public.digital_textbook_activities
  set prompt = '{"zh-CN":"四个语块排成自然的自我介绍","ko-KR":"네 개의 말덩이로 자연스러운 자기소개 만들기"}'::jsonb,
      instruction = '{"zh-CN":"依次选择句子，完成“问候—姓名—身份—结束语”的表达路径。","ko-KR":"문장을 차례로 골라 ‘인사—이름—신분—마무리’ 표현 흐름을 완성하세요."}'::jsonb,
      public_config = '{"presentation":"expression_path","resettable":true,"pathLabels":[{"id":"greeting","zh-CN":"问候","ko-KR":"인사"},{"id":"name","zh-CN":"姓名","ko-KR":"이름"},{"id":"identity","zh-CN":"身份","ko-KR":"신분"},{"id":"closing","zh-CN":"结束语","ko-KR":"마무리"}]}'::jsonb,
      updated_at = now()
  where id = pattern_order_id;

  delete from public.digital_textbook_attempts
  where activity_id = pattern_order_id;

  update public.digital_textbook_node_progress as progress
  set status = 'in_progress',
      completion_percent = coalesce((
        select round(
          100.0 * count(*) filter (where exists (
            select 1
            from public.digital_textbook_attempts as attempt
            where attempt.activity_id = activity.id
              and attempt.tenant_id = progress.tenant_id
              and attempt.student_id = progress.student_id
              and attempt.version_id = progress.version_id
              and attempt.is_correct = true
          )) / nullif(count(*), 0)
        )::integer
        from public.digital_textbook_activities as activity
        where activity.node_id = pattern_node_id
          and activity.activity_type in ('single_choice','multiple_choice','fill_blank','ordering','listening')
      ), 0),
      updated_at = now()
  where progress.node_id = pattern_node_id;
end $$;
