# TASK — 已批准的 chen001 学习助手统计只读核对

## Identity
TASK ID: ASSISTANT-STATS-READONLY-CHECK-04
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_high | GPT-6.1 Sol high
ARCHITECT GATE: NOT_REQUIRED for bounded read through existing capability; any change to Auth/RLS/API/schema remains forbidden.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high, review executor before live read and saved evidence afterward; no duplicate live run.
DISPATCH RECORD REQUIRED: YES
MODEL ROUTING REASON: Exact current-learner identity, credential-safe existing configuration use, restricted read executor and source-equivalent arithmetic need careful bounded reasoning.

## Objective
Execute one explicitly approved, model-free, read-only comparison of chen001's current guide statistics against the previously reported node/test/pending values, with direct evidence and clear snapshot limits.

## Context / Authorization
User was asked: use existing server configuration for a one-time read-only check of chen001教材进度、测评、待办汇总, including necessary connection/identity checks; only aggregate results, no passwords/output, no writes or model calls, stop if identity/read-only conditions cannot be confirmed. User explicitly answered 批准 in the current turn. This grants the limited configuration and source-record access that prior PLAN-03 did not authorize. Do not ask again for this same approved action. It does not authorize a new endpoint, unrestricted admin reads, unrelated students, old recovery work, application changes or retries.
Previous limited manual chat and records UI PASS remain accepted. No repeated GUI/login/source inventory. Original answer claimed 5 completed nodes/100%, 4 chapter records/38 of40/95%, no pending tasks. Current snapshot cannot prove historical answer-time correctness or serving-source parity.

## Scope
WRITABLE SCOPE: Worker new private /tmp/assistant-stats-read-* helper/reports/receipts only (0700 dir/0600 files). Supervisor Task metadata only in repo.
READABLE DEPENDENCIES: AGENTS.md/role manuals; PLAN-03 and its directly bound Reports; guide-agent-progress/login-id/auth/admin and directly needed generated types/schema evidence; existing project configuration limited to necessary connection variable names and in-process values, never emitted to model/tool/log/report. No broad filesystem search.
FORBIDDEN: modifying source/tests/config/secrets/roles/RLS/schema/fixtures/authority; credentials in argv/stdout/stderr/report/chat; cookie/profile/storage/session token extraction; unrelated private approvals/dumps; auth listUsers enumeration, login/password auth mutation; browser/model/chat/RPC, INSERT/UPDATE/DELETE/UPSERT, Docker/tests/build/install/deployment; new public API, arbitrary SQL or transport fallback and retries. No old recovery tools.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO.
Exact project jubdbsjsalpecfvseskz (my-lms-system), target login chen001, expected tenant yuanzhi. Unique identity/student membership required. Bind one existing connection/transport and concrete SELECT or GET allowlist before live execution. Elevated credentials alone do not enforce read-only; helper must constrain method/host/path/query/response/timeouts and output. Follow normal tool escalation for network/filesystem; do not bypass denial. A sandbox-level failure before a request reached the service is not an application retry, but ambiguous transmission must be recorded and no retry made.

## Data / Security Impact
READ_ONLY current project/learner. Existing necessary connection configuration may be consumed only inside private helper process under user's explicit approval, not printed. In-process filtered raw values used for aggregation may not be dumped; persist only aggregate/opaque matching checks and sanitized timing/status/source references. No other-user row fetch or credential logging.

## Requirements
1. Preflight first: narrow git/Task state; existing connection key availability/project match as booleans only; select concrete transport and exact-email/username identity lookup based on actual source/schema, not guessed profiles.username or other-user auth enumeration. No live network in initial preparation; submit helper and report for Supervisor/verifier review.
2. Strict target host/TLS verification and project-ref equality; reject redirects or alternative targets. Service credentials read at execution time from one bound existing file/source only. No secret values in executable/source evidence or environment dump. On unavailable safe existing lookup/transport, stop with the exact prerequisite rather than build a new API.
3. Identity phase requires exactly one source-compatible active permitted student profile/membership, real joined active tenant slug yuanzhi, and exact user binding. Membership role is authoritative; reject ambiguous/missing/other-role/platform-only identity. No arbitrary default/oldest membership fallback. Opaque UUIDs only in process, not report.
4. Freeze helper source reference and raw SHA. Preserve original selected fields, tenant/student filters, order/NULL behavior and limits. Respect implicit PostgREST caps: source absence of LIMIT is not unlimited; no DISTINCT/latest-per-assignment rewrite or pagination/truncation/new tie-breaker masquerading as the original helper. Ambiguous cutoff/ties/read-errors => HOLD/NOT VALIDATED, not zero.
5. Private approved queries for node progress, chapter attempts, published assignments plus this learner's target/submission rows only. Optional bounded recent-lesson projection only if necessary for the original claim and previously reviewed scope; otherwise omit. Do not fetch content/passwords/full student histories. Return node/attempt/pending aggregate only, read timestamp, errors and source-window/uncertainty caveats.
6. Freeze original arithmetic Number(x)||0, rounded node mean and two-decimal pooled accuracy, zero-total null, pending all_students/selected targeting plus absent/revision_required latest returned submission then slice10. A cap-reached case is not unrestricted global truth.
7. One finite logical read attempt, zero automatic retry, per-call timeout and response size cap. Bind exact maximum request sequence in reviewed helper. GET sequence is not an atomic snapshot; record start/end/per-query times. Do not refresh the assistant response or call the model.
8. After offline verification and Supervisor approval of exact helper SHA, execute once with existing user authorization. If platform/sandbox denies network, use ordinary permitted require_escalated only for unchanged reviewed helper; no bypass. Do not rerun after a received service response/error. Freeze results for independent saved-evidence review.
9. No broader numeric claims than evidence: equal current aggregate supports a current comparison only, not old response-time snapshot/production security/full teaching-Agent certification. Report mismatches as actual measured differences with source/timing caveats; do not fix them in this task.

