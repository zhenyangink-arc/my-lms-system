-- 文本转 date 与日期格式化受数据库区域设置影响，应标记为 stable。
-- 这不会改变截止日期规则，只修正函数的优化器声明。
alter function public.is_valid_university_deadline(text) stable;
alter function public.university_deadline_for_stage(jsonb, text) stable;

notify pgrst, 'reload schema';
