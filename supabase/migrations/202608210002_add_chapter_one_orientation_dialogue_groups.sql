-- Store reusable dialogue groups in chapter content. The shared renderer reads
-- this array directly and falls back to targets for chapters without groups.
update public.digital_textbook_nodes as node
set
  content = jsonb_set(
    node.content,
    '{dialogueGroups}',
    $dialogue_groups$
    [
      {
        "id": "greeting",
        "title": {"zh-CN": "问候", "ko-KR": "인사"},
        "lines": [
          {"speaker": "王明", "ko": "안녕하세요?", "zh": "你好？"},
          {"speaker": "智敏", "ko": "네, 안녕하세요?", "zh": "嗯，你好？"}
        ]
      },
      {
        "id": "introductions",
        "title": {"zh-CN": "自我介绍", "ko-KR": "자기소개"},
        "lines": [
          {"speaker": "王明", "ko": "저는 왕밍이에요.", "zh": "我是王明。"},
          {"speaker": "智敏", "ko": "저는 지민이에요.", "zh": "我是智敏。"}
        ]
      },
      {
        "id": "student-status",
        "title": {"zh-CN": "确认身份", "ko-KR": "신분 확인"},
        "lines": [
          {"speaker": "王明", "ko": "지민 씨는 학생이에요?", "zh": "智敏是学生吗？"},
          {"speaker": "智敏", "ko": "네, 학생이에요.", "zh": "是的，是学生。"}
        ]
      },
      {
        "id": "complete-first-meeting",
        "title": {"zh-CN": "完整对话", "ko-KR": "전체 대화"},
        "lines": [
          {"speaker": "王明", "ko": "안녕하세요?", "zh": "你好？"},
          {"speaker": "智敏", "ko": "네, 안녕하세요?", "zh": "嗯，你好？"},
          {"speaker": "王明", "ko": "저는 왕밍이에요.", "zh": "我是王明。"},
          {"speaker": "智敏", "ko": "저는 지민이에요.", "zh": "我是智敏。"},
          {"speaker": "王明", "ko": "지민 씨는 학생이에요?", "zh": "智敏是学生吗？"},
          {"speaker": "智敏", "ko": "네, 학생이에요.", "zh": "是的，是学生。"},
          {"speaker": "王明", "ko": "만나서 반가워요.", "zh": "很高兴认识你。"},
          {"speaker": "智敏", "ko": "네, 저도 만나서 반가워요.", "zh": "嗯，我也很高兴认识你。"}
        ]
      }
    ]
    $dialogue_groups$::jsonb,
    true
  ),
  updated_at = now()
from public.digital_textbook_modules as module
join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
join public.digital_textbook_versions as version on version.id = chapter.version_id
join public.digital_textbooks as textbook on textbook.id = version.textbook_id
where node.module_id = module.id
  and textbook.slug = 'korean-level-one-smart'
  and chapter.chapter_number = 1
  and node.node_code = 'mission-map';
