# Supabase public schema RLS 策略现状说明

查询日期：2026-08-03

数据来源：PostgreSQL 系统目录 `pg_class`、`pg_policies`、`pg_proc` 与 `information_schema.columns`。表达式保留数据库系统目录返回原文。

## 1. RLS 启用情况总览

- public 基础表：94
- 已启用 RLS：94
- 未启用 RLS：0
- FORCE ROW LEVEL SECURITY：0
- policy 总数：167
- 有 policy 的表：90
- RLS 已启用但 policy 为 0 的表：4

### 账号、权限与多租户

- `profiles` — RLS：已启用；FORCE RLS：否；policy：4 条
- `tenants` — RLS：已启用；FORCE RLS：否；policy：2 条
- `tenant_memberships` — RLS：已启用；FORCE RLS：否；policy：4 条
- `tenant_provisioned_accounts` — RLS：已启用；FORCE RLS：否；policy：1 条
- `tenant_membership_audit_logs` — RLS：已启用；FORCE RLS：否；policy：1 条
- `tenant_lifecycle_audit_logs` — RLS：已启用；FORCE RLS：否；policy：1 条
- `account_management_audit_logs` — RLS：已启用；FORCE RLS：否；policy：1 条
- `account_deletion_audit_logs` — RLS：已启用；FORCE RLS：否；policy：1 条
- `permission_grants` — RLS：已启用；FORCE RLS：否；policy：1 条
- `permission_grant_audit_logs` — RLS：已启用；FORCE RLS：否；policy：1 条
- `question_bank_admin_assignments` — RLS：已启用；FORCE RLS：否；policy：1 条
- `student_service_card_deletion_logs` — RLS：已启用；FORCE RLS：否；policy：1 条
- `ai_token_usage` — RLS：已启用；FORCE RLS：否；policy：1 条

### 课程目录与课程内容

- `course_categories` — RLS：已启用；FORCE RLS：否；policy：4 条
- `courses` — RLS：已启用；FORCE RLS：否；policy：4 条
- `lessons` — RLS：已启用；FORCE RLS：否；policy：4 条
- `course_chapters` — RLS：已启用；FORCE RLS：否；policy：4 条
- `lesson_resources` — RLS：已启用；FORCE RLS：否；policy：6 条
- `course_content_audit_logs` — RLS：已启用；FORCE RLS：否；policy：1 条

### 章节测试、标准试卷与题库

- `chapter_tests` — RLS：已启用；FORCE RLS：否；policy：4 条
- `chapter_test_questions` — RLS：已启用；FORCE RLS：否；policy：4 条
- `chapter_test_attempts` — RLS：已启用；FORCE RLS：否；policy：2 条
- `chapter_test_question_reviews` — RLS：已启用；FORCE RLS：否；policy：4 条
- `chapter_homework_plans` — RLS：已启用；FORCE RLS：否；policy：2 条
- `chapter_homework_skill_settings` — RLS：已启用；FORCE RLS：否；policy：2 条
- `chapter_homework_questions` — RLS：已启用；FORCE RLS：否；policy：2 条
- `assessment_papers` — RLS：已启用；FORCE RLS：否；policy：2 条
- `assessment_paper_questions` — RLS：已启用；FORCE RLS：否；policy：2 条
- `assessment_paper_question_keys` — RLS：已启用；FORCE RLS：否；policy：2 条
- `homework_bank_materials` — RLS：已启用；FORCE RLS：否；policy：1 条
- `homework_bank_material_secrets` — RLS：已启用；FORCE RLS：否；policy：1 条
- `homework_bank_questions` — RLS：已启用；FORCE RLS：否；policy：1 条
- `homework_bank_question_keys` — RLS：已启用；FORCE RLS：否；policy：1 条
- `exam_bank_materials` — RLS：已启用；FORCE RLS：否；policy：1 条
- `exam_bank_material_secrets` — RLS：已启用；FORCE RLS：否；policy：1 条
- `exam_bank_questions` — RLS：已启用；FORCE RLS：否；policy：1 条
- `exam_bank_question_keys` — RLS：已启用；FORCE RLS：否；policy：1 条

### 作业、提交与成绩

- `learning_assignments` — RLS：已启用；FORCE RLS：否；policy：1 条
- `learning_assignment_questions` — RLS：已启用；FORCE RLS：否；policy：1 条
- `learning_assignment_question_keys` — RLS：已启用；FORCE RLS：否；policy：1 条
- `learning_assignment_targets` — RLS：已启用；FORCE RLS：否；policy：1 条
- `learning_submissions` — RLS：已启用；FORCE RLS：否；policy：1 条
- `learning_submission_answers` — RLS：已启用；FORCE RLS：否；policy：1 条
- `grade_items` — RLS：已启用；FORCE RLS：否；policy：1 条
- `grade_records` — RLS：已启用；FORCE RLS：否；policy：1 条
- `grade_review_requests` — RLS：已启用；FORCE RLS：否；policy：1 条
- `grade_center_admin_assignments` — RLS：已启用；FORCE RLS：否；policy：2 条

### 学习进度与学习记录

- `lesson_progress` — RLS：已启用；FORCE RLS：否；policy：1 条
- `lesson_questions` — RLS：已启用；FORCE RLS：否；policy：3 条
- `course_ebook_progress` — RLS：已启用；FORCE RLS：否；policy：3 条
- `learning_record_notes` — RLS：已启用；FORCE RLS：否；policy：1 条
- `learning_record_admin_assignments` — RLS：已启用；FORCE RLS：否；policy：2 条
- `student_course_category_favorites` — RLS：已启用；FORCE RLS：否；policy：3 条
- `student_course_category_learning_plans` — RLS：已启用；FORCE RLS：否；policy：3 条

### 智能数字教材

- `digital_textbooks` — RLS：已启用；FORCE RLS：否；policy：1 条
- `digital_textbook_versions` — RLS：已启用；FORCE RLS：否；policy：1 条
- `digital_textbook_chapters` — RLS：已启用；FORCE RLS：否；policy：1 条
- `digital_textbook_modules` — RLS：已启用；FORCE RLS：否；policy：1 条
- `digital_textbook_nodes` — RLS：已启用；FORCE RLS：否；policy：1 条
- `digital_textbook_activities` — RLS：已启用；FORCE RLS：否；policy：1 条
- `digital_textbook_activity_secrets` — RLS：已启用；FORCE RLS：否；policy：0 条
- `digital_textbook_attempts` — RLS：已启用；FORCE RLS：否；policy：2 条
- `digital_textbook_node_progress` — RLS：已启用；FORCE RLS：否；policy：1 条
- `digital_textbook_preferences` — RLS：已启用；FORCE RLS：否；policy：1 条

### 会话练习

- `conversation_practice_scenarios` — RLS：已启用；FORCE RLS：否；policy：1 条
- `conversation_practice_progress` — RLS：已启用；FORCE RLS：否；policy：1 条
- `conversation_practice_admin_assignments` — RLS：已启用；FORCE RLS：否；policy：2 条

### 通知、帮助中心与资料库

- `announcements` — RLS：已启用；FORCE RLS：否；policy：3 条
- `announcement_reads` — RLS：已启用；FORCE RLS：否；policy：1 条
- `announcement_admin_assignments` — RLS：已启用；FORCE RLS：否；policy：0 条
- `help_articles` — RLS：已启用；FORCE RLS：否；policy：1 条
- `help_tickets` — RLS：已启用；FORCE RLS：否；policy：1 条
- `help_ticket_messages` — RLS：已启用；FORCE RLS：否；policy：1 条
- `help_center_admin_assignments` — RLS：已启用；FORCE RLS：否；policy：0 条
- `library_resources` — RLS：已启用；FORCE RLS：否；policy：1 条
- `library_favorites` — RLS：已启用；FORCE RLS：否；policy：1 条
- `library_downloads` — RLS：已启用；FORCE RLS：否；policy：1 条
- `library_admin_assignments` — RLS：已启用；FORCE RLS：否；policy：0 条

### 学校、大学与留学申请

