# TASK — 课程 Explain 四项配置只读核对

## Identity
TASK ID: COURSE-EXPLAIN-CONFIG-READ-03
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
METHOD REVIEW: worker_high | GPT-6.1 Sol high (completed)
ARCHITECT GATE: NOT_REQUIRED — no Auth/config/API implementation change.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
DISPATCH RECORD REQUIRED: YES
REASON: Fixed single-file four-key projection, frozen parser semantics and strict redaction; root executes reviewed helper to avoid hidden child approval waits.

## Objective / Context
用户明确批准继续核对课程内金老师的启用开关及学生/课程资格。先取得实际磁盘配置事实，保留有效进程配置和未绑定目标的不确定性；不启用、不发Run。
完成的Task02已证明knownentry→loopback3000→PID5778→historicalreleasecwd及diskBUILD_ID关联。运行启动器在同进程Object.assign(process.env,config)后import Next，Next又加载env，因此/proc initialEnv不足以证明effectiveConfig，不执行它。
方法报告 /tmp/course-explain-eligibility-method-ef4o78n2/WorkerReport.md SHA256 c785ff00a5ef5f4ee72532cb476ce3cec59699ec319d7479aa054c62cbb967f6。
已合法固定配置文件 /home/yangzhen/.config/uply-first-enable-20260910/runtime.json（inventory.py:21）。此次授权只投影所需四键，不输出/保存其它字段或值；禁止读取其它配置、凭据文件或业务数据。

## Scope
WRITABLE SCOPE: new private /tmp/course-explain-config-*/helper, synthetic sanity evidence, redacted receipt, reports; directory0700/files0600. Supervisor Task metadata only.
READABLE DEPENDENCIES: rules/this Task/bound method report; repository transport-config.ts/rollout-policy.ts; existing installed zod parser through repository package.json. No new packages.
Operator live read: exactly fixed runtime.json once, using O_NOFOLLOW, regular-file check, private permission check and <=64KiB before read; fdstat before/after inode/device/size/mtime/ctime consistency; save sourceSHA/bytes/metadata not raw content. No writable target fd. Root calls reviewed helper once using normal escalation; Worker does not submit live read.
FORBIDDEN: repository code/test/config/README/otherdocs changes; configuration writes/activation/restart; .env, proc environ/cmdline, PM2 metadata/logs, othercredentials, browser/cookies, HTTP/network/DB/Provider/AgentRun; raw runtimeJSON or raw target values in output/report/stdout/errors; extracting other keys; reading target IDs from private sources or guessing them; fallback paths; retries upon gate failure.

## Frozen Rules / Data Impact
Only own-key exact projection:
TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED
TEACHING_AGENT_ALLOWED_TENANTS
TEACHING_AGENT_ALLOWED_USERS
TEACHING_AGENT_ALLOWED_COURSES
Missing flag -> onDiskEnabled=null, unknown. String flag -> true iff exact 1 or true (repository evaluator); other strings false with recognition field. Wrong type -> malformed/null, no coercion.
Lists: string.trim().split(/[\s,]+/).filter(Boolean), raw token max256; every token must pass installed z.uuid().safeParse; lowercase Set; no guessed UUID regex. Empty explicit string valid count0; missing or nonstring -> unknown/malformed/null count; invalid or overlimit -> validfalse/effectiveSetCount0, matching repository failclosed. Never emit token/list/id/raw string or unknown config keys.
Use installed zod as a pure dependency, not application bootstrap; record ruleSource=repository-static and loadedEvaluatorParity=NOT_VALIDATED. No current-production evaluator parity inference.
Target prep has no fully bound chosen tenant/student/course IDs. Do not silently nominate chen001 as formal FirstEnable target. targetKnown=false; all target membership results=null/NOT_VALIDATED. No DB lookup in this task. Explicit onDiskOFF or empty list can establish a disk-config blocking condition only; never infer target denied or liveconfigOFF.
Config has possible secrets in same JSON; reader may parse the single authorized file locally but must never semantically extract/output/persist unrelated fields or include raw parse exception text. Failures must be safe closed codes. No whole config spread/logging. Root report public summary excludes private UUIDs/values/path internals.

