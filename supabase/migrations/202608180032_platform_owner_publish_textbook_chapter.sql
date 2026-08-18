-- A platform-owner-only release boundary for one complete digital textbook
-- chapter. The chapter, linked test, and valid test items change state in one
-- database transaction so students never see a partially published release.
create or replace function public.publish_digital_textbook_chapter(
  p_chapter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  chapter_number_value integer;
  chapter_test_id_value uuid;
  chapter_test_slug_value text;
  version_id_value uuid;
  textbook_id_value uuid;
  question_count integer := 0;
  invalid_question_count integer := 0;
begin
  if auth.uid() is null or not private.is_platform_owner() then
    raise exception '只有平台负责人可以发布教材章节';
  end if;

  select
    chapter.chapter_number,
    chapter.chapter_test_id,
    version.id,
    textbook.id
  into
    chapter_number_value,
    chapter_test_id_value,
    version_id_value,
    textbook_id_value
  from public.digital_textbook_chapters as chapter
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where chapter.id = p_chapter_id
  for update of chapter, version, textbook;

  if not found then
    raise exception '没有找到要发布的教材章节';
  end if;

  if chapter_number_value > 0 and chapter_test_id_value is null then
    raise exception '当前章节尚未关联章节测试';
  end if;

  if chapter_test_id_value is not null then
    select
      test.slug
    into chapter_test_slug_value
    from public.chapter_tests as test
    where test.id = chapter_test_id_value
    for update;

    if chapter_test_slug_value is null then
      raise exception '当前章节测试还没有可发布题目';
    end if;

    perform 1
    from public.chapter_test_questions as question
    where question.test_id = chapter_test_id_value
    for update;

    select
      count(question.id) filter (
        where question.is_chapter_test_item = true
          and question.question_type = 'single_choice'
      ),
      count(question.id) filter (
        where question.is_chapter_test_item = true
          and (
            question.question_type is distinct from 'single_choice'
            or nullif(btrim(question.prompt), '') is null
            or case
              when jsonb_typeof(question.options) = 'array'
                then jsonb_array_length(question.options) <> 4
              else true
            end
            or question.correct_option is null
            or question.correct_option < 0
            or question.correct_option > 3
          )
      )
    into question_count, invalid_question_count
    from public.chapter_test_questions as question
    where question.test_id = chapter_test_id_value;

    if question_count = 0 then
      raise exception '当前章节测试还没有可发布题目';
    end if;

    if invalid_question_count > 0 then
      raise exception '章节测试存在未完成配置的题目';
    end if;

    update public.chapter_test_questions
    set status = 'published',
        updated_at = now()
    where test_id = chapter_test_id_value
      and is_chapter_test_item = true
      and question_type = 'single_choice';

    update public.chapter_tests
    set status = 'published',
        updated_at = now()
    where id = chapter_test_id_value;
  end if;

  update public.digital_textbooks
  set status = 'published',
      updated_at = now()
  where id = textbook_id_value;

  update public.digital_textbook_versions
  set status = 'published',
      updated_at = now()
  where id = version_id_value;

  update public.digital_textbook_chapters
  set status = 'published',
      production_status = case
        when production_status is null then null
        else 'published'
      end,
      updated_at = now()
  where id = p_chapter_id;

  return jsonb_build_object(
    'chapterNumber', chapter_number_value,
    'testSlug', chapter_test_slug_value,
    'publishedQuestions', question_count
  );
end;
$$;

revoke all on function public.publish_digital_textbook_chapter(uuid) from public;
grant execute on function public.publish_digital_textbook_chapter(uuid) to authenticated;

comment on function public.publish_digital_textbook_chapter(uuid) is
  '平台负责人一次发布教材章节、关联章节测试及有效测试题；数据库内再次校验身份并保持事务原子性。';