- `korean_universities` — RLS：已启用；FORCE RLS：否；policy：4 条
- `korean_university_programs` — RLS：已启用；FORCE RLS：否；policy：2 条
- `schools` — RLS：已启用；FORCE RLS：否；policy：2 条
- `school_programs` — RLS：已启用；FORCE RLS：否；policy：2 条
- `university_application_document_requirements` — RLS：已启用；FORCE RLS：否；policy：2 条
- `university_visa_application_requirements` — RLS：已启用；FORCE RLS：否；policy：2 条
- `student_university_assessments` — RLS：已启用；FORCE RLS：否；policy：2 条
- `student_university_comparisons` — RLS：已启用；FORCE RLS：否；policy：1 条
- `student_university_targets` — RLS：已启用；FORCE RLS：否；policy：3 条
- `student_application_documents` — RLS：已启用；FORCE RLS：否；policy：5 条
- `document_review_events` — RLS：已启用；FORCE RLS：否；policy：1 条
- `document_review_admin_assignments` — RLS：已启用；FORCE RLS：否；policy：2 条
- `student_visa_cases` — RLS：已启用；FORCE RLS：否；policy：4 条
- `student_visa_tasks` — RLS：已启用；FORCE RLS：否；policy：4 条
- `student_visa_task_events` — RLS：已启用；FORCE RLS：否；policy：1 条
- `visa_admin_assignments` — RLS：已启用；FORCE RLS：否；policy：2 条

### 未启用 RLS 的基础表

- 无

### RLS 已启用但没有 policy 的基础表

- `announcement_admin_assignments`
- `digital_textbook_activity_secrets`
- `help_center_admin_assignments`
- `library_admin_assignments`

## 2. 每张有 policy 的表：策略原文

## 2.1 账号、权限与多租户

### `profiles`

#### Executives manage subordinate tenant member profiles

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_memberships 子查询 / join，同时包含用户身份字段或 auth.uid()
- USING：
```sql
(((EXISTS ( SELECT 1
   FROM tenant_memberships membership
  WHERE ((membership.user_id = profiles.id) AND (membership.tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id))))) AND (role <> 'tenant_operator'::text) AND (( SELECT is_owner_account() AS is_owner_account) OR (( SELECT is_executive_account() AS is_executive_account) AND (role <> ALL (ARRAY['tenant_super_admin'::text, 'ceo'::text]))))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((EXISTS ( SELECT 1
   FROM tenant_memberships membership
  WHERE ((membership.user_id = profiles.id) AND (membership.tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id))))) AND (role <> 'tenant_operator'::text) AND (( SELECT is_owner_account() AS is_owner_account) OR (( SELECT is_executive_account() AS is_executive_account) AND (role <> ALL (ARRAY['tenant_super_admin'::text, 'ceo'::text]))))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### Executives read profiles of their tenant members

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_memberships 子查询 / join，同时包含用户身份字段或 auth.uid()
- USING：
```sql
((( SELECT is_executive_account() AS is_executive_account) AND (EXISTS ( SELECT 1
   FROM tenant_memberships membership
  WHERE ((membership.user_id = profiles.id) AND (membership.tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)))))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### Users can update own profile

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：user_id / student_id / admin_id / auth.uid() 判断，不直接使用 tenant_id
- USING：
```sql
((( SELECT auth.uid() AS uid) = id) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
((( SELECT auth.uid() AS uid) = id) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### Users can view own profile

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：user_id / student_id / admin_id / auth.uid() 判断，不直接使用 tenant_id
- USING：
```sql
((( SELECT auth.uid() AS uid) = id) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `tenants`

#### members or platform tenant managers read tenants

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(( SELECT private.is_tenant_member(tenants.id) AS is_tenant_member) OR ( SELECT private.is_platform_tenant_manager() AS is_platform_tenant_manager))
```
- WITH CHECK：
```sql
NULL
```

#### tenant owners update their tenant

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
( SELECT private.has_tenant_role(tenants.id, ARRAY['tenant_super_admin'::text]) AS has_tenant_role)
```
- WITH CHECK：
```sql
( SELECT private.has_tenant_role(tenants.id, ARRAY['tenant_super_admin'::text]) AS has_tenant_role)
```

### `tenant_memberships`

#### members managers or platform tenant managers read memberships

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_memberships 子查询 / join，同时包含用户身份字段或 auth.uid()
- USING：
```sql
((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.has_tenant_role(tenant_memberships.tenant_id, ARRAY['ceo'::text, 'tenant_super_admin'::text]) AS has_tenant_role) OR ( SELECT private.is_platform_tenant_manager() AS is_platform_tenant_manager) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### tenant managers create memberships

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_memberships 子查询 / join
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(( SELECT private.has_tenant_role(tenant_memberships.tenant_id, ARRAY['ceo'::text, 'tenant_super_admin'::text]) AS has_tenant_role) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant managers delete memberships

- 角色：`{authenticated}`
- 操作：`DELETE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_memberships 子查询 / join
- USING：
```sql
(( SELECT private.has_tenant_role(tenant_memberships.tenant_id, ARRAY['ceo'::text, 'tenant_super_admin'::text]) AS has_tenant_role) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### tenant managers update memberships

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_memberships 子查询 / join
- USING：
```sql
(( SELECT private.has_tenant_role(tenant_memberships.tenant_id, ARRAY['ceo'::text, 'tenant_super_admin'::text]) AS has_tenant_role) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(( SELECT private.has_tenant_role(tenant_memberships.tenant_id, ARRAY['ceo'::text, 'tenant_super_admin'::text]) AS has_tenant_role) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

### `tenant_provisioned_accounts`

#### owners read provisioned tenant accounts

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(( SELECT private.has_tenant_role(tenant_provisioned_accounts.tenant_id, ARRAY['tenant_super_admin'::text]) AS has_tenant_role) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `tenant_membership_audit_logs`

#### tenant owners read membership audit logs

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(( SELECT private.has_tenant_role(tenant_membership_audit_logs.tenant_id, ARRAY['tenant_super_admin'::text]) AS has_tenant_role) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `tenant_lifecycle_audit_logs`

#### platform tenant managers read lifecycle audit

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_tenant_manager、or、private.is_platform_owner）
- USING：
```sql
(( SELECT private.is_platform_tenant_manager() AS is_platform_tenant_manager) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `account_management_audit_logs`

#### tenant executives read account audit logs

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_executive_account() AS is_executive_account)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `account_deletion_audit_logs`

#### tenant owner reads account deletion audit logs

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_owner_account() AS is_owner_account)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `permission_grants`

#### permission grants visible to authorized viewers

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_memberships 子查询 / join，同时包含用户身份字段或 auth.uid()
- USING：
```sql
((subject_user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_owner() AS is_platform_owner) OR (EXISTS ( SELECT 1
   FROM tenant_memberships membership
  WHERE ((membership.user_id = ( SELECT auth.uid() AS uid)) AND (membership.tenant_id = permission_grants.tenant_id) AND (membership.status = 'active'::text) AND (membership.role = ANY (ARRAY['tenant_super_admin'::text, 'ceo'::text]))))))
```
- WITH CHECK：
```sql
NULL
```

### `permission_grant_audit_logs`

#### permission audit visible to platform owner

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_owner）
- USING：
```sql
( SELECT private.is_platform_owner() AS is_platform_owner)
```
- WITH CHECK：
```sql
NULL
```

### `question_bank_admin_assignments`

#### question bank assignments visible to owner or assignee

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：user_id / student_id / admin_id / auth.uid() 判断，不直接使用 tenant_id
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR (admin_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
NULL
```

### `student_service_card_deletion_logs`

#### tenant admins read service card deletion logs

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin_account() AS is_admin_account)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `ai_token_usage`

#### tenant admins read AI token usage

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin_account() AS is_admin_account)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

## 2.2 课程目录与课程内容

### `course_categories`

#### authenticated users read published platform course categories

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：常量、状态字段或无身份字段判断
- USING：
```sql
((content_scope = 'platform'::text) AND is_published)
```
- WITH CHECK：
```sql
NULL
```

#### platform course managers manage categories

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_course_manager）
- USING：
```sql
((content_scope = 'platform'::text) AND private.is_platform_course_manager())
```
- WITH CHECK：
```sql
((content_scope = 'platform'::text) AND private.is_platform_course_manager())
```

#### tenant admins manage course categories

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin() AS is_admin)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin() AS is_admin)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant members read published course categories

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (is_published OR ( SELECT is_admin() AS is_admin))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `courses`

#### authenticated users read published platform courses

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：常量、状态字段或无身份字段判断
- USING：
```sql
((content_scope = 'platform'::text) AND is_published)
```
- WITH CHECK：
```sql
NULL
```

#### platform course managers manage courses

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_course_manager）
- USING：
```sql
((content_scope = 'platform'::text) AND private.is_platform_course_manager())
```
- WITH CHECK：
```sql
((content_scope = 'platform'::text) AND private.is_platform_course_manager())
```

#### tenant admins manage courses

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin() AS is_admin)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin() AS is_admin)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant members read published courses

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (is_published OR ( SELECT is_admin() AS is_admin))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `lessons`

#### authenticated users read published platform lessons

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：常量、状态字段或无身份字段判断
- USING：
```sql
((content_scope = 'platform'::text) AND is_published)
```
- WITH CHECK：
```sql
NULL
```

