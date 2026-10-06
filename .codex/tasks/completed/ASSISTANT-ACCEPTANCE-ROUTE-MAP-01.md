# TASK — Identify assistant UI routes for live acceptance

## Identity
TASK ID: ASSISTANT-ACCEPTANCE-ROUTE-MAP-01
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED — read-only code trace.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high (combined saved findings audit).
DISPATCH RECORD REQUIRED: YES
MODEL ROUTING REASON: Bounded current route-to-component/API mapping; no redesign.

## Objective
Support current user-requested assistant browser acceptance by identifying relevant current UI routes, distinguishing platform chat/teaching Explain/legacy assistant, and stating what visible checks establish course binding. Reuse completed inventory, do not repeat full history.

## Context
User opens historically supplied platform https://kmgwak-system-product-name.taila18cd5.ts.net:8443 and reports quick assistant replies; root must not assume this is unenabled teaching Explain. Current installed BUILD_ID observation only is PjpaYHAz0asyvwh0G-lBo. Live source revision is not yet established; current checkout analysis cannot certify deployed behavior. Other worker uses browser exclusively.

## Scope
WRITABLE SCOPE: new /tmp/assistant-acceptance-route-map-* report only. No repository changes.
READABLE DEPENDENCIES: AGENTS.md/CODEX_WORKER.md/task; docs/ASSISTANT_AGENT_HANDOFF.md; existing /tmp/assistant-capability-inventory-qxh1uhq8/WorkerReport.md and /tmp/assistant-launch-dependencies-z1_y47wk/WorkerReport.md if present; narrowly traced src app/components/features relevant assistant routes and handler interfaces. Git status current only. Prefer rg. Do not revisit recovery evidence or source inventories wholesale.
FORBIDDEN: .env/secrets/credentials/private approvals; runtime release files; network/browser/HTTP/DB/SQL/PM2/Docker; tests/build/import app runtime; code/doc/fixture changes.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO.

## Data / Security Impact
NONE; read-only public source interface trace, no private data access.

## Requirements
1. Read role manual and existing inventory first. Check current status and only route-level source needed to map actual assistant entry choices.
2. Report exact URL paths/sidebar labels/components/API endpoints for likely chat(s). Identify learner Explain vs any general/platform assistant. Mark auth needed and browser-visible indicators that distinguish them.
3. State bounded smoke checks possible through UI without course/progress/settings writes, and whether submitting ordinary chat can dispatch mutating tools. Do not authorize or change anything.
4. Give source references with lines; distinguish current repository vs unknown deployed match. Any login prerequisite exact nonsecret instructions for user if needed, no secret collection.
5. Send concise findings to Supervisor early to unblock browser worker, then complete report. Time-box narrow investigation, no generic first-enable gate redesign and no repeated audits.

## Out of Scope
New code, live diagnosis, verification reruns, authority/recovery work.

## Acceptance Criteria
Enough route/product distinction to test correct UI; no unsupported live claims.

## Required Validation
Static source trace only; all test suites NOT_REQUIRED.

## Risk Focus
Mistaking a working platform assistant for a different dormant research agent.

## Parallelism
CAN RUN IN PARALLEL: YES; browser worker owns all live interactions. No file collision.

## Escalation Rule
Missing exact user entry: report ambiguity, do not broaden product scope.

## Worker Report
CODEX_WORKER.md full concise report, scope, evidence, limitations.

## Verification Report
Combined focused review; do not rerun analysis wholesale.

## Supervisor review — 2026-10-03
PASS: current-checkout route distinction only. User confirmed topbar 学习助手, mapped to GuideAgentChat /api/agent-chat, not lesson Explain. Deployed source parity NOT VALIDATED. No source modification.
WorkerReport /tmp/assistant-acceptance-route-map-uv6o2t2r/WorkerReport.md SHA256 01df305d88dba1309092eb0140620154850ec3e27b805ce87fbb3b29bc5ec799
VerificationReport /tmp/assistant-acceptance-review-31o0wonc/VerificationReport.md SHA256 9da267520c9eeaf3a2155f0640fe28d5beb0a85c44d8762306c84f5ab6915ce5
Supervisor read both reports and accepted scoped evidence. Do not repeat mapping in subsequent chat validation.
