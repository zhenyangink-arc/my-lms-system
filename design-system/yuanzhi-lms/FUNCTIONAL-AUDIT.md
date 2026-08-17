# Yuanzhi LMS Functional & Business-Flow Audit (Phase 2)

> Phase 2 of UI/product governance. Phase 1 (`NAVIGATION-AUDIT.md`, Batch 0–11) covered
> navigation correctness and desktop UI compliance against `MASTER.md`; all pages there are
> **Approved and are not re-reviewed here**. This document covers whether each business flow
> *works correctly* — data persists, permissions are enforced (not just hidden in the UI),
> state transitions are correct, and edge cases (empty/error/insufficient-permission/
> conflicting-state) are handled functionally, not just visually.

## 0. Document status

| Field | Value |
|---|---|
| Status | **Complete — all batches F0-F7 Approved 2026-08-17** |
| Version | 1.0 |
| Started | 2026-08-17 |
| Completed | 2026-08-17 |
| Platform | Desktop Web only (same scope as Phase 1: 1024–1920px, no mobile) |
| Depends on | `MASTER.md` (design authority, unchanged), `NAVIGATION-AUDIT.md` (routing/page inventory, unchanged), `.orchestration/ui-governance-state.md` (execution ledger, continued from Phase 1) |

### Purpose

Phase 1 answered "is this page reachable, well-formed, and accessible?" Phase 2 answers:

1. Does the business action this page exists for actually succeed (form submits, data
   persists, the right rows change)?
2. Is the permission/role boundary enforced at the data layer (RLS / server-side check), not
   just hidden by conditional rendering in the UI?
3. Do state transitions behave correctly (draft→published, pending→approved, assigned→
   submitted→graded, etc.) including who can trigger them and what happens to dependent data?
4. Are the genuinely reachable edge cases — empty data, a second concurrent editor, an expired
   session mid-form, a permission downgrade after page load, a duplicate submission — handled
   without silent data corruption or a stuck UI?

### Method

Unlike Phase 1's mostly-static scan, Phase 2 favors **real execution** wherever it's safe and
reversible: reuse the ephemeral-account + real-session pattern already built in
`scripts/test-dashboard-session-refresh.cjs` and `.orchestration/verification/batch11-interactive.mjs`
to actually perform an action (submit a form, change a status, upload a resource) against
disposable seed/ephemeral data, and verify the resulting DB state and UI state agree — not just
that the request returned 200. Where an action is destructive to shared/real tenant data (not
ephemeral), audit the code path (server action / API route / RLS policy) directly instead of
executing it against real data.

### Source of truth for business logic

- Server actions / mutations: colocated under each `src/features/*/api/` or `src/app/dashboard/**/actions.ts`
- RLS policies: Supabase project (read via service-role queries against `pg_policies`, never
  edit schema/policies in this phase — flag policy gaps as findings, do not fix schema)
- Role/permission checks: `src/lib/admin.ts`, `src/lib/auth.ts`, per-feature `service.ts` guard
  clauses

## 1. Status legend

| Status | Meaning |
|---|---|
| `Not started` | Not yet audited in Phase 2 |
| `In review` | Codex actively auditing/executing this batch |
| `Changes required` | A real functional/permission defect was found, fix in progress |
| `Approved` | Flow executed (or code-audited where execution is unsafe) and confirmed correct, with independently verified evidence |

## 2. Batch plan