#### platform course managers manage lessons

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_course_manager）
- USING：
```sql
((content_scope = 'platform'::text) AND private.is_platform_course_manager())
```
- WITH CHECK：
```sql
((content_scope = 'platform'::text) AND private.is_platform_course_manager())
```

#### tenant admins manage lessons

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin() AS is_admin)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin() AS is_admin)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant members read published lessons

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (is_published OR ( SELECT is_admin() AS is_admin))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `course_chapters`

#### authenticated users read published platform course chapters

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：常量、状态字段或无身份字段判断
- USING：
```sql
((content_scope = 'platform'::text) AND is_published)
```
- WITH CHECK：
```sql
NULL
```

#### platform course managers manage chapters

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_course_manager）
- USING：
```sql
((content_scope = 'platform'::text) AND private.is_platform_course_manager())
```
- WITH CHECK：
```sql
((content_scope = 'platform'::text) AND private.is_platform_course_manager())
```

#### tenant admins manage course chapters

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin() AS is_admin))
```
- WITH CHECK：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin() AS is_admin))
```

#### tenant members read published course chapters

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (is_published OR ( SELECT is_admin() AS is_admin)))
```
- WITH CHECK：
```sql
NULL
```

### `lesson_resources`

#### authenticated users read published platform lesson resources

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：常量、状态字段或无身份字段判断
- USING：
```sql
((content_scope = 'platform'::text) AND is_published)
```
- WITH CHECK：
```sql
NULL
```

#### platform course managers manage lesson resources

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_course_manager）
- USING：
```sql
((content_scope = 'platform'::text) AND private.is_platform_course_manager())
```
- WITH CHECK：
```sql
((content_scope = 'platform'::text) AND private.is_platform_course_manager())
```

#### tenant admins insert lesson resources

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin() AS is_admin)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant admins update lesson resources

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin() AS is_admin)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin() AS is_admin)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant members read published lesson resources

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (is_published OR ( SELECT is_admin() AS is_admin))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### tenant owner deletes lesson resources

- 角色：`{authenticated}`
- 操作：`DELETE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_owner_account() AS is_owner_account)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `course_content_audit_logs`

#### tenant admins read course audit logs

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin_account() AS is_admin_account)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

## 2.3 章节测试、标准试卷与题库

### `chapter_tests`

#### platform question bank managers create groups

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.can_manage_standard_question_bank）
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
( SELECT private.can_manage_standard_question_bank() AS can_manage_standard_question_bank)
```

#### platform question bank managers delete groups

- 角色：`{authenticated}`
- 操作：`DELETE`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.can_manage_standard_question_bank）
- USING：
```sql
( SELECT private.can_manage_standard_question_bank() AS can_manage_standard_question_bank)
```
- WITH CHECK：
```sql
NULL
```

#### platform question bank managers update groups

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.can_manage_standard_question_bank）
- USING：
```sql
( SELECT private.can_manage_standard_question_bank() AS can_manage_standard_question_bank)
```
- WITH CHECK：
```sql
( SELECT private.can_manage_standard_question_bank() AS can_manage_standard_question_bank)
```

#### standard question groups are readable by authorized staff

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（and、current_user_can_manage_standard_question_bank、current_user_can_publish_assessment_papers）
- USING：
```sql
((status = 'published'::text) AND (current_user_can_manage_standard_question_bank() OR current_user_can_publish_assessment_papers()))
```
- WITH CHECK：
```sql
NULL
```

### `chapter_test_questions`

#### platform question bank managers create questions

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.can_manage_standard_question_bank）
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
( SELECT private.can_manage_standard_question_bank() AS can_manage_standard_question_bank)
```

#### platform question bank managers delete questions

- 角色：`{authenticated}`
- 操作：`DELETE`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.can_manage_standard_question_bank）
- USING：
```sql
( SELECT private.can_manage_standard_question_bank() AS can_manage_standard_question_bank)
```
- WITH CHECK：
```sql
NULL
```

#### platform question bank managers update questions

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.can_manage_standard_question_bank）
- USING：
```sql
( SELECT private.can_manage_standard_question_bank() AS can_manage_standard_question_bank)
```
- WITH CHECK：
```sql
( SELECT private.can_manage_standard_question_bank() AS can_manage_standard_question_bank)
```

#### standard questions are readable by authorized staff

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.can_manage_standard_question_bank、or、and、current_user_can_use_standard_question_bank、where）
- USING：
```sql
(( SELECT private.can_manage_standard_question_bank() AS can_manage_standard_question_bank) OR ((status = 'published'::text) AND ( SELECT current_user_can_use_standard_question_bank() AS current_user_can_use_standard_question_bank) AND (EXISTS ( SELECT 1
   FROM chapter_tests test
  WHERE ((test.id = chapter_test_questions.test_id) AND (test.status = 'published'::text))))))
```
- WITH CHECK：
```sql
NULL
```

### `chapter_test_attempts`

#### students view own course test attempts

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
NULL
```

#### tenant admins view course test attempts

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin() AS is_admin))
```
- WITH CHECK：
```sql
NULL
```

### `chapter_test_question_reviews`

#### students add own course question reviews

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```

#### students refresh own course question reviews

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```

#### students remove own course question reviews

- 角色：`{authenticated}`
- 操作：`DELETE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
NULL
```

#### students view own course question reviews

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
NULL
```

### `chapter_homework_plans`

#### chapter homework plans are readable by authorized staff

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_assessment_papers、or、current_user_can_publish_assessment_papers）
- USING：
```sql
(current_user_can_manage_assessment_papers() OR ((status = 'published'::text) AND current_user_can_publish_assessment_papers()))
```
- WITH CHECK：
```sql
NULL
```

#### platform managers maintain chapter homework plans

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_assessment_papers）
- USING：
```sql
current_user_can_manage_assessment_papers()
```
- WITH CHECK：
```sql
current_user_can_manage_assessment_papers()
```

### `chapter_homework_skill_settings`

#### chapter homework skills are readable by authorized staff

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（where、and、current_user_can_manage_assessment_papers、or、current_user_can_publish_assessment_papers）
- USING：
```sql
(EXISTS ( SELECT 1
   FROM chapter_homework_plans plan
  WHERE ((plan.id = chapter_homework_skill_settings.plan_id) AND (current_user_can_manage_assessment_papers() OR ((plan.status = 'published'::text) AND current_user_can_publish_assessment_papers())))))
```
- WITH CHECK：
```sql
NULL
```

#### platform managers maintain chapter homework skills

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_assessment_papers）
- USING：
```sql
current_user_can_manage_assessment_papers()
```
- WITH CHECK：
```sql
current_user_can_manage_assessment_papers()
```

### `chapter_homework_questions`

#### chapter homework questions are readable by authorized staff

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（where、and、current_user_can_manage_assessment_papers、or、current_user_can_publish_assessment_papers）
- USING：
```sql
(EXISTS ( SELECT 1
   FROM chapter_homework_plans plan
  WHERE ((plan.id = chapter_homework_questions.plan_id) AND (current_user_can_manage_assessment_papers() OR ((plan.status = 'published'::text) AND current_user_can_publish_assessment_papers())))))
```
- WITH CHECK：
```sql
NULL
```

#### platform managers maintain chapter homework questions

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_assessment_papers）
- USING：
```sql
current_user_can_manage_assessment_papers()
```
- WITH CHECK：
```sql
current_user_can_manage_assessment_papers()
```

### `assessment_papers`

#### authorized staff read assessment papers

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_assessment_papers、or、current_user_can_publish_assessment_papers）
- USING：
```sql
(current_user_can_manage_assessment_papers() OR ((status = 'published'::text) AND current_user_can_publish_assessment_papers()))
```
- WITH CHECK：
```sql
NULL
```

#### platform managers write assessment papers

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_assessment_papers）
- USING：
```sql
current_user_can_manage_assessment_papers()
```
- WITH CHECK：
```sql
current_user_can_manage_assessment_papers()
```

### `assessment_paper_questions`

#### authorized staff read assessment paper questions

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（where、and、current_user_can_manage_assessment_papers、or、current_user_can_publish_assessment_papers）
- USING：
```sql
(EXISTS ( SELECT 1
   FROM assessment_papers paper
  WHERE ((paper.id = assessment_paper_questions.paper_id) AND (current_user_can_manage_assessment_papers() OR ((paper.status = 'published'::text) AND current_user_can_publish_assessment_papers())))))