## Requirements / Acceptance
1. Worker prepares minimal Node .mjs reader, source profile check, synthetic pure sanity incl secretsentinel not output, exact flags, invalid/missing/empty lists, UUID validity,256limit, wrongtype. Tests only synthetic in memory; no runtime access until root execution.
2. Same parser shared by synthetic and live projection, retain unknowns. No generic config framework/new schema/module.
3. Valid read emits only redacted JSON and receipt hash, file metadata and timestamp, actualrc. On malformed/type/security drift output safe HOLD and stop, do not broaden.
4. Receipt created exclusively in private directory; fsync and readback. Root executes once after static review, then Worker interprets actual receipt. Independent saved-only verification must not reread runtime.json.
5. Explain readiness remains NOT_VALIDATED except specifically observed disk facts. No provider/free-use claim or activation permission inferred.

## Required Validation
Application tests/build/E2E/DB: NOT_REQUIRED and not run. Helper synthetic sanity and independent static privacy/savedreceipt review only. Source/config changes0, runtimefile reads<=1 on actual invocation; no retries.

## Parallelism / Escalation
Single reader/operator, no concurrent mutable resource. Out-of-scope data or service action -> stop/report, no inferred authority. Ordinary tool permission handled root-side after user's stated authorization.

## Reports
Short CODEX_WORKER report and CODEX_VERIFICATION report; separate prepared/not-run state from live observation. Supervisor final PASS only for bounded configuration observation; membership/effective runtime limitations retained. Stop after the relevant observation, no follow-on activation.


## Supervisor Final Review — 2026-10-05
DISPOSITION: PASS for bounded on-disk configuration observation only.
OBSERVATION RESULT: HOLD; actual tool exit code 2. Course Explain readiness remains UNDETERMINED / NOT_VALIDATED.

The user authorized this specific read-only check. Root operated the reviewed Worker-authored helper exactly once after checking its hash and absence of its receipt; no retry occurred. The actual receipt timestamp is 2026-10-05T04:39:51.442Z. Independent verification inspected saved artifacts only and did not re-read runtime configuration.

Observed source bytes: 1614. Source SHA256: 7a4b31b099fb968dd1105f8fbc67b946ae3fa79c30873998f8864ef1578878c8. All four requested own keys are absent:
- TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED
- TEACHING_AGENT_ALLOWED_TENANTS
- TEACHING_AGENT_ALLOWED_USERS
- TEACHING_AGENT_ALLOWED_COURSES

All four projected states are unknown; enabled, counts and target memberships remain null. This is not evidence of live OFF, explicit empty allowlists, target denial or readiness. diskBlockingCondition=false means no explicit blocker was established from the four-key disk projection; it does not mean usable. Startup may supply configuration from other sources. Effective runtime settings, loaded evaluator parity, the chosen tenant/student/course identity and eligibility remain NOT_VALIDATED. The completed topbar Guide acceptance and prior service association remain unchanged.

Operation summary: one authorized runtime file read; configuration/source/test/service changes 0; HTTP, DB, Provider and Agent Run requests 0. Only private reports/receipt and Supervisor Task metadata were written. git diff --stat returned empty for tracked files before archival. Synthetic 19 checks/exit0 are preparation-reported, not independently rerun; application tests/build/E2E were not required or executed.

Worker preparation report preserved at /tmp/course-explain-config-rfly7r6u/WorkerReport.md, SHA256 4a3415f843484b4691fc94c6fea72eb1ee0f4f213d561aba4d06de0d29f20eb6. A visible scheduling record for the post-read Worker was mistakenly emitted immediately after creation; this ordering deviation was explicitly disclosed. The independent Verifier was announced before creation.

Artifact bindings:
- /tmp/course-explain-config-rfly7r6u/reader.mjs
  SHA256: d68216ffc6c21f28b1607af95ba3abdbddd4a31c82adc32189c9ce4a327076ae
- /tmp/course-explain-config-rfly7r6u/receipt.json
  SHA256: fc76bb37339acd65fb004041ae392bea35d5018bbc7a032faabd31547ee22561
- /tmp/course-explain-config-rfly7r6u/PostReadWorkerReport.md
  SHA256: 793708d25746275c80b74b5f19d1c4018b4a81722f6cf0459b57c0b467bc8eee
- /tmp/course-explain-config-verification-r155b73s/VerificationReport.md
  SHA256: 8be52f1559874e36e9444e888df5d4e165c67816bb9c8ac6f92018cfacc29bd6

Next minimum work: establish the serving deployment's actual Explain configuration source and then a chosen eligible student/course through a separately bounded method. Missing disk keys do not authorize adding configuration or changing allowlists. No activation, restart, model request, target lookup or further configuration read was performed or approved by this completed observation. Do not repeat Task02/03 as a substitute for resolving these remaining facts.
