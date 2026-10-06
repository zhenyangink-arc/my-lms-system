import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {publishedChapterFixture,publishedOverrides} from './fixtures/published-chapter-one.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
import {literal as q,json,service} from './fixtures/recording-v2-postgres.mjs';
import {source} from './fixtures/runtime-4a.mjs';
import {chapterPracticeSnapshot} from '../src/lib/chapter-practice-binding.ts';

const migration=p=>readFile(`supabase/migrations/${p}`,'utf8');
const grammarSource=source.nodes.find(n=>n.node_code==='topic-and-copula');
// Extract the JSON array from repository content seeds, never execute seed SQL.
function cardsFromSeed(sql){
  const at=sql.indexOf('"grammarCards"'),start=sql.indexOf('[',at);
  if(at<0)throw Error('Missing grammarCards');
  for(let end=start+1;end<sql.length;end++)if(sql[end]===']')try{return JSON.parse(sql.slice(start,end+1));}catch{}
  throw Error('Invalid grammarCards seed');
}
test('actual 16 chapter seed cards → management reader: 63 total, 3 in chapter 1, not old grammar',async()=>{
  const files=(await readdir('supabase/migrations')).filter(n=>/chapter_(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen)_golden_smart_textbook/.test(n));
  assert.equal(files.length,15);
  const arrays=[grammarSource.content.grammarCards,...await Promise.all(files.map(async f=>cardsFromSeed(await migration(f))))];
  const chapters=arrays.map((cards,i)=>({id:`chapter-${i}`,version_id:'version',slug:`chapter-${i}`,chapter_number:i+1,status:'published',digital_textbook_modules:[{id:`module-${i}`,chapter_id:`chapter-${i}`,module_code:'grammar',digital_textbook_nodes:[{id:`node-${i}`,module_id:`module-${i}`,content:{grammarCards:cards}}]}]}));
  chapters[0].digital_textbook_modules.push(...source.modules.filter(m=>m.module_code!=='grammar').map(m=>({...m,chapter_id:'chapter-0',digital_textbook_nodes:source.nodes.filter(n=>n.module_id===m.id)})));
  chapters.push({id:'overview',version_id:'version',slug:'overview',chapter_number:0,status:'published',digital_textbook_modules:[]});
  const rows={digital_textbooks:[{id:'book',lesson_id:'lesson',slug:'book',title:'教材',status:'published',lessons:{id:'lesson',title:'课时',course_id:'course'},digital_textbook_versions:[{id:'version',textbook_id:'book',version_number:1,status:'published',digital_textbook_chapters:chapters}]}],courses:[{id:'course',title:'课程'}],growth_toolbox_grammar:[],growth_toolbox_vocabulary:[]};
  globalThis.__grammarRead={rows,role:'platform_owner'};
  try{
    const mod=await serverModule('src/features/digital-textbook/api/service.ts',{
      '@/lib/auth':'export async function requireActiveUser(){return {tenant:null,platformProfile:{global_role:globalThis.__grammarRead.role},supabase:{}}}',
      '@/lib/supabase/admin':`export function createAdminClient(){return {from(t){if(!(t in globalThis.__grammarRead.rows))throw Error('unexpected table');const q={select(){return q},eq(){return q},in(){throw Error('module filter would hide the real 8 Step structure')},order(){return q},then(a,b){return Promise.resolve({data:globalThis.__grammarRead.rows[t],error:null}).then(a,b)}};return q}}}`,
      '@/lib/tenant-app-capabilities':'export async function requireTenantAppCapability(){throw Error("unexpected tenant");}',
      'next/navigation':'export function redirect(){throw Error("redirect");}',
      'react':'export function cache(fn){return fn}',
    });
    const data=await mod.getDigitalTextbookManagementData('app');
    const result=data.courses[0].lessons[0].textbooks[0].chapters;
    assert.equal(result.length,17);assert.equal(result[0].modules[0].grammarCount,3);
    assert.equal(result[0].modules.length,8);assert.equal(result[16].grammarNodes.length,0);
    assert.equal(result.reduce((s,c)=>s+c.modules.reduce((n,m)=>n+m.grammarCount,0),0),63);
    assert.deepEqual(result.flatMap(c=>c.grammarNodes.flatMap(n=>n.cards)),arrays.flat());
    assert.equal(result.flatMap(c=>c.grammarNodes.flatMap(n=>n.items)).length,0);
    globalThis.__grammarRead.role='platform_admin';assert.equal((await mod.getDigitalTextbookManagementData('app')).canManage,false);
    chapters[0].digital_textbook_modules[0].digital_textbook_nodes[0].content.grammarCards=[{form:'malformed'}];
    await assert.rejects(mod.getDigitalTextbookManagementData('app'),'invalid content must not pretend zero');
  }finally{delete globalThis.__grammarRead;}
});

