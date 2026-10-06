# TASK — 课程内 Explain 当前服务只读核对

## Identity
TASK ID: COURSE-EXPLAIN-RUNTIME-RESUME-02
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED — observe existing local service only; any Auth/runtime contract change needs a separate gate.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
MODEL ROUTING REASON: 已明确入口和端口的少量只读运行信息，比对现有证据，无实现决策。
DISPATCH RECORD REQUIRED: YES

## Objective
核对课程内单句 Explain 所在网站的当前 HTTPS 入口、loopback listener 和磁盘构建关联，明确哪些启用条件仍未验证。不要重做已完成准备或顶部 Guide 验收。

## Context
用户明确选择继续课程内教学助手。已有 Worker 只读恢复确认：目标/读取准备与网址纠正已完成；此前仅观察磁盘 BUILD_ID PjpaYHAz0asyvwh0G-lBo，不能代表现在 serving 或 loaded process。已知网址 https://kmgwak-system-product-name.taila18cd5.ts.net:8443，历史路由为 loopback3000，历史 PM2 名 uply-first-enable。用户当前批准普通只读本机运行状态核对，不代表新生产凭据、数据库、Provider或Agent Run授权。

## Scope
WRITABLE SCOPE: new private /tmp/course-explain-runtime-* (directory0700/files0600) helper/receipts/WorkerReport only. Supervisor Task metadata only.
READABLE DEPENDENCIES: AGENTS.md, CODEX_WORKER.md, this Task, docs/ASSISTANT_AGENT_HANDOFF.md, completed ASSISTANT-LAUNCH-DEPENDENCIES-01.md, preceding course_assistant_resume WorkerReport when supplied.
Allowed fresh reads: tailscale serve status --json (retain only known host:8443 matching handler/Proxy and relevant counts; no raw unrelated mappings); ss -H -ltnp 'sport = :3000'; for unique fresh listener PID only readlink /proc/<pid>/cwd and exe, comm and ps pid/ppid/comm/lstart fields. Repeat that narrow ss once at end solely for same-PID consistency, no probing other ports. At most two parent process identity-only metadata hops to understand child/server chain, no cmdline or environ. Read exactly known .next/BUILD_ID under actual mapped application cwd or previously pinned release path if cwd itself is release root; do not traverse arbitrary folders to find another build. File bytes/metadata/hash only. Match source root to historical release; do not equate disk file with loaded image.
Forbidden: .env, credentials, process environ/cmdline, PM2 jlist/dump/logs, raw service logs, browser/cookies/token/storage, new network/HTTP/DB/Provider/Agent requests, PM2 start/stop/restart, service/deployment config edits, broad process/port/file scans, tests/build/install, mutations other than private /tmp and Supervisor Task metadata.

## Contracts / Data Impact
MAY CHANGE PUBLIC CONTRACT: NO
DATABASE IMPACT: NONE
AUTH / RLS IMPACT: NO
SECURITY: limited metadata only; do not include host/IP/private identifiers beyond necessary private report; concise public explanation.

## Requirements
1. Preserve prior topbar Guide acceptance and course setup results; no repeated live examples.
2. No missing historical helper reuse: /tmp/uply4b0-process-readonly.mjs is gone, process.py/start-stop/deploy-harness preflight are not allowed substitutes.
3. Use direct read-only commands or a small stdlib-only temporary reducer. Output allowlisted facts; no secret environment or raw mappings.
4. If listener PID missing/multiple, permissions denied, or mapping differs, record exact limitation and stop dependent reads. Do not guess or scan unrelated processes. Ordinary sandbox escalation if needed; never bypass rejection.
5. Distinguish entry-to-listener, cwd-to-disk-build, process-loaded-build, live flags/allowlists/published pins/StudentPolicy/provider readiness. The last categories remain NOT VALIDATED absent direct existing evidence. Do not treat topbar chat success as Explain enablement.
6. Preserve direct stdout/rc for safe narrow commands and only reduced tailscale output. Record timing and changes=0. Do not claim a comprehensive runtime health check.
7. Return a concise WorkerReport with current facts and one concrete minimal next step; no giant new gate chain, no fresh workflow invented. If insufficient data, name the exact missing piece.

