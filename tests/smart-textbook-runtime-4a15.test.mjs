import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {persistedTeacherFixture} from './fixtures/teacher-persisted-4a15.mjs';
import {literal as q} from './fixtures/recording-v2-postgres.mjs';
import {source} from './fixtures/runtime-4a.mjs';

test('4A15 production composition authority/revision/current-node guards against actual isolated PostgreSQL', {timeout:120000},async t=>{
  const f=await persistedTeacherFixture();
  try{
    const open=()=>f.boundary.dispatch({operation:'open',scope:f.learning.sessionRef});
    const noWrite=async fn=>{const before=await f.rows('learning_agent_messages');await fn();assert.deepEqual(await f.rows('learning_agent_messages'),before);assert.equal((await f.rows('digital_textbook_attempts')).length,0);};
    await t.test('two simultaneous mounts cannot create duplicate presentation owners',async()=>{
      const results=await Promise.allSettled([open(),open()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/OPEN_BUSY/);
      assert.equal((await f.rows('learning_agent_sessions')).length,1);
    });
    await t.test('wrong authenticated learner or tenant cannot restore an opaque learning scope',async()=>{
      await noWrite(async()=>{
        f.auth.user.id=randomUUID();await assert.rejects(open(),/SCOPE_AUTHORITY/);f.auth.user.id=f.student;
        f.auth.tenant.id=randomUUID();await assert.rejects(open(),/SCOPE_AUTHORITY/);f.auth.tenant.id=f.tenant;
      });
    });
    await t.test('correct lesson/profile relationship required before invoking original responder',async()=>{
      const version=source.teachingVersions[0],lesson=await f.db.query(`select agent_profile_id from public.learning_agent_lessons where id=${q(version.lesson_id)}`);
      await f.db.query(`update public.learning_agent_lessons set agent_profile_id=null where id=${q(version.lesson_id)}`);
      await noWrite(()=>assert.rejects(open(),/LESSON_PROFILE/));
      await f.db.query(`update public.learning_agent_lessons set agent_profile_id=${q(lesson)} where id=${q(version.lesson_id)}`);
    });
    await t.test('stale published script revision fails closed, not silently migrated by old responder',async()=>{
      const id=source.teachingVersions[0].id;await f.db.query(`update public.learning_agent_script_versions set status='draft' where id=${q(id)}`);
      await noWrite(()=>assert.rejects(open(),/REVISION/));await f.db.query(`update public.learning_agent_script_versions set status='published' where id=${q(id)}`);
    });
    await t.test('node must belong to the current published version',async()=>{
      const node=source.teachingNodes[0],version=randomUUID();
      await f.db.query(`insert into public.learning_agent_script_versions(id,lesson_id,version_number,status) values(${q(version)},${q(source.teachingVersions[0].lesson_id)},24,'draft')`);
      await f.db.query(`update public.learning_agent_script_nodes set script_version_id=${q(version)} where id=${q(node.id)}`);
      await noWrite(()=>assert.rejects(open(),/NODE_SCOPE/));await f.db.query(`update public.learning_agent_script_nodes set script_version_id=${q(node.script_version_id)} where id=${q(node.id)}`);
    });
    await t.test('snapshot/source revision never chosen by browser; changed private binding rejects',async()=>{
      const revision=f.data.result.report.sourceRevision;f.data.result.report.sourceRevision='incompatible-source';
      await noWrite(()=>assert.rejects(open(),/BINDING_REVISION/));f.data.result.report.sourceRevision=revision;
      await assert.rejects(f.boundary.dispatch({operation:'open',scope:f.learning.sessionRef,tenantId:f.tenant}));
      const snapshot=f.data.result.manifest.snapshot.id;f.data.result.manifest.snapshot.id='snapshot-wrong';
      await noWrite(()=>assert.rejects(open(),/BINDING_REVISION/));f.data.result.manifest.snapshot.id=snapshot;
    });
    await t.test('completed native sessions are not resurrected during restore/open',async()=>{
      await f.db.query(`update public.learning_agent_sessions set status='completed' where id=${q(f.sessionId)}`);
      await open();assert.equal((await f.rows('learning_agent_sessions')).length,1);assert.equal((await f.rows('learning_agent_sessions'))[0].status,'completed');
      assert.equal((await f.rows('learning_agent_messages')).length,0);
    });
    await t.test('reload drains an admitted persisted turn; late response cannot become the new opaque cue',async()=>{
      await f.db.query(`update public.learning_agent_sessions set status='active' where id=${q(f.sessionId)}`);
      const {session}=await open(),raw=f.db.raw;let entered,release,held=false;
      const barrier=new Promise(r=>entered=r),wait=new Promise(r=>release=r);
      f.db.raw=async sql=>{if(!held&&sql.includes('update public."learning_agent_sessions"')){held=true;entered();await wait;}return raw(sql);};
      try {
        const old=f.boundary.dispatch({session,operation:'current'});const rejected=assert.rejects(old,/REVOKED/);
        await barrier;let reopened=false;const fresh=open().then(r=>{reopened=true;return r;});
        await new Promise(r=>setTimeout(r,20));assert.equal(reopened,false);release();await rejected;
        const next=await fresh;assert.notEqual(next.session,session);
        await assert.rejects(f.boundary.dispatch({session,operation:'current'}),/SCOPE/);
        assert.equal((await f.rows('learning_agent_sessions')).length,1);
        assert.equal((await f.rows('learning_agent_messages')).length,2);
        assert.equal((await f.rows('digital_textbook_attempts')).length,0);
      } finally { release();f.db.raw=raw; }
    });
  }finally{await f.dispose();}
});