test('current grammar cards are lossless, closed and separate from legacy grammar',async()=>{
  const {readTextbookGrammarCards}=await serverModule('src/lib/textbook-grammar-content.ts');
  const cards=readTextbookGrammarCards(grammarSource.content);
  assert.equal(cards.length,3);assert.deepEqual(cards,grammarSource.content.grammarCards);
  assert.deepEqual(readTextbookGrammarCards({grammar:[{title:'legacy'}]}),[]);
  for(const bad of [null,{},[{...cards[0],secret:'no'}]])assert.throws(()=>readTextbookGrammarCards({grammarCards:bad}));
  const comparison={...cards[0],comparison:{'zh-CN':'对比','ko-KR':'비교'}};
  assert.deepEqual(readTextbookGrammarCards({grammarCards:[comparison]})[0],comparison);
  const tree=[{lessons:[{textbooks:[{status:'published',chapters:[{id:'c',status:'published',versionStatus:'published',nodes:[],grammarNodes:[{id:'n',items:[{title:'legacy'}],cards:[comparison]}]}]}]}]}];
  const snapshot=chapterPracticeSnapshot(tree,'c');assert.equal(snapshot.length,2);
  assert.deepEqual(snapshot[1].value,comparison);assert.equal(snapshot[0].value.title,'legacy');
});
test('media proof only permits non-playback text edits; rules, examples, audio and other node fields still block',async()=>{
  const {unchangedGrammarMedia}=await serverModule('src/lib/smart-textbook-publishing/grammar-media-proof.server.ts');
  const original='8da8793aff849b949c25b84cc1040e1ef6fd18e3cb26322e666c23e27e7ad289';
  const n=structuredClone(grammarSource);n.content.grammarCards[0].form='new form';n.content.grammarCards[0].function['zh-CN']='new';
  assert.equal(unchangedGrammarMedia(n,original),true);
  for(const mutate of [n=>n.content.grammarCards[0].examples[0].ko='other text',n=>n.content.grammarCards[0].examples[0].audioId='other audio',n=>n.content.grammarCards[0].examples[0].audioStatus='ready',n=>n.content.grammarCards[0].rules[0]='other rule',n=>n.content.grammarCards.reverse(),n=>n.content.lead['zh-CN']='other',n=>n.id='other']){
    const changed=structuredClone(n);mutate(changed);assert.equal(unchangedGrammarMedia(changed,original),false);
  }
  assert.equal(unchangedGrammarMedia(n,'forged'),false);
});

