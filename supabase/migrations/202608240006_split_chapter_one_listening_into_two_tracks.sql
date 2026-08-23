create table if not exists public.digital_textbook_listening_tracks (
  activity_id uuid not null references public.digital_textbook_activities(id) on delete cascade,
  page_index integer not null check (page_index >= 0),
  transcript_ko text not null check (length(trim(transcript_ko)) > 0),
  audio_object_key text not null check (length(trim(audio_object_key)) > 0),
  audio_status text not null default 'pending' check (audio_status in ('pending', 'ready', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (activity_id, page_index)
);

alter table public.digital_textbook_listening_tracks enable row level security;
revoke all on table public.digital_textbook_listening_tracks from anon, authenticated;
grant all on table public.digital_textbook_listening_tracks to service_role;

drop trigger if exists digital_textbook_listening_tracks_set_updated_at
  on public.digital_textbook_listening_tracks;
create trigger digital_textbook_listening_tracks_set_updated_at
before update on public.digital_textbook_listening_tracks
for each row execute function private.set_updated_at();

with target_activity as (
  select activity.id
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and activity.activity_key = 'listening-identity'
)
insert into public.digital_textbook_listening_tracks (
  activity_id, page_index, transcript_ko, audio_object_key, audio_status, metadata
)
select id, 0,
  '안녕하세요? 저는 수진이에요. 한국 사람이에요. 저는 학생이에요. 요즘 한국어를 배워요. 처음 만나서 반가워요.',
  'korean-level-one/chapter-01/listening/chapter-01-listening-identity-normal.mp3',
  'ready',
  '{"edition":"temporary_tts","voice":"ko-KR-SunHiNeural","questionCount":4}'::jsonb
from target_activity
union all
select id, 1,
  '안녕하세요? 저는 왕밍이에요. 중국 사람이에요. 저는 회사원이에요. 요즘 한국어를 배워요. 지민 씨는 학생이에요? 네, 학생이에요. 만나서 반가워요.',
  'korean-level-one/chapter-01/listening/chapter-01-listening-dialogue-normal.mp3',
  'ready',
  '{"edition":"temporary_tts","voice":"ko-KR-InJoonNeural","questionCount":4}'::jsonb
from target_activity
on conflict (activity_id, page_index) do update set
  transcript_ko = excluded.transcript_ko,
  audio_object_key = excluded.audio_object_key,
  audio_status = excluded.audio_status,
  metadata = excluded.metadata,
  updated_at = now();

with target_activity as (
  select activity.id
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and activity.activity_key = 'listening-identity'
)
update public.digital_textbook_activities activity
set prompt = '{"zh-CN":"完成两套初次见面听力，每页依据当前音频回答四题。","ko-KR":"두 개의 첫 만남 듣기를 듣고 페이지마다 네 문제에 답하세요."}'::jsonb,
    instruction = '{"zh-CN":"每页对应一段不同音频；完成本页四题后可查看本页母稿。","ko-KR":"페이지마다 다른 음성을 듣고 네 문제를 푼 뒤 해당 원고를 확인하세요."}'::jsonb,
    public_config = activity.public_config || $config${
      "pageCount":2,
      "trackMode":"per_page",
      "items":[
        {"id":"a-name","group":"listening-a","question":{"zh-CN":"说话人叫什么名字？","ko-KR":"말하는 사람의 이름은 무엇이에요?"},"options":["수진","지민","리나","왕밍"]},
        {"id":"a-origin","group":"listening-a","question":{"zh-CN":"说话人是哪国人？","ko-KR":"말하는 사람은 어느 나라 사람이에요?"},"options":["한국 사람","중국 사람","일본 사람","没有提到／언급하지 않음"]},
        {"id":"a-identity","group":"listening-a","question":{"zh-CN":"说话人的身份是什么？","ko-KR":"말하는 사람의 신분은 무엇이에요?"},"options":["학생","선생님","회사원","의사"]},
        {"id":"a-learning","group":"listening-a","question":{"zh-CN":"说话人最近在学习什么？","ko-KR":"말하는 사람은 요즘 무엇을 배워요?"},"options":["한국어","영어","수학","没有提到／언급하지 않음"]},
        {"id":"b-name","group":"listening-b","question":{"zh-CN":"自我介绍的人叫什么名字？","ko-KR":"자기소개한 사람의 이름은 무엇이에요?"},"options":["왕밍","수진","지민","리나"]},
        {"id":"b-origin","group":"listening-b","question":{"zh-CN":"王明是哪国人？","ko-KR":"왕밍 씨는 어느 나라 사람이에요?"},"options":["중국 사람","한국 사람","일본 사람","没有提到／언급하지 않음"]},
        {"id":"b-identity","group":"listening-b","question":{"zh-CN":"王明的身份是什么？","ko-KR":"왕밍 씨의 신분은 무엇이에요?"},"options":["회사원","학생","선생님","의사"]},
        {"id":"b-jimin","group":"listening-b","question":{"zh-CN":"智敏的身份是什么？","ko-KR":"지민 씨의 신분은 무엇이에요?"},"options":["학생","회사원","선생님","没有提到／언급하지 않음"]}
      ]
    }$config$::jsonb,
    updated_at = now()
where activity.id in (select id from target_activity);

with target_activity as (
  select activity.id
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and activity.activity_key = 'listening-identity'
)
update public.digital_textbook_activity_secrets secret
set answer_key = '{"kind":"index_array","value":[0,0,0,0,0,0,0,0]}'::jsonb,
    explanation = '{"correct":{"zh-CN":"两页答案均来自各自音频原话。","ko-KR":"두 페이지의 답은 각각의 음성에 나온 표현입니다."}}'::jsonb,
    updated_at = now()
where secret.activity_id in (select id from target_activity);

with target_activity as (
  select activity.id
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and activity.activity_key = 'listening-identity'
)
delete from public.digital_textbook_activity_page_progress progress
where progress.activity_id in (select id from target_activity);