```
- WITH CHECK：
```sql
NULL
```

#### platform managers write assessment paper questions

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_assessment_papers）
- USING：
```sql
current_user_can_manage_assessment_papers()
```
- WITH CHECK：
```sql
current_user_can_manage_assessment_papers()
```

### `assessment_paper_question_keys`

#### platform managers read assessment paper keys

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_assessment_papers）
- USING：
```sql
current_user_can_manage_assessment_papers()
```
- WITH CHECK：
```sql
NULL
```

#### platform managers write assessment paper keys

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_assessment_papers）
- USING：
```sql
current_user_can_manage_assessment_papers()
```
- WITH CHECK：
```sql
current_user_can_manage_assessment_papers()
```

### `homework_bank_materials`

#### question bank managers manage homework materials

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_standard_question_bank）
- USING：
```sql
current_user_can_manage_standard_question_bank()
```
- WITH CHECK：
```sql
current_user_can_manage_standard_question_bank()
```

### `homework_bank_material_secrets`

#### question bank managers manage homework material secrets

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_standard_question_bank）
- USING：
```sql
current_user_can_manage_standard_question_bank()
```
- WITH CHECK：
```sql
current_user_can_manage_standard_question_bank()
```

### `homework_bank_questions`

#### question bank managers manage homework questions

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_standard_question_bank）
- USING：
```sql
current_user_can_manage_standard_question_bank()
```
- WITH CHECK：
```sql
current_user_can_manage_standard_question_bank()
```

### `homework_bank_question_keys`

#### question bank managers manage homework question keys

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_standard_question_bank）
- USING：
```sql
current_user_can_manage_standard_question_bank()
```
- WITH CHECK：
```sql
current_user_can_manage_standard_question_bank()
```

### `exam_bank_materials`

#### question bank managers manage exam materials

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_standard_question_bank）
- USING：
```sql
current_user_can_manage_standard_question_bank()
```
- WITH CHECK：
```sql
current_user_can_manage_standard_question_bank()
```

### `exam_bank_material_secrets`

#### question bank managers manage exam material secrets

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_standard_question_bank）
- USING：
```sql
current_user_can_manage_standard_question_bank()
```
- WITH CHECK：
```sql
current_user_can_manage_standard_question_bank()
```

### `exam_bank_questions`

#### question bank managers manage exam questions

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_standard_question_bank）
- USING：
```sql
current_user_can_manage_standard_question_bank()
```
- WITH CHECK：
```sql
current_user_can_manage_standard_question_bank()
```

### `exam_bank_question_keys`

#### question bank managers manage exam question keys

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_standard_question_bank）
- USING：
```sql
current_user_can_manage_standard_question_bank()
```
- WITH CHECK：
```sql
current_user_can_manage_standard_question_bank()
```

## 2.4 作业、提交与成绩

### `learning_assignments`

#### tenant users read visible learning assignments

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND current_user_can_view_learning_assignment(id)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `learning_assignment_questions`

#### tenant users read visible assignment questions

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND current_user_can_view_learning_assignment_questions(assignment_id))
```
- WITH CHECK：
```sql
NULL
```

### `learning_assignment_question_keys`

#### tenant managers read assignment answer keys

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_is_assignment_manager() AS current_user_is_assignment_manager)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `learning_assignment_targets`

#### tenant managers or assigned students read targets

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_is_assignment_manager() AS current_user_is_assignment_manager) OR ((student_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('learning_assignments'::text))))
```
- WITH CHECK：
```sql
NULL
```

### `learning_submissions`

#### tenant managers or owners read submissions

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_is_assignment_manager() AS current_user_is_assignment_manager) OR ((student_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('learning_assignments'::text))))
```
- WITH CHECK：
```sql
NULL
```

### `learning_submission_answers`

#### tenant managers or owners read submission answers

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_is_assignment_manager() AS current_user_is_assignment_manager) OR (student_feature_allowed('learning_assignments'::text) AND (EXISTS ( SELECT 1
   FROM learning_submissions submission
  WHERE ((submission.id = learning_submission_answers.submission_id) AND (submission.student_id = ( SELECT auth.uid() AS uid))))))))
```
- WITH CHECK：
```sql
NULL
```

### `grade_items`

#### tenant users read visible grade items

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_manage_grade_center() AS current_user_can_manage_grade_center) OR ((status = 'published'::text) AND ( SELECT is_active_account() AS is_active_account)))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `grade_records`

#### tenant managers or owners read grade records

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_manage_grade_center() AS current_user_can_manage_grade_center) OR ((student_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM grade_items item
  WHERE ((item.id = grade_records.item_id) AND (item.status = 'published'::text))))))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `grade_review_requests`

#### tenant managers or owners read grade reviews

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_manage_grade_center() AS current_user_can_manage_grade_center) OR (student_id = ( SELECT auth.uid() AS uid)))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `grade_center_admin_assignments`

#### tenant grade assignments visible to owner or assignee

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_is_grade_center_owner() AS current_user_is_grade_center_owner) OR (admin_id = ( SELECT auth.uid() AS uid)))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### tenant owner manages grade assignments

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_is_grade_center_owner() AS current_user_is_grade_center_owner)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_is_grade_center_owner() AS current_user_is_grade_center_owner)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

## 2.5 学习进度与学习记录

### `lesson_progress`

#### tenant users manage own lesson progress

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

### `lesson_questions`

#### tenant students insert own lesson questions

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant students update own open lesson questions

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)) AND (status <> 'closed'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)) AND (status <> 'closed'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant students view own lesson questions

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `course_ebook_progress`

#### students add own ebook progress

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```

#### students update own ebook progress

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```

#### students view own ebook progress

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
NULL
```

### `learning_record_notes`

#### tenant managers or students read learning record notes

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_manage_learning_records() AS current_user_can_manage_learning_records) OR ((student_id = ( SELECT auth.uid() AS uid)) AND (visibility = 'student_visible'::text) AND (status = 'active'::text)))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `learning_record_admin_assignments`

#### tenant learning record assignments visible to owner or assignee

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_is_learning_record_owner() AS current_user_is_learning_record_owner) OR (admin_id = ( SELECT auth.uid() AS uid)))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### tenant owner manages learning record assignments

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_is_learning_record_owner() AS current_user_is_learning_record_owner)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_is_learning_record_owner() AS current_user_is_learning_record_owner)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

### `student_course_category_favorites`

#### users add own course category favorites

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：user_id / student_id / admin_id / auth.uid() 判断，不直接使用 tenant_id
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(user_id = auth.uid())
```

#### users read own course category favorites

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：user_id / student_id / admin_id / auth.uid() 判断，不直接使用 tenant_id
- USING：
```sql
(user_id = auth.uid())
```
- WITH CHECK：
```sql
NULL
```

#### users remove own course category favorites

- 角色：`{authenticated}`
- 操作：`DELETE`
- 模式：`PERMISSIVE`
- 判断依据：user_id / student_id / admin_id / auth.uid() 判断，不直接使用 tenant_id
- USING：
```sql
(user_id = auth.uid())
```
- WITH CHECK：
```sql
NULL
```

### `student_course_category_learning_plans`

#### users add own course learning plans

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：user_id / student_id / admin_id / auth.uid() 判断，不直接使用 tenant_id
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(user_id = auth.uid())
```

#### users read own course learning plans

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：user_id / student_id / admin_id / auth.uid() 判断，不直接使用 tenant_id
- USING：
```sql
(user_id = auth.uid())
```
- WITH CHECK：
```sql
NULL
```

#### users remove own course learning plans

- 角色：`{authenticated}`
- 操作：`DELETE`
- 模式：`PERMISSIVE`
- 判断依据：user_id / student_id / admin_id / auth.uid() 判断，不直接使用 tenant_id
- USING：
```sql
(user_id = auth.uid())
```
- WITH CHECK：
```sql
NULL
```

## 2.6 智能数字教材

### `digital_textbooks`

#### authenticated read textbook catalog

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_standard_question_bank）
- USING：
```sql
((status = 'published'::text) OR current_user_can_manage_standard_question_bank())
```
- WITH CHECK：
```sql
NULL
```

### `digital_textbook_versions`

#### authenticated read textbook versions

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_standard_question_bank）
- USING：
```sql
((status = 'published'::text) OR current_user_can_manage_standard_question_bank())
```
- WITH CHECK：
```sql
NULL
```

### `digital_textbook_chapters`

#### authenticated read textbook chapters

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（current_user_can_manage_standard_question_bank）
- USING：
```sql
((status = 'published'::text) OR current_user_can_manage_standard_question_bank())
```
- WITH CHECK：
```sql
NULL
```

### `digital_textbook_modules`

#### authenticated read textbook modules

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：常量、状态字段或无身份字段判断
- USING：
```sql
true
```
- WITH CHECK：
```sql
NULL
```

### `digital_textbook_nodes`

#### authenticated read textbook nodes

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：常量、状态字段或无身份字段判断
- USING：
```sql
true
```
- WITH CHECK：
```sql
NULL
```

### `digital_textbook_activities`

