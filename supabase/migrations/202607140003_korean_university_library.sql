-- ============================================================
-- 韩国大学库、学生对比清单与在线评估
-- 数据口径：学费为年度参考区间；排名字段始终与排名年份一起保存。
-- 页面展示时必须提示学生以大学当年招生简章和缴费通知为准。
-- ============================================================

-- 建立韩国大学主表，集中保存筛选、卡片和详情页所需信息。
create table if not exists public.korean_universities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_zh text not null,
  name_ko text not null,
  name_en text not null,
  ownership text not null check (ownership in ('national', 'public', 'private')),
  province text not null,
  city text not null,
  admission_stages text[] not null default '{}',
  discipline_groups text[] not null default '{}',
  tuition_min_krw integer not null check (tuition_min_krw >= 0),
  tuition_max_krw integer not null check (tuition_max_krw >= tuition_min_krw),
  tuition_min_cny integer not null check (tuition_min_cny >= 0),
  tuition_max_cny integer not null check (tuition_max_cny >= tuition_min_cny),
  tuition_reference_year smallint not null default 2025,
  qs_rank_display text,
  qs_rank_sort integer,
  qs_ranking_year smallint,
  joongang_rank_display text,
  joongang_rank_sort integer,
  joongang_ranking_year smallint,
  summary text not null,
  highlights text[] not null default '{}',
  official_website text,
  ranking_source_url text,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint korean_universities_stage_check check (
    admission_stages <@ array['language', 'bachelor_fresh', 'bachelor_transfer', 'master', 'doctor']::text[]
  ),
  constraint korean_universities_discipline_check check (
    discipline_groups <@ array['humanities_social', 'science', 'natural_sciences', 'medicine']::text[]
  )
);

-- 为后续专业级筛选预留独立项目表，避免把所有专业内容塞进大学主表。
create table if not exists public.korean_university_programs (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.korean_universities(id) on delete cascade,
  admission_stage text not null check (
    admission_stage in ('language', 'bachelor_fresh', 'bachelor_transfer', 'master', 'doctor')
  ),
  program_name_zh text not null,
  program_name_ko text,
  discipline_group text not null check (
    discipline_group in ('humanities_social', 'science', 'natural_sciences', 'medicine')
  ),
  tuition_krw integer,
  topik_requirement smallint check (topik_requirement between 0 and 6),
  application_term text,
  notes text,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 保存学生选择的四校对比清单。
create table if not exists public.student_university_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.korean_universities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, university_id)
);

-- 保存在线评估输入、分项结果和最终建议，便于顾问后续复核。
create table if not exists public.student_university_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.korean_universities(id) on delete cascade,
  admission_stage text not null check (
    admission_stage in ('language', 'bachelor_fresh', 'bachelor_transfer', 'master', 'doctor')
  ),
  discipline_group text not null check (
    discipline_group in ('humanities_social', 'science', 'natural_sciences', 'medicine')
  ),
  academic_score numeric(5,2) not null check (academic_score between 0 and 100),
  topik_level smallint not null check (topik_level between 0 and 6),
  annual_budget_cny integer not null check (annual_budget_cny between 20000 and 100000),
  match_score smallint not null check (match_score between 0 and 100),
  result_label text not null check (result_label in ('匹配度较高', '可以冲刺', '建议先提升')),
  score_breakdown jsonb not null default '{}'::jsonb,
  disclaimer_version text not null default '2026-07',
  created_at timestamptz not null default now()
);

-- 目标院校表关联学校库，同时保留原有手工录入大学名称的能力。
alter table public.student_university_targets
  add column if not exists university_id uuid references public.korean_universities(id) on delete set null,
  add column if not exists admission_track text;

-- 约束从学校库添加的申请阶段，历史手工数据可以继续保持空值。
alter table public.student_university_targets
  drop constraint if exists student_university_targets_admission_track_check;
