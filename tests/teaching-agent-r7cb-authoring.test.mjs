import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {loadPreflight}=await import('./fixtures/teaching-agent-r7cb/preflight-harness.mjs');
const {module:{bindingReceiptSchema,canonicalFreeze}}=await loadPreflight({authorize(){throw Error('NO_TEST_OWNER')},admin(){throw Error('NO_TEST_READER')}});
test('receipt whitelist rejects private payload and inconsistent count',()=>{
 const r={contract:'canonical-activity-binding/1',result:'CREATED',targetAlias:'hangul-introduction',activityAlias:'hangul-introduction-vowel-recognition',operatorHash:'a'.repeat(64),nodeHash:'b'.repeat(64),activityHash:'c'.repeat(64),insertedRows:3,observedAt:'2026-09-17T00:00:00+00:00',transactionRef:'12'};
 assert.equal(bindingReceiptSchema.parse(r).result,'CREATED');
 assert.throws(()=>bindingReceiptSchema.parse({...r,answer_key:{kind:'index',value:1}}));
 assert.throws(()=>bindingReceiptSchema.parse({...r,insertedRows:0}));
});
test('server and DB pin identical R6F baseline, including objectives through parent hash',()=>{
 const sql=readFileSync('supabase/migrations/202609170001_teaching_lesson_activity_binding.sql','utf8');
 assert.deepEqual(JSON.parse(sql.match(/approved constant jsonb := '([^']+)'/)[1]),canonicalFreeze);
 const freeze=JSON.parse(readFileSync('docs/evidence/teaching-agent-stage-1f-r6f/content-freeze-baseline.json'));
 assert.deepEqual(canonicalFreeze.nodes,freeze.nodes.map(n=>n.rowSha256));
 assert.equal(canonicalFreeze.versionRow,freeze.scriptVersionRowSha256);
});
test('public form has no answer marker, private key or frozen authoring body',()=>{
 const ui=readFileSync('src/features/digital-textbook/components/create-native-activity-form.tsx','utf8');
 assert.doesNotMatch(ui,/answer_key|correctIndex|private_answer|teacher_script|value:1/);
 assert.match(ui,/useSyncExternalStore/);assert.match(ui,/sessionStorage.setItem/);assert.match(ui,/VERIFY_REQUIRED/);
});
test('action reauthenticates; ambiguous failure holds without retry or SQL error exposure',()=>{
 const action=readFileSync('src/features/digital-textbook/api/create-native-activity.ts','utf8');
 assert.match(action,/await requirePlatformOwner\(\)/);assert.match(action,/VERIFY_REQUIRED/);
 assert.doesNotMatch(action,/error\.message|console\.|createAdminClient/);
 const sql=readFileSync('supabase/migrations/202609170001_teaching_lesson_activity_binding.sql','utf8');
 assert.doesNotMatch(sql,/UPDATE public\.|DELETE FROM public\.|record_smart_textbook_attempt|PGRST202/);
});
