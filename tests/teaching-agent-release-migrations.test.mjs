import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const archive='docs/evidence/teaching-agent-stage-1f-r1/migration-identity/';
test('reconciled migration runner has unique versions, one Core DDL path, exact archived SQL and correct order',()=>{
 const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();assert.equal(new Set(files.map(f=>f.split('_')[0])).size,files.length);
 const core='202609140000_agent_core_foundation.sql',completion='202609140001_agent_runtime_completion_evidence.sql',cancel='202609140002_agent_run_cancel_request.sql';
 assert.ok(files.indexOf(core)<files.indexOf(completion)&&files.indexOf(completion)<files.indexOf(cancel));assert.ok(files.includes('202609130001_textbook_grammar_authoring.sql'));assert.ok(!files.includes('202609130001_agent_core_foundation.sql'));
 assert.equal(files.filter(f=>/create table public\.agent_runs\s*\(/i.test(readFileSync('supabase/migrations/'+f,'utf8'))).length,1);
 assert.equal(hash('supabase/migrations/'+core),hash(archive+'202609130001_agent_core_foundation.sql'));
 const manifest=JSON.parse(readFileSync(archive+'reconciliation.json'));for(const r of manifest.recoveredTargetHistory)assert.equal(hash('supabase/migrations/'+r.filename),r.sha256);
 const inventory=JSON.parse(readFileSync(archive+'migration-inventory.json'));
 const decisions=JSON.parse(readFileSync('supabase/bootstrap/orphan-migration-decisions.json'));
 for(const entry of inventory){const retired=decisions.find(d=>d.originalFilename===entry.filename);assert.equal(hash(retired?retired.archive:'supabase/migrations/'+entry.filename),entry.sha256);}
 const ledger=JSON.parse(readFileSync('supabase/bootstrap/migration-ledger-baseline.json'));
 const baselineManifest=JSON.parse(readFileSync('supabase/bootstrap/baseline-manifest.json'));
 assert.deepEqual(files,[...ledger.map(x=>`${x.version}_${x.name}.sql`),...baselineManifest.postBaselineMigrations.map(x=>x.filename)].sort());
 for(const entry of baselineManifest.postBaselineMigrations)assert.equal(hash('supabase/migrations/'+entry.filename),entry.sha256);
});
