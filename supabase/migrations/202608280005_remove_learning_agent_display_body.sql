-- “展示说明”已从教学脚本工作台移除；清理历史节点中遗留的同名展示正文，
-- 防止学生端或后续渲染器再次显示后台已经删除的旧文案。
update public.learning_agent_script_nodes
set configuration = jsonb_set(
      configuration,
      '{display}',
      (configuration -> 'display') - 'body',
      false
    ),
    updated_at = now()
where jsonb_typeof(configuration -> 'display') = 'object'
  and (configuration -> 'display') ? 'body';
