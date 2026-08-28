begin;

update public.learning_agent_profiles
set
  display_name = jsonb_build_object(
    'zh-CN', 'UPLY 韩语-金老师',
    'ko-KR', 'UPLY 한국어 김 선생님'
  ),
  updated_at = now()
where agent_code = 'uply-korean-teacher';

commit;
