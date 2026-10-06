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


## R2 — 用户明确要求的本地数据与服务出口补充

STATUS: COMPLETED
AUTHORIZATION: 用户已审阅规则并明确要求补两条，随后将既有五份规则文件及三份完成Task记录提交到本地main，禁止push。前三个阶段结论和旧提交7950c524831d2792d32c6491c2e36af06f7e6d08保留。
SOURCE_REPOSITORY: /home/yangzhen/projects/my-lms-system
WORKTREE: /home/yangzhen/projects/my-lms-system
RELEASE_READ_ONLY_PATHS: /home/yangzhen/releases/**及所有正式部署副本
DEPLOYMENT_ALLOWED: NO
DEPLOYMENT_SCOPE: NONE
IMPLEMENTATION PROFILE: worker_medium / GPT-6.1 Sol medium
VERIFICATION PROFILE: verifier / GPT-6.1 Sol high
ARCHITECT GATE: NOT_REQUIRED — 用户已明确的流程文档规则，无实际安全系统或运行时变更。

### R2精确修改范围
Worker只可修改 AGENTS.md、CODEX_SUPERVISOR.md、CODEX_WORKER.md、CODEX_VERIFICATION.md、.codex/tasks/TASK_TEMPLATE.md。当前Task由Supervisor恢复到active、记录R2并在完成后归档回原completed路径；其他两份completedTask原样保留。不得新增第四份repo Task或其他repo artifact，不修改CLAUDE/application/tests/env/服务配置。
私有Worker/Verifier报告可放 /tmp/main-source-only-r2/ 和 /tmp/main-source-only-r2-verify/。

### R2内容与验收
1. 本地验证默认使用经确认的本机数据库（543xx，或lms-verify56321）；不能只凭端口名判定目标为本地。主项目.env.local指向线上Supabase，未经用户对当次明确授权不得利用它（包括框架自动加载或继承环境）启动服务、登录或写数据。使用明确隔离的本地验证配置，目标不明/本机库未准备则停下，不自动回退线上。不读取、输出、修改实际.env.local/凭据；本Task只记录用户已声明事实，不重新联网验证。
2. 8443和任何线上入口不得直接或经反向代理/Tailscale/转发指向源码工作区（包含同仓库worktree）。禁止启动或重新拉起cwd为主项目的PM2 uply-dev，以及从源码工作区直接对外服务的其他进程。本地开发预览只可在隔离本地范围中使用，不因为监听loopback就获准经代理对外暴露。线上只能使用可追溯的发布副本。修改规则不等于实际调整PM2/路由；本Task禁止探测或操作服务。
3. 五份规则保持一致：AGENTS为精确主条款，角色手册以职责简短引用并检查，模板增加验证数据目标、当次线上授权（默认无）、源码服务出口边界等必要字段；不重复大段、不改其他规则。相同当次明确授权在原范围内不重复索要，泛泛“继续/测试/发布”不自动授权线上数据操作。
4. preflight Git main/HEAD7950c52、工作区干净（除Supervisor刚恢复Task元数据）及目标realpath；检测已有无关改动则保留并报告，不reset/clean/stash。只能读有关docs/diff，不读env/日志/私有配置。不跑服务、build、应用测试、数据库或网络。
5. 修改后git diff --check和独立文档验收；先提交报告等待Supervisor。验收后Supervisor归档Task并给出明确Git交付PROCEED，Worker显式git add八条路径并本地git commit，不amend、不push。
6. 最终提交树应含五规则文件+三完成Task，未变化的历史Task自然继承，不制造虚假改动。Git交付唯一writer，检查hooks、staged范围及精确字节、commitparent和最终clean。遇异常停下，不篡改历史或绕过hook。

### R2报告要求
按CODEX_WORKER/VERIFICATION，区分修改文档、未部署、未运行DB/服务；保存必要哈希/命令/rc。旧完成阶段测试不重跑。根Task末尾另记R2结果，旧记录不覆盖。


### R2 Supervisor final review and Git delivery authorization
DECISION: PASS — 文档实施与独立验收通过，Git交付另以提交事实核对。
WorkerReport: /tmp/main-source-only-r2/WorkerReport.md
SHA256: f72f58bf014e12c139063447109aab4444b98e5b2ce04398c815565314865358
VerificationReport: /tmp/main-source-only-r2-verify/VerificationReport.md
SHA256: 10e3df431b668630a20c283240da4917a5e5b61b5bacae11599fc8813e47ef85

五规则文件仅17行增补，原条款逐行保留，diffcheck/文档身份与一致性最终PASS。Worker及Verifier各自私有检查曾因过严的字面断言失败，修正的是检查脚本而非仓库规则，过程在各报告如实保留。无应用测试、实际.env.local/凭据读取、DB、服务或路由操作；文档通过不表示运行时验证通过。

Supervisor归档前确认原Task03正文前缀SHA仍为b0db91f82038758364c330948bb681c30c67f71f70ae69f4067ffadf6868f769，原两个completedTask分别仍为07a2986d01f54f88d4ba168c4ee85c18cbbb2de62f4ab86e803f7cd2a266f4ad与1f99ec02876c99a870086d38174e1c86f2e06a7180b2085e0ad3f8c3b658e691。旧完成结论保留，仅本Task追加R2。

用户已授权本地main提交，禁止push。Git交付允许显式加入原八文件：五规则和三个completedTask；未改变的两个Task由父提交继承，不能虚构改动。预期新提交为五规则+当前Task的六项修改，无新增/删除最终路径。提交前核对当前main/parent7950c524831d2792d32c6491c2e36af06f7e6d08、限定staged哈希与hook边界，提交后核对parent/tree及clean；不amend、不新建其他Task、不部署、不联网。Git交付回执存/tmp/main-source-only-r2/CommitReport.md，提交结果以Git事实及回执为准，不在本文件预写成功或自引用commit id。
