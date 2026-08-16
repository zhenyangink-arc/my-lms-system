begin;

-- 补齐韩语课程目录的第一批正式内容。所有记录都属于平台韩语应用，
-- 不绑定任何机构租户；机构学生仍通过现有应用权限与 RLS 读取。
select set_config('app.platform_content_migration', 'on', true);

do $$
begin
  if not exists (
    select 1
    from public.course_categories
    where id = 'be68db58-845c-4cc5-bfbd-c13d2398643d'::uuid
      and slug = 'korean-life'
      and student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
      and content_scope = 'platform'
      and tenant_id is null
  ) then
    raise exception '生活韩语分类不存在或应用归属不正确，拒绝写入课程';
  end if;

  if not exists (
    select 1
    from public.course_categories
    where id = '6c0fb0b9-4c9e-4b58-8b0f-9d4733deac8f'::uuid
      and slug = 'korean-topik'
      and student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
      and content_scope = 'platform'
      and tenant_id is null
  ) then
    raise exception 'TOPIK 分类不存在或应用归属不正确，拒绝写入课程';
  end if;
end;
$$;

alter table public.courses disable trigger user;

insert into public.courses (
  id,
  category_id,
  category,
  slug,
  title,
  description,
  level,
  icon_name,
  is_published,
  sort_order,
  support_teacher_name,
  support_teacher_status,
  ai_support_enabled,
  support_message,
  tenant_id,
  content_scope,
  unlock_mode,
  is_manually_locked,
  student_app_id
)
values
  (
    'a3100000-0000-4000-8000-000000000001'::uuid,
    'be68db58-845c-4cc5-bfbd-c13d2398643d'::uuid,
    'korean',
    'korean-life-essentials',
    '韩国生活实用韩语',
    '围绕校园、餐厅、购物、交通和就医等真实生活场景，练习到韩国后马上能使用的表达。',
    'beginner',
    'MessageCircle',
    true,
    1,
    '金老师',
    'offline',
    true,
    '遇到不熟悉的生活场景时，可以把想说的中文告诉老师，再一起整理成自然的韩语。',
    null,
    'platform',
    'immediate',
    false,
    '10000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    'a3100000-0000-4000-8000-000000000002'::uuid,
    '6c0fb0b9-4c9e-4b58-8b0f-9d4733deac8f'::uuid,
    'korean',
    'topik-i-foundation',
    'TOPIK I 基础备考',
    '从高频词汇、基础语法、听力定位和阅读解题入手，建立 TOPIK I 的基础备考方法。',
    'beginner',
    'BookOpenCheck',
    true,
    1,
    '金老师',
    'offline',
    true,
    '完成练习后可以记录错题类型，老师会帮助你判断是词汇、语法还是解题方法的问题。',
    null,
    'platform',
    'immediate',
    false,
    '10000000-0000-4000-8000-000000000001'::uuid
  )
on conflict (id) do update set
  category_id = excluded.category_id,
  category = excluded.category,
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  level = excluded.level,
  icon_name = excluded.icon_name,
  is_published = excluded.is_published,
  sort_order = excluded.sort_order,
  support_teacher_name = excluded.support_teacher_name,
  support_teacher_status = excluded.support_teacher_status,
  ai_support_enabled = excluded.ai_support_enabled,
  support_message = excluded.support_message,
  tenant_id = excluded.tenant_id,
  content_scope = excluded.content_scope,
  unlock_mode = excluded.unlock_mode,
  is_manually_locked = excluded.is_manually_locked,
  student_app_id = excluded.student_app_id,
  updated_at = now();

alter table public.courses enable trigger user;

alter table public.lessons disable trigger user;

