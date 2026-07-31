-- 彻底关闭历史的“从标准题库逐题创建机构任务”入口。
-- 新流程只能调用 create_learning_assignment_from_paper 整卷发布。
revoke execute on function public.create_learning_assignment_from_bank(
  text, text, text, uuid, text, uuid[], timestamptz,
  integer, boolean, boolean, jsonb
) from authenticated;

grant execute on function public.create_learning_assignment_from_bank(
  text, text, text, uuid, text, uuid[], timestamptz,
  integer, boolean, boolean, jsonb
) to service_role;

comment on function public.create_learning_assignment_from_bank(
  text, text, text, uuid, text, uuid[], timestamptz,
  integer, boolean, boolean, jsonb
) is
  '历史逐题布置入口，仅保留服务角色兼容；机构必须通过标准试卷整卷发布。';
