# TASK — 把 8443 的界面合回主项目（只合并，不上线）

> 本任务单由 Claude 根据 2026-10-06 的只读调查起草，状态为 PROPOSED，需 root Supervisor 复核后再进入 SPECIFIED。
> 本文件是新增的未跟踪文件，**不属于 COURSE-VIDEO-GIT-CHECKPOINT-18 的提交范围**。

## Identity

```text
TASK ID:
RELEASE-8443-RECONCILE-01

TITLE:
以 8443 为界面标准，把 8443 独有的代码合回 main 的新分支（不部署、不碰线上库、不 push）

STATUS:
PROPOSED

BLOCKED BY:
COURSE-VIDEO-GIT-CHECKPOINT-18（当前唯一 Git index 所有者，要求暂停其他工作）
```

## Routing

```text
IMPLEMENTATION PROFILE:
建议 Phase A = worker_medium；Phase B = worker_astra_high（由 Supervisor 最终决定）

ARCHITECT GATE:
REQUIRED — 冲突横跨 smart-textbook-runtime / teaching-agent / smart-textbook-publishing / digital-textbook，
含 teaching-agent 工具 contracts 的 add/add 冲突与迁移对齐

VERIFICATION PROFILE:
verifier_critical — 合并结果将来会替换正在给真实用户使用的 8443

MODEL ROUTING REASON:
Phase A 是边界清楚的 Git 留底；Phase B 是两条无共同历史的代码线三方合并，
需判断每个冲突以哪边为准，并保证 8443 的界面行为不变，不确定性高、跨模块。

DISPATCH RECORD REQUIRED:
YES
```

## Objective

```text
OBJECTIVE:
1. 8443 当前运行的代码进入 git（新分支，只增不改）。
2. 得到一个基于 main 的新分支：界面与 8443 一致，同时保留 main 在 9/13 之后的后台功能。
全程 8443 照常运行，不写线上库，不 push，不部署。
```

## Context

```text
WHY:
用户确认（2026-10-06）：8443 是"以后的唯一"界面标准，是用户 9/11–9/13 亲自盯着做的。
这些界面改动当时直接打在 8443 的发布目录里，只以补丁文件形式存进 main 的 docs/，从未合进 main 源码。
同时 main 在 9/13 之后有大量新功能（teaching-agent、agent-core、学科拆分、时区等）8443 没有。
10/02 Claude 做的 Apple 风格改版已被用户否决并删除（分支 feat/apple-design 已删）。

CURRENT BEHAVIOR:
两条代码线 9/10 分叉后各自发展，没有合回。8443 的代码不在任何 git 仓库里。

DESIRED BEHAVIOR:
一个分支同时拥有 8443 的界面与 main 的后台功能；8443 的代码在 git 中有完整留底。
```

### 已核实的事实（Claude，2026-10-06，只读，可复现）

- **8443 是什么**：Tailscale `:8443` → `127.0.0.1:3000` → PM2 `uply-first-enable`（pid 5778）→
  cwd `/home/yangzhen/releases/uply-first-enable-20260910/source`。不是 git 仓库。
  编译产物中的 Supabase 地址是线上 `jubdbsjsalpecfvseskz`（与 main 的 `.env.local` 相同）。
  9/11 由用户授权接管 3000/8443，此前是 PM2 `uply-dev`（cwd 为 main 目录，现为 stopped）。
  部署记录见 `docs/SMART_TEXTBOOK_STUDENT_UI_DEPLOYMENT_STATUS.md`。
- **8443 的历史**：`/home/yangzhen/releases/uply-first-enable-20260910/source-history.bundle`，
  `refs/heads/master` = `a24049c`，共 4 个提交，根提交 `0003f57`（9/10 基线，含当时工作区未提交改动）。
  **与 main 没有共同祖先**，合并时必须手动以 `0003f57` 为基准。
- **9/10 之后 8443 被改过的源码**（src/tests/scripts/supabase，按 mtime，与当前 main 逐文件 cmp）：

  | 日期 | 与 main 相同 | 内容不同 | main 没有 |
  |---|---|---|---|
  | 09-11 | 16 | 17 | 7 |
  | 09-12 | 0 | 1 | 1 |
  | 09-13 | 5 | 34 | 26 |
  | 09-17 | 42 | 13 | 0 |

  结论：9/11–9/13 的界面工作主要只在 8443；9/17 的工作 main 已有。