test('real owner grammar edit → stable identity → compiler → publisher → Loader, conflicts and fence', {timeout:240000},async t=>{
  let f;
  try{
    f=await publishedChapterFixture();
    const call=(await serverModule('src/features/digital-textbook/workbench/service.server.ts',publishedOverrides)).chapterWorkbenchOperation;
    const beforeCheck=await call({operation:'check'});assert(beforeCheck.ok,JSON.stringify(beforeCheck));
    const first=await call({operation:'publish',expected:beforeCheck.check.expected,digest:beforeCheck.check.digest});assert(first.ok,JSON.stringify(first));
    const before=await f.loader.loadPublishedRuntimeSnapshot();
    await f.db.query(await migration('202609130001_textbook_grammar_authoring.sql'));
    assert.equal((await f.loader.loadPublishedRuntimeSnapshot()).bundle.snapshotId,before.bundle.snapshotId,'empty mapping is semantics-preserving');
    // The capture must still equal its existing fence after adding the column.
    await f.db.query("update public.digital_textbooks set status=status");
    let read=await call({operation:'read'});assert(read.ok,JSON.stringify(read));
    let card=read.data.steps.flatMap(s=>s.nodes.flatMap(n=>n.grammarCards)).find(Boolean);
    assert(card);
    const input={operation:'save-grammar',cardId:card.cardId,expected:card.expected,patch:{form:card.card.form,function:{...card.card.function,'zh-CN':'语法功能隔离修订'},caution:card.card.caution,source:card.card.source}};
    await t.test('owner-only, no write outside edit window or unknown fields',async()=>{
      assert.equal((await call(input)).ok,false);
      for(const role of ['platform_admin','organization_owner','teacher','student']){f.auth.profile.global_role=role;assert.equal((await call(input)).ok,false);}
      f.auth.profile.global_role='platform_owner';
      assert.equal((await call({...input,patch:{...input.patch,examples:[]}})).ok,false);
      for(const role of ['anon','authenticated'])assert.notEqual((await f.db.raw(`set role ${role};select public.edit_runtime_grammar_card_v1(null,null,null,null,null,null,null,null)`)).code,0);
    });
    assert((await call({operation:'begin'})).ok);
    await t.test('same expected content: two concurrent saves cannot overwrite each other',async()=>{
      const results=await Promise.all([call(input),call({...input,patch:{...input.patch,function:{...input.patch.function,'zh-CN':'并发修订'}}})]);
      assert.equal(results.filter(r=>r.ok).length,1,JSON.stringify(results));
      assert.equal((await call(input)).ok,false,'stale editor must refresh');
    });
    read=await call({operation:'read'});assert(read.ok);
    const current=read.data.steps.flatMap(s=>s.nodes.flatMap(n=>n.grammarCards)).find(c=>c.cardId===card.cardId);
    assert.notEqual(current.expected,card.expected);
    assert.deepEqual(current.card.examples,card.card.examples);assert.deepEqual(current.card.rules,card.card.rules);
    assert.equal(await f.db.query(`select content ? 'grammar' from public.digital_textbook_nodes where id=${q(card.nodeId)}`),'f');
    await f.publisher.compileChapterOnePublication();
    const check=await call({operation:'check'});assert(check.ok,JSON.stringify(check));
    const pub=await call({operation:'publish',expected:check.check.expected,digest:check.check.digest});assert(pub.ok,JSON.stringify(pub));
    const after=await f.loader.loadPublishedRuntimeSnapshot();
    assert.equal(after.bundle.manifest.steps.length,8);assert.equal(after.bundle.manifest.activityRefs.length,19);
    assert.equal(after.bundle.manifest.blocks.filter(b=>b.type==='multiple_choice').length,3);
    assert.deepEqual(after.bundle.manifest.runtimeTargets.map(t=>t.id),before.bundle.manifest.runtimeTargets.map(t=>t.id));
    assert.deepEqual(after.bundle.privatePayload.source.teachingNodes,before.bundle.privatePayload.source.teachingNodes);
    assert.notEqual(after.bundle.manifestDigest,before.bundle.manifestDigest);
    assert.equal(after.bundle.privatePayload.source.nodes.find(n=>n.id===card.nodeId).content.grammarCards[0].function['zh-CN'],current.card.function['zh-CN']);
    const projector=await serverModule('src/lib/smart-textbook-legacy-adapter/runtime-content.server.ts');
    const capsule=after.bundle.privatePayload.result.bindings.capsules.find(c=>c.kind==='learning'&&c.nodeId===card.nodeId);
    const displayed=projector.projectLearningContent(after.bundle.privatePayload.result.bindings,capsule.id,'zh-CN');
    assert(displayed.cards.find(c=>c.section==='grammarCards').children.some(c=>c.paragraphs.includes(current.card.function['zh-CN'])),'actual student projection uses edited published text');
    assert.equal(before.bundle.privatePayload.source.nodes.find(n=>n.id===card.nodeId).content.grammarCards[0].function['zh-CN'],card.card.function['zh-CN']);
    const raw=await f.db.raw(`update public.digital_textbook_nodes set authoring_grammar_identities='[]' where id=${q(card.nodeId)}`);assert.match(raw.stderr,/IMMUTABLE/);
    assert(!/authoring_grammar_identities|answer_key|object_key|service_role/.test(JSON.stringify(read)));
    await t.test('second revision rebinds same card again, not an index/title allocation',async()=>{
      assert((await call({operation:'begin'})).ok);
      const saved=await call({...input,expected:current.expected,patch:{...input.patch,form:'은/는（主题助词）'}});assert(saved.ok,JSON.stringify(saved));
      const next=await f.publisher.compileChapterOnePublication();
      assert.deepEqual(next.manifest.runtimeTargets.map(t=>t.id),before.bundle.manifest.runtimeTargets.map(t=>t.id));
      assert.equal(next.privatePayload.source.nodes.find(n=>n.id===card.nodeId).content.grammarCards[0].form,'은/는（主题助词）');
    });
    await t.test('real reference RPC keeps full current cards, owner guard, CAS and frozen student read',async()=>{
      const app='10000000-0000-4000-8000-000000000001';
      await f.db.query(`create schema if not exists private;
        create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        create table public.student_apps(id uuid primary key);insert into public.student_apps values(${q(app)});
        alter table public.digital_textbooks add column if not exists student_app_id uuid;
        alter table public.digital_textbooks add column if not exists lesson_id uuid;
        update public.digital_textbooks set student_app_id=${q(app)};
        create or replace function private.is_platform_owner() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and global_role='platform_owner' and status='active')$$;
        create or replace function public.current_user_can_manage_standard_question_bank() returns boolean language sql stable as $$select true$$;
        create or replace function private.current_user_can_read_student_app(id uuid) returns boolean language sql stable as $$select id=${q(app)}::uuid and auth.uid() is not null$$;`);
      await f.db.query(await migration('202609080001_chapter_practice_bindings.sql'));
      await f.db.query(await migration('202609080002_chapter_practice_explicit_function_grants.sql'));
      await f.db.query(await migration('202609130002_textbook_grammar_practice_binding.sql'));
      const nodes=JSON.parse(await f.db.query(`select jsonb_agg(to_jsonb(n)) from public.digital_textbook_nodes n`));
      const gn=nodes.find(n=>n.id===card.nodeId),vn=nodes.find(n=>Array.isArray(n.content.vocabulary));
      const tree=[{lessons:[{textbooks:[{status:'published',chapters:[{id:source.chapter.id,status:'published',versionStatus:'published',nodes:[{id:vn.id,vocabulary:vn.content.vocabulary}],grammarNodes:[{id:gn.id,items:[],cards:gn.content.grammarCards}]}]}]}]}];
      const snapshot=chapterPracticeSnapshot(tree,source.chapter.id);
      assert.equal(snapshot.length,15);assert.equal(snapshot.filter(i=>i.kind==='grammar').length,3);
      const asOwner=sql=>`set role authenticated;set request.jwt.claim.sub=${q(f.student)};${sql}`;
      const review=(rev,snapshot)=>f.db.raw(asOwner(`select public.review_chapter_practice_binding(${q(app)},${q(source.chapter.id)},${rev},${json(snapshot)},true)`));
      assert.equal(await f.db.query('select count(*) from public.chapter_practice_bindings'),'0');
      const approved=await review(0,snapshot);assert.equal(approved.code,0,approved.stderr);
      const read=await f.db.query(asOwner(`select snapshot from public.read_chapter_practice_snapshots(${q(app)})`));
      assert.deepEqual(JSON.parse(read),snapshot);
      const view=await serverModule('src/features/growth-toolbox/components/referenced-grammar-materials.tsx',{
        '@/components/ui/card-title-with-hint':'export function CardTitleWithHint(){return null}',
        '@/features/digital-textbook/components/grammar-card-content':'export function GrammarCardContent({card}){return card.form}',
      });
      assert(view.ReferencedGrammarMaterials({items:JSON.parse(read)}),'actual student material branch accepts grammarCards');
      assert.notEqual((await review(0,snapshot)).code,0);
      const bad=structuredClone(snapshot);bad.find(i=>i.kind==='grammar').value.examples[0].ko='not authorized';
      assert.notEqual((await review(1,bad)).code,0);
      const races=await Promise.all([review(1,snapshot),review(1,snapshot)]);assert.equal(races.filter(r=>r.code===0).length,1);
      await f.db.query(`update public.profiles set global_role='platform_admin' where id=${q(f.student)}`);
      assert.match((await review(2,snapshot)).stderr,/没有权限/);
      await f.db.query(`update public.profiles set global_role='platform_owner' where id=${q(f.student)}`);
    });
  }finally{await f?.dispose();}
});
