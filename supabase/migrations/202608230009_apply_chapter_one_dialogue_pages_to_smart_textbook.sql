-- Reshape chapter 1 dialogue into an explanation page and a two-scene
-- conversation page. The two scripts naturally cover all twelve core words.

with target_node as (
  select node.id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and node.node_code = 'club-first-meeting'
)
update public.digital_textbook_nodes as node
set content = node.content || jsonb_build_object(
  'dialogueFlow', $flow$[
    {"order":1,"title":{"zh-CN":"初次见面","ko-KR":"처음 만남"},"description":{"zh-CN":"先确认是第一次见面，用问候自然开启交流。","ko-KR":"처음 만난 상황을 확인하고 인사로 자연스럽게 대화를 시작합니다."},"words":["처음","만나다","인사하다"]},
    {"order":2,"title":{"zh-CN":"介绍自己","ko-KR":"자기소개"},"description":{"zh-CN":"说明自己、姓名以及正在学习的语言。","ko-KR":"자신과 이름, 배우는 언어를 소개합니다."},"words":["저","이름","소개하다","한국어"]},
    {"order":3,"title":{"zh-CN":"确认人物与身份","ko-KR":"사람과 신분 확인"},"description":{"zh-CN":"介绍朋友，并确认对方是学生还是老师。","ko-KR":"친구를 소개하고 학생인지 선생님인지 확인합니다."},"words":["학생","선생님","친구","사람"]},
    {"order":4,"title":{"zh-CN":"礼貌结束","ko-KR":"공손하게 마무리"},"description":{"zh-CN":"用见面高兴的表达回应对方并结束交流。","ko-KR":"만나서 기쁘다는 표현으로 서로 응답하며 대화를 마칩니다."},"words":["반갑다"]}
  ]$flow$::jsonb,
  'dialogueScenes', $scenes$[
    {
      "id":"first-meeting",
      "title":{"zh-CN":"场景 1｜第一次见面","ko-KR":"장면 1｜처음 만남"},
      "context":{"zh-CN":"王明与智敏在校园语言交换签到区第一次见面，交换姓名、确认学生身份并礼貌结束。","ko-KR":"왕밍과 지민이 교내 언어 교환 접수대에서 처음 만나 이름을 나누고 학생 신분을 확인한 뒤 인사를 마칩니다."},
      "coverage":["처음","만나다","저","이름","학생","한국어","반갑다"],
      "lines":[
        {"speaker":"지민","ko":"안녕하세요? 우리 처음 만나요. 저는 김지민이에요.","zh":"你好！我们是第一次见面吧？我叫金智敏。","words":["처음","만나다","저"]},
        {"speaker":"왕밍","ko":"안녕하세요? 제 이름은 왕밍이에요.","zh":"你好！我的名字叫王明。","words":["이름"]},
        {"speaker":"지민","ko":"왕밍 씨는 학생이에요?","zh":"王明，你是学生吗？","words":["학생"]},
        {"speaker":"왕밍","ko":"네, 학생이에요. 한국어를 배워요.","zh":"是的，我是学生。我学习韩语。","words":["학생","한국어"]},
        {"speaker":"왕밍","ko":"지민 씨도 학생이에요?","zh":"智敏，你也是学生吗？","words":["학생"]},
        {"speaker":"지민","ko":"네, 저도 학생이에요.","zh":"是的，我也是学生。","words":["저","학생"]},
        {"speaker":"왕밍","ko":"만나서 반가워요.","zh":"很高兴认识你。","words":["만나다","반갑다"]},
        {"speaker":"지민","ko":"저도 만나서 반가워요.","zh":"我也很高兴认识你。","words":["저","만나다","반갑다"]}
      ]
    },
    {
      "id":"introduce-and-correct",
      "title":{"zh-CN":"场景 2｜介绍朋友与身份更正","ko-KR":"장면 2｜친구 소개와 신분 정정"},
      "context":{"zh-CN":"敏智介绍两位第一次见面的朋友；王明误以为丽娜是老师，丽娜礼貌更正后互相问候。","ko-KR":"민지가 처음 만나는 두 친구를 소개합니다. 왕밍이 리나를 선생님으로 생각하지만 리나가 공손히 바로잡고 서로 인사합니다."},
      "coverage":["사람","처음","만나다","친구","소개하다","선생님","저","학생","한국어","인사하다","반갑다"],
      "lines":[
        {"speaker":"민지","ko":"두 사람은 처음 만나지요? 제 친구 리나 씨를 소개할게요.","zh":"你们两位是第一次见面吧？我来介绍我的朋友丽娜。","words":["사람","처음","만나다","친구","소개하다"]},
        {"speaker":"왕밍","ko":"안녕하세요? 리나 씨는 선생님이에요?","zh":"你好！丽娜，你是老师吗？","words":["인사하다","선생님"]},
        {"speaker":"리나","ko":"아니요, 저는 학생이에요. 중국 사람이에요.","zh":"不是，我是学生，是中国人。","words":["저","학생","사람"]},
        {"speaker":"민지","ko":"왕밍 씨도 한국어를 배워요. 서로 인사하세요.","zh":"王明也学习韩语。你们互相问候吧。","words":["한국어","인사하다"]},
        {"speaker":"왕밍","ko":"만나서 반가워요.","zh":"很高兴认识你。","words":["만나다","반갑다"]},
        {"speaker":"리나","ko":"저도 반가워요.","zh":"我也很高兴认识你。","words":["저","반갑다"]}
      ]
    }
  ]$scenes$::jsonb
), updated_at = now()
where node.id in (select id from target_node);

