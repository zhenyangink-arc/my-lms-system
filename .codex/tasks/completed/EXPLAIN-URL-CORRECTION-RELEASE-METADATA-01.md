# TASK — Correct known platform URL and read one release metadata file

## Identity
TASK ID: EXPLAIN-URL-CORRECTION-RELEASE-METADATA-01
TITLE: Remove false URL blocker and observe only the installed Build-ID of the known local release
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED — no contract/source/auth/security changes; one bounded non-secret local metadata read, no execution/enable qualification
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high (focused report/diff audit, no repeat read)
MODEL ROUTING REASON: small document correction plus narrowly scoped local file observation; no system discovery
DISPATCH RECORD REQUIRED: YES

## Objective
Correct the mistaken request for a platform URL already in repository records. Safely read exactly one known non-secret installed-build metadata file, clearly separating on-disk version from live serving and Agent usability. Do not build a new general qualification reader or research programme.

## Context
User corrected that we supplied the platform address and asked to continue on 2026-10-03 after Supervisor promised a correction. Root now explicitly announced one read-only known release BUILD_ID check. Routine non-secret read-only file inspection is within resuming this diagnostic work; this does not authorize production DB/HTTP/Provider or First Enable. Prior completed preparation task remains historical, not an active blanket ban on this newly scoped file read.
Known URL https://kmgwak-system-product-name.taila18cd5.ts.net:8443 is a HISTORICALLY_DELIVERED_ENTRY. Source docs/TEXTBOOK_GRAMMAR_DEPLOYMENT_RESULT.md lines3,7,13 (2026-09-13); R3 production-operations gate lines99-105 binds same host/8443 to loopback3000 and uply-first-enable; R7D-A lines199-205 records 2026-09-18 deployment Build PjpaYHAz0asyvwh0G-lBo, Tailscale unchanged. Supervisor already sampled these actual lines. Do not rediscover URL or ask user for it again. Current site reachability, loaded binary, flags and Agent state are NOT VALIDATED.

## Scope
WRITABLE SCOPE:
- docs/EXPLAIN_READONLY_QUALIFICATION_PREPARATION.md: only correct stale URL-missing/next-step statements, append dated one-file observation with limitations and source references.
- new /tmp/explain-url-release-metadata-* report/evidence directory0700/files0600.
Supervisor owns this Task metadata. Verifier only new /tmp/explain-url-release-metadata-verify-*.
READABLE DEPENDENCIES:
- AGENTS/CODEX_WORKER/CODEX_VERIFICATION, this Task, current preparation doc
- three exact non-secret source docs above, narrowly decisive lines only
- completed EXPLAIN-TARGET-READMETHOD-PREPARATION-01 for prior bounds if needed
- ONLY current host release content read allowed: /home/yangzhen/releases/uply-first-enable-20260910/source/.next/BUILD_ID
- local standard library and path components metadata solely to safely reach this file.
FORBIDDEN: .env/runtime.json/launcher configs/credentials/private approvals/backup contents; other release file content; directories enumeration/broad process/container scans/PM2/Tailscale commands; HTTP/browser/network/DB/SQL/Provider/Agent/build/tests/import application runtime; services/restarts/flags/deploy/new reader implementation in repository; source/tests/fixtures/README/handoff/authority/history/locks changes; git mutation/push. Preserve all concurrent work.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO. All seven actual qualification gates remain NOT VALIDATED. Historical URL does not prove current reachability. Installed Build-ID does not prove process-loaded version or service mapping, sealed source closure or authorization. Current on-disk match does not validate First Enable, RPC/RLS/Student Policy, backup, budget or stop. No obsolete source-lock overwrite.

## Data / Security Impact
DB/RLS/Auth impact NONE. This task explicitly includes one read of live-host non-secret release-file metadata; do not claim production metadata accesses zero if it occurs. Production DB and business data accesses zero; no writes to runtime target.

