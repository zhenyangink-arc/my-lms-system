import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStudentChapterAccess } from '../src/lib/chapter-release-access.ts';
const rule = { unlock_mode:'immediate', available_from:null, is_manually_locked:false };
function fixture() {
  return { courses:[{...rule,id:'course',category_id:'category',prerequisite_course_id:null,is_published:true}],
    lessons:[{...rule,id:'lesson',course_id:'course',prerequisite_lesson_id:null,prerequisite_chapter_id:null,is_published:true}],
    chapters:[{...rule,id:'chapter',slug:'chapter-1',lesson_id:'lesson',chapter_test_id:'test',prerequisite_chapter_id:null,is_published:true}],
    lessonId:'lesson',chapterTestId:'test',completedLessonIds:new Set(),passedChapterSlugs:new Set(),now:new Date('2026-09-08T00:00:00Z') };
}
test('selected student sees published and unlocked chapter without administrator bypass',()=>{
  const input=fixture();
  assert.deepEqual(evaluateStudentChapterAccess(input),{matched:true,published:true,courseOpen:true,lessonOpen:true,chapterOpen:true});
  input.chapters[0].is_manually_locked=true;
  assert.equal(evaluateStudentChapterAccess(input).chapterOpen,false);
});
test('future opening dates and prerequisite lessons remain blocked',()=>{
  const input=fixture();
  input.courses[0].unlock_mode='scheduled';input.courses[0].available_from='2026-09-09T00:00:00Z';
  input.lessons[0].unlock_mode='prerequisite_completed';input.lessons[0].prerequisite_lesson_id='intro';
  assert.equal(evaluateStudentChapterAccess(input).courseOpen,false);
  assert.equal(evaluateStudentChapterAccess(input).lessonOpen,false);
  input.completedLessonIds.add('intro');
  assert.equal(evaluateStudentChapterAccess(input).lessonOpen,true);
});
test('test relationship must match exactly once within the same lesson',()=>{
  const input=fixture();
  input.chapters[0].lesson_id='different-lesson';
  assert.equal(evaluateStudentChapterAccess(input).matched,false);
  input.chapters[0].lesson_id='lesson'; input.chapters.push({...input.chapters[0],id:'duplicate'});
  assert.equal(evaluateStudentChapterAccess(input).matched,false);
  input.chapterTestId=null;
  assert.equal(evaluateStudentChapterAccess(input).chapterOpen,false);
});
test('unpublished course or lesson never counts as published even when unlock rules are immediate',()=>{
  const input=fixture();input.lessons[0].is_published=false;
  assert.equal(evaluateStudentChapterAccess(input).published,false);
});
test('previous chapter requires selected student progress rather than another chapter number',()=>{
  const input=fixture();
  input.chapters.unshift({...rule,id:'intro',slug:'intro',lesson_id:'lesson',chapter_test_id:'intro-test',prerequisite_chapter_id:null,is_published:true});
  input.chapters[1].unlock_mode='previous_completed';
  assert.equal(evaluateStudentChapterAccess(input).chapterOpen,false);
  input.passedChapterSlugs.add('intro');
  assert.equal(evaluateStudentChapterAccess(input).chapterOpen,true);
});
