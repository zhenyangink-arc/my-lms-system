-- 清理阶段拆分迁移期间误生成的跨阶段学生资料，并建立数据库硬性匹配规则。

-- 未提交的错配项目可以安全删除。
delete from public.student_application_documents as document
using public.student_university_targets as target,
      public.university_application_document_requirements as requirement
where document.target_id = target.id
  and document.requirement_id = requirement.id
  and requirement.admission_stage <> coalesce(target.admission_track, 'language')
  and document.submission_version = 0
  and document.storage_path is null;

-- 若以后发现已有提交历史的旧错配项目，只归档隐藏，不删除文件和审核记录。
update public.student_application_documents as document
set is_archived = true
from public.student_university_targets as target,
     public.university_application_document_requirements as requirement
where document.target_id = target.id
  and document.requirement_id = requirement.id
  and requirement.admission_stage <> coalesce(target.admission_track, 'language')
  and document.is_archived = false;

create or replace function public.enforce_application_document_requirement_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_stage text;
  requirement_stage text;
begin
  if new.target_id is null or new.requirement_id is null then
    return new;
  end if;

  select coalesce(target.admission_track, 'language')
  into target_stage
  from public.student_university_targets as target
  where target.id = new.target_id;

  select requirement.admission_stage
  into requirement_stage
  from public.university_application_document_requirements as requirement
  where requirement.id = new.requirement_id;

  if target_stage is null or requirement_stage is null then
    raise exception '申请资料关联的目标大学或资料模板不存在';
  end if;

  if target_stage <> requirement_stage then
    raise exception '申请资料阶段必须与学生选择的目标阶段一致';
  end if;

  return new;
end;
$$;

drop trigger if exists application_documents_enforce_requirement_stage
  on public.student_application_documents;
create trigger application_documents_enforce_requirement_stage
before insert or update of target_id, requirement_id
on public.student_application_documents
for each row execute function public.enforce_application_document_requirement_stage();

revoke all on function public.enforce_application_document_requirement_stage()
  from public, anon, authenticated;

comment on function public.enforce_application_document_requirement_stage() is
  '阻止语学院、大学新入、大学插班、硕士和博士资料互相混入学生目标申请表';

notify pgrst, 'reload schema';