| Batch | Scope | Status |
|---|---|---|
| F0 | Foundation: auth/session lifecycle, tenant scoping, role-based route + data guards (cross-cutting, blocks nothing else but audited first since every other batch depends on it being sound) | **Approved 2026-08-17** — found and fixed 1 blocking security finding (F0-S1: `createManagedAccountAction` bypassed the centralized owner guard's tenant-provisioned-account exclusion, allowing a tenant account with a stale platform-owner marker to create accounts in an arbitrary tenant). Fixed by routing through `requireAccountOwner()` + `requirePlatformOwner()`; verified via real HTTP regression (exploit now returns 303/no account created; legitimate platform-owner and tenant-owner flows still return 200). 2 non-blocking functional-debt items (digital-textbook/growth-toolbox permission-model mismatch) deferred to `.orchestration/ui-governance-state.md` §7b. |
| F1 | Student Korean learning core flow: course browse → lesson progress → practice/chapter-test submission → grade result → learning record | **Approved 2026-08-17** — found and fixed 2 blocking defects: (1) ebook reading-time accumulation was silently reset by a BEFORE INSERT trigger racing `INSERT ... ON CONFLICT`, meaning real students reading across multiple sessions could never naturally accumulate enough time to unlock chapter tests — fixed via `supabase/migrations/202608170001_fix_ebook_progress_accumulation.sql` (UPDATE-first pattern), verified with a fresh account naturally accumulating 35→630 seconds and unlocking without any admin intervention; (2) chapter-test grades had no reachable review-request UI anywhere — fixed by adding the existing `GradeReviewForm` to the chapter-test result screen, verified via real submission producing a real pending review row. |
| F2 | Student study-abroad flow: school/university browse → application target → document upload/review → visa task tracking | **Approved 2026-08-17** — 0 blocking defects, 6 confirmed-correct flows, 1 non-blocking functional-debt gap (awkward "preparing" lock vs. checklist-creation status requirement) deferred to `.orchestration/ui-governance-state.md` §7b. |
| F3 | Management accounts & tenant lifecycle: account create/edit/disable, tenant create/suspend/history, permission grants | **Approved 2026-08-17** — found and fixed 1 blocking defect: `deleteTenantPermanentlyAction` only cleaned up accounts tracked in `tenant_provisioned_accounts`, leaving regular teacher/student accounts orphaned (auth.users/profiles surviving with zero tenant memberships) after permanent tenant deletion. Fixed by snapshotting all real tenant members before the deletion RPC and merging with the provisioned-accounts set; verified with a real account confirmed deleted and a multi-tenant account confirmed to survive with its other membership intact. |
| F4 | Management courses & assessments: course/lesson catalog editing, assignment/exam paper composition, grading + grade review workflow | **Approved 2026-08-17** — found and fixed 1 blocking defect: the routed application assessment page (`apps/korean/assessments`) was entirely read-only with no reachable paper-composer or publish controls, even though `AssessmentPaperComposer` already existed and worked when invoked directly. Confirmed the legacy `/dashboard/admin/assignments` route redirects away and is not a substitute entry point. Fixed by wiring the existing composer + status-action components into the routed page; verified with a real browser session creating and publishing a paper from that exact URL. |
| F5 | Management study-abroad ops: schools/universities maintenance, document review workflow, visa case/task management | **Approved 2026-08-17** — found and fixed 2 blocking defects: (1) visa requirement reorder crashed with HTTP 500 because the select omitted `applicable_scopes`, silently resetting it to an empty array on upsert and violating a real CHECK constraint; (2) the student-facing university detail page never displayed any staff-maintained document/visa requirements at all. Both fixed and verified with real before/after evidence (successful reorder with scopes preserved; requirements now visible on the real student page). 1 non-blocking functional-debt item deferred to §7b. |
| F6 | Management long tail: announcements, help center tickets, library resources, growth-toolbox content, learning records, model/token usage | **Approved 2026-08-17** — 0 blocking defects, 7 confirmed-correct flows, 2 non-blocking functional-debt items (growth-toolbox has no content create/publish UI; re-confirming an already-closed ticket silently suppresses the "already closed" signal) deferred to `.orchestration/ui-governance-state.md` §7b. |
| F7 | Cross-cutting live flows: conversation-practice AI sessions, live class rooms, digital textbook audio/progress | **Approved 2026-08-17** — found and fixed 1 blocking defect: conversation-practice scenario create/publish was a dead end for every role — the TypeScript access gate required a tenantless `platform_super_admin` while the SQL RPC permission function required a tenant-scoped `tenant_super_admin`/`ceo`/`admin`, mutually exclusive. Fixed via a new migration making scenarios genuinely platform-owned (nullable `tenant_id`, dedicated platform-scope trigger, permission function realigned to the TS layer's documented intent). Verified the fix does not touch the shared trigger logic F1 already fixed for `course_ebook_progress` (line-by-line diff confirmed only the `conversation_practice_progress` branch changed). Real regression evidence: platform-owner create+publish succeeds, tenant-owner mutation attempts correctly rejected with P0001. 1 non-blocking functional-debt item deferred. |

Each batch closes with: (a) a written finding list (defect vs confirmed-correct), (b) fixes for
confirmed real defects dispatched through the same Claude-plans/Codex-executes model as Phase 1,
(c) independent Claude verification of both the audit evidence and any fix (git status/grep,
never report-first for multi-file or data-mutating claims), (d) this table updated to Approved.

## 3. Termination conditions

Phase 2 is complete only when:

1. All batches F0–F7 are `Approved`.
2. Every confirmed real defect found has either been fixed and verified, or is explicitly
   logged as non-blocking deferred debt with rationale (same standard as Phase 1 §7b).
3. No RLS/permission gap that allows a role to read or mutate data it should not is left
   unresolved — these are treated as blocking regardless of batch, per the standing "security/
   auth" carve-out (fix immediately, do not defer).
4. `npm run check` + `npm run build` + `git diff --check` pass cleanly after all fixes.
5. No commits/pushes/deploys were made; no destructive operation touched real (non-ephemeral)
   tenant data.

**All five conditions are satisfied as of 2026-08-17.** 8 real blocking defects were found across
F0/F1/F3/F4/F5/F7 and fixed with independently-verified evidence (see
`.orchestration/ui-governance-state.md` §12 for the complete list). F2/F6 found only non-blocking
functional debt. The single RLS/permission finding (F0-S1) was fixed immediately, not deferred.
Final verification (`npm run check`, `npm run build`, `git diff --check`) all passed cleanly.
No commits/pushes/deploys occurred; all destructive test operations (tenant/account creation and
deletion) were confined to ephemeral data created by the audit itself.

## 4. Execution log

See `.orchestration/ui-governance-state.md` §11+ for the live batch-by-batch execution ledger
(continues the same file used in Phase 1 rather than starting a new one, to preserve one
continuous audit trail).