#### authenticated read textbook activities

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：常量、状态字段或无身份字段判断
- USING：
```sql
true
```
- WITH CHECK：
```sql
NULL
```

### `digital_textbook_attempts`

#### students create own textbook attempts

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
((student_id = auth.uid()) AND (tenant_id = private.current_tenant_id()))
```

#### students read own textbook attempts

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((student_id = auth.uid()) AND private.is_tenant_member(tenant_id))
```
- WITH CHECK：
```sql
NULL
```

### `digital_textbook_node_progress`

#### students manage own textbook progress

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((student_id = auth.uid()) AND private.is_tenant_member(tenant_id))
```
- WITH CHECK：
```sql
((student_id = auth.uid()) AND (tenant_id = private.current_tenant_id()))
```

### `digital_textbook_preferences`

#### students manage own textbook preferences

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((student_id = auth.uid()) AND private.is_tenant_member(tenant_id))
```
- WITH CHECK：
```sql
((student_id = auth.uid()) AND (tenant_id = private.current_tenant_id()))
```

## 2.7 会话练习

### `conversation_practice_scenarios`

#### tenant users read visible conversation scenarios

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND current_user_can_view_conversation_scenario(id)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `conversation_practice_progress`

#### tenant managers or owners read conversation progress

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_manage_conversation_practice() AS current_user_can_manage_conversation_practice) OR ((user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('conversation_course'::text))))
```
- WITH CHECK：
```sql
NULL
```

### `conversation_practice_admin_assignments`

#### tenant conversation assignments visible to owner or assignee

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_is_conversation_practice_owner() AS current_user_is_conversation_practice_owner) OR (admin_id = ( SELECT auth.uid() AS uid)))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### tenant owner manages conversation assignments

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_is_conversation_practice_owner() AS current_user_is_conversation_practice_owner)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_is_conversation_practice_owner() AS current_user_is_conversation_practice_owner)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

## 2.8 通知、帮助中心与资料库

### `announcements`

#### platform or tenant owners create announcements

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
((created_by = ( SELECT auth.uid() AS uid)) AND (updated_by = ( SELECT auth.uid() AS uid)) AND (((scope = 'platform'::text) AND (tenant_id IS NULL) AND ( SELECT private.is_platform_owner() AS is_platform_owner)) OR ((scope = 'tenant'::text) AND (tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (current_profile_role() = ANY (ARRAY['tenant_super_admin'::text, 'ceo'::text])) AND ( SELECT is_active_account() AS is_active_account))))
```

#### platform or tenant owners update announcements

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((scope = 'platform'::text) AND (tenant_id IS NULL) AND ( SELECT private.is_platform_owner() AS is_platform_owner)) OR ((scope = 'tenant'::text) AND (tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (current_profile_role() = ANY (ARRAY['tenant_super_admin'::text, 'ceo'::text])) AND ( SELECT is_active_account() AS is_active_account)))
```
- WITH CHECK：
```sql
(((scope = 'platform'::text) AND (tenant_id IS NULL) AND ( SELECT private.is_platform_owner() AS is_platform_owner)) OR ((scope = 'tenant'::text) AND (tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (current_profile_role() = ANY (ARRAY['tenant_super_admin'::text, 'ceo'::text])) AND ( SELECT is_active_account() AS is_active_account)))
```

#### visible announcements or managed announcements

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((scope = 'platform'::text) AND (status = 'published'::text) AND ( SELECT is_active_account() AS is_active_account)) OR ((scope = 'tenant'::text) AND (tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((status = 'published'::text) OR ( SELECT current_user_can_access_announcements() AS current_user_can_access_announcements)) AND ( SELECT is_active_account() AS is_active_account)))
```
- WITH CHECK：
```sql
NULL
```

### `announcement_reads`

#### announcement reads visible to reader or managers

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (current_profile_role() = ANY (ARRAY['tenant_super_admin'::text, 'ceo'::text])) AND ( SELECT is_active_account() AS is_active_account)))
```
- WITH CHECK：
```sql
NULL
```

### `help_articles`

#### tenant users read help articles

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_manage_help_articles() AS current_user_can_manage_help_articles) OR ((status = 'published'::text) AND ( SELECT is_active_account() AS is_active_account))))
```
- WITH CHECK：
```sql
NULL
```

### `help_tickets`

#### tenant handlers or owners read help tickets

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_handle_help_tickets() AS current_user_can_handle_help_tickets) OR (user_id = ( SELECT auth.uid() AS uid))))
```
- WITH CHECK：
```sql
NULL
```

### `help_ticket_messages`

#### tenant handlers or owners read help messages

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_handle_help_tickets() AS current_user_can_handle_help_tickets) OR (EXISTS ( SELECT 1
   FROM help_tickets ticket
  WHERE ((ticket.id = help_ticket_messages.ticket_id) AND (ticket.tenant_id = help_ticket_messages.tenant_id) AND (ticket.user_id = ( SELECT auth.uid() AS uid)))))))
```
- WITH CHECK：
```sql
NULL
```

### `library_resources`

#### platform owner curates and institutions read published resource

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id IS NULL) AND (content_scope = 'platform'::text) AND (status = 'published'::text) AND (( SELECT private.current_tenant_id() AS current_tenant_id) IS NOT NULL) AND ( SELECT is_active_account() AS is_active_account)))
```
- WITH CHECK：
```sql
NULL
```

### `library_favorites`

#### users read own platform library favorites

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid))))
```
- WITH CHECK：
```sql
NULL
```

### `library_downloads`

#### platform owner or user reads library downloads

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid))))
```
- WITH CHECK：
```sql
NULL
```

## 2.9 学校、大学与留学申请

### `korean_universities`

#### authenticated read published universities

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（or、private.is_platform_university_manager）
- USING：
```sql
((is_published = true) OR ( SELECT private.is_platform_university_manager() AS is_platform_university_manager))
```
- WITH CHECK：
```sql
NULL
```

#### platform owner deletes universities

- 角色：`{authenticated}`
- 操作：`DELETE`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_university_owner）
- USING：
```sql
( SELECT private.is_platform_university_owner() AS is_platform_university_owner)
```
- WITH CHECK：
```sql
NULL
```

#### platform university managers insert universities

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_university_manager）
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
( SELECT private.is_platform_university_manager() AS is_platform_university_manager)
```

#### platform university managers update universities

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_university_manager）
- USING：
```sql
( SELECT private.is_platform_university_manager() AS is_platform_university_manager)
```
- WITH CHECK：
```sql
( SELECT private.is_platform_university_manager() AS is_platform_university_manager)
```

### `korean_university_programs`

#### authenticated read published university programs

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（or、private.is_platform_catalog_manager）
- USING：
```sql
((is_published = true) OR ( SELECT private.is_platform_catalog_manager() AS is_platform_catalog_manager))
```
- WITH CHECK：
```sql
NULL
```

#### platform catalog managers manage university programs

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_catalog_manager）
- USING：
```sql
( SELECT private.is_platform_catalog_manager() AS is_platform_catalog_manager)
```
- WITH CHECK：
```sql
( SELECT private.is_platform_catalog_manager() AS is_platform_catalog_manager)
```

### `schools`

#### authenticated read published schools

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（or、private.is_platform_catalog_manager）
- USING：
```sql
((is_published = true) OR ( SELECT private.is_platform_catalog_manager() AS is_platform_catalog_manager))
```
- WITH CHECK：
```sql
NULL
```

#### platform catalog managers manage schools

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_catalog_manager）
- USING：
```sql
( SELECT private.is_platform_catalog_manager() AS is_platform_catalog_manager)
```
- WITH CHECK：
```sql
( SELECT private.is_platform_catalog_manager() AS is_platform_catalog_manager)
```

### `school_programs`

#### authenticated read published school programs

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（or、private.is_platform_catalog_manager）
- USING：
```sql
((is_published = true) OR ( SELECT private.is_platform_catalog_manager() AS is_platform_catalog_manager))
```
- WITH CHECK：
```sql
NULL
```

#### platform catalog managers manage school programs

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_catalog_manager）
- USING：
```sql
( SELECT private.is_platform_catalog_manager() AS is_platform_catalog_manager)
```
- WITH CHECK：
```sql
( SELECT private.is_platform_catalog_manager() AS is_platform_catalog_manager)
```

### `university_application_document_requirements`

#### authenticated read active university document requirements

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（or、private.is_platform_university_manager）
- USING：
```sql
((is_active = true) OR ( SELECT private.is_platform_university_manager() AS is_platform_university_manager))
```
- WITH CHECK：
```sql
NULL
```

#### platform university managers manage document requirements

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_university_manager）
- USING：
```sql
( SELECT private.is_platform_university_manager() AS is_platform_university_manager)
```
- WITH CHECK：
```sql
( SELECT private.is_platform_university_manager() AS is_platform_university_manager)
```