-- 现有中级、高级目录已经有草稿课时；补齐首批学习正文并正式发布。
with lesson_catalog (
  course_slug,
  lesson_slug,
  lesson_type,
  duration_minutes,
  content_text,
  learning_objectives,
  lesson_tasks,
  key_points,
  common_mistakes,
  summary_text
) as (
  values
    (
      'korean-intermediate',
      'intermediate-grammar-bridge',
      'text',
      25,
      E'中级韩语需要把短句连接成有前后关系的表达。本课先练习表示原因、转折和顺序的连接方式。\n\n1. 原因：-아/어서、-(으)니까。\n2. 转折：-지만、그런데。\n3. 顺序：-고 나서、-(으)ㄴ 다음에。\n\n学习时先判断句子之间是什么关系，再选择连接表达，不要只按中文逐词翻译。',
      E'能判断原因、转折和先后关系。\n能用连接表达组成两到三个分句。\n能在简单对话中说明理由。',
      E'完成三组句子连接练习。\n用韩语说明一次迟到或改变计划的原因。\n朗读并录下自己的答案。',
      E'-아/어서 常用于自然原因。\n-(으)니까 更适合强调说话人的判断或理由。\n-지만 前后内容形成明显对比。',
      E'不要在同一句中堆叠太多连接词。\n注意 -(으)니까 与命令、建议句搭配时的语气。',
      '先看句间关系，再选择连接形式；表达完整比句子复杂更重要。'
    ),
    (
      'korean-intermediate',
      'situational-conversation',
      'text',
      25,
      E'场景会话的重点是完成沟通任务。本课用“说明情况—提出请求—确认结果”的结构练习校园和公共服务场景。\n\n示例结构：\n상황을 설명하다 → 부탁하다 → 다시 확인하다\n\n遇到没听清的内容，可以使用 천천히 말씀해 주세요 或 다시 한번 설명해 주세요 主动确认。',
      E'能按三步结构完成场景对话。\n能礼貌地提出请求。\n能在没听清时主动确认。',
      E'完成选课咨询和宿舍报修两组角色扮演。\n每组对话至少包含一次说明、一次请求和一次确认。',
      E'请求前先说明情况会更自然。\n结尾复述关键信息可以减少误解。',
      E'避免只回答 네 或 아니요。\n不要因为担心语法错误而省略关键信息。',
      '真实会话先保证任务完成，再逐步提高表达的准确度和自然度。'
    ),
    (
      'korean-intermediate',
      'reading-and-writing',
      'text',
      30,
      E'中级阅读先找主题句、连接词和重复出现的关键词。写作时可以沿用“主题—说明—例子—结论”的四步结构。\n\n阅读一段文字后，先用一句话写出主题，再记录两条支持信息。最后用自己的话完成三到五句摘要。',
      E'能定位段落主题句和支持信息。\n能写出结构完整的短段落。\n能用自己的话概括原文。',
      E'阅读一篇校园通知并提取时间、地点、对象和要求。\n围绕“我的学习计划”写一个五句段落。',
      E'连接词帮助判断信息关系。\n摘要应保留核心信息，不照抄原文。',
      E'不要把每个陌生词都当成理解障碍。\n写作时避免每句都以 저는 开头。',
      '阅读提取结构，写作复用结构；先表达清楚，再修改词汇和语法。'
    ),
    (
      'korean-advanced',
      'advanced-grammar-expression',
      'text',
      30,
      E'高级表达不仅要求语法正确，还要根据对象和场合选择语体。本课比较口语、书面语和正式表达中的措辞差异，并练习推测、让步与间接表达。\n\n同一内容可以有不同强度。正式场景应减少过度直接的断定，使用 것으로 보이다、가능성이 있다 等表达保留适当余地。',
      E'能区分口语和正式书面表达。\n能使用推测与让步结构表达复杂观点。\n能根据对象调整语气。',
      E'把三句日常口语改写成正式通知用语。\n用两个不同强度的表达说明同一观点。',
      E'语体选择取决于关系、场合和文本目的。\n高级表达追求准确，不等于堆叠复杂语法。',
      E'避免在正式文章中混入口语缩略。\n不要把推测表达误写成确定事实。',
      '先确定场合和立场，再选择语体、语法与措辞。'
    ),
    (
      'korean-advanced',
      'news-and-academic-reading',
      'text',
      30,
      E'新闻和学术文本通常把事实、引用和作者判断放在不同位置。阅读时先确认标题与首段提出的问题，再标记数据、来源和转折句。\n\n看到 조사에 따르면、반면에、따라서 等表达时，要判断后面的内容是在提供证据、对比观点还是得出结论。',
      E'能区分事实、引用和作者判断。\n能识别论点、证据与结论。\n能用简短韩语概括文章结构。',
      E'给一篇短新闻标注事实、来源和观点。\n用三句话概括文章的问题、证据和结论。',
      E'标题不一定等于作者最终观点。\n数据必须连同来源和比较对象一起理解。',
      E'不要因为认识所有单词就默认理解了论证。\n引用内容不一定代表作者赞同。',
      '高级阅读要看信息如何组织，而不只是理解单句。'
    ),
    (
      'korean-advanced',
      'discussion-and-writing',
      'text',
      35,
      E'观点讨论和高级写作都需要清楚的论证路线。可以使用“立场—理由—证据—回应反方—结论”的结构。\n\n表达不同意见时，先准确复述对方观点，再说明保留意见的部分，比直接否定更有说服力。',
      E'能提出清晰且有限定条件的观点。\n能用例子或资料支持理由。\n能回应一种可能的反方意见。',
      E'围绕“大学课程是否应增加团队项目”准备两分钟发言。\n根据发言写一篇六到八句的短论述。',
      E'一个段落集中处理一个核心理由。\n证据需要说明它如何支持观点。',
      E'避免只重复立场而没有证据。\n不要把不同意见写成对人的评价。',
      '有结构的观点比复杂词汇更有说服力；写完后检查每条证据是否真正支持结论。'
    )
),
resolved as (
  select course.id as course_id, catalog.*
  from lesson_catalog as catalog
  join public.courses as course
    on course.slug = catalog.course_slug
   and course.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
   and course.content_scope = 'platform'
   and course.tenant_id is null
)
update public.lessons as lesson
set
  lesson_type = resolved.lesson_type,
  duration_minutes = resolved.duration_minutes,
  content_text = resolved.content_text,
  learning_objectives = resolved.learning_objectives,
  lesson_tasks = resolved.lesson_tasks,
  key_points = resolved.key_points,
  common_mistakes = resolved.common_mistakes,
  summary_text = resolved.summary_text,
  is_published = true,
  tenant_id = null,
  content_scope = 'platform',
  updated_at = now()
