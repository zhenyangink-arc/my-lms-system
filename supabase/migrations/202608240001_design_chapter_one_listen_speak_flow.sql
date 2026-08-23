-- Organize chapter-one listening and speaking into a four-page learning flow.
-- Formal audio remains pending; the shared renderer may use clearly labelled
-- device speech as a temporary rehearsal aid.

with target_node as (
  select node.id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and node.node_code = 'listen-and-respond'
)
update public.digital_textbook_nodes as node
set content = node.content || $flow$
{
  "listenSpeakPages":[
    {"id":"prepare","title":{"zh-CN":"听前准备","ko-KR":"듣기 준비"},"description":{"zh-CN":"先明确场景与需要捕捉的信息，不提前展示完整原文。","ko-KR":"전체 원고를 보기 전에 상황과 들어야 할 정보를 확인하세요."}},
    {"id":"identify","title":{"zh-CN":"听辨信息","ko-KR":"정보 듣기"},"description":{"zh-CN":"依据音频原话判断姓名、身份和结束表达。","ko-KR":"음성의 실제 표현으로 이름, 신분과 마무리 말을 판단하세요."}},
    {"id":"repeat","title":{"zh-CN":"跟读复现","ko-KR":"듣고 따라 말하기"},"description":{"zh-CN":"逐句听示范并按自然节奏复现。正式点读音频待制作。","ko-KR":"문장별로 듣고 자연스러운 리듬으로 따라 말하세요. 정식 음원은 제작 대기 중입니다."}},
    {"id":"output","title":{"zh-CN":"独立表达","ko-KR":"독립 말하기"},"description":{"zh-CN":"脱离逐句原文，完成约 30 秒的完整表达。","ko-KR":"문장별 원고 없이 약 30초의 완전한 표현을 녹음하세요."}}
  ],
  "listeningContext":{"zh-CN":"校园语言交换活动中新成员进行自我介绍。","ko-KR":"캠퍼스 언어 교환 모임에서 새 회원이 자기소개를 합니다."},
  "listeningFocus":[
    {"zh-CN":"说话人的姓名","ko-KR":"말하는 사람의 이름"},
    {"zh-CN":"国籍或地区信息","ko-KR":"국적 또는 지역 정보"},
    {"zh-CN":"学生、老师等身份词","ko-KR":"학생, 선생님 등의 신분 표현"},
    {"zh-CN":"结束初次见面的表达","ko-KR":"첫 만남을 마치는 표현"}
  ],
  "repeatLines":[
    {"ko":"안녕하세요?","zh":"你好。","audioAssetKey":"chapter-01-listening-repeat-01"},
    {"ko":"저는 수진이에요.","zh":"我叫秀珍。","audioAssetKey":"chapter-01-listening-repeat-02"},
    {"ko":"한국 사람이에요.","zh":"我是韩国人。","audioAssetKey":"chapter-01-listening-repeat-03"},
    {"ko":"저는 학생이에요.","zh":"我是学生。","audioAssetKey":"chapter-01-listening-repeat-04"},
    {"ko":"한국어를 배워요.","zh":"我学习韩语。","audioAssetKey":"chapter-01-listening-repeat-05"},
    {"ko":"만나서 반가워요.","zh":"很高兴认识你。","audioAssetKey":"chapter-01-listening-repeat-06"}
  ],
  "outputChecklist":["问候","姓名","身份","正在学习韩语","礼貌结束"],
  "formalAudioStatus":"pending"
}
$flow$::jsonb,
    updated_at = now()
where node.id in (select id from target_node);

with target_node as (
  select node.id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and node.node_code = 'listen-and-respond'
), repeat_assets(asset_key, object_key, line_index) as (
  values
    ('chapter-01-listening-repeat-01', 'korean-level-one/chapter-01/listen-speak/repeat-01.mp3', 1),
    ('chapter-01-listening-repeat-02', 'korean-level-one/chapter-01/listen-speak/repeat-02.mp3', 2),
    ('chapter-01-listening-repeat-03', 'korean-level-one/chapter-01/listen-speak/repeat-03.mp3', 3),
    ('chapter-01-listening-repeat-04', 'korean-level-one/chapter-01/listen-speak/repeat-04.mp3', 4),
    ('chapter-01-listening-repeat-05', 'korean-level-one/chapter-01/listen-speak/repeat-05.mp3', 5),
    ('chapter-01-listening-repeat-06', 'korean-level-one/chapter-01/listen-speak/repeat-06.mp3', 6)
)
insert into public.digital_textbook_media_assets (
  node_id,
  asset_key,
  media_type,
  purpose,
  object_key,
  production_status,
  metadata
)
select
  target_node.id,
  repeat_assets.asset_key,
  'audio',
  '听说任务逐句正式示范音',
  repeat_assets.object_key,
  'pending',
  jsonb_build_object('kind', 'listen_speak_repeat', 'lineIndex', repeat_assets.line_index)
from target_node
cross join repeat_assets
on conflict (node_id, asset_key) do update
set object_key = excluded.object_key,
    production_status = excluded.production_status,
    metadata = excluded.metadata,
    updated_at = now();
