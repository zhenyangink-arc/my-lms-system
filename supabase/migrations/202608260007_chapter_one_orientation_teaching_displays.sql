-- Add node-correlated teaching-board content to every Chapter 1 orientation script version.
with target_nodes as (
  select node.id, node.node_key
  from public.learning_agent_script_nodes node
  join public.learning_agent_script_versions version on version.id = node.script_version_id
  join public.learning_agent_lessons lesson on lesson.id = version.lesson_id
  join public.learning_agent_profiles profile on profile.id = lesson.agent_profile_id
  join public.digital_textbook_modules module on module.id = lesson.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions textbook_version on textbook_version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = textbook_version.textbook_id
  where profile.agent_code = 'uply-korean-teacher'
    and textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and module.module_code = 'orientation'
), displays(node_key, display) as (
  values
    ('welcome', jsonb_build_object(
      'kind', 'overview',
      'title', jsonb_build_object('zh-CN', '初次见面，你将学会什么？', 'ko-KR', '첫 만남에서 무엇을 배우나요?'),
      'body', jsonb_build_object('zh-CN', '把第一次见面的交流拆成四个容易完成的动作。', 'ko-KR', '첫 만남의 대화를 네 가지 쉬운 행동으로 나눠 봅니다.'),
      'items', jsonb_build_object('zh-CN', jsonb_build_array('先问候', '介绍姓名与身份', '确认对方信息', '礼貌结束'), 'ko-KR', jsonb_build_array('인사하기', '이름과 신분 소개하기', '상대 정보 확인하기', '예의 있게 마무리하기')),
      'korean', '안녕하세요? → 저는 왕밍이에요. → 만나서 반가워요.',
      'translation', jsonb_build_object('zh-CN', '你好 → 我是王明 → 很高兴见到你', 'ko-KR', '')
    )),
    ('observe-scene', jsonb_build_object(
      'kind', 'scene',
      'title', jsonb_build_object('zh-CN', '先看人物、地点和关系', 'ko-KR', '인물, 장소, 관계를 먼저 보세요'),
      'body', jsonb_build_object('zh-CN', '王明和智敏在校园语言交换活动中第一次见面。', 'ko-KR', '왕밍과 지민은 교내 언어 교환 모임에서 처음 만납니다.'),
      'items', jsonb_build_object('zh-CN', jsonb_build_array('人物：王明、智敏', '地点：校园语言交换活动', '关系：第一次见面'), 'ko-KR', jsonb_build_array('인물: 왕밍, 지민', '장소: 교내 언어 교환 모임', '관계: 첫 만남')),
      'korean', '', 'translation', jsonb_build_object('zh-CN', '', 'ko-KR', '')
    )),
    ('explain-order', jsonb_build_object(
      'kind', 'sequence',
      'title', jsonb_build_object('zh-CN', '初次见面的交流顺序', 'ko-KR', '첫 만남의 대화 순서'),
      'body', jsonb_build_object('zh-CN', '按这条顺序组织表达，对话就不会突然中断。', 'ko-KR', '이 순서대로 표현하면 대화가 자연스럽게 이어집니다.'),
      'items', jsonb_build_object('zh-CN', jsonb_build_array('问候', '自我介绍', '确认身份', '礼貌结束'), 'ko-KR', jsonb_build_array('인사', '자기소개', '신분 확인', '마무리 인사')),
      'korean', '안녕하세요? → 저는 왕밍이에요. → 학생이에요? → 만나서 반가워요.',
      'translation', jsonb_build_object('zh-CN', '你好 → 我是王明 → 是学生吗？→ 很高兴见到你', 'ko-KR', '')
    )),
    ('model-dialogue', jsonb_build_object(
      'kind', 'expression',
      'title', jsonb_build_object('zh-CN', '最短问候示范', 'ko-KR', '가장 짧은 인사 예시'),
      'body', jsonb_build_object('zh-CN', '第一次见面时，一方先问候，另一方自然回应。', 'ko-KR', '처음 만날 때 한 사람이 먼저 인사하고 상대가 자연스럽게 답합니다.'),
      'items', jsonb_build_object('zh-CN', jsonb_build_array('王明先开口', '智敏回应'), 'ko-KR', jsonb_build_array('왕밍이 먼저 인사', '지민이 응답')),
      'korean', '왕밍: 안녕하세요?\n지민: 네, 안녕하세요?',
      'translation', jsonb_build_object('zh-CN', '王明：你好？\n智敏：嗯，你好？', 'ko-KR', '')
    )),
    ('check-understanding', jsonb_build_object(
      'kind', 'question',
      'title', jsonb_build_object('zh-CN', '第一次见面，先说哪一句？', 'ko-KR', '처음 만났을 때 먼저 무엇을 말할까요?'),
      'body', jsonb_build_object('zh-CN', '回想刚才示范对话的第一句，再从下方选择回答。', 'ko-KR', '방금 본 대화의 첫 문장을 떠올리고 아래에서 답을 고르세요.'),
      'items', jsonb_build_object('zh-CN', jsonb_build_array(), 'ko-KR', jsonb_build_array()),
      'korean', '', 'translation', jsonb_build_object('zh-CN', '', 'ko-KR', '')
    )),
    ('lesson-mission', jsonb_build_object(
      'kind', 'task',
      'title', jsonb_build_object('zh-CN', '课末要完成什么？', 'ko-KR', '수업 끝에 무엇을 완성하나요?'),
      'body', jsonb_build_object('zh-CN', '最终目标不是背一句话，而是完成一段真正的双向交流。', 'ko-KR', '최종 목표는 한 문장을 외우는 것이 아니라 실제 양방향 대화를 완성하는 것입니다.'),
      'items', jsonb_build_object('zh-CN', jsonb_build_array('两个角色交替说话', '至少完成 8 轮对话', '不能用单人自我介绍代替'), 'ko-KR', jsonb_build_array('두 역할이 번갈아 말하기', '최소 8턴 대화 완성하기', '혼자 하는 자기소개로 대신하지 않기')),
      'korean', '', 'translation', jsonb_build_object('zh-CN', '', 'ko-KR', '')
    )),
    ('ready-for-practice', jsonb_build_object(
      'kind', 'summary',
      'title', jsonb_build_object('zh-CN', '课前导航完成', 'ko-KR', '수업 전 안내 완료'),
      'body', jsonb_build_object('zh-CN', '你已经知道交流场景、表达顺序和课末任务，可以进入情景诊断。', 'ko-KR', '대화 장면, 표현 순서, 수업 과제를 확인했으니 상황 진단으로 이동할 수 있습니다.'),
      'items', jsonb_build_object('zh-CN', jsonb_build_array('认识场景', '掌握顺序', '听过示范', '明确课末任务'), 'ko-KR', jsonb_build_array('장면 이해', '순서 익히기', '예시 듣기', '수업 과제 확인')),
      'korean', '안녕하세요? 만나서 반가워요.',
      'translation', jsonb_build_object('zh-CN', '你好，很高兴见到你。', 'ko-KR', '')
    ))
)
update public.learning_agent_script_nodes node
set configuration = coalesce(node.configuration, '{}'::jsonb) || jsonb_build_object('display', displays.display),
    updated_at = now()
from target_nodes, displays
where node.id = target_nodes.id
  and target_nodes.node_key = displays.node_key;
