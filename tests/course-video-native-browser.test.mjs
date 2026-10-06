// TEST ONLY: synthetic authenticated-session envelopes and local file persistence.
// This mounts production UI/transport/controller; it does not validate real Auth/DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import { chromium } from '@playwright/test';
import { nativeCapture, serverModule } from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
import { executionBinding } from '../src/features/smart-textbook-runtime/core/execution-contracts.ts';
import { nativeSessionBootstrapSchema } from '../src/features/smart-textbook-runtime/core/native-learning-session-transport.ts';

const evidenceRoot = '/tmp/course-video-runtime-ui-impl-17';
const samplePath = '/home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4';
const sampleHash = '68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe';
const sampleRevision = 'media-sample01-' + sampleHash;
const compilerPath = 'src/lib/smart-textbook-publishing/native-video-publication.server.ts';
const componentPath = 'src/features/smart-textbook-runtime/components/native-course-runtime.tsx';

function syntheticBundle(compiler) {
  const fixture = nativeCapture(), node = fixture.c.learning_agent_script_nodes[0];
  node.title = { 'zh-CN': '浏览器测试课程', 'ko-KR': '브라우저 테스트' };
  node.configuration = { videoPilotPublication: {
    contract: 'video-pilot-publication-source/1', mode: 'video', state: 'promoted',
    origin: { teachingNodeId: randomUUID(), scriptVersionId: randomUUID(), draftDigest: 'a'.repeat(64) },
    approvedBy: randomUUID(), approvedAt: '2026-10-05T00:00:00.000Z',
    media: { adapter: 'fixed-selected-host/1', assetId: 'course-video-sample01', sha256: sampleHash,
      sizeBytes: 5487747, mime: 'video/mp4', videoDurationSeconds: 30, containerDurationSeconds: 30.016,
      revision: sampleRevision },
    cue: { id: 'pause-1', atSeconds: 1, activityId: node.reference_activity_id }, captions: null,
  } };
  return compiler.packageNativeVideoPublication(
    compiler.projectNativeVideoPublicationCapture(fixture.c, fixture.scope), fixture.scope);
}