-- Keep the reserved R2 audio manifest synchronized with the revised scripts.
with target_node as (
  select node.id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and node.node_code = 'club-first-meeting'
), scripts(asset_key, script, speaker) as (
  values
    ('chapter-01-dialogue-main-line-01','안녕하세요? 우리 처음 만나요. 저는 김지민이에요.','F01／지민'),
    ('chapter-01-dialogue-main-line-02','안녕하세요? 제 이름은 왕밍이에요.','M01／왕밍'),
    ('chapter-01-dialogue-main-line-03','왕밍 씨는 학생이에요?','F01／지민'),
    ('chapter-01-dialogue-main-line-04','네, 학생이에요. 한국어를 배워요.','M01／왕밍'),
    ('chapter-01-dialogue-main-line-05','지민 씨도 학생이에요?','M01／왕밍'),
    ('chapter-01-dialogue-main-line-06','네, 저도 학생이에요.','F01／지민'),
    ('chapter-01-dialogue-main-line-07','만나서 반가워요.','M01／왕밍'),
    ('chapter-01-dialogue-main-line-08','저도 만나서 반가워요.','F01／지민'),
    ('chapter-01-dialogue-main','안녕하세요? 우리 처음 만나요. 저는 김지민이에요. 안녕하세요? 제 이름은 왕밍이에요. 왕밍 씨는 학생이에요? 네, 학생이에요. 한국어를 배워요. 지민 씨도 학생이에요? 네, 저도 학생이에요. 만나서 반가워요. 저도 만나서 반가워요.','F01／M01'),
    ('chapter-01-dialogue-alt-line-01','두 사람은 처음 만나지요? 제 친구 리나 씨를 소개할게요.','F02／민지'),
    ('chapter-01-dialogue-alt-line-02','안녕하세요? 리나 씨는 선생님이에요?','M01／왕밍'),
    ('chapter-01-dialogue-alt-line-03','아니요, 저는 학생이에요. 중국 사람이에요.','F03／리나'),
    ('chapter-01-dialogue-alt-line-04','왕밍 씨도 한국어를 배워요. 서로 인사하세요.','F02／민지'),
    ('chapter-01-dialogue-alt-line-05','만나서 반가워요.','M01／왕밍'),
    ('chapter-01-dialogue-alt-line-06','저도 반가워요.','F03／리나'),
    ('chapter-01-dialogue-alt','두 사람은 처음 만나지요? 제 친구 리나 씨를 소개할게요. 안녕하세요? 리나 씨는 선생님이에요? 아니요, 저는 학생이에요. 중국 사람이에요. 왕밍 씨도 한국어를 배워요. 서로 인사하세요. 만나서 반가워요. 저도 반가워요.','F02／M01／F03')
)
update public.digital_textbook_media_assets as asset
set metadata = asset.metadata || jsonb_build_object('script', scripts.script, 'speaker', scripts.speaker),
    production_status = 'pending',
    updated_at = now()
from scripts
where asset.node_id in (select id from target_node)
  and asset.asset_key = scripts.asset_key;
