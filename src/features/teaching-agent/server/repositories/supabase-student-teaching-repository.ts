import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertExecution, withSignal } from '../../../agent-core/runtime/deadline.ts';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import type { RuntimeExecutionContext } from '../../../agent-core/contracts/server.ts';
import { independentlyUnlocked, studentTeachingFeatureAllowed, validEnrollment, visibleInTenant } from '../policies/access-rules.ts';
import { teachingRef } from '../selection/references.ts';
import type { StudentSelectionLocator, StudentTeachingScope, TeachingLocale } from '../selection/selection-types.ts';
import type { PublishedNode, SavedTeachingState, StudentAuthIdentity, StudentContentRecord, StudentTeachingReadRepository } from './contracts.ts';

type Row = Record<string, unknown>;
const lockFields = 'unlock_mode,is_manually_locked,available_from';
const visibilityFields = 'content_scope,tenant_id';
const koreanApp = '10000000-0000-4000-8000-000000000001';
function str(value: unknown): string { if (typeof value !== 'string' || !value) throw new CoreError('PERSISTENCE_FAILED'); return value; }
function obj(value: unknown): Row { return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}; }
function localized(value: unknown, locale: TeachingLocale): string {
  if (typeof value === 'string') return value;
  const record = obj(value); const text = record[locale] ?? record['zh-CN'];
  return typeof text === 'string' ? text : '';
}
function optionalString(value: unknown): string | null { return typeof value === 'string' ? value : null; }

/** Construct ONLY with the authenticated user's SSR client. No admin fallback. */
export class SupabaseStudentTeachingReadRepository implements StudentTeachingReadRepository {
  private readonly client: Pick<SupabaseClient, 'from'>;
  constructor(client: Pick<SupabaseClient, 'from'>) { this.client = client; }

  private async one(table: string, columns: string, filters: Record<string, string | boolean>,
    execution: RuntimeExecutionContext, latest?: string): Promise<Row | null> {
    assertExecution(execution.signal, execution.deadlineAt);
    let query = this.client.from(table).select(columns);
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    if (latest) query = query.order(latest, { ascending: false }).limit(1);
    // Without a latest selector, two visible matches are ambiguity, not permission.
    const result = await withSignal(Promise.resolve(query.limit(latest ? 1 : 2).abortSignal(execution.signal).maybeSingle()), execution.signal);
    assertExecution(execution.signal, execution.deadlineAt);
    if (result.error) throw new CoreError('PERSISTENCE_FAILED'); // Never include DB messages/rows.
    return result.data ? obj(result.data) : null;
  }