- **补丁记录**：main `docs/*.patch` 共 16 个，对应 9/11–9/13 的各次部署。只作参考，**以 8443 源码为准**
  （补丁有累计版与增量版之分，例如 4B1C CUMULATIVE / INCREMENTAL，不能叠加套用）。
  `docs/evidence/teaching-agent-stage-1f-r7c-b/b1d-preflight-fix.patch` 不属于 8443 界面工作。
- **模拟合并**（`git merge-tree --write-tree --merge-base=0003f57 main <8443 快照提交>`，main@2c07384）：
  24 个冲突文件，12 个 add/add、12 个 content：
  - 界面（6）：`src/features/courses/components/course-catalog-listing.tsx`、
    `src/features/digital-textbook/components/digital-textbook-listing.tsx`、
    `src/features/growth-toolbox/components/growth-toolbox-listing.tsx`、
    `src/features/growth-toolbox/components/growth-toolbox-workspace.tsx`（add/add）、
    `src/features/learning-agent-script-studio/ChapterReleaseCheckPanel.tsx`、
    `src/features/smart-textbook-runtime/components/runtime-toolbar.tsx`（add/add）
  - 运行时 / teaching-agent / 发布（12）：`smart-textbook-runtime/core/execution-contracts.ts`（add/add）、
    `smart-textbook-runtime/server/durable-activity-completion.server.ts`（add/add）、
    `smart-textbook-runtime/server/durable-activity-repository.server.ts`（add/add）、
    `smart-textbook-runtime/server/learning-boundary.server.ts`、
    `teaching-agent/server/domain-ports/{index.ts,lesson-execution-facts-binding.ts,lesson-execution-facts-read-port.ts}`（add/add）、
    `teaching-agent/server/tools/{contracts.ts,get-current-lesson-execution-facts.ts}`（add/add）、
    `src/lib/smart-textbook-publishing/{artifact,capture,publisher}.server.ts`
  - 测试与脚本（6）：`scripts/verify-teaching-script-workspace.mjs`、`scripts/verify-toolbox-workspace.mjs`（add/add）、
    `tests/fixtures/mounted-recording-4a12.mjs`、`tests/fixtures/published-chapter-one.mjs`、
    `tests/smart-textbook-runtime-4a-browser.test.mjs`、`tests/smart-textbook-runtime-4a14-browser.test.mjs`
  - 其中 4 个正是 main 当前未提交的文件（CHECKPOINT-18 范围）：`execution-contracts.ts`、
    `artifact.server.ts`、`capture.server.ts`、`publisher.server.ts`。**CHECKPOINT-18 提交后必须重新计算冲突。**
- **合并时不报冲突、但会静默删除的 8443 文件（18 个）**：`src/features/student-assignments/**`（13 个）、
  `src/app/dashboard/admin/student-assignments/**`（4 个）、`src/app/dashboard/admin/growth-toolbox/page-content.tsx`。
  main 在 `98d025c`（2026-09-30，"remove unreachable legacy student-assignment module"）删除。
  它们在 8443 上是否可达、是否有人使用：**未核实**。
- **数据库迁移**：main 461 个，8443 451 个，同名文件内容全部一致。
  8443 独有 2 个：`202609080004_teaching_operations.sql`、`202609080005_completion_policy_management.sql`
  （main 以 `202609140003_teaching_operations_reissue.sql`、`202609140004_completion_policy_management_reissue.sql` 重发）。
  main 独有 12 个：`202609140000`–`202609140007`、`202609170001`、`202609180000`–`202609180002`（agent-core、教学内容隔离等）。
  8443 在 9/10 之后新增的 8 个迁移，main 都有。**线上库实际执行过哪些：未核实。**
