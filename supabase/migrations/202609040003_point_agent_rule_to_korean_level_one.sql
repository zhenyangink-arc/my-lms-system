begin;

update public.guide_agent_navigation_rules rule
set target_path = '/dashboard/courses/korean/korean-basic/korean-beginner',
    response_text = '好的，正在为你打开韩语1级课程。',
    updated_at = now()
from public.learning_agent_profiles profile
where rule.agent_profile_id = profile.id
  and profile.agent_code = 'uply-guide-agent'
  and rule.name = '继续韩语学习';

commit;
