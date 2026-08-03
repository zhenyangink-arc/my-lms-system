begin;

alter policy "question bank managers manage homework materials"
on public.homework_bank_materials
using (public.current_user_can_manage_standard_question_bank())
with check (public.current_user_can_manage_standard_question_bank());

alter policy "question bank managers manage homework material secrets"
on public.homework_bank_material_secrets
using (public.current_user_can_manage_standard_question_bank())
with check (public.current_user_can_manage_standard_question_bank());

alter policy "question bank managers manage homework questions"
on public.homework_bank_questions
using (public.current_user_can_manage_standard_question_bank())
with check (public.current_user_can_manage_standard_question_bank());

alter policy "question bank managers manage homework question keys"
on public.homework_bank_question_keys
using (public.current_user_can_manage_standard_question_bank())
with check (public.current_user_can_manage_standard_question_bank());

alter policy "question bank managers manage exam materials"
on public.exam_bank_materials
using (public.current_user_can_manage_standard_question_bank())
with check (public.current_user_can_manage_standard_question_bank());

alter policy "question bank managers manage exam material secrets"
on public.exam_bank_material_secrets
using (public.current_user_can_manage_standard_question_bank())
with check (public.current_user_can_manage_standard_question_bank());

alter policy "question bank managers manage exam questions"
on public.exam_bank_questions
using (public.current_user_can_manage_standard_question_bank())
with check (public.current_user_can_manage_standard_question_bank());

alter policy "question bank managers manage exam question keys"
on public.exam_bank_question_keys
using (public.current_user_can_manage_standard_question_bank())
with check (public.current_user_can_manage_standard_question_bank());

commit;
