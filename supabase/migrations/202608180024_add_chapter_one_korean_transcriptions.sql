-- Add Hangul pronunciation transcriptions to the chapter-one core vocabulary.
with vocabulary_transcriptions(ko, transcription) as (
  values
    ('저', '저'),
    ('이름', '이름'),
    ('학생', '학쌩'),
    ('선생님', '선생님'),
    ('친구', '친구'),
    ('사람', '사람'),
    ('만나다', '만나다'),
    ('인사하다', '인사하다'),
    ('소개하다', '소개하다'),
    ('한국어', '한구거'),
    ('처음', '처음'),
    ('반갑다', '반갑따')
), chapter_one_vocabulary as (
  select node.id, node.content
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.slug = 'korean-level-one-01'
    and node.node_code = 'people-and-greetings'
), patched_vocabulary as (
  select
    source.id,
    jsonb_agg(
      case
        when transcription.transcription is not null
          then word.value || jsonb_build_object('transcription', transcription.transcription)
        else word.value
      end
      order by word.ordinality
    ) as vocabulary
  from chapter_one_vocabulary source
  cross join lateral jsonb_array_elements(source.content -> 'vocabulary') with ordinality as word(value, ordinality)
  left join vocabulary_transcriptions transcription on transcription.ko = word.value ->> 'ko'
  group by source.id
)
update public.digital_textbook_nodes node
set content = jsonb_set(node.content, '{vocabulary}', patched.vocabulary, false),
    updated_at = now()
from patched_vocabulary patched
where node.id = patched.id;