## Out of Scope
Activation/deploy/model run, source fixes, historical recovery/authority experiments, course navigation/progress writes, production data reads.

## Acceptance Criteria
Honest current source-serving association with explicit uncertainty; no secret data collection, no runtime mutation, no duplicated finished checks.

## Required Validation
TYPECHECK/LINT/UNIT/INTEGRATION/E2E/MIGRATION: NOT_REQUIRED.
Read-only command receipts plus independent saved-evidence review. Do not rerun commands for verification.

## Parallelism
Single runtime observer; doc review may be parallel. No mutable runtime operations.

## Escalation Rule
Scope change / credentials / service mutation / Auth decision => report; do not broaden. Missing command/result => NOT VALIDATED.

## Reports
Follow CODEX_WORKER.md and CODEX_VERIFICATION.md. Private short report and SHA; source/test/config changes0. Stop after current observation.


## Supervisor Final Review — 2026-10-05
DISPOSITION: PASS for limited saved-evidence service association. No Explain enablement or real-run approval is implied.

The user explicitly authorized the prepared read-only snapshot. Earlier child tool requests were interrupted without execution receipts and remain unproven. Supervisor acted as execution operator for the unchanged Worker-authored helper in the root tool channel after confirming the receipt was absent; actual exec exit code 0. Worker interpreted the saved result; independent Verifier reviewed it without rerunning commands. This tool handoff did not restart or modify the website.

Actual observation: 2026-10-05T04:08:40.604859+00:00 to 04:08:40.704985+00:00.
Known HTTPS entry maps to http://127.0.0.1:3000; exactly one listener PID5778. Its cwd is /home/yangzhen/releases/uply-first-enable-20260910/source and executable is the installed Node binary. Parent process metadata identifies PM2, without establishing the application name. Final PID and starttimeTicks match the initial observation.
The fixed cwd/.next/BUILD_ID file contains PjpaYHAz0asyvwh0G-lBo (21 bytes), SHA256 b8d14107c79e66491bbb8ce920f4963882aa2756a206caee18fe7a4105bd5b12, with stable file metadata. This is a disk-build association, not proof of the complete process-loaded build or current HTTP behavior.

Explain current enabled flag, tenant/user/course allowlists, published content pins, StudentPolicy, DB/Provider readiness and a real explanation remain NOT VALIDATED. The prior Guide PASS and earlier completed Explain preparation stay unchanged. No new code defect was established and no recovery/authority investigation was reopened.

The next meaningful work is a scoped check of actual Explain enablement and the chosen student/course eligibility. This task did not authorize or execute environment/credential reads, business-data reads, activation, Provider calls, Agent Runs or deployments. Do not repeat this completed association as a substitute for those facts.

Artifact bindings:
- /tmp/course-explain-runtime-_qrgd9ip/WorkerReport.md
  SHA256: 11c474ed3bc430c34094d1493d4e84c19a08285a30eb5e3a98f72383cffa7627
- /tmp/course-explain-runtime-_qrgd9ip/snapshot-receipt.json
  SHA256: 304ff8424f3aa992736fea005841b66024182dcb647acca28fd0e8acb51fdc03
- /tmp/course-explain-runtime-verification-0fx4xyxh/VerificationReport.md
  SHA256: c97c3dc4cebe34c4702864fdb706584aa1bee661193d4615547204ca8395aa22

Supervisor reviewed actual tool output, static helper, WorkerReport and VerificationReport. Source/tests/config/service changes0; HTTP/DB/Provider/Agent requests0 in this observation; only private evidence and Supervisor Task metadata written.