### `university_visa_application_requirements`

#### authenticated read active university visa requirements

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（or、private.is_platform_university_manager）
- USING：
```sql
((is_active = true) OR ( SELECT private.is_platform_university_manager() AS is_platform_university_manager))
```
- WITH CHECK：
```sql
NULL
```

#### platform university managers manage visa requirements

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_university_manager）
- USING：
```sql
( SELECT private.is_platform_university_manager() AS is_platform_university_manager)
```
- WITH CHECK：
```sql
( SELECT private.is_platform_university_manager() AS is_platform_university_manager)
```

### `student_university_assessments`

#### tenant assessments read own or staff

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text, 'ceo'::text, 'tenant_super_admin'::text])))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### tenant students create own university assessments

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('university_target'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

### `student_university_comparisons`

#### tenant students manage own university comparisons

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('university_comparison'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('university_comparison'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

### `student_university_targets`

#### tenant admins update university targets

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin_account() AS is_admin_account)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT is_admin_account() AS is_admin_account)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant students manage own university targets

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('university_target'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('university_target'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant targets read own or staff

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text, 'ceo'::text, 'tenant_super_admin'::text])))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### `student_application_documents`

#### tenant application documents read own or reviewers

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT current_user_can_manage_document_reviews() AS current_user_can_manage_document_reviews))))
```
- WITH CHECK：
```sql
NULL
```

#### tenant reviewers create application checklist items

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (target_id IS NOT NULL) AND ( SELECT current_user_can_manage_document_reviews() AS current_user_can_manage_document_reviews)))
```

#### tenant reviewers delete application checklist items

- 角色：`{authenticated}`
- 操作：`DELETE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (admin_locked_at IS NULL) AND ( SELECT current_user_can_manage_document_reviews() AS current_user_can_manage_document_reviews)))
```
- WITH CHECK：
```sql
NULL
```

#### tenant reviewers update application checklist items

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_can_manage_document_reviews() AS current_user_can_manage_document_reviews)))
```
- WITH CHECK：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_can_manage_document_reviews() AS current_user_can_manage_document_reviews)))
```

#### tenant students update own checklist status

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['preparing'::text, 'completed'::text, 'not_needed'::text])) AND student_feature_allowed('application_documents'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['preparing'::text, 'completed'::text, 'not_needed'::text])) AND student_feature_allowed('application_documents'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

### `document_review_events`

#### document review managers read events

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_can_manage_document_reviews() AS current_user_can_manage_document_reviews)))
```
- WITH CHECK：
```sql
NULL
```

### `document_review_admin_assignments`

#### document review assignments visible to platform or assignee

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((admin_id = ( SELECT auth.uid() AS uid)) OR (current_profile_role() = 'tenant_super_admin'::text))))
```
- WITH CHECK：
```sql
NULL
```

#### platform owner manages document review assignments

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_owner）
- USING：
```sql
( SELECT private.is_platform_owner() AS is_platform_owner)
```
- WITH CHECK：
```sql
( SELECT private.is_platform_owner() AS is_platform_owner)
```

### `student_visa_cases`

#### tenant students create own visa case

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('visa_tasks'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant students update own visa case

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('visa_tasks'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('visa_tasks'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant visa cases read own or managers

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT current_user_can_manage_visas() AS current_user_can_manage_visas)))
```
- WITH CHECK：
```sql
NULL
```

#### tenant visa managers manage cases

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_can_manage_visas() AS current_user_can_manage_visas))
```
- WITH CHECK：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_can_manage_visas() AS current_user_can_manage_visas))
```

### `student_visa_tasks`

#### tenant students create active own visa tasks

- 角色：`{authenticated}`
- 操作：`INSERT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND (is_archived = false) AND student_feature_allowed('visa_tasks'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant students update active own visa tasks

- 角色：`{authenticated}`
- 操作：`UPDATE`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND (is_archived = false) AND student_feature_allowed('visa_tasks'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND (is_archived = false) AND student_feature_allowed('visa_tasks'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### tenant visa managers manage tasks

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id 或租户辅助函数判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_can_manage_visas() AS current_user_can_manage_visas))
```
- WITH CHECK：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ( SELECT current_user_can_manage_visas() AS current_user_can_manage_visas))
```

#### tenant visa tasks read own or managers

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (((user_id = ( SELECT auth.uid() AS uid)) AND (is_archived = false)) OR ( SELECT current_user_can_manage_visas() AS current_user_can_manage_visas)))
```
- WITH CHECK：
```sql
NULL
```

### `student_visa_task_events`

#### tenant visa task events read own or managers

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT current_user_can_manage_visas() AS current_user_can_manage_visas)))
```
- WITH CHECK：
```sql
NULL
```

### `visa_admin_assignments`

#### platform owner manages visa assignments

- 角色：`{authenticated}`
- 操作：`ALL`
- 模式：`PERMISSIVE`
- 判断依据：其他：状态、角色或辅助函数（private.is_platform_owner）
- USING：
```sql
( SELECT private.is_platform_owner() AS is_platform_owner)
```
- WITH CHECK：
```sql
( SELECT private.is_platform_owner() AS is_platform_owner)
```

#### visa assignments visible to platform or assignee

- 角色：`{authenticated}`
- 操作：`SELECT`
- 模式：`PERMISSIVE`
- 判断依据：tenant_id（或租户辅助函数）与 user_id / student_id / admin_id / auth.uid() 同时判断
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((admin_id = ( SELECT auth.uid() AS uid)) OR (current_profile_role() = 'tenant_super_admin'::text))))
```
- WITH CHECK：
```sql
NULL
```

## 3. 有 tenant_id 但未启用 RLS 的表

- 无

## 4. RLS 判断依据分类统计

以下为按表进行的互斥分类。分类顺序为：无 policy → policy 原文显式引用 tenant_memberships → tenant 与用户身份同时出现 → tenant → 用户身份 → 其他。

### 通过显式 tenant_memberships 子查询 / join：3 张

- `permission_grants`
- `profiles`
- `tenant_memberships`

### 同时用 tenant 与用户身份：33 张

- `announcement_reads`
- `announcements`
- `chapter_test_attempts`
- `chapter_test_question_reviews`
- `conversation_practice_admin_assignments`
- `conversation_practice_progress`
- `course_ebook_progress`
- `digital_textbook_attempts`
- `digital_textbook_node_progress`
- `digital_textbook_preferences`
- `document_review_admin_assignments`
- `grade_center_admin_assignments`
- `grade_records`
- `grade_review_requests`
- `help_ticket_messages`
- `help_tickets`
- `learning_assignment_targets`
- `learning_record_admin_assignments`
- `learning_record_notes`
- `learning_submission_answers`
- `learning_submissions`
- `lesson_progress`
- `lesson_questions`
- `library_downloads`
- `library_favorites`
- `student_application_documents`
- `student_university_assessments`
- `student_university_comparisons`
- `student_university_targets`
- `student_visa_cases`
- `student_visa_task_events`
- `student_visa_tasks`
- `visa_admin_assignments`

### 直接用 tenant 判断：21 张

- `account_deletion_audit_logs`
- `account_management_audit_logs`
- `ai_token_usage`
- `conversation_practice_scenarios`
- `course_categories`
- `course_chapters`
- `course_content_audit_logs`
- `courses`
- `document_review_events`
- `grade_items`
- `help_articles`
- `learning_assignment_question_keys`
- `learning_assignment_questions`
- `learning_assignments`
- `lesson_resources`
- `lessons`
- `library_resources`
- `student_service_card_deletion_logs`
- `tenant_membership_audit_logs`
- `tenant_provisioned_accounts`
- `tenants`

### 直接用用户身份判断（不涉及 tenant）：3 张

- `question_bank_admin_assignments`
- `student_course_category_favorites`
- `student_course_category_learning_plans`

### 其他方式：30 张

- `assessment_paper_question_keys`
- `assessment_paper_questions`
- `assessment_papers`
- `chapter_homework_plans`
- `chapter_homework_questions`
- `chapter_homework_skill_settings`
- `chapter_test_questions`
- `chapter_tests`
- `digital_textbook_activities`
- `digital_textbook_chapters`
- `digital_textbook_modules`
- `digital_textbook_nodes`
- `digital_textbook_versions`
- `digital_textbooks`
- `exam_bank_material_secrets`
- `exam_bank_materials`
- `exam_bank_question_keys`
- `exam_bank_questions`
- `homework_bank_material_secrets`
- `homework_bank_materials`
- `homework_bank_question_keys`
- `homework_bank_questions`
- `korean_universities`
- `korean_university_programs`
- `permission_grant_audit_logs`
- `school_programs`
- `schools`
- `tenant_lifecycle_audit_logs`
- `university_application_document_requirements`
- `university_visa_application_requirements`

### RLS 已启用但无 policy：4 张

- `announcement_admin_assignments`
- `digital_textbook_activity_secrets`
- `help_center_admin_assignments`
- `library_admin_assignments`

### 租户辅助函数的表间关联原文

`private.current_tenant_id()`、`private.has_tenant_role(...)` 和 `private.is_tenant_member(...)` 均在函数内部查询 `public.tenant_memberships` 并连接 `public.tenants`。函数定义如下：

#### `private.current_tenant_id()`

```sql
CREATE OR REPLACE FUNCTION private.current_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select membership.tenant_id
  from public.tenant_memberships as membership
  join public.tenants as tenant on tenant.id = membership.tenant_id
  where membership.user_id = (select auth.uid())
    and membership.status = 'active'
    and tenant.status = 'active'
  order by membership.is_default desc, membership.created_at, membership.tenant_id
  limit 1;