test('TEST ONLY native course composition: actual video, durable reads and responsive UI', { timeout: 120_000 }, async t => {
  await mkdir(evidenceRoot, { recursive: true });
  const temp = await mkdtemp(join(evidenceRoot, 'browser-run-'));
  const compiler = await serverModule(compilerPath);
  const published = syntheticBundle(compiler);
  const videoBytes = await readFile(samplePath);
  assert.equal(videoBytes.length, 5487747);
  assert.equal(createHash('sha256').update(videoBytes).digest('hex'), sampleHash);
  const component = resolve(componentPath);
  const output = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {NativeCourseRuntime} from ${JSON.stringify(component)};
      const bootstrap = await fetch('/test-only/bootstrap?case='+new URL(location.href).searchParams.get('case')).then(r=>r.json());
      createRoot(document.getElementById('root')).render(<NativeCourseRuntime bootstrap={bootstrap} backHref="/dashboard/courses/test-only?course=test-only"/>);`,
    loader: 'tsx', resolveDir: process.cwd(), sourcefile: 'test-only-native-mount.tsx' },
    bundle: true, write: false, outdir: temp, platform: 'browser', format: 'esm', jsx: 'automatic',
    metafile: true, define: { 'process.env.NODE_ENV': '"development"' },
  });
  await writeFile(join(temp, 'browser-import-closure.json'), JSON.stringify(output.metafile, null, 2));
  // Use the application's actual CSS, limiting utility discovery to this mounted
  // import closure. No broad repository scan, generated theme or test skin.
  const cssPath = resolve('src/app/globals.css');
  const cssSources = Object.keys(output.metafile.inputs).filter(path => path.startsWith('src/') && path.endsWith('.tsx'));
  const cssInput = (await readFile(cssPath, 'utf8')).replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
    + '\n' + cssSources.map(path => '@source ' + JSON.stringify(resolve(path)) + ';').join('\n');
  const globalCss = await postcss([tailwindcss({ base: temp, optimize: false })]).process(cssInput, { from: cssPath });
  await writeFile(join(temp, 'css-input-closure.json'), JSON.stringify({ sources: cssSources,
    dependencies: globalCss.messages.filter(message => message.type === 'dependency').map(message => message.file) }, null, 2));
  const cases = new Map(), requests = [], pending = new Set(), errors = [], network = [];
  let browser, context;
  const json = (res, value) => {
    if (res.destroyed || res.writableEnded) return;
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(value));
  };
  async function persisted(f) { return JSON.parse(await readFile(f.file, 'utf8')); }
  async function store(f, state) { await writeFile(f.file, JSON.stringify(state)); }
  const result = (f, state, correct = state.complete) => ({
    ok: true, correct, score: correct ? 100 : 0, explanation: '仅浏览器测试反馈', attemptNumber: state.attempts,
    preview: false, nodeId: published.privatePayload.bindings[0].executionNodeId,
    nodeCompleted: correct, completionPercent: correct ? 100 : 0,
  });
  async function stateProjection(f) {
    const state = await persisted(f);
    return { snapshotId: published.snapshotId, revision: 'test-only-state',
      completedStepIds: state.complete ? [published.manifest.steps[0].id] : [],
      attempts: state.attempts ? [{ activityRef: f.binding.execution.activityRef, result: result(f, state), selectedOptionId: state.selected }] : [],
      activityProgress: [{ activityRef: f.binding.execution.activityRef, completed: state.complete }],
      pageProgress: [], guidedRepeat: [], speakingEvidence: [] };
  }
  async function getCase(name) {
    if (cases.has(name)) return cases.get(name);
    const sessionRef = 'learning-session-' + randomUUID();
    const context = { runtimeSessionId: sessionRef, snapshotId: published.snapshotId,
      sourceState: 'published', trackingDisabled: false, locale: 'zh-CN', supportMode: 'bilingual' };
    const execution = executionBinding(published.manifest, context, published.manifest.execution.cues[0]);
    const native = Object.fromEntries(['session', 'actor', 'tenant', 'lesson', 'snapshot', 'scope', 'content', 'activity', 'executionNode', 'sourceTeachingNode', 'version']
      .map(key => [key + 'Ref', 'test-only-' + name + '-' + key]));
    const binding = { execution, activityRevision: published.manifest.activityRefs[0].revision,
      mediaRef: published.manifest.mediaRefs[0].id, completionPolicy: 'correct-durable-readback/1', native };
    const f = { name, sessionRef, context, binding, file: join(temp, name + '.json'),
      restoreCount: 0, readbackCount: 0, held: null, release: null, lastRead: null };
    await store(f, { attempts: 0, complete: false, pending: false, selected: null });
    cases.set(name, f); return f;
  }
  async function envelope(f, request) {
    const state = await persisted(f), now = Date.now(), iso = value => new Date(value).toISOString();
    const value = { contract: 'native-media-read/1', request: structuredClone(request),
      authority: structuredClone(f.binding), acceptedAt: iso(now - 3),
      pending: request.operation === 'restore' && state.pending && !state.complete,
      receipt: { contract: 'activity-completion/4', status: state.complete ? 'COMPLETED' : 'INCOMPLETE',
        attemptNumber: state.attempts, completedAt: state.complete ? iso(now - 5) : null,
        provenance: { ...f.binding.native, kind: 'native-published-session', storage: 'PINNED_PUBLISHED_DB',
          source: 'activity-domain', publicationRevision: 'publish-foundation/3',
          activityRevision: f.binding.activityRevision, mediaRevision: f.binding.execution.mediaRevision,
          readStartedAt: iso(now - 2), asOf: iso(now), observedAt: iso(now), deadlineAt: iso(now + 9997), revision: 'test-only-state' },
        evidence: { kind: 'durable-attempt-sequence', attemptSequence: state.attempts, stateDigest: 'a'.repeat(64),
          latestAttemptAt: state.attempts ? iso(now - 5) : null, progressUpdatedAt: state.complete ? iso(now - 4) : null } } };
    if (request.operation === 'readback' && f.name === 'stale') {
      const p = value.receipt.provenance;
      value.acceptedAt = iso(now - 40003); p.readStartedAt = iso(now - 40002);
      p.asOf = p.observedAt = iso(now - 40000); p.deadlineAt = iso(now - 30003);
    }
    if (request.operation === 'readback' && f.name === 'reordered') {
      // Return an actual previously issued checkpoint envelope, not this read.
      return f.lastRead;
    }
    if (request.operation === 'readback' && f.name === 'foreign') {
      const differentActor = 'test-only-different-actor';
      assert.notEqual(differentActor, f.binding.native.actorRef);
      value.receipt.provenance.actorRef = differentActor;
    }
    if (request.operation === 'checkpoint') f.lastRead = structuredClone(value);
    return value;
  }
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/bundle.js' || url.pathname === '/style.css') {
        const suffix = url.pathname.endsWith('.js') ? '.js' : '.css';
        res.setHeader('Content-Type', suffix === '.js' ? 'text/javascript' : 'text/css');
        const compiled = output.outputFiles.find(file => file.path.endsWith(suffix)).text;
        return res.end(suffix === '.css' ? globalCss.css + '\n' + compiled : compiled);
      }
      if (url.pathname === '/test-only/bootstrap') {
        const f = await getCase(url.searchParams.get('case') || 'normal');
        return json(res, nativeSessionBootstrapSchema.parse({ contract: 'native-learning-session/1',
          sessionRef: f.sessionRef, expiresAt: Date.now() + 120_000, manifest: published.manifest,
          context: f.context, nativeBindings: [f.binding], initialState: await stateProjection(f) }));
      }
      if (url.pathname === '/api/smart-textbook-runtime/native-media') {
        const f = [...cases.values()].find(c => c.sessionRef === url.searchParams.get('sessionRef'));
        assert(f); assert.equal(url.searchParams.get('mediaRef'), f.binding.mediaRef);
        assert.equal(url.searchParams.get('revision'), sampleRevision);
        res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-store');
        const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
        const start = range ? Number(range[1]) : 0;
        const end = range && range[2] ? Math.min(Number(range[2]), videoBytes.length - 1) : videoBytes.length - 1;
        assert(start <= end && start < videoBytes.length);
        if (range) { res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${videoBytes.length}`); }
        res.setHeader('Content-Length', end - start + 1); return res.end(videoBytes.subarray(start, end + 1));
      }
      if (url.pathname === '/api/smart-textbook-runtime/native' && req.method === 'POST') {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const f = [...cases.values()].find(c => c.sessionRef === body.sessionRef); assert(f);
        requests.push({ case: f.name, body });
        if (body.op === 'refresh') return json(res, await stateProjection(f));
        assert.deepEqual(body.request.binding, f.binding.execution);
        if (body.op === 'submit') {
          const state = await persisted(f);
          state.attempts++; state.selected = body.optionId;
          const correct = body.optionId === 'option-2';
          state.complete = correct && f.name !== 'feedback-alone'; state.pending = !state.complete;
          await store(f, state); return json(res, { result: result(f, state, correct) });
        }
        assert.equal(body.request.operation, body.op);
        if (body.op === 'restore') f.restoreCount++;
        if (body.op === 'checkpoint') {
          const state = await persisted(f); state.pending = !state.complete; await store(f, state);
        }
        if (body.op === 'readback') {
          f.readbackCount++;
          if (['gate', 'late', 'timeout'].includes(f.name)) {
            f.held = res; pending.add(res);
            f.release = async () => { pending.delete(res); f.held = null; json(res, await envelope(f, body.request)); };
            return;
          }
        }
        return json(res, await envelope(f, body.request));
      }
      if (url.pathname !== '/') { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end('<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><p>仅浏览器测试课程</p><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>');
    } catch (error) { errors.push(error.stack); res.statusCode = 500; res.end('{}'); }
  });
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const screenshots = [], assertions = [];
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route => {
      const url = new URL(route.request().url()); network.push(url.href);
      return url.origin === origin ? route.continue() : route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(15_000);
    page.on('pageerror', error => errors.push(error.stack));
    async function open(name) {
      await page.goto(`${origin}/?case=${name}`);
      await page.waitForFunction(() => {
        const video = document.querySelector('video'), phase = document.querySelector('[data-media-phase]')?.getAttribute('data-media-phase');
        return video?.readyState >= 1 && ['READY', 'RESUME_READY', 'AWAITING_ACTIVITY'].includes(phase);
      });
      return cases.get(name);
    }
    const paused = () => page.locator('video').evaluate(video => video.paused);
    async function reach(name, seek = false) {
      const f = await open(name);
      if (seek) { await page.getByRole('slider', { name: '视频位置' }).focus(); await page.keyboard.press('End'); }
      else await page.getByRole('button', { name: '继续播放', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-media-phase]')?.getAttribute('data-media-phase') === 'AWAITING_ACTIVITY');
      assert.equal(await paused(), true); assert.equal(await page.locator('form').count(), 1);
      return f;
    }
    async function choose(option) {
      await page.locator(`input[value="${option}"]`).check();
      await page.getByRole('button', { name: '提交答案', exact: true }).click();
    }
    async function capture(name) {
      const path = join(temp, name + '.png'); await page.screenshot({ path, fullPage: true }); screenshots.push(path);
    }
    await t.test('cue reaches from actual playback; wrong answer and correct-looking feedback stay paused', async () => {
      const f = await reach('feedback-alone');
      await choose('option-1'); await page.getByText('请再想一想', { exact: true }).waitFor();
      assert.equal(await paused(), true); assert.equal((await persisted(f)).complete, false);
      await choose('option-2'); await page.getByText('回答正确', { exact: true }).waitFor();
      assert.equal(await paused(), true); assert.equal((await persisted(f)).complete, false);
      assert.equal(await page.locator('.runtime-native-video').getAttribute('data-media-phase'), 'AWAITING_ACTIVITY');
      await capture('feedback-alone'); assertions.push('wrong and feedback-alone paused');
    });
    await t.test('one media owner, preserved back link; seek cannot bypass cue', async () => {
      const f = await reach('seek', true);
      assert.equal(await page.locator('video').count(), 1); assert.equal(f.restoreCount, 1);
      assert.equal(await page.locator('.runtime-teacher-executor,.runtime-teacher-stage,.runtime-teacher-image,audio').count(), 0);
      assert.equal(await page.getByRole('link', { name: '返回课程' }).getAttribute('href'), '/dashboard/courses/test-only?course=test-only');
      assert.equal(requests.filter(r => r.case === 'seek' && r.body.op === 'checkpoint').length, 1);
      assert.equal(await paused(), true); assertions.push('sole rendered video and one restore flight; seek blocked');
    });
    await t.test('correct durable state resumes only after a fresh independent read; refresh restores', async () => {
      const f = await reach('gate'); await choose('option-2');
      await page.waitForFunction(() => document.querySelector('[data-media-phase]')?.getAttribute('data-media-phase') === 'CHECKING_COMPLETION');
      assert.equal((await persisted(f)).complete, true);
      await new Promise(resolve => setTimeout(resolve, 120));
      assert(f.held); assert.equal(await paused(), true); assert.equal(await page.locator('form').count(), 1);
      await f.release();
      await page.waitForFunction(() => !document.querySelector('video').paused);
      assert.equal(await page.locator('form').count(), 0);
      await page.reload(); await page.waitForFunction(() => document.querySelector('[data-media-phase]')?.getAttribute('data-media-phase') === 'RESUME_READY');
      assert.equal(await paused(), true); assert.equal(await page.locator('form').count(), 0);
      await page.getByRole('button', { name: '继续播放', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('video').paused);
      await page.getByRole('slider', { name: '视频位置' }).focus(); await page.keyboard.press('End');
      assert.equal(await page.locator('form').count(), 0); assertions.push('fresh read only; durable refresh skips completed cue');
    });
    for (const name of ['stale', 'reordered', 'foreign', 'timeout']) {
      await t.test(name + ' read leaves UNKNOWN paused', async () => {
        const f = await reach(name); await choose('option-2');
        await page.getByText('作答结果暂时无法确认，视频保持暂停。', { exact: true }).waitFor({ timeout: 15_000 });
        assert.equal(await paused(), true); assert.equal((await persisted(f)).complete, true);
        assert.equal(await page.locator('fieldset').evaluate(fieldset => fieldset.disabled), true);
        assert.equal(await page.locator('input[value="option-2"]').isDisabled(), true);
        await capture(name); assertions.push(name + ' UNKNOWN paused');
        if (f.release) { await f.release(); await new Promise(resolve => setTimeout(resolve, 120)); assert.equal(await paused(), true); }
      });
    }
    await t.test('user pause survives late valid completion', async () => {
      const f = await reach('late'); await choose('option-2');
      await page.waitForFunction(() => document.querySelector('[data-media-phase]')?.getAttribute('data-media-phase') === 'CHECKING_COMPLETION');
      await page.getByRole('button', { name: '保持暂停', exact: true }).click();
      assert(f.held); await f.release();
      await page.getByText('视频保持暂停，可点击继续播放。', { exact: true }).waitFor();
      assert.equal(await paused(), true); assertions.push('user pause survives late valid read');
    });
    await t.test('pending refresh and narrow/mobile layout use actual styles and keyboard controls', async () => {
      const f = await reach('responsive'); await choose('option-1');
      await page.getByText('请再想一想', { exact: true }).waitFor(); await page.reload();
      await page.getByRole('button', { name: '提交答案', exact: true }).waitFor();
      assert.equal(await paused(), true); assert.equal(await page.locator('input[value="option-1"]').isChecked(), true);
      assert.equal((await persisted(f)).pending, true);
      for (const width of [768, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        const bounds = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
          video: document.querySelector('video').getBoundingClientRect().toJSON(),
          controls: [...document.querySelectorAll('.runtime-media-controls button')].map(b => b.getBoundingClientRect().toJSON()) }));
        assert(bounds.scroll <= bounds.width, JSON.stringify(bounds));
        assert(bounds.video.width > 0 && bounds.video.right <= width);
        assert(bounds.controls.every(b => b.height >= 44 && b.right <= width));
        await page.getByRole('button', { name: '保持暂停', exact: true }).focus();
        assert.equal(await page.getByRole('button', { name: '保持暂停', exact: true }).evaluate(b => b === document.activeElement), true);
        await capture('responsive-' + width);
        const radio = page.getByRole('radio', { name: '丁', exact: true });
        await radio.scrollIntoViewIfNeeded(); await radio.focus();
        assert.equal(await radio.isEnabled(), true);
        assert.equal(await radio.evaluate(input => input === document.activeElement), true);
        const submit = page.getByRole('button', { name: '提交答案', exact: true });
        await submit.scrollIntoViewIfNeeded(); await submit.focus();
        assert.equal(await submit.isEnabled(), true);
        const exercise = await page.evaluate(() => {
          const classroom = document.querySelector('.runtime-classroom').getBoundingClientRect();
          const form = document.querySelector('form');
          const lastRadio = form.querySelector('input[value="option-3"]').getBoundingClientRect();
          const submit = form.querySelector('button[type="submit"]').getBoundingClientRect();
          return { height: innerHeight, classroom: classroom.toJSON(), radio: lastRadio.toJSON(),
            submit: submit.toJSON(), focused: form.querySelector('button[type="submit"]') === document.activeElement };
        });
        assert(exercise.focused);
        assert(exercise.radio.top >= exercise.classroom.top && exercise.radio.bottom <= exercise.classroom.bottom, JSON.stringify(exercise));
        assert(exercise.submit.top >= exercise.classroom.top && exercise.submit.bottom <= Math.min(exercise.height, exercise.classroom.bottom), JSON.stringify(exercise));
        await capture('responsive-' + width + '-exercise');
      }
      assertions.push('pending refresh restores choice; 768/390/320 no overflow; radio/submit scroll into view and receive keyboard focus');
    });
    assert.deepEqual(errors, []);
    assert(requests.every(r => ['refresh', 'restore', 'checkpoint', 'submit', 'readback'].includes(r.body.op)));
    assert(network.every(url => new URL(url).origin === origin));
    await writeFile(join(temp, 'assertions.json'), JSON.stringify({ assertions, screenshots, requests, network, errors }, null, 2));
    t.diagnostic(JSON.stringify({ testOnly: true, temp, screenshots, assertions, requests: requests.length }));
  } finally {
    const cleanupErrors = [];
    async function clean(label, action) {
      try { await action(); } catch (error) { cleanupErrors.push({ label, error: String(error) }); }
    }
    for (const res of pending) await clean('held-response', async () => res.destroy());
    pending.clear();
    await clean('context', async () => context?.close());
    await clean('browser', async () => browser?.close());
    await clean('connections', async () => server.closeAllConnections());
    await clean('server', () => new Promise((yes, no) => server.close(error => error ? no(error) : yes())));
    // Persist evidence; dispose task-owned runtime state and generated bundle only.
    let stateFilesRemoved = 0;
    for (const f of cases.values()) await clean('state-file', async () => { await rm(f.file, { force: true }); stateFilesRemoved++; });
    await writeFile(join(temp, 'assertions.json'), JSON.stringify({ assertions, screenshots, requests, network, errors }, null, 2));
    await writeFile(join(temp, 'cleanup.json'), JSON.stringify({ origin, browserClosed: !browser?.isConnected(),
      serverListening: server.listening, pendingResponses: pending.size, stateFilesRemoved, cleanupErrors }, null, 2));
    assert.deepEqual(cleanupErrors, [], 'task-owned resource cleanup failed');
  }
});
