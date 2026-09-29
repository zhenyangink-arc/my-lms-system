import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const file='supabase/migrations/202609140005_student_teaching_content_isolation.sql',sql=readFileSync(file,'utf8');
test('R2A migration is a hashed incremental; frozen baseline remains byte-identical',()=>{
 const m=JSON.parse(readFileSync('supabase/bootstrap/baseline-manifest.json'));
 assert.equal(createHash('sha256').update(readFileSync('supabase/bootstrap/app-schema-baseline.sql')).digest('hex'),'e5de2f48fa40da53ebcae5353aa4907b1738e15998a304a37b3d0fc555c7bac5');
 const entry=m.postBaselineMigrations.find(x=>x.version==='202609140005');assert(entry);assert.equal(entry.sha256,createHash('sha256').update(sql).digest('hex'));
 assert.equal(m.preCutoverLedgerCount,449);assert.equal(new Set(m.postBaselineMigrationVersions).size,m.postBaselineMigrationVersions.length);
});
test('raw authoring SELECT policy removed; owner policy and JWT adapters preserved',()=>{
 assert.match(sql,/DROP POLICY "authenticated read published learning agent script nodes"/);
 assert(!/DROP POLICY "platform owner/.test(sql));assert(!/DISABLE ROW LEVEL SECURITY/i.test(sql));
 for(const p of ['repositories/supabase-student-teaching-repository.ts','page-projection/lesson-slots.tsx']){
  const source=readFileSync('src/features/teaching-agent/server/'+p,'utf8');assert(source.includes("'student_learning_agent_script_nodes'"));assert(!source.includes("'learning_agent_script_nodes'"));assert(!source.includes('createAdminClient'));
 }
});
test('safe barrier view has explicit fields and caller-bound ancestry; no private JSON blacklist',()=>{
 const view=sql.split('CREATE VIEW public.student_learning_agent_script_nodes')[1].split('ALTER VIEW')[0];
 assert.match(view,/security_barrier=true/);assert.match(view,/auth.uid\(\) IS NOT NULL/);assert.match(view,/private.can_read_published_teaching_module\(l.module_id\)/);
 assert(!/SELECT\s+\*/i.test(view));assert(!/n\.configuration\s*(?:,|AS)/i.test(view));assert.match(view,/e.key IN \('zh-CN','ko-KR'\)/);
 assert.match(sql,/REVOKE ALL ON public.student_learning_agent_script_nodes FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT SELECT ON public.student_learning_agent_script_nodes TO authenticated/);
 for(const name of ['can_read_published_textbook','can_read_published_teaching_module']){
  const fn=sql.split('CREATE FUNCTION private.'+name)[1].split('$$;')[0];assert.match(fn,/SECURITY DEFINER SET search_path = ''/);assert.match(fn,/auth.uid\(\)/);assert.match(sql,new RegExp('REVOKE ALL ON FUNCTION private.'+name+'\\(uuid\\) FROM PUBLIC,anon'));
 }
 assert(!/configuration\s*-(?!>)/.test(sql));
});
