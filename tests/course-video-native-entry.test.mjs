import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serverModule,uid} from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
// TEST ONLY in-memory query recorder. No DB, server, containers, credentials or providers.
const selection=await serverModule('src/lib/smart-textbook-publishing/course-release-selection.server.ts');
const book=uid(),old=uid(),fresh=uid(),lesson=uid();
test('installed registry is EMPTY and strict schema rejects aliases/colliding reservations',()=>{
 assert.equal(selection.getLegacyVersionPin(book),null);assert.equal(selection.getNativeVideoReleaseSelection({lessonId:lesson,chapterNumber:0}),null);
 const entry={contract:'course-release-selection/1',textbookId:book,textbookSlug:'test',lessonId:lesson,legacyVersionId:old,phase:'prepared',chapterNumber:0,chapterSlug:'test-00',reserved:Object.fromEntries(['versionId','chapterId','moduleId','executionNodeId','activityId','teachingLessonId','scriptVersionId','sourceTeachingNodeId'].map(k=>[k,uid()])),sourceDraft:{scriptVersionId:uid(),teachingNodeId:uid()}};
 assert.equal(selection.courseReleaseSelectionSchema.safeParse(entry).success,true);
 assert.equal(selection.courseReleaseSelectionSchema.safeParse({...entry,url:'bad'}).success,false);
 entry.reserved.versionId=old;assert.equal(selection.courseReleaseSelectionSchema.safeParse(entry).success,false);
});
const loader=await serverModule('src/lib/smart-digital-textbook.ts',{
 '@/lib/r2':`export const createR2SignedObjectUrl=()=>{throw Error('TEST_ONLY_NO_PROVIDER');};`,
 '@/lib/learning-agent-buffer-selection.server':`export const BUFFER_CANDIDATE_COLUMNS='id';export const selectBufferSpeechIds=()=>{throw Error('TEST_ONLY_NO_BUFFER');};`,
 '@/lib/learning-agent-script-runtime':`export const virtualCharacterForScriptSegment=()=>{throw Error('TEST_ONLY_NO_AVATAR');};`,
 './smart-textbook-publishing/course-release-selection.server':`export const getLegacyVersionPin=()=>globalThis.__entry.pin;`,
 '@/lib/supabase/admin':`export const createAdminClient=()=>globalThis.__entry.admin;`,
 './supabase/admin':`export const createAdminClient=()=>globalThis.__entry.admin;`,
});
function setupLoader(){
 const calls=[];globalThis.__entry={pin:old,calls,admin:{from(table){const filters=[];const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},in(k,v){filters.push([k,v]);return q;},order(){calls.push({table,stage:'order',filters:[...filters]});return q;},limit(){return q;},maybeSingle(){return Promise.resolve(result(true));},then(resolve){return Promise.resolve(result(false)).then(resolve);}};
 function result(single){calls.push({table,filters:[...filters]});const id=filters.find(([k])=>k==='id')?.[1];let data=table==='digital_textbooks'?{id:book,agent_profile_id:null}:table==='digital_textbook_versions'?{id:id??fresh}:table==='digital_textbook_chapters'?null:[];if(!single&&!Array.isArray(data))data=[data];return {data,error:null};}return q;}}};return globalThis.__entry;
}
test('prepared pin is applied before order/limit for BOTH legacy loader paths and both chapters',async()=>{
 const m=setupLoader();for(const chapterNumber of [0,1]){const options={textbookSlug:'test',chapterNumber,userId:uid(),tenantId:uid(),trackingDisabled:false};await loader.loadSmartDigitalTextbook(options);await loader.loadSmartDigitalTextbookChapterProgress(options);}
 const versions=m.calls.filter(x=>x.table==='digital_textbook_versions'&&x.stage==='order');assert.equal(versions.length,4);for(const c of versions)assert(c.filters.some(([k,v])=>k==='id'&&v===old));
});
test('active progress uses exact new published version while ordinary chapter calls keep legacy',async()=>{
 const m=setupLoader();await loader.loadSmartDigitalTextbookChapterProgress({textbookSlug:'test',chapterNumber:0,userId:uid(),tenantId:uid(),trackingDisabled:false,versionId:fresh});
 const query=m.calls.find(x=>x.table==='digital_textbook_versions'&&x.stage==='order');assert(query.filters.some(([k,v])=>k==='id'&&v===fresh));assert(query.filters.some(([k,v])=>k==='textbook_id'&&v===book));assert(query.filters.some(([k,v])=>k==='status'&&v==='published'));
});
const entry=await serverModule('src/features/subjects/korean/native-video-entry.server.ts',{
 '../../../lib/auth':`export async function requireActiveUser(){return {supabase:globalThis.__nativeEntry.db};}`,
 '../../../lib/smart-textbook-publishing/course-release-selection.server.ts':`export const getNativeVideoReleaseSelection=()=>globalThis.__nativeEntry.selection;`,
 '../../smart-textbook-runtime/server/native-learning-session.server.ts':`export const issueNativeLearningSession=async s=>{globalThis.__nativeEntry.issued.push(s);if(globalThis.__nativeEntry.fail)throw Error('denied');return {testOnly:true};};`,
});
function setupEntry(){const m={selection:{phase:'active',textbookId:book,chapterSlug:'test-00',reserved:{versionId:fresh,chapterId:uid()}},issued:[],fail:false,db:{from(){const q={select(){return q;},eq(){return q;},async maybeSingle(){return {data:{id:uid()},error:null};}};return q;}}};globalThis.__nativeEntry=m;return m;}
test('selected admission issues only native scope; failures and audit never fall back',async()=>{
 const input={lessonId:lesson,chapterNumber:0,chapterSlug:'test-00',audit:false};const m=setupEntry();assert.equal((await entry.loadKoreanNativeVideoEntry(input)).kind,'native');assert.equal(m.issued[0].versionId,fresh);
 m.fail=true;assert.equal((await entry.loadKoreanNativeVideoEntry(input)).kind,'blocked');assert.equal((await entry.loadKoreanNativeVideoEntry({...input,audit:true})).kind,'blocked');assert.equal(m.issued.length,2);
 m.selection.phase='prepared';assert.equal((await entry.loadKoreanNativeVideoEntry(input)).kind,'legacy');m.selection=null;assert.equal((await entry.loadKoreanNativeVideoEntry(input)).kind,'legacy');
});
test('real app mounts native before teacher/legacy loading and preserves actual lesson boundary',()=>{
 const page=readFileSync('src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx','utf8');const branch=page.indexOf('const entry = await loadKoreanNativeVideoEntry');assert(branch>0);assert(branch<page.indexOf('const smartTextbook = await loadSmartDigitalTextbook'));assert.match(page.slice(branch,branch+1200),/entry.kind !== "legacy"\) return/);assert.match(page.slice(branch,branch+1200),/<LessonActivityBoundary lessonId=\{lesson.id\}>/);assert.match(page,/versionId: getKoreanNativeProgressVersion\(lesson.id, 0\)/);
});
