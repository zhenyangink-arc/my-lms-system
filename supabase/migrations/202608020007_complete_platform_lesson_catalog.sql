-- 为每门平台课程补齐可归档资料的课级目录。
-- 新增目录先保持未发布，平台可用于整理资料，但不会提前开放给学生。

begin;

select set_config('app.platform_content_migration', 'on', true);
alter table public.lessons disable trigger user;

with lesson_catalog(course_slug, lesson_slug, title, description, sort_order) as (
  values
    ('service-interview-common-questions', 'follow-up-and-pressure-questions', '第 2 课：追问与压力问题应对', '练习澄清问题、组织思路并稳定回答追问和压力问题。', 2),
    ('service-interview-common-questions', 'mock-interview-review', '第 3 课：模拟面试与复盘', '通过完整模拟面试检查回答内容、表达节奏和临场反应。', 3),
    ('service-visa-documents', 'translation-and-certification', '第 2 课：材料翻译与认证', '梳理签证材料的翻译、公证、认证和有效期要求。', 2),
    ('service-visa-documents', 'final-check-and-supplement', '第 3 课：递交检查与补件', '完成递交前核对，并掌握补件通知的处理方式。', 3),
    ('service-interview-self-introduction', 'experience-and-strengths', '第 2 课：经历与优势组织', '把个人经历、学习动机和优势整理成清晰的自我介绍。', 2),
    ('service-interview-self-introduction', 'timed-delivery-and-review', '第 3 课：限时表达与模拟修正', '进行不同时间长度的表达训练，并根据反馈修正内容。', 3),

    ('korean-intermediate', 'intermediate-grammar-bridge', '第 1 课：中级语法衔接', '建立中级连接表达、时态语气和句子扩展能力。', 1),
    ('korean-intermediate', 'situational-conversation', '第 2 课：场景会话进阶', '围绕学习、生活和公共服务场景提升连贯会话能力。', 2),
    ('korean-intermediate', 'reading-and-writing', '第 3 课：中级阅读与写作', '训练段落理解、信息提取和基础主题写作。', 3),
    ('korean-advanced', 'advanced-grammar-expression', '第 1 课：高级语法与表达', '掌握复杂句式、语体差异和更自然的高级表达。', 1),
    ('korean-advanced', 'news-and-academic-reading', '第 2 课：新闻与学术阅读', '阅读新闻和学术类文本，训练观点与论据识别。', 2),
    ('korean-advanced', 'discussion-and-writing', '第 3 课：讨论与高级写作', '进行观点讨论、论证组织和正式文章写作。', 3),

    ('english-beginner', 'pronunciation-and-vocabulary', '第 1 课：基础发音与词汇', '建立英语基础发音规则和高频词汇认读能力。', 1),
    ('english-beginner', 'daily-sentence-patterns', '第 2 课：日常基础句型', '练习自我介绍、问答和日常交流中的基础句型。', 2),
    ('english-beginner', 'basic-listening-speaking', '第 3 课：基础听说训练', '通过短对话训练关键词听辨和基础口头表达。', 3),
    ('english-intermediate', 'grammar-expansion', '第 1 课：中级语法拓展', '系统扩展从句、时态和句子组织能力。', 1),
    ('english-intermediate', 'situational-listening-speaking', '第 2 课：情景听说', '在校园和生活场景中训练信息理解与连续表达。', 2),
    ('english-intermediate', 'reading-and-paragraph-writing', '第 3 课：阅读与段落写作', '训练文章结构理解和主题段落写作。', 3),
    ('english-advanced', 'advanced-language-use', '第 1 课：高级语言运用', '学习正式语体、复杂表达和准确措辞。', 1),
    ('english-advanced', 'academic-reading', '第 2 课：学术阅读', '训练长文本结构、论证关系和学术词汇理解。', 2),
    ('english-advanced', 'presentation-and-writing', '第 3 课：演讲与学术写作', '完成观点演讲、资料整合和学术写作训练。', 3),

    ('math-beginner', 'numbers-and-algebra', '第 1 课：数与代数基础', '复习数的运算、代数式和基本运算规律。', 1),
    ('math-beginner', 'equations-and-functions', '第 2 课：方程与函数入门', '学习一元方程、坐标表示和函数基本概念。', 2),
    ('math-beginner', 'geometry-and-data', '第 3 课：基础几何与数据', '掌握常见图形、度量方法和基础数据分析。', 3),
    ('math-intermediate', 'functions-and-graphs', '第 1 课：函数与图像', '理解常用函数性质以及图像之间的对应关系。', 1),
    ('math-intermediate', 'geometry-and-probability', '第 2 课：几何与概率', '训练平面几何推理和基础概率计算。', 2),
    ('math-intermediate', 'integrated-problem-solving', '第 3 课：综合问题训练', '综合运用代数、函数和几何方法解决问题。', 3),
    ('math-advanced', 'calculus-foundations', '第 1 课：微积分基础', '建立极限、导数和变化率的基础认识。', 1),
    ('math-advanced', 'vectors-and-space', '第 2 课：向量与空间几何', '学习向量运算以及空间位置关系。', 2),
    ('math-advanced', 'modeling-and-admission', '第 3 课：建模与升学综合训练', '使用综合建模方法完成升学方向的复杂题训练。', 3),

    ('university-class-adaptation', 'classroom-rules-and-systems', '第 1 课：课堂规则与学习系统', '认识韩国大学课堂规则、教学平台和成绩构成。', 1),
    ('university-class-adaptation', 'course-registration-and-communication', '第 2 课：选课与师生沟通', '掌握选课流程、邮件礼仪和课堂提问方式。', 2),
    ('university-class-adaptation', 'teamwork-and-campus-life', '第 3 课：小组活动与校园适应', '练习小组协作、任务分工和校园生活适应。', 3),
    ('university-report-writing', 'topic-and-structure', '第 1 课：报告选题与结构', '学习确定主题、提出问题并搭建报告结构。', 1),
    ('university-report-writing', 'research-and-citation', '第 2 课：资料检索与引用', '练习查找可靠资料、记录来源并规范引用。', 2),
    ('university-report-writing', 'draft-revision-and-submission', '第 3 课：写作修改与提交', '完成初稿、内容修改、格式检查和最终提交。', 3),
    ('university-major-introduction', 'curriculum-structure', '第 1 课：专业课程结构', '认识专业培养目标、课程模块和学分要求。', 1),
    ('university-major-introduction', 'core-skills-and-tools', '第 2 课：核心能力与工具', '了解专业学习所需的基础能力、软件和研究工具。', 2),
    ('university-major-introduction', 'learning-and-career-path', '第 3 课：学习路径与职业方向', '规划大学学习路径，并了解相关职业发展方向。', 3)
)
insert into public.lessons (
  course_id,
  slug,
  title,
  description,
  lesson_type,
  duration_minutes,
  is_free_preview,
  is_published,
  sort_order,
  tenant_id,
  content_scope,
  unlock_mode,
  is_manually_locked
)
select
  course.id,
  catalog.lesson_slug,
  catalog.title,
  catalog.description,
  'video',
  20,
  false,
  false,
  catalog.sort_order,
  null,
  'platform',
  'immediate',
  false
from lesson_catalog as catalog
join public.courses as course
  on course.slug = catalog.course_slug
 and course.tenant_id is null
 and course.content_scope = 'platform'
where not exists (
  select 1
  from public.lessons as existing
  where existing.course_id = course.id
    and existing.slug = catalog.lesson_slug
);

alter table public.lessons enable trigger user;

commit;
