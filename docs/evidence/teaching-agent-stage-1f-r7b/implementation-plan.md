# R7B 精确实施计划（已批准并实施）

目标：Teaching Agent Lesson Execution MVP。生产只读预检 PASS；R6F 8 个节点冻结基线 VERIFIED。该计划提交时产品代码尚未修改；用户随后明确批准，现已按范围实施。

本计划复用现有 LessonManifestV1、LessonRuntime、Activity 与 Progress 合同。新增的是同一 Runtime 内的媒体控制和执行合同，不创建第二套系统。

## 计划修改的产品文件

- `src/lib/smart-textbook-runtime-v1/contracts.ts`
- `src/lib/smart-textbook-runtime-v1/registry.ts`
- `src/lib/smart-textbook-runtime-v1/validator.ts`
- `src/features/smart-textbook-runtime/core/block-registry.ts`
- `src/features/smart-textbook-runtime/core/services.ts`
- `src/features/smart-textbook-runtime/core/target-registry.ts`
- `src/features/smart-textbook-runtime/components/runtime-context.tsx`
- `src/features/smart-textbook-runtime/components/runtime-root.tsx`
- `src/features/smart-textbook-runtime/components/block-renderer.tsx`
- `src/features/smart-textbook-runtime/components/region-renderer.tsx`
- `src/features/smart-textbook-runtime/components/choice-block.tsx`
- `src/features/smart-textbook-runtime/components/template-renderer.tsx`
- `src/features/smart-textbook-runtime/components/runtime.css`

## 计划新增的产品文件

- `src/lib/smart-textbook-runtime-v1/execution.ts`
- `src/features/smart-textbook-runtime/server/native-execution-projection.server.ts`
- `src/features/smart-textbook-runtime/core/execution-contracts.ts`
- `src/features/smart-textbook-runtime/core/native-media-controller.ts`
- `src/features/smart-textbook-runtime/core/runtime-facts.ts`
- `src/features/smart-textbook-runtime/components/video-block.tsx`

## 计划修改的测试

- `tests/smart-textbook-runtime-4a.test.mjs`
- `tests/smart-textbook-runtime-4a14.test.mjs`
- `tests/smart-textbook-runtime-4a-browser.test.mjs`

## 计划新增的测试

- `tests/teaching-agent-r7b-projection.test.mjs`
- `tests/teaching-agent-r7b-execution.test.mjs`
- `tests/teaching-agent-r7b-completion.test.mjs`
- `tests/teaching-agent-r7b-browser.test.mjs`

## 计划新增的开发 fixture

- `tests/fixtures/teaching-agent-r7b/fixture.server.mjs`
- `tests/fixtures/teaching-agent-r7b/server.mjs`
- `tests/fixtures/teaching-agent-r7b/browser.tsx`
- `tests/fixtures/teaching-agent-r7b/start.mjs`
- `tests/fixtures/teaching-agent-r7b/create-video.mjs`
- `tests/fixtures/teaching-agent-r7b/video.webm`
- `tests/fixtures/teaching-agent-r7b/README.md`

## 实施与验收

- Extend the existing strict LessonManifestV1 with an optional typed native execution field; no V2 or parallel schema authority. Server-only builder projects frozen Node5 and only public first-question semantics from Node7; validates through existing validator. Do not import the fixed chapter-one compiler/source/capsules.
- Reuse MultipleChoiceBlock and existing RuntimeServices activity submission boundary; existing ActivityExecutor remains the general activity renderer, no new question UI. Server fixture uses existing gradeSmartTextbookActivity and existing single_choice answer contract. Fixture completion is a bound server-owned receipt, not ActivityResult.ok or step completion.
- One native media controller subordinate to existing StepController generation/disposal and TargetRegistry. Video component reports media events/intents; only controller issues play/pause/seek. Native execution rejects mixed compat teacher blocks, so no parallel old TeacherTimeline execution.
- One fixture show_activity cue, immutable manifest-bound source/target/media revision; validate finite time and duration when available; mark pending before pause/reveal. Cue tracks pending/waiting/completed within scoped session/snapshot/step/media/cue identity.
- Typed COMPLETED/INCOMPLETE/UNKNOWN; bind request/session/snapshot/step/activity/attempt/generation plus server fixture state evidence. Separate content revision, student-state evidence and client generation. UNKNOWN invokes readback without resubmission; only validated COMPLETED allows resume.
- Same loopback fixture server retains isolated attempt/completion and pending interaction state across browser reload. Restore validates all bindings and reads authoritative fixture state; client video position is only an observation hint. This is not production durable progress.
- Use existing Learning Area, MultipleChoiceBlock and TemplateRenderer. Cue changes presentation to learning, then restores previous layout. Respect user pause; autoplay rejected once requires user action; media error halts cue advancement.
- Versioned read-only facts projection includes safe lesson/script/node/block/activity binding, runtime phase, completion summary, evidence/freshness and generation. Video time explicitly client-observed. No grading key, prompts, control commands, or Agent Tool registration.
- Loopback-only isolated harness imports existing LessonRuntime. No production Next route, StudentPolicy change or real student admission. Synthetic 30-second dev media fixture only, no TTS/provider/official video. Test browser has no production login.

## 测试场景

- happy path with real HTML5 development video
- wrong answer holds
- UNKNOWN submit no retry; completed and unknown readbacks
- duplicate timeupdate and completion callback
- backward seek after completion
- forward seek across earliest mandatory cue
- seek landing near cue
- refresh awaiting activity
- refresh completed activity
- invalid restore binding fails closed
- stale generation and disposed instance callbacks ignored
- user pause respected
- autoplay rejection yields manual resume without loop
- media error fails closed
- public manifest/DOM/browser bundle/log/facts answer leakage scan
- single presentation owner restores layout
- runtime facts before/during/after with evidence
- missing renderer/unknown action/unsupported activity fail closed
- cue source/target/time/policy validation
- frozen content and production boundary unchanged

## 写入边界

Frozen Content Writes / Production DB Writes / Migration / Agent Runs / Provider / Publish / Pins / Production Deploy = 0。Feature OFF，Allowlists EMPTY。

完成状态使用服务端隔离 fixture 与现有 grader 验证。即使运行闭环通过，也按 CONDITIONAL / FIXTURE LIMITATION 报告；不声称 Production Durable Progress 已验证。

按用户 R7B 第7节，获得本计划的明确批准后才开始修改产品代码；批准已取得。
