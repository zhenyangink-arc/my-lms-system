# TASK — 课程 Explain 部署配置来源追踪

## Identity
TASK ID: COURSE-EXPLAIN-CONFIG-SOURCE-04
TITLE: Trace the serving release configuration sources without changing the website
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_high | GPT-6.1 Sol high
ARCHITECT GATE: NOT_REQUIRED — read-only code/artifact analysis, no contract change.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
MODEL ROUTING REASON: Need distinguish repository implementation, deployed build and configuration loading order; bounded cross-file analysis with privacy constraints.
DISPATCH RECORD REQUIRED: YES

## Objective
Find the concrete configuration sources used by the serving release for the course Explain enable flag and three identity allowlists, and determine whether its disk build contains that Explain path. Advance beyond the already-completed runtime.json observation without repeating it.

## Context
User said continue after Task03 reported all four keys absent from the one measured runtime.json. Task02 bound entry/listener PID5778/release cwd and disk BUILD_ID; do not repeat live process probes. Task03 receipt HOLD/rc2, all four keys absent, does not prove live OFF or target denial. Root can operate reviewed narrow helpers if required, but this initial task phase is saved/static analysis only. Topbar Guide acceptance is complete and distinct. chen001's formal course/tenant binding remains unknown.

Known evidence: completed Task02 and Task03; /tmp/course-explain-eligibility-method-ef4o78n2/WorkerReport.md; /tmp/course-explain-config-rfly7r6u/PostReadWorkerReport.md; /tmp/course-explain-config-verification-r155b73s/VerificationReport.md. Serving disk root /home/yangzhen/releases/uply-first-enable-20260910/source, BUILD_ID PjpaYHAz0asyvwh0G-lBo, observed before this task, not a fresh loaded-build assertion.

## Scope
WRITABLE SCOPE: new private /tmp/course-explain-config-source-* directory0700/helpers/reports0600 only; Supervisor Task metadata.
READABLE DEPENDENCIES: AGENTS.md, CODEX_WORKER.md, CODEX_VERIFICATION.md, this Task, named previous reports and completed tasks; repository Explain transport/rollout/composition wiring and relevant source/deploy scripts; installed Next guide/implementation for exact configuration loading; known release package.json and Next generated route manifests/compiled server code necessary to trace Explain and four exact keys. Minimize reads, do not dump minified bundles. Use exact-path or token-presence/offset/hash reduction and output only known feature/config identifiers. No raw string-literal dump from startup scripts: use existing masked analysis, or freshly mask literals before output if essential. Known fixed launcher /home/yangzhen/.config/uply-first-enable-20260910/start.mjs is source code only, not permission to read adjacent private data.
May lstat only precisely derived Next env candidate filenames under release cwd; NO env file content read yet. No broad disk search. If actual additional config content is necessary, report exact derived paths, four-key-only extraction method, parser semantics and precedence; Supervisor reviews before any runtime/data read. Do not submit a hidden child live-read escalation.
FORBIDDEN: runtime.json re-read; .env/private credential contents; process environ/cmdline; PM2 metadata/logs; raw bundled secret literals; business data/target IDs/cookies/HTTP/browser/DB/model requests; executing application/Next startup, tests/build/deploy/restart/activation; source/config/test/docs changes; repair or assume missing settings. No other project or unrelated release scan. Preserve concurrent edits.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO
All config values/readiness/eligibility not directly established stay NOT_VALIDATED. Only four keys relevant: TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED, TEACHING_AGENT_ALLOWED_TENANTS, TEACHING_AGENT_ALLOWED_USERS, TEACHING_AGENT_ALLOWED_COURSES. Historical Student GUI is not proof of first-use qualification.

## Data / Security Impact
DATABASE IMPACT: NONE
RLS IMPACT: NO
AUTH IMPACT: NO
SECURITY IMPACT: bounded static evidence only; do not expose secrets or broaden permissions.

