# TASK — 主项目唯一源码与发布目录边界

## Identity
TASK ID: MAIN-SOURCE-ONLY-03
TITLE: 固化所有后续开发在主项目、8443仅接收发布产物的长期规则
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_medium / GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED — workflow documentation only; no filesystem permission/security architecture/deployment change.
VERIFICATION PROFILE: verifier / GPT-6.1 Sol high
MODEL ROUTING REASON: 小范围流程文档，需要核对已有规则并避免与worktree并行流程冲突。
DISPATCH RECORD REQUIRED: YES

## Objective
将用户“以后必须在主项目做更改，防止再在8443副本改代码”的要求落入长期入口、Worker开工检查、Verifier验收和Task模板。

## Context
主项目 /home/yangzhen/projects/my-lms-system 已在本地main合入64f51c8b1040a82be5815a0498a6c7398bde010e。8443现有发布源码目录 /home/yangzhen/releases/uply-first-enable-20260910/source 与其分离。历史曾在发布副本留下未回归主仓库的UI修改。用户明确要求以后统一在主项目开发；本Task具体授权相应规则文件的最小增补。

## Scope
WRITABLE SCOPE (existing files only):
- AGENTS.md
- CODEX_SUPERVISOR.md
- CODEX_WORKER.md
- CODEX_VERIFICATION.md
- .codex/tasks/TASK_TEMPLATE.md
- CLAUDE.md only if already exists, only a concise pointer to the same canonical source/release rule if necessary; do not create.
- /tmp/main-source-only-03/ private Worker report/evidence.
READABLE DEPENDENCIES: above manuals, root Git status/worktree metadata, tracked release/deployment/handoff documentation as narrowly relevant. No full source/release tree scans needed. Do not read env, credentials, logs, private configs or access running site.
FORBIDDEN: all application/test/build/schema/migration/runtime files, actual release dirs, chmod/chown/chattr, PM2/Tailscale/network/HTTP/DB/Docker, dependency/build/test execution, Git commit/stage/push/merge/ref changes. Other task files root-owned; preserve untracked completedTask01/02. You are not alone; never overwrite/revert others' work.

## Contracts
PUBLIC CONTRACTS: no application contract changes.
MAY CHANGE PUBLIC CONTRACT: NO
DATABASE IMPACT: NONE
RLS IMPACT: NO
AUTH IMPACT: NO
SECURITY IMPACT: LOW; document constraints only, do not claim OS enforcement.