alter table public.student_university_targets
  add constraint student_university_targets_admission_track_check check (
    admission_track is null
    or admission_track in ('language', 'bachelor_fresh', 'bachelor_transfer', 'master', 'doctor')
  );

-- 每名学生对同一所学校只保留一个目标记录，手工录入的空关联不受影响。
create unique index if not exists student_university_targets_user_university_idx
  on public.student_university_targets (user_id, university_id)
  where university_id is not null;

-- 常用筛选和学生数据读取索引。
create index if not exists korean_universities_filter_idx
  on public.korean_universities (is_published, province, ownership, sort_order);

create index if not exists korean_universities_qs_rank_idx
  on public.korean_universities (qs_rank_sort nulls last);

create index if not exists korean_universities_joongang_rank_idx
  on public.korean_universities (joongang_rank_sort nulls last);

create index if not exists korean_university_programs_filter_idx
  on public.korean_university_programs (university_id, admission_stage, discipline_group, sort_order);

create index if not exists student_university_comparisons_user_idx
  on public.student_university_comparisons (user_id, created_at desc);

create index if not exists student_university_assessments_user_idx
  on public.student_university_assessments (user_id, university_id, created_at desc);

-- 复用留学规划工作台的更新时间函数。
drop trigger if exists set_korean_universities_updated_at on public.korean_universities;
create trigger set_korean_universities_updated_at
before update on public.korean_universities
for each row execute function public.set_student_planning_updated_at();

drop trigger if exists set_korean_university_programs_updated_at on public.korean_university_programs;
create trigger set_korean_university_programs_updated_at
before update on public.korean_university_programs
for each row execute function public.set_student_planning_updated_at();

-- 数据库层强制限制每名学生最多同时对比四所大学。
create or replace function public.enforce_student_university_comparison_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 对同一名学生的并发写入加事务锁，防止快速重复点击突破四校上限。
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if (
    select count(*)
    from public.student_university_comparisons
    where user_id = new.user_id
  ) >= 4 then
    raise exception '每次最多对比四所大学';
  end if;

  return new;
end;
$$;

drop trigger if exists student_university_comparison_limit on public.student_university_comparisons;
create trigger student_university_comparison_limit
before insert on public.student_university_comparisons
for each row execute function public.enforce_student_university_comparison_limit();

-- 启用行级安全。
alter table public.korean_universities enable row level security;
alter table public.korean_university_programs enable row level security;
alter table public.student_university_comparisons enable row level security;
alter table public.student_university_assessments enable row level security;

-- 登录用户可以读取已发布大学与专业项目。
create policy "authenticated users can read published universities"
on public.korean_universities for select
to authenticated
using (is_published = true);

create policy "authenticated users can read published university programs"
on public.korean_university_programs for select
to authenticated
using (
  is_published = true
  and exists (
    select 1 from public.korean_universities
    where korean_universities.id = korean_university_programs.university_id
      and korean_universities.is_published = true
  )
);

-- 管理员及以上角色可以维护大学库与项目库。
create policy "admins can manage university library"
on public.korean_universities for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

create policy "admins can manage university programs"
on public.korean_university_programs for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

-- 学生只能维护自己的对比清单。
create policy "students manage own university comparisons"
on public.student_university_comparisons for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 学生读取自己的评估，老师与管理角色可以在辅导场景下查看。
create policy "students or staff read university assessments"
on public.student_university_assessments for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('teacher', 'admin', 'ceo', 'super_admin')
  )
);

create policy "students manage own university assessments"
on public.student_university_assessments for insert
to authenticated
with check (auth.uid() = user_id);

-- 开放必要权限，实际可见范围仍由 RLS 控制。
grant select, insert, update, delete on public.korean_universities to authenticated;
grant select, insert, update, delete on public.korean_university_programs to authenticated;
grant select, insert, delete on public.student_university_comparisons to authenticated;
grant select, insert on public.student_university_assessments to authenticated;

