-- Persist Hangul pronunciation transcriptions for every core-vocabulary item
-- in chapters 02–16. Words without a sound change use their written Hangul;
-- the exception map records the pronunciation learners should actually read.
with pronunciation_exceptions(ko, transcription) as (
  values
    ('물건', '물껀'),
    ('열쇠', '열쐬'),
    ('있다', '읻따'),
    ('없다', '업따'),
    ('한국어', '한구거'),
    ('먹다', '먹따'),
    ('읽다', '익따'),
    ('학교', '학꾜'),
    ('식당', '식땅'),
    ('학생 식당', '학쌩 식땅'),
    ('앞', '압'),
    ('옆', '엽'),
    ('밖', '박'),
    ('월요일', '워료일'),
    ('일요일', '이료일'),
    ('산책하다', '산채카다'),
    ('재미있다', '재미읻따'),
    ('찍다', '찍따'),
    ('작다', '작따'),
    ('따뜻하다', '따뜨타다'),
    ('맑다', '막따'),
    ('덥다', '덥따'),
    ('춥다', '춥따'),
    ('겉옷', '거돋'),
    ('음악', '으막'),
    ('극장', '극짱'),
    ('듣다', '듣따'),
    ('걷다', '걷따'),
    ('괜찮다', '괜찬타'),
    ('같이', '가치'),
    ('가족사진', '가족싸진'),
    ('직업', '지겁'),
    ('몇', '멷'),
    ('일정', '일쩡'),
    ('시작하다', '시자카다'),
    ('끝나다', '끈나다'),
    ('막히다', '마키다'),
    ('받다', '받따'),
    ('연락하다', '열라카다'),
    ('약속', '약쏙'),
    ('서울역', '서울력'),
    ('택시', '택씨'),
    ('갈아타다', '가라타다'),
    ('도착하다', '도차카다'),
    ('옷', '옫'),
    ('짧다', '짤따'),
    ('가볍다', '가볍따'),
    ('입다', '입따'),
    ('신다', '신따'),
    ('찾다', '찯따'),
    ('여권', '여꿘'),
    ('숙소', '숙쏘'),
    ('예약하다', '예야카다'),
    ('좋아하다', '조아하다'),
    ('집들이', '집뜨리'),
    ('답장', '답짱'),
    ('돕다', '돕따'),
    ('가져오다', '가저오다'),
    ('답장하다', '답짱하다')
), target_nodes as (
  select node.id, node.content
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number between 2 and 16
    and jsonb_typeof(node.content -> 'vocabulary') = 'array'
), patched_vocabulary as (
  select
    source.id,
    jsonb_agg(
      word.value || jsonb_build_object(
        'transcription', coalesce(exception.transcription, word.value ->> 'ko')
      )
      order by word.ordinality
    ) as vocabulary
  from target_nodes source
  cross join lateral jsonb_array_elements(source.content -> 'vocabulary')
    with ordinality as word(value, ordinality)
  left join pronunciation_exceptions exception
    on exception.ko = word.value ->> 'ko'
  group by source.id
)
update public.digital_textbook_nodes node
set content = jsonb_set(node.content, '{vocabulary}', patched.vocabulary, false),
    updated_at = now()
from patched_vocabulary patched
where node.id = patched.id;

do $$
declare
  missing_count integer;
begin
  select count(*)
  into missing_count
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  cross join lateral jsonb_array_elements(node.content -> 'vocabulary') word
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number between 2 and 16
    and jsonb_typeof(node.content -> 'vocabulary') = 'array'
    and nullif(btrim(word ->> 'transcription'), '') is null;

  if missing_count > 0 then
    raise exception 'Korean transcription backfill left % vocabulary items empty', missing_count;
  end if;
end $$;