from resolved
where lesson.course_id = resolved.course_id
  and lesson.slug = resolved.lesson_slug;

-- 生活韩语与 TOPIK 各建立一门课程、三个可直接学习的课时。
with lesson_catalog (
  id,
  course_slug,
  lesson_slug,
  title,
  description,
  duration_minutes,
  is_free_preview,
  sort_order,
  content_text,
  learning_objectives,
  lesson_tasks,
  key_points,
  common_mistakes,
  summary_text
) as (
  values
    (
      'a3200000-0000-4000-8000-000000000001'::uuid,
      'korean-life-essentials',
      'campus-and-introduction',
      '第 1 课：校园与自我介绍',
      '练习在课堂、办公室和同学初次见面时使用的介绍与确认表达。',
      20,
      true,
      1,
      E'初次见面先说姓名和身份，再补充专业、年级或来韩时间。\n\n안녕하세요. 저는 중국에서 온 왕리입니다.\n이번 학기에 교환학생으로 왔습니다.\n잘 부탁드립니다.\n\n在办公室办事时，可以先说明来意：수강 신청에 대해 문의하러 왔습니다。',
      E'能完成三到四句自我介绍。\n能礼貌说明来办公室的目的。\n能确认对方姓名或负责事项。',
      E'录制一段 30 秒自我介绍。\n分别写出向同学和向老师介绍自己的版本。',
      E'正式场景使用 -습니다/-ㅂ니다 或 -세요 体。\n잘 부탁드립니다 常用于初次见面后的礼貌收尾。',
      E'不要把自己的名字直接按中文发音生硬拼读。\n向老师或职员说话时避免使用半语。',
      '自我介绍不必很长，姓名、身份、来意清楚就足够。'
    ),
    (
      'a3200000-0000-4000-8000-000000000002'::uuid,
      'korean-life-essentials',
      'restaurant-and-shopping',
      '第 2 课：餐厅与购物',
      '掌握点餐、询价、数量、支付和退换时的核心表达。',
      25,
      false,
      2,
      E'餐厅点餐可以按“询问—选择—补充要求—结账”进行。\n\n이 메뉴는 맵나요?\n이거 하나 주세요.\n덜 맵게 해 주세요.\n카드로 계산할게요.\n\n购物时先确认价格、尺寸和是否可以退换：교환이나 환불이 가능한가요?',
      E'能完成基本点餐和结账。\n能询问价格、尺寸与退换条件。\n能表达数量和简单的个性化要求。',
      E'设计一组两人点餐对话。\n比较 주세요、할게요 和 가능한가요 的功能。',
      E'주세요 用于请求给某物。\n할게요 表示自己接下来要做的选择。\n가능한가요 用于礼貌确认是否可行。',
      E'注意 하나、둘、셋 与数量单位搭配。\n提出要求时不要只说名词，要补充完整请求。',
      '把常用句型练成固定流程，在真实场景中会比临时逐词翻译更快。'
    ),
    (
      'a3200000-0000-4000-8000-000000000003'::uuid,
      'korean-life-essentials',
      'transport-and-medical',
      '第 3 课：交通与就医',
      '练习问路、确认交通路线，以及在医院描述基本症状。',
      25,
      false,
      3,
      E'问路时需要说清目的地，并确认换乘或下车位置。\n\n이 버스가 시청에 가나요?\n어디에서 갈아타야 하나요?\n몇 번 출구로 나가면 돼요?\n\n就医时按照“哪里不舒服—持续多久—是否伴随其他症状”说明：어제부터 목이 아프고 열이 조금 나요。',
      E'能询问路线、换乘和出口。\n能描述常见症状及持续时间。\n能听懂对方给出的基本指示。',
      E'用地图设计一次包含换乘的问路对话。\n写出三句症状说明并标出时间表达。',
      E'问路后复述路线进行确认。\n描述症状要包含部位、感觉和开始时间。',
      E'不要只说 아파요，要说明哪里痛。\n注意 출구、정류장、갈아타다 等交通高频词。',
      '紧急和医疗场景优先保证信息准确，听不清时一定要再次确认。'
    ),
    (
      'a3200000-0000-4000-8000-000000000004'::uuid,
      'topik-i-foundation',
      'topik-vocabulary-grammar',
      '第 1 课：高频词汇与基础语法',
      '建立 TOPIK I 高频主题词汇和助词、时态、连接表达的复习框架。',
      25,
      true,
      1,
      E'TOPIK I 词汇应按主题和搭配复习，而不是只背中文释义。优先整理人物、地点、时间、日常活动、购物、交通和天气。\n\n语法复习先检查助词、时态、否定和连接词。做题时看完整句子，利用前后词语判断缺少的功能。',
      E'能按主题整理高频词汇。\n能识别基础助词与时态。\n能利用句子关系排除错误选项。',
      E'建立一张 30 词的主题词表。\n完成十道语法选择题并标注每题考点。',
      E'词汇要连同常见搭配记忆。\n语法选择题先判断位置和功能，再比较词形。',
      E'不要只看空格前一个词。\n不要把相似中文翻译当成相同语法。',
      '把错题归入词汇、助词、时态或连接关系，复习才会有针对性。'
    ),
    (
      'a3200000-0000-4000-8000-000000000005'::uuid,
      'topik-i-foundation',
      'topik-listening-strategy',
      '第 2 课：听力定位方法',
      '练习从人物、地点、目的和下一步行动中快速定位答案。',
      25,
      false,
      2,
      E'听力播放前先读选项，圈出人物、地点、数字和动作差异。播放时不要尝试记住每个词，要抓住“谁—在哪里—为什么—接下来做什么”。\n\n遇到数字和时间题，可以在草稿上快速记录关键词，注意答案常在修正或转折后出现。',
      E'能在播放前比较选项差异。\n能记录人物、地点、目的和行动。\n能识别转折后的关键信息。',
      E'完成五组短对话定位训练。\n每题写下一个判断答案的关键词。',
      E'先看选项可以明确听取目标。\n하지만、그런데、아니요 后的信息经常改变原判断。',
      E'不要因为漏听一个词就放弃整题。\n相同词重复出现不一定就是正确答案。',
      '听力解题的核心是带着问题听，并用选项差异验证关键信息。'
    ),
    (
      'a3200000-0000-4000-8000-000000000006'::uuid,
      'topik-i-foundation',
      'topik-reading-strategy',
      '第 3 课：阅读解题顺序',
      '练习先看题目要求，再利用关键词、连接词和段落位置快速作答。',
      30,
      false,
      3,
      E'阅读题先确认题型：填空、顺序、主旨还是内容一致。不同题型需要找的证据不同。\n\n短文中反复出现的名词通常与主题有关，그러나、그래서、때문에 等连接词可以帮助判断逻辑。做内容一致题时，每个选项都要回到原文定位。',
      E'能区分常见阅读题型。\n能利用关键词和连接词定位证据。\n能用原文逐项验证内容一致题。',
      E'完成一组限时阅读练习。\n为每道错题记录题型、证据位置和错误原因。',
      E'先读问题可以减少无目标阅读。\n主旨通常覆盖全文，不能只概括一个细节。',
      E'不要凭常识选择原文没有的信息。\n遇到陌生词时先根据上下文判断是否影响答案。',
      '稳定的题型识别和证据定位，比单纯追求阅读速度更重要。'
    )
),
resolved as (
  select course.id as course_id, catalog.*
  from lesson_catalog as catalog
  join public.courses as course
    on course.slug = catalog.course_slug
   and course.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
   and course.content_scope = 'platform'
   and course.tenant_id is null
)
insert into public.lessons (
  id,
  course_id,
  slug,
  title,
  description,
  lesson_type,
  duration_minutes,
  is_free_preview,
  is_published,
  sort_order,
  content_text,
  learning_objectives,
  lesson_tasks,
  key_points,
  common_mistakes,
  summary_text,
  allow_questions,
  tenant_id,
  content_scope,
  unlock_mode,
  is_manually_locked
)
select
  resolved.id,
  resolved.course_id,
  resolved.lesson_slug,
  resolved.title,
  resolved.description,
  'text',
  resolved.duration_minutes,
  resolved.is_free_preview,
  true,
  resolved.sort_order,
  resolved.content_text,
  resolved.learning_objectives,
  resolved.lesson_tasks,
  resolved.key_points,
  resolved.common_mistakes,
  resolved.summary_text,
  true,
  null,
  'platform',
  'immediate',
  false
