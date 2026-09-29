# R7C 精确写入计划（已批准，隔离范围已实施）

Target: hangul-introduction。Mainline: TEACHING AGENT。

用户已批准本文范围。最终结果及一项隔离负向测试范围偏差见正式报告和 db-write-boundary.json；原计划条目保留供对照。

只读预检 PASS；冻结内容 VERIFIED。当前目标 execution node / Activity / private answer 均为 0。

建议先在项目既有隔离 PostgreSQL 测试机制中验证实际域 SQL 持久化，不写当前运行数据库。通过后的最高结论为 CONDITIONAL / TEST-ENV VERIFIED，当前 canonical Activity binding 未验证。

## 修改产品文件

- `src/features/smart-textbook-runtime/core/execution-contracts.ts`
- `src/features/smart-textbook-runtime/core/native-media-controller.ts`
- `src/features/smart-textbook-runtime/core/runtime-facts.ts`
- `src/features/smart-textbook-runtime/server/native-execution-projection.server.ts`

## 新增产品文件

- `src/features/smart-textbook-runtime/server/native-activity-binding.server.ts`
- `src/features/smart-textbook-runtime/server/durable-activity-completion.server.ts`
- `src/features/smart-textbook-runtime/server/durable-activity-repository.server.ts`

## 修改测试文件

- `tests/teaching-agent-r7b-execution.test.mjs`
- `tests/teaching-agent-r7b-completion.test.mjs`
- `tests/fixtures/teaching-agent-r7b/server.mjs`

## 新增测试与 fixture

- `tests/teaching-agent-r7c-binding.test.mjs`
- `tests/teaching-agent-r7c-durable.test.mjs`
- `tests/teaching-agent-r7c-browser.test.mjs`
- `tests/fixtures/teaching-agent-r7c/postgres.mjs`
- `tests/fixtures/teaching-agent-r7c/bootstrap.sql`
- `tests/fixtures/teaching-agent-r7c/fixture.server.mjs`
- `tests/fixtures/teaching-agent-r7c/service-process.mjs`
- `tests/fixtures/teaching-agent-r7c/browser.tsx`
- `tests/fixtures/teaching-agent-r7c/README.md`

## 隔离数据库范围

每个 fresh fixture：digital_textbook_nodes INSERT 1、digital_textbook_activities INSERT 1、digital_textbook_activity_secrets INSERT 1；合法 synthetic 父链及测试身份 FK fixture，仅存在于隔离数据库，无 Auth 服务、无登录、无生产身份复制。

没有可用的通用正式创建 workflow，因此这三条 test-only bootstrap INSERT 也纳入此次明确审批；不声称它们是当前数据库官方 authoring 创建。

提交测试仅通过正式 7 参数 record_smart_textbook_attempt：每个 actor/activity 场景至多 20 条 attempt INSERT，node_progress 至多 1 条 INSERT 及后续官方 UPSERT；activity_page_progress=0；Cue DB=0。清理仅限本任务自建测试容器。

Current DB writes=0；Frozen writes=0；Migration=0；Publish/Provider/Agent/Pins=0；Feature OFF；Allowlists EMPTY；生产 Deploy/PM2/Runtime/Auth/Tailscale 修改=0。

## 实现合同

- Use existing single_choice/index private grader; load the activity parent, version and private answer under trusted server binding. Public projection includes only prompt/options/safe aliases and content binding hashes.
- Versioned response envelope in existing response JSONB carries submitted option coordinate, request correlation, execution binding digest and client generation. Existing grader receives the numeric response, not the envelope. No private correct key in response/facts/public manifest.
- Trusted server transaction port takes the SAME tenant/student/activity advisory lock as the existing RPC, checks persisted request correlation, rejects changed-payload reuse, then invokes exact existing atomic RPC within that transaction. This is a server transaction, not a new RPC or table. No PGRST202 fallback. Production transport is not wired.
- Independent fresh READ ONLY transaction reconstructs activity completion from correct attempts and verifies corresponding node progress in one consistent read. Any missing/inconsistent binding or unavailable evidence is UNKNOWN. Node progress and step/lesson completion remain distinct.
- Durable receipt evidence uses attempt sequence, safe evidence digest and database timestamps; these are evidence/freshness facts, not content revision or a fabricated CAS revision. Version receipt if semantics require it.
- NativeMediaController always performs independent readback after submit; submit response alone cannot resume. Keep current generation/duplicate/media/seek owner logic.
- Runtime facts expose bound public Activity alias, completion, attempt count/sequence and safe evidence, never actual answers or private grader config.
- Waiting restart uses a scoped browser observation hint for presentation only plus independent DB readback. Hint cannot mark completion or skip mandatory cue; invalid binding fails closed. Completed restore is solely from DB. Video position is not progress.
- Reusable R7B loopback harness permits injected async fixture/entrypoint; R7C child service process is destroyed and recreated against the same owned isolated DB. Existing LessonRuntime/MultipleChoiceBlock/media fixture remain reused.

## 验收和限制

- Real existing grader + actual atomic SQL writes; read-only independent query proves correct/wrong attempts and progress.
- Completed and waiting states rebuild after child service process termination/restart.
- Lost response committed/no-commit/unknown; no automatic resubmit; same request concurrent/restart dedupe; changed request payload rejected.
- Correct readback resumes; wrong/unknown hold; stale generation never resumes a new video.
- Public manifest, pre-submit DOM, browser bundle graph, HTTP DTOs, facts and logs contain no answer-key/config/authoring-answer leakage.
- R7B 108 tests retain coverage plus new R7C cases; typecheck/build pass; no new lint errors.
- R6F node/version/objective/canonical hashes and current DB/infrastructure end-state unchanged.
- Expected maximum classification CONDITIONAL / TEST-ENV VERIFIED; current development DB canonical Activity binding remains NOT VERIFIED.
- Published student admission NOT TESTED; no draft policy bypass.
- No safe production native test admission/official general activity create path established; do not invent or impersonate an existing user.
- Direct bare historical RPC remains non-idempotent; guarantees apply to the new trusted transaction seam, not arbitrary callers bypassing it.
- No migration proposed because response JSONB plus existing transaction lock can express correlation within approved isolated path; if actual implementation cannot uphold this, stop and report.