## Out of Scope
Code fixes, new data-source UI/API, recovery/authority/provenance deployment chains, production writes, new prompts, second read experiment or rerun.

## Acceptance Criteria
Concrete reviewed read executor and direct current-learner aggregate evidence, or a precise failure with no fake zeros. Secret-free evidence, target/identity matched, method constraints preserved, no mutation. No repeated already-passed UI checks.

## Required Validation
Offline helper syntax/static/pure fixture checks permitted; no repository suites. Independent verifier reviews exact private helper before execution and evidence after execution without live requests. Supervisor checks hash binding and accepts PASS/REVISE/BLOCKED/UNDETERMINED appropriately.

## Risk Focus
Wrong learner/project, broad privileged reads, credential logging, implicit response cap and ordering differences, historical/current snapshot confusion.

## Parallelism
Preparation and review sequential; one Worker owns the live executor. No concurrent GUI/DB/model operation. Other repository work preserved.

## Escalation Rule
If a new auth/schema/API capability or wider data domain is necessary, stop; do not broaden approval. Runtime errors yield saved evidence, no retry/fix-run loop.

## Worker Report
Per CODEX_WORKER.md; actual transport, constraints, hash, commands/counters, safe results and limitations.

## Verification Report
Per CODEX_VERIFICATION.md; exact helper review and later saved receipts, no repeated live run.


## Supervisor Final Review — 2026-10-04
DECISION: PASS for the approved current-statistics read-only comparison.
User authorization: explicit 批准; no repeated approval required or sought.
Execution: one live logical attempt, six fixed HTTPS GET requests, six HTTP200 responses with complete count checks, Node exit0, zero retries. Unique chen001 profile / active yuanzhi / active student membership matched. No source/test/config/business-data modification, model invocation or additional user prompt.
Observed interval: 2026-10-04T05:56:46.846Z through 2026-10-04T05:56:48.802Z (Korea 14:56:46–14:56:48).
Current comparison: completed smart nodes5; average node completion100%; chapter assessment records4, correct38/total40, pooled accuracy95%; pending assignments0. All match the earlier user-provided figures. Published assignment count0 caused the original conditional targets/submissions reads to be omitted. No cutoff/truncation observed.
Important scope: current sequential reads are not an atomic snapshot or evidence of the historical response-time state; deployed-source parity and broad teaching-Agent/security certification remain NOT VALIDATED. Recent-lesson claim was not part of this numeric read. Previously accepted manual-chat and UI observations were not rerun.

### Bound evidence
- Executor: /tmp/assistant-stats-read-preflight-2vhrpkxs/executor-v3.mjs
  SHA256: 980c1906b312da335f4a707ed8194b246400163a1041d3bf8b4e478a8394b2b6
- Pre-live Verification: /tmp/assistant-stats-v3-verification-vljlxh2n/VerificationReport.md
  SHA256: 721d54dc176f64d69335334bd641a4a057af9ed04799d0d0e3eb5ac410d986ee
- Aggregate receipt: /tmp/assistant-stats-read-preflight-2vhrpkxs/LiveAggregateReceipt.json
  SHA256: bebb115800b1ff8cba13abb6c74b4c0f9c18a766a180fffaa8d03a852a22d088
- Execution receipt: /tmp/assistant-stats-read-preflight-2vhrpkxs/LiveExecutionToolReceipt.json
  SHA256: 98c253f057d929bfe9b123f9e430a0e7d9f14a438c4828cc8256a61907968a5f
- Worker Report: /tmp/assistant-stats-read-preflight-2vhrpkxs/WorkerLiveReport.md
  SHA256: ab6c2c40e515e0d2ef645ea11d75cd8b84c009ee0be0526a642cbe7edf85ca88
- Saved-evidence Verification: /tmp/assistant-stats-v3-verification-vljlxh2n/LiveVerificationReport.md
  SHA256: 602031338d79c065a331c2c33f3fc61503806ebf6daae93217beabd6509dc099

Supervisor read actual reports, executor diff and aggregate receipt, accepted independent PASS. No more live requests or code changes required. Completed Task archived under project workflow; private evidence remains private. Execution streams were combined by the tool, so no separate stderr-empty claim is made.