- **依赖**：8443 的 `package.json` 只新增了 `pg 8.23.0`、`@types/pg 8.23.1`，main 已相同。
- **快照中的排除项**：`.next-before-grammar-1789271693244/`（1,397 个文件，旧编译备份，`.gitignore` 未覆盖）必须排除；
  快照中只发现 `.env.example`，未发现真实环境文件（入库前仍需复核）。

## Scope

```text
WRITABLE SCOPE:
- 新分支 release/8443-base、release/8443-snapshot（Phase A，只新增 refs 与对象）
- 新分支 merge/8443-into-main，必须在独立 worktree 中（Phase B）
- 报告目录 /tmp/release-8443-reconcile-01/

READABLE DEPENDENCIES:
- /home/yangzhen/releases/uply-first-enable-20260910/**（只读）
- main 全部源码、docs/*.patch 及对应说明文档、docs/SMART_TEXTBOOK_STUDENT_UI_DEPLOYMENT_STATUS.md

FORBIDDEN:
- 停止、重启或修改 8443：PM2 uply-first-enable、端口 3000、Tailscale 配置、~/releases/** 下任何文件
- 连接线上 Supabase（含只读查询，另行授权）；在 main 目录用 .env.local（指向线上库）启动服务并登录
- push、部署、修改 main 分支、修改 origin
- 任何视觉改版：不得引入 Apple 改版或新的样式方案；
  不修 src/app/globals.css:860 的 --font-sans 自引用（修了会改变 8443 的观感），只在报告中记录
- AGENTS.md、CODEX_*.md、.codex/** 配置、根级构建 / TypeScript / ESLint 配置
- 未经用户决定，不得最终删除或恢复上面列出的 18 个静默删除文件
```

## Contracts

```text
MAY CHANGE PUBLIC CONTRACT:
可能 — teaching-agent/server/tools/contracts.ts、smart-textbook-runtime/core/execution-contracts.ts 为 add/add 冲突。
任何公共 contract 取舍必须经 Architect Gate。
```

## Data / Security Impact

```text
DATABASE IMPACT:
NONE（本任务不执行任何迁移）；但须产出"合并后代码所需迁移清单"

RLS IMPACT:
NO（预期）；若冲突涉及 RLS / Auth，立即上报

AUTH IMPACT:
NO（预期）

SECURITY IMPACT:
MEDIUM — 入库前检查快照中没有密钥、会话、日志或大二进制
```

## Requirements

### Phase A — 8443 留底（只增不改）

1. 在发布目录运行 `sha256sum -c SHA256SUMS`，记录结果（9/10 之后被改过的文件不匹配属预期，记录数量与列表）。
2. `git fetch <bundle 路径> master:release/8443-base`。
3. 用临时 index 把 8443 当前源码记成一个提交，父提交为 `release/8443-base`，分支名 `release/8443-snapshot`：
   排除 `.next*`、`node_modules`、真实环境文件、日志。不得写入发布目录。
4. 复核：分支中没有密钥 / 会话 / 大二进制；`git archive` 解出的 `src/` 与发布目录 `src/` 逐字节一致。
5. 不 push。

### Phase B — 在新分支上合并

6. 前置：CHECKPOINT-18 已完成；从其提交后的 main HEAD 建独立 worktree 与分支 `merge/8443-into-main`。
7. 以 `0003f57` 为合并基准，把 `diff(0003f57, release/8443-snapshot)` 三方合并进来，
   范围为 `src tests scripts supabase docs package.json package-lock.json`（不含 `.next*`）。
   重新计算冲突清单，与本文件的 24 个对照，差异说明原因。
8. 冲突取舍原则：
   - 用户可见的界面（学生端、管理端）以 8443 为准；
   - 运行时、teaching-agent、发布、contract 以 main 为准，但必须保证 8443 界面依赖的接口仍可用；
   - 两边都需要时合并；逐个文件写明取舍与理由。
9. 18 个静默删除文件：只读确认它们在 8443 上是否有入口、是否有数据，报告后**停下该项等用户决定**（恢复 / 保持删除），
   其他工作继续。用户决定前在合并分支中保持 main 的删除状态。
10. 迁移：产出清单，列出合并后代码依赖的迁移、8443 已依赖的迁移、两个 reissue 的对应关系。不执行。
11. 除解决冲突所必需的改动外，不得新增任何样式或界面改动。
12. 列出合并后用户会感知到、但不属于界面的行为变化（例如时区、学科拆分带来的入口变化），供用户确认。

