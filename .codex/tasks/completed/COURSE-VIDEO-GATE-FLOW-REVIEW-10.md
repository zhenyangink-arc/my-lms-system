# TASK — Trace actual video playback and question answer gates

## Identity
TASK ID: COURSE-VIDEO-GATE-FLOW-REVIEW-10
TITLE: Trace actual video playback and question answer gates
STATUS: SPECIFIED

## Routing
IMPLEMENTATION PROFILE: worker_high | GPT-6.1 Sol high
ARCHITECT GATE: NOT_REQUIRED — read-only review, no contract change.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high (combined independent cross-check after reports).
MODEL ROUTING REASON: Existing course design/state-machine spans multiple files; need evidence-based distinction of intended and current behavior.
DISPATCH RECORD REQUIRED: YES

## Objective / Context
User recalls intended teacher video -> question pauses -> answer unlocks continued video and asks careful review. Current Task08 ordinary question test is on hold; no question has been submitted. One Continue click showed teaching figure, subtitles and controls. That screenshot alone cannot prove video vs static or validate question gates.
OBJECTIVE: Trace the actual Korean1 course teacher implementation: visible avatar/image vs real video vs fallback; source of presentation/media; play start/end and segment boundaries; pause/question rendering; choice submission; correct vs incorrect retry; conditions permitting next segment; relevant APIs/actions and data contract. Find whether manual play/seek or event paths can bypass a question gate, but do not execute tests or exploit. Contrast generic floating teacher panel with lesson video workflow and selected-sentence Explain. Use saved post2/post15 screenshots and previous report as actual limited observation, not provider evidence. Inspect known deployed source counterpart or build manifest only if useful to establish parity; no live network/process/config reads. Return concrete state sequence, exact paths/lines, implemented/missing/unknown distinctions, what limited UI observation can next verify. Do not repeat broad prior configuration forensics.

## Scope
WRITABLE SCOPE: new private /tmp/course-video-gate-flow-review-10-* report/evidence only, directory0700/files0600. Supervisor Task metadata only.
READABLE DEPENDENCIES: AGENTS.md, CODEX_WORKER.md, this Task; Current source around KoreanLevelOneSmartTextbook.tsx and direct dependencies, relevant API/types/video renderer, saved /tmp/course-teacher-reply-k1q0oubo/post2.png and post15.png, previous /tmp/course-teacher-button-trace-pf5moa6m/WorkerReport.md. Known release source /home/yangzhen/releases/uply-first-enable-20260910/source may be read narrowly; no env/runtime config.
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
DECISION: PASS for static runtime distinction. Legacy image/speech, segment-ended teacher video, and native time-cue media are distinct paths. Old custom-question maxAttempts release is not native correct-only completion. Screenshot strongly matches legacy presentation, without proving current DOM/media/header/published binding. Published /3 facts do not establish media integration.
Worker report: /tmp/course-video-gate-flow-review-10-9wmlrglo/WorkerReport.md
Worker SHA256: c83b6db4a990160c656ea1cd71f9b34943d5aa190fd6ce8d5439355a7ae61899
Independent verification: /tmp/course-video-combined-verification-hx1o0qv6/VerificationReport.md
Verification SHA256: ae5946346a4d6a3e77598adb7c0d9ef76a76fae5d879ca0070d3583d2e873eb9
Actual requested video-pause-question-answer-resume acceptance remains NOT VALIDATED. Next scope: identify current Korean1 published media/runtime/cue/activity binding, then accept that actual intended flow. No ordinary floating-panel success may substitute for it. No source/config/test changes or new live actions during Tasks09/10. No recovery/authority work resumed.