-- ============================================================
-- 韩国大学种子数据
-- 学费参考韩国政府 Study in Korea / 大学信息公开口径，人民币仅作选校预算筛选。
-- QS 使用 2027 世界大学排名；中央日报使用 2025 综合大学评价中已公开的名次。
-- 未参加或无法确认的排名保留空值，页面明确显示“暂无”。
-- ============================================================

insert into public.korean_universities (
  slug, name_zh, name_ko, name_en, ownership, province, city,
  admission_stages, discipline_groups,
  tuition_min_krw, tuition_max_krw, tuition_min_cny, tuition_max_cny,
  tuition_reference_year, qs_rank_display, qs_rank_sort, qs_ranking_year,
  joongang_rank_display, joongang_rank_sort, joongang_ranking_year,
  summary, highlights, official_website, ranking_source_url, is_featured, sort_order
)
values
  ('seoul-national', '首尔大学', '서울대학교', 'Seoul National University', 'national', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 4200000, 10000000, 23000, 56000, 2025, '=38', 38, 2027, '1', 1, 2025, '韩国代表性国立综合大学，学科覆盖完整，研究与社会影响力突出。', array['国立旗舰大学','综合学科完整','研究资源丰富'], 'https://www.snu.ac.kr/', 'https://www.topuniversities.com/universities/seoul-national-university', true, 10),
  ('yonsei', '延世大学', '연세대학교', 'Yonsei University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 7200000, 14500000, 39000, 80000, 2025, '42', 42, 2027, '2', 2, 2025, '位于首尔市中心的知名私立综合大学，国际交流与医学教育资源突出。', array['国际化程度高','语学堂成熟','医学资源突出'], 'https://www.yonsei.ac.kr/', 'https://www.topuniversities.com/universities/yonsei-university', true, 20),
  ('korea', '高丽大学', '고려대학교', 'Korea University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 7000000, 14000000, 38000, 78000, 2025, '=52', 52, 2027, '4', 4, 2025, '人文社会、经营与研究实力均衡的首尔私立综合大学。', array['经营与传媒优势','校园文化鲜明','国际项目丰富'], 'https://www.korea.ac.kr/', 'https://www.topuniversities.com/universities/korea-university', true, 30),
  ('kaist', '韩国科学技术院', '한국과학기술원', 'KAIST', 'national', '大田广域市', '大田', array['bachelor_fresh','master','doctor'], array['science','natural_sciences'], 3500000, 8000000, 20000, 45000, 2025, '65', 65, 2027, null, null, null, '以理工科研究和科技创新为核心的国家级研究型大学。', array['理工科研究强','奖学金资源','研究生项目突出'], 'https://www.kaist.ac.kr/', 'https://www.topuniversities.com/universities/kaist', true, 40),
  ('postech', '浦项工科大学', '포항공과대학교', 'POSTECH', 'private', '庆尚北道', '浦项', array['bachelor_fresh','master','doctor'], array['science','natural_sciences'], 5500000, 9000000, 30000, 50000, 2025, '106', 106, 2027, null, null, null, '规模精炼的研究型理工大学，材料、工程与基础科学具有竞争力。', array['小班研究环境','理工科优势','产学合作'], 'https://www.postech.ac.kr/', 'https://www.topuniversities.com/universities/pohang-university-science-technology-postech', true, 50),
  ('sungkyunkwan', '成均馆大学', '성균관대학교', 'Sungkyunkwan University', 'private', '首尔特别市', '首尔／水原', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 7000000, 13500000, 38000, 75000, 2025, '108', 108, 2027, '5', 5, 2025, '兼具传统人文底蕴与现代产业研究资源的私立综合大学。', array['产学合作突出','就业表现良好','双校区资源'], 'https://www.skku.edu/', 'https://www.topuniversities.com/universities/sungkyunkwan-university-skku', true, 60),
  ('hanyang', '汉阳大学', '한양대학교', 'Hanyang University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 7200000, 14000000, 39000, 78000, 2025, '155', 155, 2027, '3', 3, 2025, '工程、创业与实践教育特色鲜明的首尔私立综合大学。', array['工程优势','创业支持','产学合作'], 'https://www.hanyang.ac.kr/', 'https://www.topuniversities.com/universities/hanyang-university', true, 70),
  ('kyung-hee', '庆熙大学', '경희대학교', 'Kyung Hee University', 'private', '首尔特别市', '首尔／龙仁', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 6800000, 14500000, 37000, 80000, 2025, '=309', 309, 2027, null, null, null, '国际化、人文教育与医学相关学科具有辨识度的综合大学。', array['语学堂热门','国际化项目','医学相关学科'], 'https://www.khu.ac.kr/', 'https://www.topuniversities.com/universities/kyung-hee-university', true, 80),
  ('chung-ang', '中央大学', '중앙대학교', 'Chung-Ang University', 'private', '首尔特别市', '首尔／安城', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 7000000, 14000000, 38000, 78000, 2025, '=432', 432, 2027, '=8', 8, 2025, '传媒、文化艺术、经营与药学等领域具有特色的私立综合大学。', array['传媒文化优势','国际交流','双校区'], 'https://www.cau.ac.kr/', 'https://www.topuniversities.com/universities/chung-ang-university-cau', true, 90),
  ('ewha', '梨花女子大学', '이화여자대학교', 'Ewha Womans University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 7000000, 14500000, 38000, 80000, 2025, '=488', 488, 2027, '6', 6, 2025, '位于首尔的知名女子综合大学，国际教育与女性人才培养资源丰富。', array['女子大学','国际项目丰富','医学与人文兼备'], 'https://www.ewha.ac.kr/', 'https://www.topuniversities.com/universities/ewha-womans-university', true, 100),
  ('konkuk', '建国大学', '건국대학교', 'Konkuk University', 'private', '首尔特别市', '首尔／忠州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 6800000, 13500000, 37000, 75000, 2025, null, null, null, '=8', 8, 2025, '学科覆盖广，在生命科学、经营与文化内容领域具有特色。', array['首尔校区便利','专业选择广','生命科学'], 'https://www.konkuk.ac.kr/', 'https://www.koreajoongangdaily.com/korea/snu-tops-the-joongang-university-rankings-for-10th-straight-year-hanyang-climbs-to-third/12271525', false, 110),
  ('dongguk', '东国大学', '동국대학교', 'Dongguk University', 'private', '首尔特别市', '首尔／庆州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 6600000, 13500000, 36000, 75000, 2025, null, null, null, '=8', 8, 2025, '传媒影视、人文社会与文化内容教育具有鲜明优势。', array['影视传媒','首尔中心区','文化内容'], 'https://www.dongguk.edu/', 'https://www.koreajoongangdaily.com/korea/snu-tops-the-joongang-university-rankings-for-10th-straight-year-hanyang-climbs-to-third/12271525', false, 120),
  ('university-of-seoul', '首尔市立大学', '서울시립대학교', 'University of Seoul', 'public', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], 2500000, 6500000, 20000, 38000, 2025, '851–900', 851, 2027, '16', 16, 2025, '由首尔市支持的公立大学，城市规划、行政与学费性价比较突出。', array['公立大学','学费优势','城市研究'], 'https://www.uos.ac.kr/', 'https://www.topuniversities.com/universities/university-seoul', true, 130),
  ('hufs', '韩国外国语大学', '한국외국어대학교', 'Hankuk University of Foreign Studies', 'private', '首尔特别市', '首尔／龙仁', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science'], 6500000, 11000000, 35000, 62000, 2025, null, null, null, '17', 17, 2025, '外语、国际关系、区域研究和国际商务领域特色突出。', array['外语教育','区域研究','国际商务'], 'https://www.hufs.ac.kr/', 'https://www.koreajoongangdaily.com/korea/snu-tops-the-joongang-university-rankings-for-10th-straight-year-hanyang-climbs-to-third/12271525', false, 140),
  ('seoultech', '首尔科学技术大学', '서울과학기술대학교', 'Seoul National University of Science and Technology', 'national', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['science','natural_sciences'], 4500000, 7500000, 24000, 42000, 2025, '1001–1200', 1001, 2027, '18', 18, 2025, '位于首尔的国立理工大学，实践教育与产业合作导向明显。', array['国立理工','实践教育','首尔区位'], 'https://www.seoultech.ac.kr/', 'https://www.topuniversities.com/universities/seoul-national-university-science-technology', false, 150),
  ('sogang', '西江大学', '서강대학교', 'Sogang University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], 7000000, 12000000, 38000, 67000, 2025, null, null, null, null, null, null, '规模适中，在经营、经济、传媒与人文教育方面具有良好口碑。', array['小而精','经营经济','传媒人文'], 'https://www.sogang.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 160),
  ('sookmyung', '淑明女子大学', '숙명여자대학교', 'Sookmyung Womans University', 'private', '首尔特别市', '首尔', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], 6500000, 12000000, 35000, 67000, 2025, null, null, null, '20', 20, 2025, '女子综合大学，语言、经营、文化内容与女性领导力培养特色鲜明。', array['女子大学','首尔区位','语言与经营'], 'https://www.sookmyung.ac.kr/', 'https://www.koreajoongangdaily.com/korea/snu-tops-the-joongang-university-rankings-for-10th-straight-year-hanyang-climbs-to-third/12271525', false, 170),
  ('pusan-national', '釜山大学', '부산대학교', 'Pusan National University', 'national', '釜山广域市', '釜山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 4200000, 8500000, 23000, 48000, 2025, '=449', 449, 2027, '=21', 21, 2025, '韩国东南地区代表性国立综合大学，学科覆盖完整且预算友好。', array['地方国立旗舰','综合学科','学费性价比'], 'https://www.pusan.ac.kr/', 'https://www.topuniversities.com/universities/pusan-national-university', true, 180),
  ('pukyong', '国立釜庆大学', '국립부경대학교', 'Pukyong National University', 'national', '釜山广域市', '釜山', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], 4000000, 7200000, 22000, 41000, 2025, '1201–1400', 1201, 2027, null, null, null, '海洋、水产、环境与工科领域具有区域特色的国立大学。', array['海洋水产','国立大学','釜山生活圈'], 'https://www.pknu.ac.kr/', 'https://www.topuniversities.com/universities/pukyong-national-university', false, 190),
  ('kyungpook-national', '庆北大学', '경북대학교', 'Kyungpook National University', 'national', '大邱广域市', '大邱', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 4200000, 8500000, 23000, 48000, 2025, '=481', 481, 2027, '=21', 21, 2025, '大邱与庆北地区代表性国立综合大学，理工、医学与农业生命领域完整。', array['地方国立旗舰','医学资源','理工优势'], 'https://www.knu.ac.kr/', 'https://www.topuniversities.com/universities/kyungpook-national-university', true, 200),
  ('inha', '仁荷大学', '인하대학교', 'Inha University', 'private', '仁川广域市', '仁川', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 6800000, 13000000, 37000, 72000, 2025, '=555', 555, 2027, '12', 12, 2025, '航空、物流、工程与国际化教育较有特色，邻近首尔都市圈。', array['航空物流','工程优势','首都圈'], 'https://www.inha.ac.kr/', 'https://www.topuniversities.com/universities/inha-university', true, 210),
  ('incheon-national', '仁川大学', '인천대학교', 'Incheon National University', 'national', '仁川广域市', '仁川', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], 4300000, 7800000, 23000, 44000, 2025, null, null, null, null, null, null, '位于松岛国际城的国立大学，国际商务、城市与工程领域具有区位优势。', array['国立大学','松岛国际城','国际商务'], 'https://www.inu.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 220),
  ('chonnam-national', '全南大学', '전남대학교', 'Chonnam National University', 'national', '光州广域市', '光州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 4000000, 8200000, 22000, 46000, 2025, '781–790', 781, 2027, null, null, null, '光州与全南地区代表性国立综合大学，农业生命、理工与医学资源较完整。', array['地方国立旗舰','医学资源','农业生命'], 'https://www.jnu.ac.kr/', 'https://www.topuniversities.com/universities/chonnam-national-university', false, 230),
  ('gist', '光州科学技术院', '광주과학기술원', 'GIST', 'national', '光州广域市', '光州', array['bachelor_fresh','master','doctor'], array['science','natural_sciences'], 3500000, 7500000, 20000, 43000, 2025, null, null, null, null, null, null, '聚焦科学与工程研究的国家级研究型大学，适合理工研究路线。', array['研究型大学','理工科','奖学金机会'], 'https://www.gist.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 240),
  ('chungnam-national', '忠南大学', '충남대학교', 'Chungnam National University', 'national', '大田广域市', '大田', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 4000000, 8200000, 22000, 46000, 2025, null, null, null, null, null, null, '位于大田科研城市的国立综合大学，理工、农业与医学方向齐全。', array['大田科研圈','国立综合','专业完整'], 'https://www.cnu.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 250),
  ('unist', '蔚山科学技术院', '울산과학기술원', 'UNIST', 'national', '蔚山广域市', '蔚山', array['bachelor_fresh','master','doctor'], array['science','natural_sciences'], 3500000, 7800000, 20000, 44000, 2025, null, null, null, null, null, null, '依托蔚山产业集群发展的研究型理工大学，新能源与工程研究活跃。', array['新能源研究','产业合作','英文课程'], 'https://www.unist.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 260),
  ('korea-sejong', '高丽大学世宗校区', '고려대학교 세종캠퍼스', 'Korea University Sejong Campus', 'private', '世宗特别自治市', '世宗', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], 6200000, 11000000, 34000, 62000, 2025, null, null, null, null, null, null, '位于世宗行政城市圈，公共政策、科技融合与国际化项目具有区位特色。', array['世宗区位','融合学科','公共政策'], 'https://sejong.korea.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 270),
  ('ajou', '亚洲大学', '아주대학교', 'Ajou University', 'private', '京畿道', '水原', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 6500000, 13000000, 35000, 72000, 2025, null, null, null, null, null, null, '位于水原，工程、经营、医学与国际项目较有竞争力。', array['水原生活圈','工程与医学','国际项目'], 'https://www.ajou.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 280),
  ('gachon', '嘉泉大学', '가천대학교', 'Gachon University', 'private', '京畿道', '城南', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 6500000, 14000000, 35000, 78000, 2025, null, null, null, null, null, null, '位于首都圈城南，医学、人工智能与融合教育投入较多。', array['首都圈','医学资源','人工智能'], 'https://www.gachon.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 290),
  ('kangwon-national', '江原大学', '강원대학교', 'Kangwon National University', 'national', '江原特别自治道', '春川', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 3800000, 7800000, 21000, 44000, 2025, null, null, null, null, null, null, '江原地区代表性国立综合大学，森林、农业生命、兽医与自然科学特色明显。', array['国立综合','自然环境','农业生命'], 'https://www.kangwon.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 300),
  ('chungbuk-national', '忠北大学', '충북대학교', 'Chungbuk National University', 'national', '忠清北道', '清州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 3900000, 8000000, 21000, 45000, 2025, null, null, null, null, null, null, '位于清州的国立综合大学，电子信息、农业生命与医学教育体系完整。', array['国立综合','清州生活圈','电子信息'], 'https://www.chungbuk.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 310),
  ('kongju-national', '国立公州大学', '국립공주대학교', 'Kongju National University', 'national', '忠清南道', '公州／天安', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], 3600000, 7200000, 20000, 41000, 2025, null, null, null, null, null, null, '教育、工科与自然科学兼备的国立大学，拥有公州与天安等校区。', array['国立大学','教育学','预算友好'], 'https://www.kongju.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 320),
  ('jeonbuk-national', '全北大学', '전북대학교', 'Jeonbuk National University', 'national', '全北特别自治道', '全州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 3900000, 8200000, 21000, 46000, 2025, null, null, null, null, null, null, '全北地区代表性国立综合大学，农业生命、兽医、工程与人文资源较完整。', array['地方国立旗舰','农业生命','全州生活圈'], 'https://www.jbnu.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 330),
  ('mokpo-national', '木浦大学', '목포대학교', 'Mokpo National University', 'national', '全罗南道', '务安／木浦', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences'], 3500000, 7000000, 20000, 40000, 2025, null, null, null, null, null, null, '全罗南道国立大学，海洋、区域产业与自然科学方向具有地方特色。', array['国立大学','海洋与区域产业','预算友好'], 'https://www.mokpo.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 340),
  ('gyeongsang-national', '庆尚国立大学', '경상국립대학교', 'Gyeongsang National University', 'national', '庆尚南道', '晋州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 3800000, 8000000, 21000, 45000, 2025, null, null, null, null, null, null, '庆尚南道代表性国立综合大学，航空、机械、农业生命与医学方向齐全。', array['航空机械','农业生命','国立综合'], 'https://www.gnu.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 350),
  ('jeju-national', '济州大学', '제주대학교', 'Jeju National University', 'national', '济州特别自治道', '济州', array['language','bachelor_fresh','bachelor_transfer','master','doctor'], array['humanities_social','science','natural_sciences','medicine'], 3800000, 8000000, 21000, 45000, 2025, null, null, null, null, null, null, '济州地区国立综合大学，旅游、海洋、兽医与自然环境相关学科具有特色。', array['济州环境','旅游与海洋','国立综合'], 'https://www.jejunu.ac.kr/', 'https://www.studyinkorea.go.kr/', false, 360)
on conflict (slug) do update set
  name_zh = excluded.name_zh,
  name_ko = excluded.name_ko,
  name_en = excluded.name_en,
  ownership = excluded.ownership,
  province = excluded.province,
  city = excluded.city,
  admission_stages = excluded.admission_stages,
  discipline_groups = excluded.discipline_groups,
  tuition_min_krw = excluded.tuition_min_krw,
  tuition_max_krw = excluded.tuition_max_krw,
  tuition_min_cny = excluded.tuition_min_cny,
  tuition_max_cny = excluded.tuition_max_cny,
  tuition_reference_year = excluded.tuition_reference_year,
  qs_rank_display = excluded.qs_rank_display,
  qs_rank_sort = excluded.qs_rank_sort,
  qs_ranking_year = excluded.qs_ranking_year,
  joongang_rank_display = excluded.joongang_rank_display,
  joongang_rank_sort = excluded.joongang_rank_sort,
  joongang_ranking_year = excluded.joongang_ranking_year,
  summary = excluded.summary,
  highlights = excluded.highlights,
  official_website = excluded.official_website,
  ranking_source_url = excluded.ranking_source_url,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  updated_at = now();

-- 为数据库控制台补充中文说明。
comment on table public.korean_universities is '韩国大学学校库及筛选、排名和参考学费信息';
comment on table public.korean_university_programs is '韩国大学分阶段专业项目与语言要求';
comment on table public.student_university_comparisons is '学生最多四所大学的对比清单';
comment on table public.student_university_assessments is '学生在线选校评估记录与分项结果';
comment on column public.korean_universities.tuition_min_cny is '人民币年度参考学费下限，仅用于预算筛选';
comment on column public.korean_universities.tuition_max_cny is '人民币年度参考学费上限，仅用于预算筛选';