$function$
```

#### `private.has_tenant_role(requested_tenant_id uuid, allowed_roles text[])`

```sql
CREATE OR REPLACE FUNCTION private.has_tenant_role(requested_tenant_id uuid, allowed_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.tenant_memberships as membership
    join public.tenants as tenant on tenant.id = membership.tenant_id
    where membership.tenant_id = requested_tenant_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and tenant.status = 'active'
      and membership.role = any(allowed_roles)
  );
$function$
```

#### `private.is_tenant_member(requested_tenant_id uuid)`

```sql
CREATE OR REPLACE FUNCTION private.is_tenant_member(requested_tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.tenant_memberships as membership
    join public.tenants as tenant on tenant.id = membership.tenant_id
    where membership.tenant_id = requested_tenant_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and tenant.status = 'active'
  );
$function$
```

## 5. auth.users / profiles 与 auth.uid() 特殊策略

### profiles 全部策略原文

#### Executives manage subordinate tenant member profiles

- 操作：`UPDATE`
- 判断依据：tenant_memberships 子查询 / join，同时包含用户身份字段或 auth.uid()
- USING：
```sql
(((EXISTS ( SELECT 1
   FROM tenant_memberships membership
  WHERE ((membership.user_id = profiles.id) AND (membership.tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id))))) AND (role <> 'tenant_operator'::text) AND (( SELECT is_owner_account() AS is_owner_account) OR (( SELECT is_executive_account() AS is_executive_account) AND (role <> ALL (ARRAY['tenant_super_admin'::text, 'ceo'::text]))))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((EXISTS ( SELECT 1
   FROM tenant_memberships membership
  WHERE ((membership.user_id = profiles.id) AND (membership.tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id))))) AND (role <> 'tenant_operator'::text) AND (( SELECT is_owner_account() AS is_owner_account) OR (( SELECT is_executive_account() AS is_executive_account) AND (role <> ALL (ARRAY['tenant_super_admin'::text, 'ceo'::text]))))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### Executives read profiles of their tenant members

- 操作：`SELECT`
- 判断依据：tenant_memberships 子查询 / join，同时包含用户身份字段或 auth.uid()
- USING：
```sql
((( SELECT is_executive_account() AS is_executive_account) AND (EXISTS ( SELECT 1
   FROM tenant_memberships membership
  WHERE ((membership.user_id = profiles.id) AND (membership.tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)))))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### Users can update own profile

- 操作：`UPDATE`
- 判断依据：user_id / student_id / admin_id / auth.uid() 判断，不直接使用 tenant_id
- USING：
```sql
((( SELECT auth.uid() AS uid) = id) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
((( SELECT auth.uid() AS uid) = id) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### Users can view own profile

- 操作：`SELECT`
- 判断依据：user_id / student_id / admin_id / auth.uid() 判断，不直接使用 tenant_id
- USING：
```sql
((( SELECT auth.uid() AS uid) = id) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

### policy 原文中直接出现 auth.uid() 的策略：59 条

#### `announcement_reads` — announcement reads visible to reader or managers

- 操作：`SELECT`
- USING：
```sql
((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (current_profile_role() = ANY (ARRAY['tenant_super_admin'::text, 'ceo'::text])) AND ( SELECT is_active_account() AS is_active_account)))
```
- WITH CHECK：
```sql
NULL
```

#### `announcements` — platform or tenant owners create announcements

- 操作：`INSERT`
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
((created_by = ( SELECT auth.uid() AS uid)) AND (updated_by = ( SELECT auth.uid() AS uid)) AND (((scope = 'platform'::text) AND (tenant_id IS NULL) AND ( SELECT private.is_platform_owner() AS is_platform_owner)) OR ((scope = 'tenant'::text) AND (tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (current_profile_role() = ANY (ARRAY['tenant_super_admin'::text, 'ceo'::text])) AND ( SELECT is_active_account() AS is_active_account))))
```

#### `chapter_test_attempts` — students view own course test attempts

- 操作：`SELECT`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
NULL
```

#### `chapter_test_question_reviews` — students add own course question reviews

- 操作：`INSERT`
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```

#### `chapter_test_question_reviews` — students refresh own course question reviews

- 操作：`UPDATE`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```

#### `chapter_test_question_reviews` — students remove own course question reviews

- 操作：`DELETE`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
NULL
```

#### `chapter_test_question_reviews` — students view own course question reviews

- 操作：`SELECT`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
NULL
```

#### `conversation_practice_admin_assignments` — tenant conversation assignments visible to owner or assignee

- 操作：`SELECT`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_is_conversation_practice_owner() AS current_user_is_conversation_practice_owner) OR (admin_id = ( SELECT auth.uid() AS uid)))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### `conversation_practice_progress` — tenant managers or owners read conversation progress

- 操作：`SELECT`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_manage_conversation_practice() AS current_user_can_manage_conversation_practice) OR ((user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('conversation_course'::text))))
```
- WITH CHECK：
```sql
NULL
```

#### `course_ebook_progress` — students add own ebook progress

- 操作：`INSERT`
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```

#### `course_ebook_progress` — students update own ebook progress

- 操作：`UPDATE`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```

#### `course_ebook_progress` — students view own ebook progress

- 操作：`SELECT`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
NULL
```

#### `digital_textbook_attempts` — students create own textbook attempts

- 操作：`INSERT`
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
((student_id = auth.uid()) AND (tenant_id = private.current_tenant_id()))
```

#### `digital_textbook_attempts` — students read own textbook attempts

- 操作：`SELECT`
- USING：
```sql
((student_id = auth.uid()) AND private.is_tenant_member(tenant_id))
```
- WITH CHECK：
```sql
NULL
```

#### `digital_textbook_node_progress` — students manage own textbook progress

- 操作：`ALL`
- USING：
```sql
((student_id = auth.uid()) AND private.is_tenant_member(tenant_id))
```
- WITH CHECK：
```sql
((student_id = auth.uid()) AND (tenant_id = private.current_tenant_id()))
```

#### `digital_textbook_preferences` — students manage own textbook preferences

- 操作：`ALL`
- USING：
```sql
((student_id = auth.uid()) AND private.is_tenant_member(tenant_id))
```
- WITH CHECK：
```sql
((student_id = auth.uid()) AND (tenant_id = private.current_tenant_id()))
```

#### `document_review_admin_assignments` — document review assignments visible to platform or assignee

- 操作：`SELECT`
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((admin_id = ( SELECT auth.uid() AS uid)) OR (current_profile_role() = 'tenant_super_admin'::text))))
```
- WITH CHECK：
```sql
NULL
```

#### `grade_center_admin_assignments` — tenant grade assignments visible to owner or assignee

- 操作：`SELECT`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_is_grade_center_owner() AS current_user_is_grade_center_owner) OR (admin_id = ( SELECT auth.uid() AS uid)))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### `grade_records` — tenant managers or owners read grade records

- 操作：`SELECT`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_manage_grade_center() AS current_user_can_manage_grade_center) OR ((student_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM grade_items item
  WHERE ((item.id = grade_records.item_id) AND (item.status = 'published'::text))))))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### `grade_review_requests` — tenant managers or owners read grade reviews

- 操作：`SELECT`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_manage_grade_center() AS current_user_can_manage_grade_center) OR (student_id = ( SELECT auth.uid() AS uid)))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### `help_ticket_messages` — tenant handlers or owners read help messages

- 操作：`SELECT`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_handle_help_tickets() AS current_user_can_handle_help_tickets) OR (EXISTS ( SELECT 1
   FROM help_tickets ticket
  WHERE ((ticket.id = help_ticket_messages.ticket_id) AND (ticket.tenant_id = help_ticket_messages.tenant_id) AND (ticket.user_id = ( SELECT auth.uid() AS uid)))))))
```
- WITH CHECK：
```sql
NULL
```

#### `help_tickets` — tenant handlers or owners read help tickets

- 操作：`SELECT`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_handle_help_tickets() AS current_user_can_handle_help_tickets) OR (user_id = ( SELECT auth.uid() AS uid))))
```
- WITH CHECK：
```sql
NULL
```

#### `learning_assignment_targets` — tenant managers or assigned students read targets

- 操作：`SELECT`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_is_assignment_manager() AS current_user_is_assignment_manager) OR ((student_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('learning_assignments'::text))))
```
- WITH CHECK：
```sql
NULL
```