## Requirements
1. Fresh-hash current prep doc before edit; expected initial da26b46a7a361fa43460a364e834a3f1aaf40d4200621fa4190288b4c03d5239. Stop doc mutation if unexpected drift, preserve user edits. Read known source references, no broad research.
2. One bounded observation of the exact BUILD_ID path. Python standard library os.open/read/fstat is allowed as a one-off observation, not a new product reader or reusable CLI. Anchor at /, open successive exact directory components with O_DIRECTORY|O_NOFOLLOW and dir_fd; open final file O_RDONLY|O_NOFOLLOW|O_NONBLOCK. Reject symlink/nonregular file, size<=0 or size>256 bytes, non-ASCII or malformed Build ID. Read at most257 bytes and compare fstat dev/inode/size/mtime_ns before/after; on change report INCONSISTENT_READ, no retry. Expected format is one nonempty ASCII [A-Za-z0-9_-]+ token <=128 chars with optional trailing LF only. No fallback/search. Missing/permissions/symlink/malformed are observations, no repair. Close all FDs. Do not follow arbitrary links or execute content.
3. Save timestamp, exact path, success/error safe code, bytes length/SHA, inode/device/file mode/mtime where available, sanitized Build ID only if valid, comparison with historical PjpaYHAz0asyvwh0G-lBo. No raw error/locals or secret dump. Query attempts=1 max; report successes/failures and observed limits. No HTTP probe, process identity or current serving claim.
4. Correct all current language in the prep doc saying user URL is missing. Add found entry and citations; acknowledge prior omission. URL is known as previously delivered, not currently tested. No more asking user for known locator. Do not change historical reports or original private WorkerReports.
5. Append concise dated observation/next step: if file valid, distinguish installed build from actual loaded build. A current process/HTTP/safety check is a separately specified action, not already performed. Conditional proposed generic reader is not needed for this single-file observation; remove it as an immediate prerequisite without deleting remaining full-qualification limitations. Do not invent live worker claims. Avoid another enormous document/review cycle.
6. Write concise full WorkerReport, precise diff, doc SHA, private observation SHA, static checks and counters. Standard-library checks and git diff --check only; no suites/build. No commit/push.

## Out of Scope
Actually enabling or certifying assistant, current serving inference, access to production business data, new runtime tooling, new authority, all seven qualification execution.

## Acceptance Criteria
Known URL corrected with source citations, exactly one bounded file observation or honest safe failure, no sensitive reads/side effects, accurate on-disk vs live distinction. No repeated generic inventories or fake authorization.

## Required Validation
Static output/diff/link checks only, plus explicitly scoped single-file observation. TYPECHECK/LINT/UNIT/INTEGRATION/E2E/MIGRATION NOT_REQUIRED. Verifier inspects saved observation/code and document diff; no second live read.

## Risk Focus
Wrong target, symlink/path escape, reading env or oversized files, treating file value as process version, stale docs and needless user questions.

## Parallelism
Serial worker then verifier. No source/worktree isolation needed; sole small doc scope. Others may edit repo; preserve unrelated changes.

## Escalation Rule
Any broader inspection needed: report scope request, do not perform. Filesystem access denial requires report; no bypassing sandbox or alternate sources. Single observation failure no repair/retry.

## Worker Report
CODEX_WORKER format, brief actual results/report hashes/counters and limitation.

## Verification Report
CODEX_VERIFICATION format, focused correctness/scope, no full history re-audit.

## Supervisor Acceptance — 2026-10-03
VERDICT: PASS for scoped document correction and single-file installedBuild observation only.
Worker report: /tmp/explain-url-release-metadata-pwhphipp/WorkerReport.md
Worker report SHA256: 1218cee5aae8880a3d65899394963db2eb52f352b845d05e35102d92e6e14d3b
Observation: /tmp/explain-url-release-metadata-pwhphipp/Observation.json
Observation SHA256: 37f94f9193c6e1e8bd754f83db02e0c2e0bb0272239fd372dbd7947e3d26ac27
Verifier report: /tmp/explain-url-release-metadata-verify-gefo0bks/VerificationReport.md
Verifier report SHA256: 3999dd03783e2510dc4aafa4cbb67b5c02c6c2aaeb9d0ac908e7a36aaf078d47
Output document SHA256: 580e46080fe84b31070d1958e407721b575a0884f9aff58409b09520bca6de21
Supervisor read actual Task, WorkerReport, Observation, Document.diff and VerificationReport. Scope accepted; no rerun of host observation. One non-secret live-host release metadata content read; DB/business/network/Provider/Agent/runtime-target writes zero. Installed build PjpaYHAz0asyvwh0G-lBo matches historical record. Current process-loaded build, site availability, sealed closure and all seven qualification gates remain NOT VALIDATED. This PASS does not approve First Enable or certify deployed assistant usability.
Next bounded action: establish actual current serving-process/release association for the known entry without secrets, then evaluate remaining first-use gates. Do not request the known URL again or require a new generic reader for the completed one-file observation.