## Requirements
1. Read saved method/report first; do not rediscover already-known in-process Object.assign and Next env loading by re-executing snapshots.
2. Trace repository feature to deployed route entry and its config evaluation. Distinguish absent source files (normal in builds) from feature absent; a single missing grep token does not prove feature absent.
3. Use exact generated route manifest and necessary bounded compiled dependencies to prove whether feature/config code exists on disk; report limits of any negative result.
4. Derive exact startup/env precedence from installed deployed version code if available. State which sources measured vs merely possible. No speculative loaded-config result.
5. Return one concrete next operation that will resolve missing facts, or a definitive bounded conclusion that no further config read can resolve deployment/code absence. Avoid starting another generic recovery/authority/AgentRun investigation.
6. No current activation or guessed target. Only report necessary checks for chen001/course identity; do not query them.

## Acceptance Criteria
A source map with direct evidence for deployed feature path and exact config inputs, finite remaining uncertainty, privacy preserved; usable plan for next authorized read if necessary. No repeated Task02/03 runtime checks.

## Required Validation
TYPECHECK/LINT/UNIT/INTEGRATION/E2E/MIGRATION: NOT_REQUIRED.
Static saved/artifact review and independent verifier review. No actual live config read in Worker phase.

## Parallelism
CAN RUN IN PARALLEL: NO (single analysis owner; independent review follows).

## Escalation Rule
Need new config/data source or implementation -> SCOPE_CHANGE_REQUEST with exact minimal operation; no self-expansion. Root retains scope/acceptance and ordinary permission handling.

## Worker Report
Use CODEX_WORKER.md; report completed facts, NOT_VALIDATED fields, exact paths/line or token evidence, counters, next minimum action. Private report only.

## Verification Report
Use CODEX_VERIFICATION.md; saved/static only; no live reproduction or config reads.


## Supervisor Final Review — 2026-10-05
DISPOSITION: PASS for the bounded static source map. Actual Explain readiness remains NOT_VALIDATED.
Worker and independent Verifier agree: the known serving disk release contains the three teaching-agent run routes, Explain admission/pinned-segment code, four direct process.env key reads, and Korean lesson integration. This is positive disk-artifact evidence, not loaded-process execution or model readiness.
Installed release Next version16.2.10 and its loader source establish possible inherited environment plus historical runtimeJSON assignment and Next env loading. All six precise production/test env candidate paths returned ENOENT at the Worker observation2026-10-05T04:55:45.817165+00:00. No env contents, runtimeJSON, process environment or business data were read in Task04. Absence now does not prove startup absence or liveOFF.
User selected 韩语1级 for chen001. No exact lesson or database UUID binding has been inferred. The next operation is a separately scoped existing-browser DOM observation in Task05. Only the specific 课文讲解/교재 설명 section and 解释这句话/이 문장 설명 action count as Explain integration signals; a generic 金老师 name does not. A positive UI signal proves that render passed its admission/publication prerequisites, not a later Run or current-process reauthorization. Host learning tracking can write on activity/visibility/unmount, so DOM observation is separated from navigation and sending a prompt.
No implementation, configuration, model, DB, browser or deployment action occurred in this static task. Prior topbar and Task02/03 results remain unchanged. Root reviewed the actual reports; Verifier did not repeat runtime observation. Do not repeat completed source/config scans to substitute for actual eligible UI observation.
Artifact bindings:
- /tmp/course-explain-config-source-l2m5do3_/WorkerReport.md
  SHA256: 505cf76906d394aa5ffbada40ba3a728bc8e4b5beb6e106faeabc79c8b7f1fea
- /tmp/course-explain-config-source-l2m5do3_/StaticEvidence.json
  SHA256: da81792f6af21578a58a15fb2fbec957ce0100303d9806ecf2b4bf1d8b1d6a2c
- /tmp/course-explain-config-source-verification-5a5pclg0/VerificationReport.md
  SHA256: 9b445ffb5c35ce36a10ac9f185a405850159cf2045dcdee899b00b16be5f9d9d
