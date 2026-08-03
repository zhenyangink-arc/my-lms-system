begin;

create or replace function private.korean_bank_json_strings_are_valid(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_child jsonb;
begin
  if p_value is null then
    return true;
  end if;

  case jsonb_typeof(p_value)
    when 'string' then
      return private.korean_bank_text_is_valid(p_value #>> '{}');
    when 'array' then
      for v_child in select value from jsonb_array_elements(p_value)
      loop
        if not private.korean_bank_json_strings_are_valid(v_child) then
          return false;
        end if;
      end loop;
    when 'object' then
      for v_child in select value from jsonb_each(p_value)
      loop
        if not private.korean_bank_json_strings_are_valid(v_child) then
          return false;
        end if;
      end loop;
  end case;

  return true;
end;
$$;

alter table public.homework_bank_question_keys
  add constraint homework_bank_question_keys_korean_answer_check
  check (private.korean_bank_json_strings_are_valid(answer_key));

alter table public.exam_bank_question_keys
  add constraint exam_bank_question_keys_korean_answer_check
  check (private.korean_bank_json_strings_are_valid(answer_key));

commit;
