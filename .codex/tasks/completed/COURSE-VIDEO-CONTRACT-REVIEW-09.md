# TASK — Recover intended Korean1 video teaching and gated question workflow

## Identity
TASK ID: COURSE-VIDEO-CONTRACT-REVIEW-09
TITLE: Recover intended Korean1 video teaching and gated question workflow
STATUS: SPECIFIED

## Routing
IMPLEMENTATION PROFILE: worker_high | GPT-6.1 Sol high
ARCHITECT GATE: NOT_REQUIRED — read-only review, no contract change.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high (combined independent cross-check after reports).
MODEL ROUTING REASON: Existing course design/state-machine spans multiple files; need evidence-based distinction of intended and current behavior.
DISPATCH RECORD REQUIRED: YES

## Objective / Context
User recalls intended teacher video -> question pauses -> answer unlocks continued video and asks careful review. Current Task08 ordinary question test is on hold; no question has been submitted. One Continue click showed teaching figure, subtitles and controls. That screenshot alone cannot prove video vs static or validate question gates.
OBJECTIVE: Read project design/task/handoff documents and relevant authoring contracts to determine the authoritative intended video teacher flow. Find direct evidence for replacing the older static/avatar form, interleaved video pauses, question types, answer/correctness/resume conditions, manual vs auto resume. Separate explicit requirements, implementation descriptions and unconfirmed user recollection. Identify dates/status and later supersession; do not assume newest filename is authoritative. Locate relevant video lesson config/schema and interface boundary at high level; leave detailed runtime code trace to Task10. Report exact paths/line references and concise Chinese summary, uncertain parts honestly.

## Scope
WRITABLE SCOPE: new private /tmp/course-video-contract-review-09-* report/evidence only, directory0700/files0600. Supervisor Task metadata only.
READABLE DEPENDENCIES: AGENTS.md, CODEX_WORKER.md, this Task; Project tracked docs, .codex task records read-only, relevant authoring schema/types and course content files as needed; no secrets or configuration values.
FORBIDDEN: all repository edits (source/tests/docs/config/tasks), credentials/env secrets, DB/API/browser/live GUI/network, new tests/build/install/services, progress changes, other users data, production recovery/authority work. No broad file dumps; use targeted rg then reads.

## Contracts / Impact
MAY CHANGE PUBLIC CONTRACT: NO
DATABASE/AUTH/RLS IMPACT: NONE, read code only.

## Requirements / Acceptance
Evidence-backed report answers user in plain Chinese. Every important finding references actual file/line or saved image; no fabricated runtime outcomes. Preserve provenance and report uncertainty. No fixes proposed as implemented. No repeated live acceptance.

## Required Validation
Static source/document tracing and saved image inspection as relevant; no repository suites needed. Independent cross-check of the two reports after completion, no duplicate full investigation.

## Parallelism
Read-only Task09 and10 may run concurrently; private output ownership separate. Workers are not alone; do not revert or edit others. No live browser operator under these tasks.

## Escalation / Reports
Scope expansion -> report, do not act. Complete Worker Report per CODEX_WORKER.md with findings, evidence, tests actually run, limitations, paths/hashes. Root final PASS/REVISE/UNDETERMINED after independent review.

## Supervisor closure — 2026-10-05
WORKFLOW STATUS: CLOSED; archived after review.
DECISION: PASS for read-only intended contract recovery. Target is teacher video time cue pause, activity answer, correct durable completion plus independent confirmation before resume; old character retirement remains conditional on completed migration. Historical controlled proof is not current published-course acceptance.
Worker report: /tmp/course-video-contract-review-09-3abyh4ph/worker-report.md
Worker SHA256: a6b1c0394af3bcffc0449b1b3064eef5307bc7ef55569a9287241b91cc3cf6e1
Independent verification: /tmp/course-video-combined-verification-hx1o0qv6/VerificationReport.md
Verification SHA256: ae5946346a4d6a3e77598adb7c0d9ef76a76fae5d879ca0070d3583d2e873eb9
Actual requested video-pause-question-answer-resume acceptance remains NOT VALIDATED. Next scope: identify current Korean1 published media/runtime/cue/activity binding, then accept that actual intended flow. No ordinary floating-panel success may substitute for it. No source/config/test changes or new live actions during Tasks09/10. No recovery/authority work resumed.
