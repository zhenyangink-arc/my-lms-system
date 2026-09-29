import 'server-only';
import { z } from 'zod';
import { requireActiveUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureChapterOnePublication, chapterOneStepTitle } from '@/lib/smart-textbook-publishing/capture.server';
import { chapterOnePublicationScope } from '@/lib/smart-textbook-publishing/loader.server';
import { pointerSchema } from '@/lib/smart-textbook-publishing/repository.server';
import { assertPublishableSnapshot } from '@/lib/smart-textbook-publishing/artifact.server';
import { beginChapterOneEditing, editChapterOneActivity } from '@/lib/smart-textbook-publishing/authoring.server';
import { compileChapterOnePublication, publishChapterOne, publicationHistory, validatePublication } from '@/lib/smart-textbook-publishing/publisher.server';
import type { ChapterWorkbenchData, WorkbenchResult } from './contracts';
import { grammarAuthoringCards, grammarSaveSchema, saveChapterOneGrammar } from '@/lib/smart-textbook-publishing/grammar-authoring.server';

const inputSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('read') }),
  z.strictObject({ operation: z.literal('begin') }),
  grammarSaveSchema.extend({operation:z.literal('save-grammar')}),
  z.strictObject({ operation: z.literal('check') }),
  z.strictObject({ operation: z.literal('publish'), expected: pointerSchema.nullable(), digest: z.string().regex(/^sha256:[a-f0-9]{64}$/) }),
  z.strictObject({ operation: z.literal('save'), activityId: z.string().uuid(),
    prompt: z.string().trim().min(1).max(4000), koreanPrompt: z.string().trim().min(1).max(4000), answerIndex: z.number().int().nonnegative() }),
]);
async function currentPointer() {
  const rows = z.array(z.object({ to_snapshot: z.string(), generation: z.number().int().positive() }))
    .parse(await publicationHistory(chapterOnePublicationScope));
  const latest = rows.sort((a, b) => b.generation - a.generation)[0];
  return latest ? { snapshotId: latest.to_snapshot, generation: latest.generation } : null;
}

/** Owner-only authoring DTO. Private captures, media keys and full secret rows
 * never cross the boundary. Only the editable answer index is intentionally
 * shown to the authorized author; this port is not used by student Runtime. */
export async function chapterWorkbenchOperation(input: unknown): Promise<WorkbenchResult> {
  try {
    const auth = await requireActiveUser();
    if (auth.profile?.global_role !== 'platform_owner') return { ok: false, message: '仅平台负责人可以管理智能教材。' };
    const value = inputSchema.parse(input);
    if (value.operation === 'save-grammar') {
      const {operation:_,...input} = value;
      await saveChapterOneGrammar(input);
      return {ok:true,kind:'save'};
    }
    if (value.operation === 'begin') {
      const result = await beginChapterOneEditing();
      return { ok: true, kind: 'begin', state: result.state, inflight: result.inflight };
    }
    if (value.operation === 'save') {
      await editChapterOneActivity({ activityId: value.activityId,
        prompt: { 'zh-CN': value.prompt, 'ko-KR': value.koreanPrompt }, answerIndex: value.answerIndex });
      return { ok: true, kind: 'save' };
    }
    if (value.operation === 'publish') return { ok: true, kind: 'publish', pointer: await publishChapterOne(value.expected, value.digest) };
    if (value.operation === 'check') {
      const bundle = await compileChapterOnePublication();
      await validatePublication(bundle);
      assertPublishableSnapshot(bundle);
      return { ok: true, kind: 'check', check: { snapshotId: bundle.snapshotId, digest: bundle.manifestDigest,
        expected: await currentPointer(), steps: bundle.manifest.steps.length, activities: bundle.manifest.activityRefs.length } };
    }
    const { source: s, dependencies: d } = await captureChapterOnePublication(createAdminClient(), auth.user.id, chapterOnePublicationScope);
    const grammarCards = grammarAuthoringCards(d);
    const data: ChapterWorkbenchData = { title: s.chapter.title['zh-CN'], version: s.version.version_number,
      pointer: await currentPointer(), steps: [...s.modules].sort((a,b)=>a.sort_order-b.sort_order).map(module => ({
        id: module.id, title: chapterOneStepTitle(module.id,module.title['zh-CN']), description: module.description['zh-CN'],
        nodes: s.nodes.filter(n=>n.module_id===module.id).sort((a,b)=>a.sort_order-b.sort_order).map(node=>({
          id: node.id, title: node.title['zh-CN'], grammarCards:grammarCards.filter(c=>c.nodeId===node.id), activities: s.activities.filter(a=>a.node_id===node.id).sort((a,b)=>a.sort_order-b.sort_order).map(a=>{
            const answer = z.object({kind:z.literal('index'),value:z.number().int().nonnegative()}).safeParse(d.digital_textbook_activity_secrets.find(secret=>secret.activity_id===a.id)?.answer_key);
            const editable = a.activity_type==='single_choice' && answer.success && answer.data.value<a.options.length;
            return {id:a.id,key:a.activity_key,type:a.activity_type,prompt:a.prompt['zh-CN'],koreanPrompt:a.prompt['ko-KR'],instruction:a.instruction['zh-CN'],
              options:a.options,editable,answerIndex:editable&&answer.success?answer.data.value:null};
          }),
        })),
        teaching:s.teachingNodes.filter(n=>s.teachingVersions.some(v=>v.id===n.script_version_id&&s.lessons.some(l=>l.id===v.lesson_id&&l.module_id===module.id)))
          .sort((a,b)=>a.sort_order-b.sort_order).map(n=>({title:n.title['zh-CN'],script:n.teacher_script['zh-CN'],version:s.teachingVersions.find(v=>v.id===n.script_version_id)!.version_number})),
      })) };
    return { ok:true, kind:'read', data };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (error instanceof z.ZodError) return {ok:false,message:'输入或数据格式不符合要求；未继续操作。请检查正在编辑的教材字段。'};
    if (message.includes('CONFLICT') || message.includes('CHECK_STALE')) return {ok:false,message:'内容或发布版本已变化。请刷新内容，重新校验后再发布。'};
    if (message.includes('EDIT_REJECTED')) return {ok:false,message:'保存被拒绝：请确认已进入编辑状态，刷新后核对内容；不会覆盖并发修改。'};
    if (message.includes('EDIT_WINDOW')) return {ok:false,message:'暂不能进入编辑，请等待在途学习请求结束后重试；不会强制清理请求。'};
    return {ok:false,message:'读取或发布前置检查未通过。未跳过任何校验，请核对章节、媒体和发布依赖后重试。'};
  }
}