#### `learning_record_admin_assignments` — tenant learning record assignments visible to owner or assignee

- 操作：`SELECT`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_is_learning_record_owner() AS current_user_is_learning_record_owner) OR (admin_id = ( SELECT auth.uid() AS uid)))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### `learning_record_notes` — tenant managers or students read learning record notes

- 操作：`SELECT`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_can_manage_learning_records() AS current_user_can_manage_learning_records) OR ((student_id = ( SELECT auth.uid() AS uid)) AND (visibility = 'student_visible'::text) AND (status = 'active'::text)))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### `learning_submission_answers` — tenant managers or owners read submission answers

- 操作：`SELECT`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_is_assignment_manager() AS current_user_is_assignment_manager) OR (student_feature_allowed('learning_assignments'::text) AND (EXISTS ( SELECT 1
   FROM learning_submissions submission
  WHERE ((submission.id = learning_submission_answers.submission_id) AND (submission.student_id = ( SELECT auth.uid() AS uid))))))))
```
- WITH CHECK：
```sql
NULL
```

#### `learning_submissions` — tenant managers or owners read submissions

- 操作：`SELECT`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (( SELECT current_user_is_assignment_manager() AS current_user_is_assignment_manager) OR ((student_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('learning_assignments'::text))))
```
- WITH CHECK：
```sql
NULL
```

#### `lesson_progress` — tenant users manage own lesson progress

- 操作：`ALL`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### `lesson_questions` — tenant students insert own lesson questions

- 操作：`INSERT`
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### `lesson_questions` — tenant students update own open lesson questions

- 操作：`UPDATE`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)) AND (status <> 'closed'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid)) AND (status <> 'closed'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### `lesson_questions` — tenant students view own lesson questions

- 操作：`SELECT`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (student_id = ( SELECT auth.uid() AS uid))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### `library_downloads` — platform owner or user reads library downloads

- 操作：`SELECT`
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid))))
```
- WITH CHECK：
```sql
NULL
```

#### `library_favorites` — users read own platform library favorites

- 操作：`SELECT`
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid))))
```
- WITH CHECK：
```sql
NULL
```

#### `permission_grants` — permission grants visible to authorized viewers

- 操作：`SELECT`
- USING：
```sql
((subject_user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_owner() AS is_platform_owner) OR (EXISTS ( SELECT 1
   FROM tenant_memberships membership
  WHERE ((membership.user_id = ( SELECT auth.uid() AS uid)) AND (membership.tenant_id = permission_grants.tenant_id) AND (membership.status = 'active'::text) AND (membership.role = ANY (ARRAY['tenant_super_admin'::text, 'ceo'::text]))))))
```
- WITH CHECK：
```sql
NULL
```

#### `profiles` — Users can update own profile

- 操作：`UPDATE`
- USING：
```sql
((( SELECT auth.uid() AS uid) = id) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
((( SELECT auth.uid() AS uid) = id) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### `profiles` — Users can view own profile

- 操作：`SELECT`
- USING：
```sql
((( SELECT auth.uid() AS uid) = id) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### `question_bank_admin_assignments` — question bank assignments visible to owner or assignee

- 操作：`SELECT`
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR (admin_id = ( SELECT auth.uid() AS uid)))
```
- WITH CHECK：
```sql
NULL
```

#### `student_application_documents` — tenant application documents read own or reviewers

- 操作：`SELECT`
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT current_user_can_manage_document_reviews() AS current_user_can_manage_document_reviews))))
```
- WITH CHECK：
```sql
NULL
```

#### `student_application_documents` — tenant students update own checklist status

- 操作：`UPDATE`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['preparing'::text, 'completed'::text, 'not_needed'::text])) AND student_feature_allowed('application_documents'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['preparing'::text, 'completed'::text, 'not_needed'::text])) AND student_feature_allowed('application_documents'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### `student_course_category_favorites` — users add own course category favorites

- 操作：`INSERT`
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(user_id = auth.uid())
```

#### `student_course_category_favorites` — users read own course category favorites

- 操作：`SELECT`
- USING：
```sql
(user_id = auth.uid())
```
- WITH CHECK：
```sql
NULL
```

#### `student_course_category_favorites` — users remove own course category favorites

- 操作：`DELETE`
- USING：
```sql
(user_id = auth.uid())
```
- WITH CHECK：
```sql
NULL
```

#### `student_course_category_learning_plans` — users add own course learning plans

- 操作：`INSERT`
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(user_id = auth.uid())
```

#### `student_course_category_learning_plans` — users read own course learning plans

- 操作：`SELECT`
- USING：
```sql
(user_id = auth.uid())
```
- WITH CHECK：
```sql
NULL
```

#### `student_course_category_learning_plans` — users remove own course learning plans

- 操作：`DELETE`
- USING：
```sql
(user_id = auth.uid())
```
- WITH CHECK：
```sql
NULL
```

#### `student_university_assessments` — tenant assessments read own or staff

- 操作：`SELECT`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text, 'ceo'::text, 'tenant_super_admin'::text])))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### `student_university_assessments` — tenant students create own university assessments

- 操作：`INSERT`
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('university_target'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### `student_university_comparisons` — tenant students manage own university comparisons

- 操作：`ALL`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('university_comparison'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('university_comparison'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### `student_university_targets` — tenant students manage own university targets

- 操作：`ALL`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('university_target'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('university_target'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### `student_university_targets` — tenant targets read own or staff

- 操作：`SELECT`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text, 'ceo'::text, 'tenant_super_admin'::text])))) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### `student_visa_cases` — tenant students create own visa case

- 操作：`INSERT`
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('visa_tasks'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### `student_visa_cases` — tenant students update own visa case

- 操作：`UPDATE`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('visa_tasks'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND student_feature_allowed('visa_tasks'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### `student_visa_cases` — tenant visa cases read own or managers

- 操作：`SELECT`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT current_user_can_manage_visas() AS current_user_can_manage_visas)))
```
- WITH CHECK：
```sql
NULL
```

#### `student_visa_task_events` — tenant visa task events read own or managers

- 操作：`SELECT`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT current_user_can_manage_visas() AS current_user_can_manage_visas)))
```
- WITH CHECK：
```sql
NULL
```

#### `student_visa_tasks` — tenant students create active own visa tasks

- 操作：`INSERT`
- USING：
```sql
NULL
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND (is_archived = false) AND student_feature_allowed('visa_tasks'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### `student_visa_tasks` — tenant students update active own visa tasks

- 操作：`UPDATE`
- USING：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND (is_archived = false) AND student_feature_allowed('visa_tasks'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
(((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (user_id = ( SELECT auth.uid() AS uid)) AND (is_archived = false) AND student_feature_allowed('visa_tasks'::text)) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```

#### `student_visa_tasks` — tenant visa tasks read own or managers

- 操作：`SELECT`
- USING：
```sql
((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND (((user_id = ( SELECT auth.uid() AS uid)) AND (is_archived = false)) OR ( SELECT current_user_can_manage_visas() AS current_user_can_manage_visas)))
```
- WITH CHECK：
```sql
NULL
```

#### `tenant_memberships` — members managers or platform tenant managers read memberships

- 操作：`SELECT`
- USING：
```sql
((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.has_tenant_role(tenant_memberships.tenant_id, ARRAY['ceo'::text, 'tenant_super_admin'::text]) AS has_tenant_role) OR ( SELECT private.is_platform_tenant_manager() AS is_platform_tenant_manager) OR ( SELECT private.is_platform_owner() AS is_platform_owner))
```
- WITH CHECK：
```sql
NULL
```

#### `visa_admin_assignments` — visa assignments visible to platform or assignee

- 操作：`SELECT`
- USING：
```sql
(( SELECT private.is_platform_owner() AS is_platform_owner) OR ((tenant_id = ( SELECT private.current_tenant_id() AS current_tenant_id)) AND ((admin_id = ( SELECT auth.uid() AS uid)) OR (current_profile_role() = 'tenant_super_admin'::text))))
```
- WITH CHECK：
```sql
NULL
```
