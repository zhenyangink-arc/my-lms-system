import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {publishedChapterFixture} from './fixtures/published-chapter-one.mjs';
import {serverModule,nativeCapture} from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
import {historicalChain,publicationMigration,q,j} from './fixtures/teaching-agent-r7d-production/postgres.mjs';
const native=await serverModule('src/lib/smart-textbook-publishing/native-publication.server.ts');
const {validateSnapshotBundle,requireLegacyPublication}=await serverModule('src/lib/smart-textbook-publishing/artifact.server.ts');
test('legacy producer and published readers remain valid through actual latest historical chain + native migration',{timeout:180000},async t=>{
 const f=await publishedChapterFixture();try{
  await f.db.query('create schema if not exists private');
  for(const path of historicalChain.filter(x=>x>'202609100002_runtime_publication_dependency_fence.sql'&&x<'202609140000'))await f.db.query(readFileSync('supabase/migrations/'+path,'utf8'));
  const old=await f.publisher.compileChapterOnePublication();const pointer=await f.publisher.publishChapterOne(null);
  const sqlBefore=await f.db.query(`select document::text from runtime_publish_private.snapshots where id=${q(pointer.snapshotId)}`);
  await f.db.query(readFileSync('supabase/migrations/'+publicationMigration,'utf8'));
  await t.test('historical v1 document bytes and digest unchanged',async()=>{assert.equal(await f.db.query(`select document::text from runtime_publish_private.snapshots where id=${q(pointer.snapshotId)}`),sqlBefore);const next=await f.publisher.compileChapterOnePublication();assert.equal(next.manifestDigest,old.manifestDigest);assert.equal(next.privateDigest,old.privateDigest);assert.equal(next.compilerVersion,old.compilerVersion);assert.equal(Object.hasOwn(next,'publicationKind'),false);});
  await t.test('legacy publish after forward migration and official current read still work',async()=>{const p=await f.publisher.publishChapterOne(pointer);const loaded=await f.loader.loadPublishedRuntimeSnapshot();assert.equal(loaded.bundle.revision,'publish-foundation/1');assert.equal(loaded.bundle.snapshotId,p.snapshotId);assert.equal(validateSnapshotBundle(loaded.bundle).manifestDigest,old.manifestDigest);});
  await t.test('legacy payload cannot enter native certifier',()=>assert.throws(()=>native.certifyNativePublication(old)));
  await t.test('native payload cannot enter legacy-only consumer',()=>{const g=nativeCapture(),b=native.packageNativePublication(native.projectNativePublicationCapture(g.c,g.scope),g.scope);assert.throws(()=>requireLegacyPublication(b));});
  await t.test('current historical PT409 fence retained for legacy content',async()=>{const r=await f.db.raw(`update public.digital_textbook_activity_secrets set answer_key='{"kind":"index","value":1}' where activity_id=${q(old.privatePayload.dependencies.digital_textbook_activities[0].id)}`);assert.notEqual(r.code,0);assert.match(r.stderr,/PUBLISHED_DEPENDENCY_IMMUTABLE_USE_EDIT_WINDOW/);});
 }finally{await f.dispose();}
});
