import 'server-only';
import { requireActiveUser } from '../../../lib/auth';
import { getNativeVideoReleaseSelection } from '../../../lib/smart-textbook-publishing/course-release-selection.server.ts';
import { issueNativeLearningSession } from '../../smart-textbook-runtime/server/native-learning-session.server.ts';

/** Public Korean entry. Selected failures are terminal for this request; the app
 * must never run its legacy teacher loader after this branch is selected. */
export async function loadKoreanNativeVideoEntry(input:{lessonId:string;chapterNumber:number;chapterSlug:string;audit:boolean}) {
  const selection = getNativeVideoReleaseSelection(input);
  if (!selection || selection.phase !== 'active') return {kind:'legacy' as const};
  try {
    const {supabase} = await requireActiveUser();
    const {data,error} = await supabase.from('course_chapters').select('id').eq('lesson_id',input.lessonId)
      .eq('slug',input.chapterSlug).eq('is_published',true).maybeSingle();
    if (error || !data || selection.chapterSlug !== input.chapterSlug) throw Error('NATIVE_CHAPTER_UNAVAILABLE');
    if (input.audit) return {kind:'blocked' as const,message:'视频课程的审阅预览尚未开放。'};
    const bootstrap = await issueNativeLearningSession({textbookId:selection.textbookId,
      versionId:selection.reserved.versionId,chapterId:selection.reserved.chapterId});
    return {kind:'native' as const,bootstrap};
  } catch { return {kind:'blocked' as const,message:'视频课程暂时无法加载，请稍后重试。'}; }
}
/** Only a server-resolved active version can replace the old overview progress. */
export function getKoreanNativeProgressVersion(lessonId:string,chapterNumber:number) {
  const selection = getNativeVideoReleaseSelection({lessonId,chapterNumber});
  return selection?.phase === 'active' ? selection.reserved.versionId : undefined;
}
