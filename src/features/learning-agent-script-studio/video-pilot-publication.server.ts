import 'server-only';
import { z } from 'zod';
import { requirePlatformOwner } from '../../lib/admin';
import { createAdminClient } from '../../lib/supabase/admin';
import { getNativeVideoPromotionSelection, getLegacyVersionPin } from '../../lib/smart-textbook-publishing/course-release-selection.server.ts';
import { readVideoPilotDraft } from './video-pilot-authoring.ts';
import { readFixedSelectedVideoSnapshot } from '../../lib/smart-textbook-publishing/fixed-selected-media.server.ts';
import { projectNativeVideoPublicationCapture, packageNativeVideoPublication } from '../../lib/smart-textbook-publishing/native-video-publication.server.ts';
import { nativeVideoSourceSchema } from '../../lib/smart-textbook-publishing/native-video-source.server.ts';
import { dependencyTables, dependencyCaptureSchema } from '../../lib/smart-textbook-publishing/capture.server.ts';
import { compileNativeVideoPublication } from '../../lib/smart-textbook-publishing/publisher.server.ts';
import { publicationRepository } from '../../lib/smart-textbook-publishing/repository.server.ts';
import { canonical, digest } from '../../lib/smart-textbook-legacy-adapter/identity.server.ts';
import { scopeSchema } from '../../lib/smart-textbook-publishing/artifact.server.ts';

const inputSchema = z.strictObject({sourceNodeId:z.uuid(),sourceScriptVersionId:z.uuid(),
  expectedToken:z.string().regex(/^[a-f0-9]{32}$/),changeNote:z.string().max(500)});
export type NativeVideoPromotionInput = z.infer<typeof inputSchema>;
export type NativeVideoPromotionReport = {state:'blocked'|'ready'|'source-created'|'published';message:string;expectedToken?:string};
const rowSchema = z.record(z.string(),z.json());

