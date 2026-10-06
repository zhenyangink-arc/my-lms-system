import 'server-only';
import { getKoreanNativeProgressVersion } from '@/features/subjects/native-video-entry.server';
import { authorizePublishedCourse, chapterOnePublicationScope } from '../../../lib/smart-textbook-publishing/loader.server';
import { isLessonUnlocked,getUnlockedChapterSlugs,type LessonUnlockRule,type ChapterUnlockRule } from '../../../lib/course-unlocks';
import { loadSmartDigitalTextbookChapterProgress } from '../../../lib/smart-digital-textbook';

/** Request-time authorization for the same canonical lesson as page-content.
 * Reuses its evaluators (including overview completion); NOT just chapter RLS.
 * No owner audit bypass is installed in the formal learner API. */
export async function authorizeRuntimeApplication(){
 const a=await authorizePublishedCourse(chapterOnePublicationScope),db=a.auth.supabase;
 if(a.auth.profile?.role!=='student')throw Error('RUNTIME_LEARNER_REQUIRED');
 const one=async(query:PromiseLike<{data:unknown;error:unknown}>)=>{const r=await query;if(r.error||!r.data)throw Error('RUNTIME_COURSE_ACCESS');return r.data as {id:string};};
 const parent=await one(db.from('course_categories').select('id').eq('slug','korean').is('parent_id',null).eq('is_published',true).maybeSingle());
 const category=await one(db.from('course_categories').select('id').eq('slug','korean-basic').eq('parent_id',parent.id).eq('is_published',true).maybeSingle());
 const course=await one(db.from('courses').select('id').eq('slug','korean-beginner').eq('category_id',category.id).eq('is_published',true).maybeSingle());
 const lessons=await db.from('lessons').select('id,slug,unlock_mode,prerequisite_lesson_id,prerequisite_chapter_id,available_from,is_manually_locked').eq('course_id',course.id).eq('is_published',true).order('sort_order');
 const lessonRows=lessons.data as (LessonUnlockRule&{slug:string})[]|null;
 const lesson=lessonRows?.find(l=>l.slug==='basic-pronunciation');if(lessons.error||!lesson||!lessonRows)throw Error('RUNTIME_LESSON_ACCESS');
 const chapters=await db.from('course_chapters').select('id,slug,unlock_mode,prerequisite_chapter_id,available_from,is_manually_locked').eq('lesson_id',lesson.id).eq('is_published',true).order('sort_order');
 const passed=await a.admin.from('chapter_test_attempts').select('test_slug').eq('student_id',a.auth.user.id).eq('tenant_id',a.tenantId).eq('passed',true);
 const completed=await db.from('lesson_progress').select('lesson_id').eq('user_id',a.auth.user.id).eq('status','completed').in('lesson_id',lessonRows.map(l=>l.id));
 if(chapters.error||passed.error||completed.error||!chapters.data||!passed.data||!completed.data)throw Error('RUNTIME_ACCESS_HISTORY');
 const prerequisiteIds=lessonRows.flatMap(l=>l.prerequisite_chapter_id?[l.prerequisite_chapter_id]:[]),prerequisites=new Map<string,string>();
 if(prerequisiteIds.length){const r=await db.from('course_chapters').select('id,slug').in('id',prerequisiteIds);if(r.error||!r.data)throw Error('RUNTIME_PREREQUISITE');r.data.forEach(c=>prerequisites.set(c.id,c.slug));}
 const passedSlugs=new Set<string>(passed.data.map(r=>r.test_slug));
 if(!isLessonUnlocked({lesson,lessonIndex:lessonRows.indexOf(lesson),orderedLessons:lessonRows,completedLessonIds:new Set(completed.data.map(r=>r.lesson_id)),prerequisiteChapterSlugById:prerequisites,passedChapterSlugs:passedSlugs}))throw Error('RUNTIME_LESSON_LOCKED');
 const completion=new Set(passedSlugs);
 const overview=await loadSmartDigitalTextbookChapterProgress({textbookSlug:'korean-level-one-smart',chapterNumber:0,versionId:getKoreanNativeProgressVersion(lesson.id,0),userId:a.auth.user.id,tenantId:a.tenantId,trackingDisabled:false});
 if(overview>=100)completion.add('korean-level-one-00');
 if(!getUnlockedChapterSlugs({chapters:chapters.data as ChapterUnlockRule[],passedChapterSlugs:passedSlugs,completedChapterSlugs:completion}).has('korean-level-one-01'))throw Error('RUNTIME_CHAPTER_LOCKED');
 return a;
}
