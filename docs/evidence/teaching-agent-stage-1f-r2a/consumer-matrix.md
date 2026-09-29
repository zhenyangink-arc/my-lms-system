# Pre-change consumer inventory

Captured before R2A policy edits. Full call-site list: consumer-inventory.txt.

|Consumer|Identity / authorization|Surface|Remediation|
|---|---|---|---|
|teaching-agent/server/repositories/supabase-student-teaching-repository.ts|Student SSR JWT + StudentTeachingPolicy|module/version/node SELECT|Use safe node view; retain JWT|
|teaching-agent/server/page-projection/lesson-slots.tsx|Student SSR JWT + rollout + full policy before pins|version/node candidate SELECT|Use safe node view|
|lib/smart-digital-textbook.ts|createAdminClient; upstream authenticated lesson page|module/version/node display reads|Preserve authorized server path; no direct JWT raw dependency|
|learning-agent-script-studio/service.ts, teacher-video-actions.ts|requirePlatformOwner then admin|raw authoring configuration|Preserve owner policy and server path|
|app/dashboard/admin/teaching-scripts/actions.ts, digital-textbook/actions.ts|requirePlatformOwner then admin/RPC|authoring writes|Unchanged|
|digital-textbook/api/service.ts, growth-toolbox/api/service.ts|requireActiveUser + requireTenantAppCapability(manageContent) for non-global owner; admin|catalog/module reads|Keep existing management policy and server capability path|
|chapter-practice/api/service.ts, management-service.ts|requirePlatformOwner + admin|module navigation|Unchanged|
|lib/learning-agent-script-runtime.ts; api/learning-agent/respond,events,speech routes|active-user/tenant/session or owner checks + admin|legacy server runtime|Not dependent on authenticated raw RLS; application checks remain separate|
|learning-agent preview routes / preview page|platform owner + admin|draft preview|Unchanged|
|smart-textbook-runtime/server/production-teacher-agent.server.ts; recording-domain-gateway.server.ts|server authorized pinned session/scope + admin|runtime script/module|Unchanged|
|smart-textbook-publishing/capture.server.ts; smart-textbook-legacy-adapter/reader.server.ts|authorized publishing/source capture, supplied server client|frozen raw authoring snapshot|Unchanged|
|tests/fixtures/teaching-agent/student-domain.mjs|synthetic memory/PG repository adapter|projected node contract|Adapt test surface; full real PostgREST is security authority|

Teacher/Admin currently have app-assigned public read eligibility, not raw Script Studio authoring permission. Raw Script Studio requires platform owner. Preserve assigned Teacher/Admin public safe reads and owner raw read/write. Modules retain the existing standard question-bank management privilege, without adding it to raw script nodes.

Ancestry: course_categories(parent_id recursive) -> courses(category_id,tenant_id,content_scope,student_app_id) -> lessons(course_id,tenant_id,content_scope) -> digital_textbooks(lesson_id,student_app_id,agent_profile_id) -> digital_textbook_versions(textbook_id) -> digital_textbook_chapters(version_id) -> digital_textbook_modules(chapter_id) -> learning_agent_lessons(module_id,agent_profile_id) -> learning_agent_script_versions(lesson_id) -> learning_agent_script_nodes(script_version_id).

No direct tenant_id on textbook/module/script rows. Platform-global requires platform scope + NULL tenant across visible ancestors; tenant rows require current active tenant. Publication alone is insufficient. Existing owner/manager bypasses are explicit retained contracts; ordinary authenticated users receive minimum public projection only.