async function inspect(input:unknown) {
  const auth = await requirePlatformOwner(), request = inputSchema.parse(input);
  const selection = getNativeVideoPromotionSelection(request.sourceNodeId,request.sourceScriptVersionId);
  if (!selection || selection.phase !== 'prepared' || getLegacyVersionPin(selection.textbookId) !== selection.legacyVersionId)
    throw Error('请先在所有服务实例安装本章的旧版本固定配置和待发布配置。');
  const {data:snapshot,error} = await auth.supabase.rpc('teaching_script_publish_snapshot',{p_version_id:request.sourceScriptVersionId});
  if (error || snapshot?.token !== request.expectedToken || !Array.isArray(snapshot.nodes)) throw Error('草稿已变化或无法读取，请重新检查。');
  const node = rowSchema.parse(snapshot.nodes.find((n:{id?:string}) => n.id === request.sourceNodeId));
  const pilot = readVideoPilotDraft(node.configuration);
  if (pilot.kind !== 'pilot' || pilot.draft.media?.kind !== 'selected-local' || pilot.draft.cue?.atSeconds === null
    || pilot.draft.cue?.atSeconds === undefined || !pilot.draft.cue.activityId || pilot.draft.cue.atSeconds >= 30
    || node.reference_activity_id !== pilot.draft.cue.activityId)
    throw Error('请保存完整的所选视频、暂停时间和当前步骤中的单选题；旧脚本的呈现配置不会复制到新版本。');
  const configuration = z.record(z.string(),z.json()).parse(node.configuration);
  const hasActiveKind = (value:unknown) => Boolean(value && typeof value === 'object' && 'kind' in value && value.kind && value.kind !== 'none');
  if (Object.hasOwn(configuration,'videoPilotPublication') || hasActiveKind(configuration.interaction) || hasActiveKind(configuration.studentTask))
    throw Error('当前小节含有不支持的互动或发布标记。');
  const admin = createAdminClient();
  const read = async(table:string,key:string,id:unknown) => {
    if (typeof id !== 'string') throw Error('来源关联不完整。');
    const result = await admin.from(table).select('*').eq(key,id).single();
    if (result.error) throw Error('无法完整读取来源及私有答案。');
    return rowSchema.parse(result.data);
  };
  const script = await read('learning_agent_script_versions','id',request.sourceScriptVersionId);
  const lesson = await read('learning_agent_lessons','id',script.lesson_id);
  const activity = await read('digital_textbook_activities','id',pilot.draft.cue.activityId);
  const secret = await read('digital_textbook_activity_secrets','activity_id',activity.id);
  const executionNode = await read('digital_textbook_nodes','id',activity.node_id);
  const moduleRow = await read('digital_textbook_modules','id',lesson.module_id);
  const chapter = await read('digital_textbook_chapters','id',moduleRow.chapter_id);
  const version = await read('digital_textbook_versions','id',chapter.version_id);
  const book = await read('digital_textbooks','id',version.textbook_id);
  const profile = await read('learning_agent_profiles','id',book.agent_profile_id);
  const interaction = await admin.from('learning_agent_node_interaction_secrets').select('node_id').eq('node_id',request.sourceNodeId);
  if (interaction.error || !Array.isArray(interaction.data) || interaction.data.length || script.status !== 'draft'
    || executionNode.module_id !== moduleRow.id || book.id !== selection.textbookId || book.slug !== selection.textbookSlug
    || book.lesson_id !== selection.lessonId || version.id !== selection.legacyVersionId || version.status !== 'published'
    || chapter.chapter_number !== selection.chapterNumber || chapter.slug !== selection.chapterSlug
    || secret.transcript_ko != null || secret.audio_object_key != null)
    throw Error('来源、旧版本或单选题关联不符合独立发布条件。');
  // Origin canonical v1 is shared with the SQL helper: complete saved rows,
  // ASCII object keys, ordered arrays, UTF8 strings, finite safe JSON numbers.
  const origin = {node,activity,secret,associations:{book,version,chapter,module:moduleRow,executionNode,lesson,script,profile}};
  const checkCanonical = (value:unknown):void => {
    if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) >= 9007199254740992)) throw Error('来源数字不受支持。');
    if (Array.isArray(value)) value.forEach(checkCanonical);
    else if (value && typeof value === 'object') for (const [key,child] of Object.entries(value)) {
      if (!/^[ -~]+$/.test(key)) throw Error('来源字段不受支持。');checkCanonical(child);
    }
  };
  checkCanonical(origin);
  const originDigest = digest(origin), {proof} = await readFixedSelectedVideoSnapshot();
  const ids = selection.reserved, scope = {textbookId:selection.textbookId,versionId:ids.versionId,chapterId:ids.chapterId};
  // In-memory prospective projection checks A's exact compiler domain. It is
  // never persisted or returned as a certified saved capture/snapshot.
  const source = nativeVideoSourceSchema.parse({contract:'video-pilot-publication-source/1',mode:'video',state:'promoted',
    origin:{teachingNodeId:request.sourceNodeId,scriptVersionId:request.sourceScriptVersionId,draftDigest:originDigest},
    approvedBy:auth.user.id,approvedAt:new Date().toISOString(),media:proof,
    cue:{...pilot.draft.cue,activityId:ids.activityId},captions:null});
  const prospective = dependencyCaptureSchema.parse(Object.fromEntries(dependencyTables.map(table => [table,[]])));
  Object.assign(prospective,{
    digital_textbooks:[book],learning_agent_profiles:[profile],
    digital_textbook_versions:[{...version,id:ids.versionId,version_number:Number(version.version_number)+1}],
    digital_textbook_chapters:[{...chapter,id:ids.chapterId,version_id:ids.versionId,status:'published',chapter_test_id:null}],
    digital_textbook_modules:[{...moduleRow,id:ids.moduleId,chapter_id:ids.chapterId,sort_order:1}],
    digital_textbook_nodes:[{...executionNode,id:ids.executionNodeId,module_id:ids.moduleId,sort_order:1,content:{}}],
    digital_textbook_activities:[{...activity,id:ids.activityId,node_id:ids.executionNodeId}],
    digital_textbook_activity_secrets:[{...secret,activity_id:ids.activityId}],
    learning_agent_lessons:[{...lesson,id:ids.teachingLessonId,module_id:ids.moduleId,status:'published'}],
    learning_agent_script_versions:[{...script,id:ids.scriptVersionId,lesson_id:ids.teachingLessonId,version_number:1,status:'published'}],
    learning_agent_script_nodes:[{...node,id:ids.sourceTeachingNodeId,script_version_id:ids.scriptVersionId,sort_order:1,
      reference_activity_id:ids.activityId,configuration:{videoPilotPublication:source},action_type:'focus_activity',is_required:true,next_node_key:null,remediation_node_key:null}],
  });
  packageNativeVideoPublication(projectNativeVideoPublicationCapture(prospective,scope),scope);
  return {auth,admin,request,selection,proof,scope,originDigest};
}
export async function inspectNativeVideoPromotion(input:unknown):Promise<NativeVideoPromotionReport> {
  await requirePlatformOwner();
  try { const checked = await inspect(input);return {state:'ready',expectedToken:checked.request.expectedToken,
    message:'已保存的小节和所选视频通过检查；可创建独立发布版本，学生入口仍保持关闭。'}; }
  catch {return {state:'blocked',message:'尚不能独立发布：请确认已保存完整草稿、同一步骤的有效单选题、所选视频及服务器待发布配置。'};}
}
export async function promoteAndPublishNativeVideoRelease(input:unknown):Promise<NativeVideoPromotionReport> {
  await requirePlatformOwner();
  let created = false;
  try {
    const c = await inspect(input), s = c.selection;
    const result = await c.auth.supabase.rpc('promote_native_video_source_v1',{p_source_node:c.request.sourceNodeId,
      p_source_version:c.request.sourceScriptVersionId,p_expected_token:c.request.expectedToken,p_change_note:c.request.changeNote,p_media:c.proof,
      p_target:{textbookId:s.textbookId,legacyVersionId:s.legacyVersionId,chapterNumber:s.chapterNumber,chapterSlug:s.chapterSlug,reserved:s.reserved}});
    if (result.error) throw Error('PROMOTION_FAILED');
    created = true;
    const promoted = z.strictObject({scope:scopeSchema,originDigest:z.string().regex(/^[a-f0-9]{64}$/),sourceCreated:z.boolean()}).parse(result.data);
    if (canonical(promoted.scope) !== canonical(c.scope) || promoted.originDigest !== c.originDigest) throw Error('PROMOTION_CHANGED');
    const compiled = await compileNativeVideoPublication(c.scope);
    const approved = compiled.privatePayload.source.teachingNodes[0].configuration.videoPilotPublication;
    if (approved.origin.draftDigest !== c.originDigest || approved.approvedBy !== c.auth.user.id) throw Error('PROMOTION_CHANGED');
    let current:Awaited<ReturnType<ReturnType<typeof publicationRepository>['current']>>|null;
    try {current = await publicationRepository(c.admin).current(c.scope);}
    catch (error) {if (!(error instanceof Error) || error.message !== 'PUBLICATION_POINTER_MISSING') throw error;current=null;}
    if (current) {
      if (current.bundle.revision !== 'publish-foundation/3' || current.bundle.sourceRevision !== compiled.sourceRevision
        || canonical(current.bundle.privatePayload.dependencies) !== canonical(compiled.privatePayload.dependencies)) throw Error('PROMOTION_PUBLICATION_DRIFT');
    } else await publicationRepository(c.admin).publish(c.auth.user.id,compiled,null);
    return {state:'published',message:'独立版本已发布；原草稿和旧学习记录保留，学生入口仍需单独启用。'};
  } catch {
    return created ? {state:'source-created',message:'独立来源已创建，但发布尚未确认。入口保持关闭；重新检查后可重试同一版本。'}
      : {state:'blocked',message:'未确认创建成功。请重新检查草稿与服务器配置；重试会核验同一组预留版本，不重复复制。'};
  }
}