  async readAuthorizedContent(identity: StudentAuthIdentity, locator: StudentSelectionLocator,
    execution: RuntimeExecutionContext): Promise<StudentContentRecord | null> {
    const { actorId, tenantId } = identity;
    const now = Date.now();
    const profile = await this.one('profiles', 'id,status,role,global_role', { id: actorId }, execution);
    if (!profile || profile.status !== 'active' || (profile.global_role != null && profile.global_role !== 'member')
      || ['tenant_operator', 'platform_super_admin', 'platform_course_inspector'].includes(String(profile.role))) return null;
    const membership = await this.one('tenant_memberships', 'tenant_id,user_id,role,status,membership_tier',
      { tenant_id: tenantId, user_id: actorId, status: 'active', role: 'student' }, execution);
    const tenant = await this.one('tenants', 'id,status', { id: tenantId, status: 'active' }, execution);
    if (!membership || !tenant) return null;

    const lesson = await this.one('lessons', `id,course_id,title,is_published,${visibilityFields},${lockFields}`,
      { id: locator.lessonId, is_published: true }, execution);
    if (!lesson || !visibleInTenant(lesson, tenantId) || !independentlyUnlocked(lesson, now)) return null;
    const course = await this.one('courses', `id,category_id,student_app_id,is_published,${visibilityFields},${lockFields}`,
      { id: str(lesson.course_id), is_published: true }, execution);
    if (!course || !visibleInTenant(course, tenantId) || !independentlyUnlocked(course, now)
      || course.student_app_id !== koreanApp) return null;
    // Verify the catalog ancestor chain; cycles and unsupported depth fail closed.
    let categoryId: string | null = str(course.category_id);
    for (let depth = 0; categoryId && depth < 8; depth++) {
      const category = await this.one('course_categories', `id,parent_id,is_published,${visibilityFields}`,
        { id: categoryId, is_published: true }, execution);
      if (!category || !visibleInTenant(category, tenantId)) return null;
      categoryId = optionalString(category.parent_id);
    }
    if (categoryId) return null;
    const app = await this.one('tenant_student_apps', 'tenant_id,app_id,is_enabled,status',
      { tenant_id: tenantId, app_id: koreanApp, is_enabled: true, status: 'active' }, execution);
    const enrollment = await this.one('student_app_enrollments', 'tenant_id,student_id,app_id,status,starts_at,ends_at',
      { tenant_id: tenantId, student_id: actorId, app_id: koreanApp }, execution);
    if (!app || !enrollment || !validEnrollment(enrollment as { status: unknown; starts_at: unknown; ends_at: unknown }, now)) return null;

    const textbook = await this.one('digital_textbooks', 'id,lesson_id,student_app_id,agent_profile_id,status,updated_at',
      { lesson_id: locator.lessonId, student_app_id: koreanApp, status: 'published' }, execution);
    if (!textbook) return null;
    const textbookVersion = await this.one('digital_textbook_versions', 'id,textbook_id,version_number,status,updated_at',
      { textbook_id: str(textbook.id), status: 'published' }, execution, 'version_number');
    const textbookModule = await this.one('digital_textbook_modules', 'id,chapter_id,title,updated_at', { id: locator.moduleId }, execution);
    if (!textbookVersion || !textbookModule) return null;
    const chapter = await this.one('digital_textbook_chapters', 'id,version_id,chapter_test_id,status,updated_at',
      { id: str(textbookModule.chapter_id), version_id: str(textbookVersion.id), status: 'published' }, execution);
    if (!chapter) return null;
    if (chapter.chapter_test_id != null) {
      const catalogChapter = await this.one('course_chapters', `id,lesson_id,is_published,${visibilityFields},${lockFields}`,
        { lesson_id: locator.lessonId, chapter_test_id: str(chapter.chapter_test_id), is_published: true }, execution);
      if (!catalogChapter || !visibleInTenant(catalogChapter, tenantId) || !independentlyUnlocked(catalogChapter, now)) return null;
    }
    const agentProfile = await this.one('learning_agent_profiles', 'id,access_feature,status',
      { id: str(textbook.agent_profile_id), status: 'published' }, execution);
    if (!agentProfile || !studentTeachingFeatureAllowed(membership.membership_tier, agentProfile.access_feature)) return null;
    const teachingLesson = await this.one('learning_agent_lessons', 'id,module_id,agent_profile_id,objectives,status,updated_at',
      { module_id: locator.moduleId, agent_profile_id: str(agentProfile.id), status: 'published' }, execution);
    if (!teachingLesson) return null;
    const scriptVersion = await this.one('learning_agent_script_versions', 'id,lesson_id,version_number,status,updated_at',
      { lesson_id: str(teachingLesson.id), status: 'published' }, execution);
    if (!scriptVersion || !Number.isInteger(scriptVersion.version_number)) return null;
    const scope: StudentTeachingScope = {
      actorId, tenantId, appId: koreanApp, courseId: str(course.id), lessonId: locator.lessonId,
      moduleId: locator.moduleId, textbookId: str(textbook.id), textbookVersionId: str(textbookVersion.id),
      chapterId: str(chapter.id), teachingLessonId: str(teachingLesson.id), agentProfileId: str(agentProfile.id),
      scriptVersionId: str(scriptVersion.id), nodeId: locator.nodeId, segmentIndex: locator.segmentIndex,
      teachingSessionId: locator.teachingSessionId, locale: locator.locale,
      scopeRef: teachingRef('scope', [actorId, tenantId, koreanApp, course.id, lesson.id, textbookModule.id, locator.teachingSessionId ?? null]),
    };
    // Session checks are done by policy before any verified binding is issued.
    const node = await this.readPublishedNode(scope, locator.nodeId, execution);
    const objectiveValue = obj(teachingLesson.objectives)[locator.locale] ?? obj(teachingLesson.objectives)['zh-CN'];
    const objectives = Array.isArray(objectiveValue) ? objectiveValue.filter((v): v is string => typeof v === 'string')
      : typeof objectiveValue === 'string' ? [objectiveValue] : [];
    const lessonTitle = localized(lesson.title, locator.locale), moduleTitle = localized(textbookModule.title, locator.locale);
    return { scope, node, lessonTitle, moduleTitle, objectives, scriptVersionNumber: scriptVersion.version_number as number,
      revisionParts: [course.id, lesson.id, lessonTitle, moduleTitle, objectives, textbook.id, textbook.updated_at,
        agentProfile.id, agentProfile.access_feature,
        textbookVersion.id, textbookVersion.updated_at, chapter.id, chapter.updated_at, textbookModule.id, textbookModule.updated_at,
        teachingLesson.id, teachingLesson.updated_at, scriptVersion.id, scriptVersion.updated_at, scriptVersion.version_number],
    };
  }