### Phase C — 不在本任务内（另立任务，需用户批准）

- 读取线上库迁移状态、补齐迁移、用合并分支重新部署 8443、回滚预案。

## Out of Scope

- 部署、切换 8443、PM2 操作
- 任何线上数据库访问
- 视觉改版、设计 token 调整、--font-sans 修复
- 韩语迁入 src/features/subjects/korean（学科拆分第 5 步）

## Acceptance Criteria

1. `release/8443-snapshot` 存在，源码与 8443 发布目录逐字节一致（排除项除外），不含敏感文件。
2. `merge/8443-into-main` 无冲突标记，类型检查、lint、单元测试按项目现有规程通过；已知的既有诊断如实说明，不写成全绿。
3. 界面对照：9/11–9/13 涉及的页面（以 docs/*.patch 及对应说明文档为清单）在本机库运行，
   与 8443 同路径截图对比，布局、文案、交互一致；数据差异除外，其他差异逐条列出。
4. 冲突逐个说明取舍；18 个静默删除文件的事实已报告并等待用户决定；迁移清单完成；行为变化清单完成。
5. 任务前后 PM2 `uply-first-enable` 的 pid 与重启次数不变；没有 push；没有访问线上库。

## Required Validation

```text
TYPECHECK:
REQUIRED

LINT:
REQUIRED

UNIT:
REQUIRED

INTEGRATION:
按项目现有规程

E2E / BROWSER:
REQUIRED — 只允许本机库（Codex 本机 543xx 或 lms-verify 56321），禁止线上库

MIGRATION / RLS:
NOT_REQUIRED（不执行）；迁移清单 REQUIRED
```

## Risk Focus

- 与 CHECKPOINT-18 的 4 个重叠文件
- teaching-agent / execution contracts 的 add/add 冲突（两边各自新建了同名文件）
- 误连线上库（main 的 .env.local 指向线上）
- 静默删除导致 8443 现有功能消失
- `docs/evidence/teaching-agent-stage-1f-r7c-b/b3a-candidate-source-lock.json` 的源码指纹不一致会进一步增加，需在报告中说明

## Parallelism

```text
CAN RUN IN PARALLEL:
NO — 等 CHECKPOINT-18；Phase B 独占合并分支

CONFLICTING TASKS:
- COURSE-VIDEO-GIT-CHECKPOINT-18

WORKTREE:
REQUIRED（Phase B）
```

## Escalation Rule

以下任一情况出现时，停止扩大修改并上报：

- 需要修改 Writable Scope 外内容
- 需要改公共 Contract
- 发现 DB / RLS / Auth / 安全架构影响
- 发现 8443 依赖快照之外的东西（例如构建期环境变量差异）
- 当前 Profile 无法可靠解决
- 任务实际复杂度显著高于预期

输出 `SCOPE_CHANGE_REQUEST` 或 `ESCALATION_REQUIRED`。

## Worker Report

按 `CODEX_WORKER.md` 格式提交。

## Verification Report

按 `CODEX_VERIFICATION.md` 格式提交。


## Supervisor activation — 2026-10-06

This section supersedes conflicting PROPOSED/baseline statements above; the original draft is preserved for provenance.

- User authorized this reconciliation direction: “好的，按照你的逻辑来”. No deployment, production access, remote push or main branch merge is authorized by this Task.
- STATUS: SPECIFIED for Phase A; Phase B remains behind independent Architecture Gate and exact-path freeze.
- Git checkpoint 18 is COMPLETED. Main HEAD baseline: `c3503cb50298a8118008cf143ad87837e6a3d6b3`; preceding source commit: `a92873bd8c18b453c76212affa21a8aeea7fd382`.
- Fresh readonly relationship report: `/tmp/main-release-relationship-20261006/WorkerReport.md`, SHA256 `df7d723265a4d026db859dce50dba64d30545d49daab1bcf42b17603dc968630`.
- Runtime mapping is corroborated by Tailscale/PM2, not a complete current compiled-source equivalence proof. Old draft counts, migration inventory, refs and conflicts MUST be refreshed. Do not read real environment/credential files.
- Phase A Worker: worker_medium / GPT-6.1 Sol medium. Exclusive Git metadata owner for this phase; no code implementation. Read CODEX_WORKER.md.
- Phase A writable: private `/tmp/release-8443-reconcile-01/`; new Git objects/refs only after secret/private-artifact screening. Branch names default `codex/release-8443-base`, `codex/release-8443-snapshot`. Ref creation is exclusive (no overwrites). Main worktree/index/HEAD remain unchanged. Local bundle only, no remote fetch/push. Inspect bundle content in private isolated Git storage BEFORE importing to main; never import credentials or private evidence. If bundle history contains sensitive content, report scope decision rather than import it.
- Snapshot excludes all `.next*`, build copies, node_modules, actual env/credentials, logs, private runtime/evidence and large media/binaries. Record exact excluded paths/categories and preserve safe src/tests/scripts/supabase/public/docs/package source as appropriate. Any unreviewed binary/secret suspicion blocks its import; never print secret values. Preserve symlink semantics; do not follow links to private/outside paths.
- Phase A must produce: WorkerReport, before/after Git and release source hashes, safe snapshot manifest, source equality proof, refreshed delta/conflicts against current main, migration inventory and static legacy-deletion reachability findings. Do not run application builds/tests, DB or live browser. Readonly PM2 output must be allowlisted; never save raw `pm2 jlist`.
- Phase B proposed branch: `codex/merge-8443-into-main`, isolated worktree under `/tmp`. Needs Gate ALLOW + exact file/path decisions before implementation. Gate must protect all Task17 native video contracts, main migrations, Auth/RLS, agent-core and current runtime behavior; legacy deleted-module decision must remain explicit. No automatic wholesale copying of old release runtime over newer main.
- UI verification will use isolated local/synthetic fixtures and source baseline where possible; this activation does NOT authorize production authenticated browser/DB reads. Live-source screenshot equivalence remains NOT VALIDATED unless safely reproduced locally.
- Known existing typecheck baseline: 59 `build/**` copy errors, src/tests zero at checkpoint. Do not edit root configs/build copies to hide them.
- Phase A acceptance: main HEAD/index/working source unchanged, live release unchanged, no credential exposure, source-only safe snapshot exact, report complete. Phase A required validation: Git/hash/static only; no tests or runtime startup.


### Phase A safe-history disposition

Snapshot Worker found the local bundle history contains private-assets audio, artifacts/round5 screenshots/runtime evidence and orchestration logs. Importing that original history into the main repository is NOT allowed. Supervisor authorizes the narrower alternative within the user-approved source-preservation objective: construct a sanitized source-only baseline from the original root tree (original OID retained in private provenance), and a sanitized current source snapshot with that sanitized baseline as parent. Use identical safe-path/exclusion policy for both. Preserve supported source bytes/modes and report exclusions; do not transplant private data. Recompute the three-way delta against sanitized baseline, documenting that these new commits are sanitized snapshot records, NOT original historical commits. No original bundle objects/private history may be imported to main. Screening or incomplete source-boundary uncertainty remains a stop gate; no main history rewrite.


## Phase B activation — independent Gate ALLOW

STATUS: INTERFACE_FROZEN -> IMPLEMENTING in isolated worktree only.

Phase A source snapshot review PASS within source-only scope: `/tmp/release-8443-reconcile-01/WorkerReport.md` SHA256 `329ed389ca7536d91a0895d2d7070c0ea82b9b82ef5fe3c7ad1cf9c6528da84b`. New safe refs baseline `4bca08b4f4bbd2004109f66f2dd95cae7496207e`, snapshot `b14a6e01952592c6830a2ff617f0141280c636e0`; main stays `c3503cb50298a8118008cf143ad87837e6a3d6b3`. Independent Phase A verification is separate; initial transient reading of unexpected credential-like reasonix.toml during scan was disclosed, no values printed/saved/imported, not claimed as a perfect no-read process.

Supervisor adopts Gate ALLOW in `/tmp/release-8443-reconcile-gate/`:
- `ArchitectureGate.md` SHA256 `5eed8437710dc2cf21965437beacb76aad0ef8240819301bee81154dc251092e`
- `file-decisions.json` SHA256 `5b5beed89ccc1b7ee0db63523d1f2713e365d470f2e0431396f9ce3c0c705fe3`
- `writable-paths.txt` SHA256 `b3c7a6bb2e900c1d1eec8988d5785e05e1bfeb19af207c59d4eced8c84f2d359`
- `conflict-decisions.md` SHA256 `e4a593a8d8e7b2ffa982b55ba4588f7d627325c846ad5c0133365c72aad7b432`

The Gate documents supersede original broad Phase B merge procedure. Exact writable manifest = 93 maximum paths, 66 source +27 tests/scripts; only necessary paths should change. All nonallowlisted paths stay byte-identical to main; no deletion. Gate frozen optional compatibility contracts are the ONLY permitted public-interface exceptions. Main 464 migrations, Auth/RLS, agent-core, native execution/publishing/media/selection, old test assertions and legacy18 absence are protected. Keeping legacy18 absent preserves both current trees' reachable behavior; it is not a new deletion, product change or DB change, so the draft's provisional extra product decision is resolved by readonly audit plus Gate.

Implementation Worker: worker_astra_high / GPT-6 Astra high. Sole Git/worktree/code owner. Create `/tmp/release-8443-reconcile-worktree` and branch `codex/merge-8443-into-main` from frozen main with exclusive creation. Do not change root main index/HEAD/worktree; no push/main merge. If path/ref already exists inspect ownership and stop conflicting mutation. Read installed Next guides and ui-ux-pro-max skill for preserving accessible UI; no visual redesign. Read Gate in full and exact per-file decisions before edits. No wholesale unrelated-history merge or directory checkout. Author an actual-disposition record for all changes.

Validation scope: isolated synthetic/pure/component browser only, per Gate. No Docker, DB, production browser, credential/env-file loading, package installation, PM2/Tailscale mutation. Use existing local dependencies and explicitly sanitized test environment. Check transitive test fixtures BEFORE launching; no broad npm check/navigation glob that starts Docker. Required typecheck/lint/path/protected-hash checks; current baseline59 build-copy errors not to be hidden by config changes. Required targeted old+new behavioral tests and source-reference synthetic screenshots at390/768/1440 per Gate, adapting only within writable manifest. Preserve native-video and current agent behavior. Any new unavoidable path/protocol issue requests scope change before expansion.

Independent verifier: verifier_critical / GPT-6 Astra xhigh, actual-diff and targeted independent checks, report no live deployment/DB proof. Final commit on isolated branch only after independent acceptance; no authority/package completion publication. Main/runtime remain unchanged. Final user explanation must distinguish saved code, integrated branch, synthetic verification, and not-yet-deployed website.


### Phase B browser-harness subtask (disjoint ownership)

To finish independent remaining work concurrently, root assigns worker_high / GPT-6.1 Sol high the following THREE already Gate-allowlisted files in the isolated worktree only:
- `scripts/verify-release-8443-reconcile.mjs`
- `tests/fixtures/release-8443-reconcile.tsx`
- `tests/fixtures/release-8443-reconcile.mjs`

The main implementation Worker confirmed it has just created the two initial fixtures and relinquishes writes to all three until this subtask completes. Browser Worker owns only those three source paths and `/tmp/release-8443-browser-impl/` report/artifacts. It must accommodate existing edits, not revert them, and may not mutate Git refs/index, production code, config, dependency files, other tests or live source. No new scope beyond the93 manifest. Main implementation Worker remains sole Git owner and owns all other files; both may only read the other's outputs, and coordinate any compatibility change before edits.

Browser objective: actual mounted components under SAME synthetic data/viewport in sanitized release source and reconciled worktree; explicit allowed main-only capability differences; 390/768/1440, relevant dark mode, navigation/action payloads/read-only/empty/error/keyboard behavior. No environment/credentials, no DB/Docker, no package install, no live8443. Serve isolated ephemeral loopback and deny all other network traffic. No modification of production return values/guards. Handle any reference-only adapter openly, not a silent redesigned baseline. Use existing cached dependencies, relevant Next docs and UI skill. Report exact tests/screenshots/hashes/limits and cleanup. Source reference is not live compiled parity.

Main implementation Worker continues safe unit/security/lint/static evidence; full independent verification begins after both reports. This disjoint test-harness subtask supersedes the one-code-writer detail only for these3 files; no shared-index writers or overlapping file scope.


### Revision R1 — bounded shared hint touch handling

Actual browser `/tmp/release-8443-browser-impl/run-6/validation.json` found first touch tap immediately closes CardTitleWithHint in BOTH source reference and candidate. All24 static comparison cases otherwise matched exactly. Independent critical verifier corroborated onMouseEnter/onFocus followed by onClick toggle as the cause. This inherited issue still fails explicit touch acceptance, so it is not waived as PASS.

An attempted additional architect_gate follow-up was rejected by the tool (`agent thread limit reached`) and did not execute. Active critical verifier independently reviewed the precise scope and determined this internal UI-event correction has no Auth/RLS/schema/public-protocol/security-boundary/high-risk architectural trigger. Root therefore authorizes this ordinary bounded UI revision under Supervisor Scope control; original Architecture Gate for the broader integration remains valid.

ONE additional writable production path in isolated worktree only:
- `src/components/ui/card-title-with-hint.tsx`

Total maximum now94 paths =67source+27tests/scripts. Main implementation Worker owns this one correction; browser Worker retains its3testfiles. No other production edit is authorized by R1. Preserve component public props/types, styles/classes/icon/geometry/ARIA and callers. Change only internal pointer/focus/click bookkeeping so first touch/pen tap opens, second closes, third reopens; no immediate focus/click cancellation. Preserve real mouse hover/leave, keyboard focus and Enter/Space activation, Escape, blur and outside dismissal. No timer/device-wide heuristic, new dependency, or visual redesign. Root main and original release component remain byte-identical and unmodified.

Browser tests must record original reference touch failure as an explicit allowed BUGFIX difference and verify the candidate first/second/thirdtap, outside tap, hover/leave, Tab/Enter/Space/Escape and focus return. Do not silently fix/mock the reference component. Keep24same-data visual comparisons unchanged. Refresh production hashes, scope/protected-path checks, typecheck and targeted lint/interaction checks. Critical verifier independently verifies this correction and final browser evidence before PASS. Earlier failed run is preserved.


## Final Supervisor acceptance — 2026-10-06

STATUS: COMPLETED (source reconciliation + isolated synthetic validation only; NOT DEPLOYED).
SUPERVISOR DECISION: PASS within activated scope.

Plain-language result: the saved8443 course/catalog/textbook/workbench interface is now reconciled with main's current learning-assistant and native video capabilities in an isolated branch of the SAME project repository. Main and the running8443 service have not been replaced. This is code integration, not website rollout.

### Durable Git pointers

- Root main remains `c3503cb50298a8118008cf143ad87837e6a3d6b3`.
- Safe source baseline: `codex/release-8443-base` -> `4bca08b4f4bbd2004109f66f2dd95cae7496207e`.
- Safe source snapshot: `codex/release-8443-snapshot` -> `b14a6e01952592c6830a2ff617f0141280c636e0`.
- Accepted implementation: `codex/merge-8443-into-main` -> `64f51c8b1040a82be5815a0498a6c7398bde010e`.
- Parent: `c3503cb50298a8118008cf143ad87837e6a3d6b3`.
- Isolated worktree: `/tmp/release-8443-reconcile-worktree`.
- Commit contains94 exact files (67source+27tests/scripts),3039insertions/296deletions, no deleted paths. All staged/committed blob hashes match the accepted94-path freeze. Worktree/index clean; main HEAD/index/all1446source hashes unchanged,464migrations unchanged.
- No merge to main, push, deploy, production DB connection, native course activation, PM2/Tailscale mutation or migration execution.

### Reports bound at acceptance

- PhaseA Worker `/tmp/release-8443-reconcile-01/WorkerReport.md`, SHA256 `329ed389ca7536d91a0895d2d7070c0ea82b9b82ef5fe3c7ad1cf9c6528da84b`.
- PhaseA independent verifier `/tmp/release-8443-reconcile-verify/VerificationReport-PhaseA.md`, SHA256 `8d59b2709af888aa4dfead8236143b10e11629ab2861a4f7509a9b1b55de446d`.
- PhaseB Worker `/tmp/release-8443-reconcile-impl/WorkerReport.md`, SHA256 `6f82d4136ae52c6cfc3c4008c7b60e2ab5b67f109389845496fbd77edc3c950d`.
- Browser Worker `/tmp/release-8443-browser-impl/WorkerReport.md`, SHA256 `6f216a137b5da7a21a27181bc9f45336425cd75d030974a065dcfd6bbb14a58f`.
- Independent critical verifier `/tmp/release-8443-reconcile-verify/PhaseB/VerificationReport-PhaseB.md`, SHA256 `c436e5b5119c069b4d35ecaada940985b6d7c4366dd3154f62e5421b63ea6103`.
- Final browser receipt `/tmp/release-8443-browser-impl/run-9-r1b-final/validation.json`, SHA256 `015b867a3a093ccc0331d63706d0fccd1e2c0d74b89fbba5787f8a611a25a4db`.
- All94 accepted files `/tmp/release-8443-reconcile-impl/all-changed-paths-final-freeze.json`, SHA256 `12b2e63ef53fa77f5f509c764fa3d76eb2718090633470b108ac51c1bf92195f`.
- Commit report `/tmp/release-8443-reconcile-impl/CommitReport.md`, SHA256 `7b858413d38c30ac9df591d34ea32a7912a2f8909470e6c8b6f9ae90756872ab`; structured report SHA256 `1bad26c93413d69418c65c3172b0e81b0366e43d70c2bf45b87b1731b40581d2`.

### Validation and limits

- Final official Next type generation and full TypeScript checks PASS. No root config/manual declaration bypass.
- Same-data actual mounted source comparison:24reference/candidate screenshot pairs byte-identical, common interactions and candidate-only native video pause editor PASS at390/768/1440 and relevant dark mode. Runtime fixture is inspection-only; does not prove actual playback receipts or live environment.
- R1b hint internal-event correction PASS: real mouse, settled touch taps, pen, keyboard/focus/Escape/cancel and outside dismissal. Original reference's two defects retained as explicit bugfix differences. Earlier failed revisions/probes retained.
- New focused unit tests16/16PASS, independently rerun; additional independent security negatives7/7PASS.
- Safe existing batch548:542PASS/5FAIL/1SQLSKIP. All five failures independently reproduced against exact frozenmain1446src+268tests: four runtime-4a9 fixture unsupported-table failures and one subject-registry outdated regex. They remain FAIL, not waived into testPASS. One preexisting lint explicit-any error and eight warnings remain (three baseline/five savedrelease); scoped new/hint/browser lint PASS.
- No introduced blocker remains under frozen source/synthetic scope. Live compiled8443 parity, real DB/RLS/RPC atomicity, production applied migrations, real login and native activation are NOT VALIDATED.
- Initial PhaseA scanner transiently read unexpected credential-like reasonix.toml before exclusion; no value printed/persisted/imported. This historical deviation remains recorded; do not claim entire workflow never read a credential-like file.

### Next work (not executed here)

1. Review the accepted isolated branch and decide main adoption through the project Git flow. Preserve original main/history and snapshot refs; do not deploy as an implicit consequence of merging.
2. Separately assess rollout prerequisites: current8443 compiled/config state, required migration ledger and rollback plan. Production reads/writes/deployment need their own concrete authorized scope. Do not use real.env or online DB merely for local preview.
3. Track the five baseline test failures, existing lint error and skippedSQL as separate bounded validation debt; no claim that the full repository suite is green.
4. Only after the deployment check is closed, separately replace8443 and verify real pages. sample01 video pauses/questions still require the user's actual content setup; this task has not invented or published them.

This archived Task is Supervisor metadata in the root main worktree, intentionally separate from the94-file accepted implementation commit. Original draft and all superseding decisions above remain for provenance.