## Requirements
1. Read AGENTS/CODEX_WORKER/currentTask, inspect current status and narrowly related existing instructions before editing; no re-verification of completed94-file adoption.
2. Canonical writable source root is /home/yangzhen/projects/my-lms-system. Allow ONLY explicitly declared linked Git worktrees of this same canonical repository after realpath/git-common-dir/worktree identity verification; worktrees are main-project branches, not independent release copies. If the user later requires literal root-only, that takes precedence. Never assume a similarly named path is same repo.
3. Releases, including /home/yangzhen/releases/** and any future 8443 serving directory, are not development writable scope. URL/port identifies an access endpoint, not a development workspace. Viewing8443 is not permission to edit files or write real data. No direct source editing, emergency patch, selective copyback/reverse sync, ad-hoc application rebuild or service restart in a running release as part of ordinary development.
4. Every Worker first records physical cwd/repo root/git common dir/branch/HEAD/dirty baseline and declared allowed source/worktree; verifies all planned write targets (including symlink realpath) stay in declared scope and outside deployment copies. No release writes through script cwd/absolute path/symlink. Mismatch -> stop before writing and report. Do not indiscriminately enumerate secrets/untracked content.
5. Supervisor Task explicitly declares SOURCE_REPOSITORY, WORKTREE, RELEASE_READ_ONLY_PATHS, DEPLOYMENT_ALLOWED(default NO). Separate code development, test/verification, commit/integration, release. Release must originate from identified validated main-project Git commit and built artifacts with traceability/rollback; it must never rely on uncommitted edits to active release. Deployment authorization derives from session's actual scope; do not re-ask when already authorized.
6. Report states exact source path/branch/commit+changes, tests, whether deployment executed. Verify diff/path scope and no live-release mutation claims only to observed extent. If deploy intentionally changes a release, must be explicit separate scope, not source edits disguised as deployment.
7. Keep additions concise, existing rules unchanged except necessary narrow references. Long global AGENTS addition should be compact; manuals/template can refer back instead of duplicating entire policy. Check CLAUDE.md existence/entry conventions, use pointer only if necessary and preexisting.
8. State clearly policy is an agent/workflow guard, not OS-enforced read-only lock. Do not change live permissions/service now. Note optional future technical hardening as separate task, not implement it.

## Acceptance Criteria
- Canonical source/release boundary explicit and consistent at entry/dispatch/worker/verification/template.
- Legal linked worktree flow remains compatible; release paths/symlinks cannot qualify accidentally.
- Only scoped existing documentation changed, no runtime/source/application actions, unrelated work preserved.
- Report exact modified paths, concise changes and validation; no unsupported claims of deployment or filesystem lockdown.

## Required Validation
TYPECHECK/LINT/UNIT/INTEGRATION/E2E/MIGRATION: NOT_REQUIRED (docs only).
Required: git diff --check, limited diff/path review, preservation of prior doc sections, consistency review. No semantic tests or runtime probes.

## Parallelism
CAN RUN IN PARALLEL: NO; one document writer then independent verifier.
WORKTREE: NOT_REQUIRED for documentation-only edits to specified root files; preserve all other work.

## Escalation Rule
Need write outside scope, unexpected existing modifications to target docs or need system/deployment protection -> report SCOPE_CHANGE_REQUEST before expansion. .codex template is protected filesystem; use proper sandbox escalation if necessary, never bypass restrictions. Routine authorization already exists in this task/user instruction.

## Worker Report
Follow CODEX_WORKER.md. Path /tmp/main-source-only-03/WorkerReport.md. Include before/after hashes and actual commands, no invented tests.

## Verification Report
Follow CODEX_VERIFICATION.md. Independent readonly doc/diff/consistency check only; own /tmp/main-source-only-03-verify/ report; no edits or runtime probes.


## Supervisor final review
DECISION: PASS — documentation workflow only.
SOURCE_REPOSITORY: /home/yangzhen/projects/my-lms-system
WORKTREE: /home/yangzhen/projects/my-lms-system; main at 64f51c8b1040a82be5815a0498a6c7398bde010e.
RELEASE_READ_ONLY_PATHS: /home/yangzhen/releases/** and all actual deployed copies.
DEPLOYMENT_ALLOWED: NO.
DEPLOYMENT: NOT_DEPLOYED.

Approved existing docs modified: AGENTS.md, CODEX_SUPERVISOR.md, CODEX_WORKER.md, CODEX_VERIFICATION.md, .codex/tasks/TASK_TEMPLATE.md. CLAUDE.md already imports AGENTS.md and is unchanged. Documents remain uncommitted; no stage/commit/push requested or performed.

Supervisor requested one narrow wording revision to distinguish deployed copies from valid local development/test/temporary-preview servers. Final rules preserve the live8443/releases prohibition, verified same-repository linked-worktree flow and normal local previews. No application changes, OS permission changes or runtime operations. These are Agent/workflow requirements, not an OS-enforced read-only lock.

WorkerReport: /tmp/main-source-only-03/WorkerReport.md
SHA256: 6850d86f2f122fdf1f4b1ac0c4e7b58959b0487673bcd959f2800e865d4147ee
VerificationReport: /tmp/main-source-only-03-verify/VerificationReport.md
SHA256: 36f82090dcc31ba451c001ad1c14a32b58672e66363d525227eed0e13bbd9b53

Independent review PASS: actual five-file diff, existing clauses preserved, source/Git identity and before/after doc hashes consistent, git diff --check exit0. No application tests needed or run. Root archival additionally verified exact historical Task01 and Task02 hashes against prior closure; both unchanged. This task is now archived as root-owned metadata, without adding it to Git.

Plain-language result: 今后只在主项目改代码；8443是发布运行入口。每次任务先核对目录、仓库和写入目标，再开发/验证；要更新网站则从确定的主项目提交构建和发布，交付时明确是否已部署。
