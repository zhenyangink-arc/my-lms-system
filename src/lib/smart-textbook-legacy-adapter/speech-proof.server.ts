import 'server-only';
import { createHash } from 'node:crypto';
import { teachingScriptSegments } from '../teaching-video.ts';
import { stripRichText } from '../rich-teaching-text.ts';
import { teacherConfigurationSchema } from './chapter-one-shapes.server.ts';
import type { LegacyChapterOneSource } from './source.server.ts';
import type { ServiceEvidence } from './readiness-contracts.server.ts';
/** Uses the same rich-text stripping / segment splitter as the existing runtime.
 * Provisioning fallback text is evidence to check, never a replacement for stale audio. */
export function verifySpeechSlot(node:LegacyChapterOneSource['teachingNodes'][number],asset:ServiceEvidence['speech'][number]):boolean {
  const parsed=teacherConfigurationSchema.safeParse(node.configuration);
  if(!parsed.success)return false;
  const config=parsed.data,locale=asset.locale;
  const localized=(v:{'zh-CN':string;'ko-KR'?:string}|undefined)=>v?.[locale]??v?.['zh-CN'];
  const buffer=config.bufferLine?.[locale]||({'zh-CN':'稍等一下，我看看这里怎么讲。','ko-KR':'잠시만요, 이 부분을 어떻게 설명할지 볼게요.'})[locale];
  const raw=asset.segment_index===197?localized(config.hint):asset.segment_index===198?localized(config.example):asset.segment_index===199?buffer:teachingScriptSegments(node.teacher_script,config,locale)[asset.segment_index];
  const plain=stripRichText(raw??''),cues=asset.cue_timeline;
  if(!plain||!cues.length||createHash('sha256').update(plain,'utf8').digest('hex')!==asset.content_hash)return false;
  return cues.every((c,i)=>c.endMs>=c.startMs&&c.endMs<=asset.duration_ms&&c.charEnd>=c.charStart&&c.charEnd<=plain.length&&
    (i===0||c.startMs>=cues[i-1].startMs&&c.charStart>=cues[i-1].charStart))&&cues[0].charStart===0&&cues.at(-1)!.charEnd===plain.length;
}
