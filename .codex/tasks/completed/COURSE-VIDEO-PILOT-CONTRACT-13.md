# TASK TEMPLATE — Course video pilot integration

## Identity
TASK ID: COURSE-VIDEO-PILOT-CONTRACT-13
TITLE: Freeze Chapter1 orientation video-pilot integration and the first useful implementation slice
STATUS: COMPLETED — PASS (design only)

## Routing
IMPLEMENTATION PROFILE: worker_astra_high | GPT-6 Astra high (design worker)
ARCHITECT GATE: REQUIRED — independent architect_gate after Worker report
VERIFICATION PROFILE: verifier_critical for any subsequent public-contract implementation; current design reviewed by Gate
MODEL ROUTING REASON: Published activity completion, sole media controller and version-scoped legacy retirement cross module/security boundaries. Existing discovery must be reused, not repeated.
DISPATCH RECORD REQUIRED: YES

## Objective
Produce one concrete integration proposal and exact implementable first slice for the Korean1 Chapter1 orientation pilot, consistent with current formal /3 completion and existing sole media controller. Root can authorize a separately scoped repository implementation after Gate; this design task itself changes no implementation.

## Context
User wants old Kim image presentation retired without accidental revival, useful teaching elements reused in video that pauses for questions and continues only after correct durable independent readback; user said continue. They have not selected the real video source yet; Root asked asynchronously. Missing media cannot be invented or relabeled production-ready. Do not let this prevent useful code-level contract work.
Accepted Task09/10/11 analysis and Task12 actual metadata are inputs. Task12 completed: .codex/tasks/completed/COURSE-VIDEO-CURRENT-BINDING-MAP-12.md. Evidence /tmp/course-video-current-map-nol1pwvt/{WorkerReport.md,BindingMap.md,safe-receipt.json}; verification /tmp/course-video-current-map-verification-x4y21m8c/VerificationReport.md. Task11 Gate /tmp/course-teacher-retirement-gate-75tx1_dq/GateReport.md.
Current observed scope textbook7100ab2b-72b0-478e-8847-4df9b4485109/version939ad4f7-3238-425e-91e9-d456c130ca68/chaptercda24fb8-c93b-4a19-9577-4418350ff708. Orientation script feb30ba7-0a5e-4e9f-83e6-8970f715ddd5 v23; 8 teaching nodes missing teacherVideo bindings; 2 nodes reference same Activity aafa6ccc-4d4a-4dba-9315-2f30381e8a13. 19 chapter activities, 7 other modules have no published teaching script in saved capture. Actual immutable pointer/history not observed, not evidence of absence. Current native author compilation emits text/single_choice only with empty mediaRefs/teachingRefs.

## Scope
WRITABLE SCOPE: one new private /tmp/course-video-pilot-contract-* directory0700, report/proposal/task-packet files0600 only. Root owns .codex task metadata.
READABLE DEPENDENCIES: accepted reports; current src/features/smart-textbook-runtime media/completion/core/server; src/lib/smart-textbook-publishing; bounded author actions/form/teaching-video and relevant actual schema/types/tests/docs; course shell integration points.
FORBIDDEN: app/test/docs/config edits; production reads or writes; env/credential reads; browser actions; media generation/provider; package installs; DB/schema changes; restart/build/deploy; deleting assets; commit/push. No old recovery investigation.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO in this design task; propose exact change for independent Gate.
No /3-to-/2 relabel, fixture issuer in production, duplicate learning record/Auth system, or second media owner. Missing video blocks new mode without avatar/text-ended fallback. Preserve original history semantics; no global missing mode to video interpretation.

## Requirements
1. Reuse verified discovery; directly inspect only integration contract gaps and existing relevant tests. Do not spend task re-enumerating legacy files or metadata.
2. Choose an actual path for published /3 correct Activity completion plus independent readback to reach sole media controller. Spell exact request/response identity, validation, source authority, revision and generation/session binding; stale/late replies; seek, refresh, user pause, replay, UNKNOWN, autoplay denial.
3. Determine minimal media/cue/subtitle representation using existing structures if possible; no schema invented merely for convenience. If new persistent schema unavoidable, explicitly separate it from a useful schema-free first slice. Do not couple implementation to dummy production video keys or times.
4. Specify new video-mode admission at server and author create/save/publish/preview, with explicit Korean1 pilot applicability, forward publication and old history isolation. Do not break existing live legacy course before replacement ready. Bound the first implementation: public types/parsers/controller seam and tests OR another directly useful coherent slice selected from evidence, not an unused generic abstraction.
5. Freeze only necessities for pilot, not whole platform. For any postponed dependency list exact fact/action needed, not vague new review loops. Distinguish absent video source from implementation blockers.
6. Deliver exact future modify/add paths with function ownership, tests/negative cases and nextjs local-doc requirements if frontend edits; no guessed test commands. Gate packet must allow a yes/no decision and actual small next Task without full redesign.
7. Explain in plain Chinese what first slice gives the user and what remains before live retirement. User media preference is pending; no assumption old avatar should become rendered video.

## Data / Security
DATABASE IMPACT: NONE this task; future impact explicit in proposal
RLS/AUTH IMPACT: no changes; reuse current authorization
SECURITY IMPACT: design high; requires independent Gate

## Acceptance
One selected bounded proposal, alternatives rejected with reasons, exact current contracts vs proposed deltas, realistic dependencies, exact first implementation scope/test plan, no source changes. Existing live class/history remains functional until explicit forward transition.

## Required Validation
Static source/contract/test inspection only; no test execution/build/browser/live operations. Worker Report per CODEX_WORKER.md with evidence line refs and private hashes.

## Parallelism
Serial design -> independent Gate -> Root approved implementation Task. Worker is not alone; do not revert other edits. Profile scope expansion reported, not enacted.


## Supervisor Final Review
PASS — bounded six-path consumer design, not production readiness.
User media choice: existing teaching video, to be supplied later; do not generate.
WorkerReport /tmp/course-video-pilot-contract-e3njous9/WorkerReport.md SHA cc3bba9edf2eb11875aa56dd43bed0a058e94287a6dab4f2c12c982f2f2ca7c3
Proposal SHA 7348331fcebc706327f8caa8506e1be3d016ace6986e742713f4d235b4c31b93
Gate /tmp/course-video-pilot-gate-qcdny_v3/GateReport.md SHA eedcfd0d57942526c6b1fb91f77ffb609a7f7fda07d92c4513474bc257b21488 ALLOW. Gate takes precedence.
Scope frozen into active COURSE-VIDEO-PUBLISHED-MEDIA-14.md with full normative text. No implementation or live operations in Task13.