from resolved
on conflict (course_id, slug) do update set
  title = excluded.title,
  description = excluded.description,
  lesson_type = excluded.lesson_type,
  duration_minutes = excluded.duration_minutes,
  is_free_preview = excluded.is_free_preview,
  is_published = excluded.is_published,
  sort_order = excluded.sort_order,
  content_text = excluded.content_text,
  learning_objectives = excluded.learning_objectives,
  lesson_tasks = excluded.lesson_tasks,
  key_points = excluded.key_points,
  common_mistakes = excluded.common_mistakes,
  summary_text = excluded.summary_text,
  allow_questions = excluded.allow_questions,
  tenant_id = excluded.tenant_id,
  content_scope = excluded.content_scope,
  unlock_mode = excluded.unlock_mode,
  is_manually_locked = excluded.is_manually_locked,
  updated_at = now();

alter table public.lessons enable trigger user;

do $$
begin
  if exists (
    select 1
    from public.courses as course
    join public.course_categories as category on category.id = course.category_id
    where course.slug in ('korean-life-essentials', 'topik-i-foundation')
      and (
        course.student_app_id is distinct from '10000000-0000-4000-8000-000000000001'::uuid
        or category.student_app_id is distinct from course.student_app_id
        or course.content_scope <> 'platform'
        or course.tenant_id is not null
      )
  ) then
    raise exception '新增韩语课程的应用或内容域不一致，回滚迁移';
  end if;

  if (
    select count(*)
    from public.lessons as lesson
    join public.courses as course on course.id = lesson.course_id
    where course.student_app_id = '10000000-0000-4000-8000-000000000001'::uuid
      and course.slug in (
        'korean-intermediate',
        'korean-advanced',
        'korean-life-essentials',
        'topik-i-foundation'
      )
      and lesson.is_published
      and lesson.content_scope = 'platform'
      and lesson.tenant_id is null
  ) <> 12 then
    raise exception '韩语扩展课时数量或发布状态不正确，回滚迁移';
  end if;
end;
$$;

commit;