  async readPublishedNode(scope: StudentTeachingScope, nodeId: string, execution: RuntimeExecutionContext): Promise<PublishedNode | null> {
    // Parent publication is checked on every read; RLS is an additional boundary.
    const version = await this.one('learning_agent_script_versions', 'id',
      { id: scope.scriptVersionId, lesson_id: scope.teachingLessonId, status: 'published' }, execution);
    if (!version) return null;
    const row = await this.one('student_learning_agent_script_nodes',
      'id,script_version_id,updated_at,teacher_script,segments,video_mode',
      { id: nodeId, script_version_id: scope.scriptVersionId }, execution);
    if (!row) return null;
    const script: PublishedNode['script'] = {};
    for (const locale of ['zh-CN', 'ko-KR'] as const) {
      const value = obj(row.teacher_script)[locale];
      if (value != null && typeof value !== 'string') throw new CoreError('PERSISTENCE_FAILED');
      if (typeof value === 'string') script[locale] = value;
    }
    return { id: str(row.id), versionId: str(row.script_version_id), updatedAt: str(row.updated_at),
      script, segments: row.segments, videoMode: row.video_mode === 'video' ? 'video' : 'legacy' };
  }

  async readOwnSession(scope: StudentTeachingScope, execution: RuntimeExecutionContext): Promise<SavedTeachingState | null> {
    if (!scope.teachingSessionId) return null;
    const row = await this.one('learning_agent_sessions',
      'id,script_version_id,current_node_id,status,updated_at,segment_node:teaching_state->>scriptSegmentNodeId,segment_index:teaching_state->scriptSegmentIndex,phase_node:teaching_state->>teachingTurnNodeId,phase:teaching_state->>teachingTurnPhase',
      { id: scope.teachingSessionId, tenant_id: scope.tenantId, student_id: scope.actorId,
        lesson_id: scope.teachingLessonId, agent_profile_id: scope.agentProfileId, status: 'active' }, execution);
    if (!row) return null;
    return { id: str(row.id), scriptVersionId: optionalString(row.script_version_id), nodeId: optionalString(row.current_node_id),
      segmentNodeId: optionalString(row.segment_node), segmentIndex: typeof row.segment_index === 'number' && Number.isInteger(row.segment_index) ? row.segment_index : null,
      phaseNodeId: optionalString(row.phase_node), phase: optionalString(row.phase), status: 'active', updatedAt: str(row.updated_at) };
  }
}
