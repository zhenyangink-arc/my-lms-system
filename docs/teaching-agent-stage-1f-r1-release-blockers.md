# UPLY Teaching Agent — Stage 1F-R1 Release Blockers

## 1. Executive Summary

**Overall: NO-GO。Stage 1F-R2: NOT READY。生产配置继续 OFF；Production Migration: NOT APPLIED；Production Ledger: UNCHANGED。**

本轮完成了仓库中三个确定的整改：

- Agent Core 从冲突的 `202609130001` 重新分配为 **`202609140000`**，SQL 字节不变，旧文件留档；补回当前 release 中 8 份生产已应用但本地缺失的 migration。当前 454 个 migration version 唯一，目标 449 个 ledger 条目的 version/name 均在本地获得一致对应。
- 仅在 `tsconfig.json` 增加 `docs/evidence/**` exclude。完整 Next production build **exit 0**；临时 `src` 类型错误使另一次完整 build **exit 1**，证明类型检查仍然生效。
- 增加 server-only tenant/course/user rollout allowlist；页面投影与 POST 共用 `createStudentRolloutAdmission`。默认空集拒绝。global OFF 拒绝新 POST / UI projection，但保留 active student owner 的已有 Run GET/cancel，仍执行身份、当前 tenant、ownership 和 cancel Origin 校验。

**尚不能将本轮判 GO：G-R1-2 Fresh Migration Apply FAIL。** 完整空库链执行到第 287 份 `202608190007_seed_korean_chapter_one_pilot_papers.sql` 时，因“韩国语一级第一章正式题库不存在或尚未发布”失败。之前还暴露了该历史 seed 对 active platform owner 的前置要求；在全新隔离库补入一个纯合成 owner 后，已发布题库依赖仍未满足。没有跳过迁移、复制生产教材或伪造题库来制造 PASS。

目标当前 schema-only clone 的新 Agent 三步序列 **3/3 PASS**，5 个 Agent 表创建成功，277 条原 public policies 未改变。这个结果不能替代完整空库链，也不能替代下一阶段真实 Auth/JWT/PostgREST/RLS。

自动回归 **345 PASS / 1 SKIP**；另有明确失败的完整 migration 验证，不计入“自动回归无失败”来掩盖 Gate。Live Provider Requests=0；Agent 执行测试 Teaching Domain Writes=0。未创建完整 Supabase staging，未生产 seed/deploy/restart，未修改 Tailscale 或生产配置。

## 2. Inputs & Baseline

沿用并核对本会话已完整阅读的十份输入：`assistant-current-state-audit.md`、`teaching-agent-architecture-v1.md`、Stage 0A/0B/1A/1B/1C/1D/1E/1F 报告。旧资料没有回写；真实源码 > 1F > 1E > 1D > 1C > 旧建议。

开始工作区 HEAD 为 `b1672390ae96357a2143358235cc10edeff8d488`，已有未提交的课堂、Growth Toolbox、Script Studio、Agent/测试/文档工作。新建 2,593 个 tracked/nonignored 源码与文档文件的 SHA-256 基线，排除 `.next*` 生成目录。所有本次修改按该基线判断，不能将整份 git status 都算作本轮改动。

读取根 AGENTS.md 和安装版 Next 16.2.10 的 `typescript.md` / `distDir.md` 等本地指南；未改依赖。生产只读操作仅取 migration catalog、Agent 表元数据；本地已有 UPLY Supabase 也只查 catalog，没有读取学生行。没有启用 live Provider 测试。

## 3. Files Changed

| 文件 / 范围 | 本轮变化 |
|---|---|
| [tsconfig.json][tsconfig] | 增加唯一精确排除 `docs/evidence/**` |
| [rollout-policy.ts][rollout] | 新增 server-only policy 与 user-scoped lesson→course resolver |
| [student-handlers.ts][handlers] | POST Auth 后检查 rollout，异步返回后重查 global gate；GET/cancel 移除 admission flag gate |
| [production.ts][production] | 使用 auth.supabase 和已验证 owner 构造 rollout admission |
| [lesson-slots.tsx][slots] | 在候选脚本查询和 client slot 创建前检查同一 rollout admission |
| [202609140000_agent_core_foundation.sql][core] | 原 Agent Core 改 identity，内容哈希不变 |
| 8 份恢复的历史 migration | 从当前线上 release 原样复制，清单及 checksum 见 §5 |
| [migration-identity archive][archive] | 保留旧 Core SQL、reconciliation、454 份完整 inventory；不在 migration runner 内 |
| [verify-teaching-agent-release-migrations.py][migrationrunner] | 新增仅运行自有无网络临时 PostgreSQL 的 fresh/clone 检查器；失败返回非零 |
| 原 Core DB / runtime fixture loader | 更新 Core migration filename |
| 原 transport/Next/UI fixtures 与 tests | 显式适配 admission seam；旧 OFF 测试改为新 admission 语义；SQL cancel 测试增加 OFF recovery |
| [student-rollout tests][rollouttest]、[page-rollout tests][pagetest]、[release-migration tests][migrationtest] | 新增 allowlist/实际 page loader/回收语义/版本唯一性及内容保真检查 |
| `docs/evidence/teaching-agent-stage-1f-r1/` | 新增脱敏验证结果；无 schema dump、凭证、教材正文或学生行 |
| [本报告][report] | 新增 26 节 R1 报告 |

没有修改 Tools、Skills、Prompt、Provider、Model Config、Domain authorization、Script Runtime、真实课程 unlock。没有编辑旧 migration SQL 内容或历史报告。Growth Toolbox / Script Studio / 原有课堂未提交修改保持不变。

## 4. Migration Collision Analysis

真实生产 catalog 本轮开始/结束均为 449 个 ledger 条目，Agent 表数 0。`202609130001` 的真实名称为 `textbook_grammar_authoring`，不是 Agent Core。Git history 中没有旧 Agent Core 的提交记录；它在工作区为未跟踪文件。Stage 0B～1F 的执行记录指向自建临时数据库，没有共享/生产 apply；本机 UPLY Supabase 的元数据也显示 Agent 表 0，`>=202609130001` 的本地 ledger 条目为空。没有已确认的其它 staging；不能声称检查了未知外部环境。

本地原 446 份文件 version 无内部重复，但与目标有 1 个同 version 不同 name 冲突，加上 7 个目标 version 缺失。因此需恢复的真实历史共 8 份。修复后 454 个唯一 version；目标全部 449 条 version/name 已匹配。

另有两份**不是 Agent、目标 ledger 未记录**的本地文件：

- `202609080004_teaching_operations.sql`
- `202609080005_completion_policy_management.sql`

它们没有被改名/删除/标 applied，也不能因为本轮修复而自动向生产补跑。未来 release preflight 仍需独立审查这两个 pending 历史差异；本报告不等于全目录 `supabase db push` 许可。

完整每文件 version、filename、SHA-256、runner predecessor、显式 REFERENCES 关系，见 [migration-inventory.json][inventory]（454 项）。`runnerPredecessor` 表示确定的执行序列，`explicitReferencedRelations` 是静态提取，不冒充所有函数/DML/人工 seed 前置条件的完整依赖图；本次 fresh run 正好证明还存在业务数据前置条件。

## 5. Migration Identity Reconciliation

新 Agent release 顺序：

```text
202609140000_agent_core_foundation.sql
→ 202609140001_agent_runtime_completion_evidence.sql
→ 202609140002_agent_run_cancel_request.sql
```

`202609140000` 在检查的本地目录、目标 ledger、本地 UPLY DB catalog 中均未占用；它晚于目标最新 `202609130003`，并早于后两份 Agent 文件。不是机械采用 Prompt 示例数字。保留后两份版本及 SQL 内容。

原 `202609130001_agent_core_foundation.sql` 从 active runner 移出，按原字节保存在 [archive][archive]。新 active Core 与 archive SHA-256 相同；没有旧+新两条 CREATE 路径。恢复的 `202609130001_textbook_grammar_authoring.sql` 使用目标真实 identity，不与 Core 混淆。

从当前 release `/home/yangzhen/releases/uply-first-enable-20260910/source/supabase/migrations/` 原样恢复：

| Filename | SHA-256 |
|---|---|
| 202609100003_runtime_admission_control.sql | 2f993901f0f3b23474aad88e07c9b58daaa4e5c74c4b8b1eb759d58a54a65b3a |
| 202609100004_runtime_single_version_authoring.sql | b7b8836e639933e5548ba9080f6823d975a77be07651ba74be04be64322ca9d5 |
| 202609100005_chapter_publish_semantic_compatibility.sql | 78f9fae8f971cb20343ff04eba8a17c2e5796428904dd62cdcfe817b8e43881d |
| 202609110001_allow_evidence_graded_roleplay_publication.sql | a786590ea6b3793266d0020ca422587da50f84561d3f377af999f97a961f96cd |
| 202609110002_restore_single_version_publish_wrapper.sql | e567ee37c8a89520a985d10d169c746e3d33cf9f5aa98cc140f3e8e6c13e50a6 |
| 202609130001_textbook_grammar_authoring.sql | a60e244ae46099ded2547d323f0311e20a5d4c87b85c0f3b8e8d52d674e6be5a |
| 202609130002_textbook_grammar_practice_binding.sql | cacb86eacfd3777492be47c6941456b43460d870c88c9269b735a863c82b2ed8 |
| 202609130003_runtime_authoring_nonretryable_error.sql | 0c5a16609d3c7196284f86cecb96f250988d2ff78834a92d8e0cce5966edd73d |

这些 checksum 是对 release 文件的字节比较；ledger name 一致不是声称 ledger 保存了相同的原始文件字节。出处与 hash 记录在 [reconciliation.json][reconciliation]。旧报告继续保留当时的名字；本报告提供旧→新/archive 映射，不制造“当时已改名”的历史。

**版本冲突本身已消除；Migration Identity Remediation 总 Gate 仍 FAIL**，因为用户要求 A1–A4 全部 PASS，而完整 fresh migration A2 未通过。

## 6. Fresh Migration Verification

**FAIL，未达到要求的完整 exit 0。** 真实执行结果见 [fresh-migration-result.json][freshresult]。

使用 cached Supabase PostgreSQL 17.6.1.159 镜像、新名字、自有 label、无网络、无 host port/volume、read-only rootfs、tmpfs 数据目录。没有触碰现有本地或生产数据库。用镜像官方初始化 SQL 建立 Auth/extension 基础；补入现有 schema-only archive 中的 Storage/Realtime 平台 schema 与 auth.jwt 函数，排除其依赖应用 private helper 的应用 policies（这些应由 app migrations 创建）。没有恢复 public 应用表或业务行后假称空库。

这不是完整 Auth/PostgREST staging。最初平台前置条件不完整的尝试不计 PASS；最终平台 bootstrap、Storage、Realtime、JWT function restore 均 exit 0。随后**从 `202607130000_profiles_auth_baseline.sql` 起按文件顺序执行全部历史，遇错即停**，没有跳过旧 SQL。

最终结果：计划 454 份，执行 287 份，前 286 份成功；第 287 份 `202608190007_seed_korean_chapter_one_pilot_papers.sql` 失败。首次该处提示缺少 active platform owner；重新创建的隔离库中仅加入一个 synthetic owner（`.invalid` email，无密码/真实用户数据），再次运行后提示：

```text
韩国语一级第一章正式题库不存在或尚未发布
```

该旧 migration 在开头明确查询 active owner、`chapter_tests.slug='korean-level-one-01'` 且 published，并依赖对应 chapter_homework_plan。[既有 seed-korean-level-one-tests.cjs][legacyseed] 是迁移链外的题库创建路径，且会加载 `.env` 后使用数据库 client 执行写入；**本阶段没有运行该脚本**，也没有把它指向生产或把其中教材作为新 synthetic fixture 复制来补齐。

失败时 Agent 表数 0，尚未到新的 Core。因而“完整 fresh chain 中 Agent tables/functions/indexes/policies 只创建一次”的动态 Gate 不能标 PASS。静态单路径验证与 §7 clone 的单次创建提供局部正向证据，但不替代 A2。

在“不改旧 SQL、不伪造发布教材、不扩大到课程内容迁移重建”的边界下，本轮不继续补人工教材状态。需要一份单独审阅的历史 bootstrap/数据前置策略，或获准的历史基线整理，才能使完整 fresh chain 可重放；不能靠当前 Agent 改名解决这一旧依赖。

可重复的仅隔离验证命令（参数目录含受限 schema.dump / roles.sql；不是数据库地址）：

```bash
python3 scripts/verify-teaching-agent-release-migrations.py \
  --mode fresh --snapshot-dir /tmp/uply-stage1f-readonly \
  --output /tmp/uply-stage1fr1-fresh-recheck
```

`--output` 必须是新目录；脚本没有外部 DB endpoint/.env 输入，结束清理自己创建的容器。当前运行该命令应返回非零，不得在 CI 将失败翻译成成功。

## 7. Target Schema Clone Verification

**PASS（R1 current-schema + new Agent SQL apply 范围）。** 见 [target-clone-result.json][cloneresult]、[clone-verification.json][cloneverify]。

使用 Stage1F 只读取得的 schema-only snapshot，其 SHA-256：`127e4fce8c0fb389b626fb7001586196fe1db0f28470ebe5de90c59791037aa4`。没有业务 data archive，也没有复制学生数据。

在另一个全新无网络容器恢复完整 schema，随后按新名字依次执行三份 Agent SQL：roles restore exit 0、schema restore exit 0、三步各 exit 0；Agent 5 表创建一次，indexes/policies 无 duplicate error。1C/1D 对既有 RPC 的 `CREATE OR REPLACE` 属于设计中的升级，不把这种有意替换误判成重复创建。

恢复适配明确记录：initdb 的 postgres 保持 bootstrap superuser；role membership 的对象与选项保留，但 grantor 由 hosted supabase_admin 改为容器 bootstrap postgres，避免伪造托管 grantor 管理权限。此适配只存在临时数据库，**未改任何应用 migration 或生产角色**。因此它证明 DDL/函数/grant 创建兼容，不证明目标真实 JWT/RLS 行为或托管角色图绝对同构。

public policies 从 277 到 280，原 277 条定义未改变，只增加三条 Agent usage restrictive policies。检查 8 个 Agent public RPC 均 SECURITY DEFINER + 空 search_path，authenticated execute=false；Core/CAS/evidence/cancel RPC 行为另外在隔离数据库回归通过。

```bash
python3 scripts/verify-teaching-agent-release-migrations.py \
  --mode clone --snapshot-dir /tmp/uply-stage1f-readonly \
  --output /tmp/uply-stage1fr1-clone-recheck
```

此命令只 apply 三份新的 Agent SQL，不把目标已执行的 449 份历史再跑一遍；完整历史的另一条 fresh 检查仍 FAIL。

## 8. Production Ledger Safety

**UNCHANGED；Production Migration: NOT APPLIED。** 两次真实只读 catalog 的全部 migration version/name 列表和 Agent 表数量完全一致。Ledger 没有 insert/update/delete/mark-applied；没有 `supabase db push`、生产 psql DDL/DML、生产用户创建或 seed。

恢复的八个本地文件只是把仓库与当前 release 对齐；没有向生产重新应用它们。没有把旧 ledger 的 `202609130001` 改成 Agent，也没有 drop 已有对象。新的 Core 只在独立临时数据库应用。

未来发布不能一键推整个目录：除 fresh-history blocker 外，§4 两份较早的 local-only pending SQL 仍需明确处置；Agent definition publication 也不是迁移自动完成。所有这些步骤均需要后续明确授权，当前保持 OFF。

## 9. Existing Build Failure Analysis

原 `tsconfig.json` 的 `include` 包含 `**/*.ts` / `**/*.tsx`；exclude 只有 node_modules、jiaoyu、supabase/functions，因而将 `docs/evidence/.../baseline/src` 等历史快照纳入 TypeScript Program。

397 条 diagnostics 都来自这些保留当时结构的快照，例如相对 `./actions` 没有随证据目录完整归档。它们没有被 src 当成生产代码导入；修复这些快照或给它们补 dummy dependency 会破坏历史证据价值。

所以修复的是**编译输入边界**，不是修 397 个旧文件。本阶段没有改证据快照正文，没有安装旧依赖，也没有排除真实 src 或 tests 的生产依赖类型。

## 10. Evidence Build Boundary

[tsconfig.json][tsconfig] 唯一配置变化：

```json
"exclude": [
  "node_modules",
  "docs/evidence/**",
  "jiaoyu",
  "supabase/functions"
]
```

不是排除整个 docs；没有设 `ignoreBuildErrors=true`，没有关闭 strict。实际用安装的 TypeScript API 解析 Program：evidence 文件数 **0**，active src 文件数 **1,265**，strict=true。所有原有 evidence 和 Stage0–1F 报告的哈希保持不变（R1 新 evidence 另列）。

临时负向实验：复制正式应用输入到独立目录，在 `src/stage1fr1-type-error.ts` 写入 `export const stage1fr1TypeError: string = 123;`，执行完整 Next production build。compile 后 TypeScript 检查在该文件报 `Type 'number' is not assignable to type 'string'`，exit 1。临时副本已删除，成功 artifact 未改动。见 [negative-build-result.json][negativebuild]。

## 11. Production Build Verification

**PASS。** 独立临时目录、当前安装依赖、原 next.config、修复后的 tsconfig、生产配置但 flag OFF；未改线上 `.next`，未部署。

- 命令：`node node_modules/next/dist/bin/next build --webpack`。
- exit：**0**；duration：**97.23 秒**。
- Build ID：`t9BzyG22OCvGXMFrHP-1a`。
- artifact digest：`fde297cf0bfb26908dc375d7a309071d8bc0bda2bbf3eff199c6d51e8a02b096`。
- digest 定义：排除 `.next/cache`，对 1,376 个产物文件的相对路径+文件 SHA-256 排序后计算 SHA-256；详见 [artifact-digest.json][digest]。

确认三条 dynamic server routes：`/api/teaching-agent/runs`、`/api/teaching-agent/runs/[runId]`、`/api/teaching-agent/runs/[runId]/cancel`。client-reference manifests 含 `StudentAiTeacherIntegration`，客户端 chunks 323 个。当前最终 product src 与成功 build 输入逐文件比较无差异。

没有通过 npm prebuild 的全仓库测试入口间接运行其它应用的 DB 测试；所需安全回归逐组显式执行，Next 子命令与 package build 一致。全项目 `tsc --noEmit --incremental false` exit 0；scoped lint exit 0。

构建通过只关闭本轮 B 类阻断，不意味着可以部署或允许生产学生使用。

## 12. Client Bundle / Secret Scan

对**成功完整 build**重新扫描 323 个客户端 chunks，而非沿用 Stage1F 失败 build 的半成品判断：

- Client bundle boundary：**PASS**。
- Secret pattern scan：**PASS**。
- 实际私密 credential 值在内存中的比对：**PASS**；没有输出任何值或匹配正文。

检查 server Provider implementation、Student Policy、privileged repository/RPC、private prompt procedure、Runtime factory、service-role / API key 名称等标记，并以 Next server-only 编译边界作额外证据。`RunAuthority` 为 type-only，不能仅凭字符串未出现证明安全。

R1 新增 rollout config 仅存在 server 模块，不向客户端传 tenant/course/user lists 或 email。对本轮新增/修改源码、tests、migration/archive、验证脚本、报告及完整 build output 做最终 secret 模式/凭证扫描；归档结果 [secret-scan-result.json][scan] 只保存状态。

完整 build 已通过，因此本轮 G-R1-8 可 PASS；未来部署 artifact/config 改变后仍需重扫，本结果不是永久保证。

## 13. Controlled Rollout Architecture

新增 [TeachingAgentRolloutPolicy][rollout]，只做 eligibility 收窄：

```text
global enabled
AND active authenticated tenant ID in allowed tenants
AND authenticated actor ID in allowed users
AND lesson's server-resolved course ID in allowed courses
AND unchanged StudentTeachingPolicy
```

当前只实现最小 internal/pilot 模式，**三张名单全部必需**，没有 expanded 模式自动绕过 user list。没有新增 Feature Management UI、数据库表、Tool、Skill 或通用聊天。

`createStudentRolloutAdmission` 先判 global/tenant/user，再用 authenticated user-scoped Supabase client 读取 `lessons(id,course_id)`，最后按实际 course ID 判定；错误、缺行、非法 ID 均拒绝。它不构造 Domain authority，不接收 browser courseOverride，不用 display name 作安全 key。

rollout checks 是 admission 范围；原 StudentPolicy、revision、evidence、cancel、deadline 和所有教学授权仍照常执行。名单变化不会自动把已存在 Run 变成另一 tenant，也不是中途权限提升。

## 14. Tenant / Course / User Allowlist

| 配置名 | 用途 | 默认 / 非法输入 |
|---|---|---|
| TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED | global admission | 仅精确 1/true 启用；其它拒绝 |
| TEACHING_AGENT_ALLOWED_TENANTS | 当前 active tenant UUID | 未配置/空集拒绝 |
| TEACHING_AGENT_ALLOWED_COURSES | server-resolved course UUID | 未配置/空集拒绝 |
| TEACHING_AGENT_ALLOWED_USERS | authenticated actor UUID | 未配置/空集拒绝 |

名单仅支持 UUID，以逗号或空白分隔；标准化大小写；单名单最多 256 项。任何非法项使该名单整体拒绝，不支持 `*`、部分解析成功或默认全量。配置函数为 server-only，未写 `.env`，未给生产加入名单，未开启 global flag。

同一 user 在 A/B tenant 都有身份时，也只使用 `getAuthContext` 给出的当前 active tenant。A allowlist 不使 B 进入；user list 不免除 tenant/course/app/enrollment 权限。

测试覆盖 global OFF+名单命中、global ON+空名单、tenant/course 单方拒绝、wrong user、同用户不同 active tenant、全匹配、非法/wildcard、规范化 ID；均无绕过。

## 15. UI / Backend Enforcement

真实页面链：[lesson-slots.tsx][slots] → `createStudentRolloutAdmission(input.supabase, verified owner)` → 允许后才查询候选 scripts / 原 StudentPolicy / Pins → 才创建 `StudentAiTeacherIntegration` slot。拒绝返回 undefined，没有按钮或 Agent client mount。

真实 POST 链：[student-handlers.ts][handlers] → global gate → strict body/Origin → [production Auth][production] → 同一个 rollout resolver → 再查 global gate → 原 Runtime/StudentPolicy。客户端发来的 selection.lessonId 仅作 locator；course、actor、tenant 不是客户端断言。

新 page test 执行**实际 TSX server loader**：只有 client component leaf 用 test placeholder 代替，授权/查询/Policy/React element props 仍为真实实现。验证 empty/OFF 时 0 查询无 slot；wrong course 无 slot；全匹配可产出 pins；`prerequisite_passed` 或 inactive enrollment 即使名单命中仍无 slot。另有 actual Next/Chromium UI 原有测试通过。

共享 resolver 的 UI/POST 决策矩阵与实际 transport 测试一致。严格 body 拒绝 pilot/tenantOverride/courseOverride/userOverride/courseId；`X-Agent-Allow` 不被当作资格。过期页面 pins 不跳过 POST 重验。名单未通过时没有 persistence admission、没有 Provider call。

## 16. Kill Switch Semantics

**应用层新语义：global OFF 禁止新的 POST admission/UI projection；不切断已有 owner 的 recovery。** POST gate 在 auth/DB/Provider 前执行；异步 rollout/auth 返回后再次检查。默认名单为空，即使错误地 global ON 也不会放开普通学生。

测试通过：OFF 下新请求数/Run admission/Provider 新调用为 0；异步 admission 等待期间切 OFF，返回后仍不创建 Run。这里的“新”针对受测新 POST；关停前已开始的运行属于 in-flight，不声称追溯撤销已经开始的 Provider 调用或成本。

**没有实现 hot reload 或跨进程动态 kill。** 生产 launcher 在启动时注入 process.env，修改配置文件不等于所有旧 workers 已 OFF。R1 只强化应用语义；all-workers 生效、旧 worker drain、进程替换和实际代理需后续运维 Gate 验证。本阶段没改 config/PM2/Tailscale。

不新增旧 Learning Agent fallback；新路径失败仍失败，课堂主体继续。

## 17. Existing Run Recovery While OFF

| 操作 | OFF 后行为 |
|---|---|
| 新 POST Run / 新 page projection | DENY / HIDDEN |
| 已有 Run GET status | active student 身份、当前 tenant、owner RPC 范围内 ALLOW |
| 已有 Run cancel | 同上，加 same-origin 与无执行参数 body 检查，ALLOW |
| wrong user / wrong tenant / 不存在的 runId | 安全 not-found，404 |
| unauthenticated | 401 |
| 无效/失效身份或 membership | 仍按现有 Auth/DB actor_guard 拒绝，不绕过权限 |

GET/cancel 不要求用户继续处于 rollout 名单中，否则移除名单后无法安全 drain。它们不 mint authority、不调用 Runtime.run、不创建 Run或启动 Provider；cancel 仅写 Agent Infrastructure 取消事实并触发本实例 abort registry。

验证包括：in-memory full Runtime 中 OFF 后 status=200/cancel=200、取消收敛、cross-user/tenant404；**真实隔离 PostgreSQL + HTTP + 跨 handler registry** 中，运行已 started 后改 OFF，GET 可用、新 POST404、持久 cancel 可用，后续无第二次 model call，23 教学域表指纹一致。不是仅通过静态源代码断言。

未改全局 Authentication/角色规则；被撤销 active membership 的用户不会因“曾是 owner”而获得通用 recovery bypass。

## 18. Security Regression

保持原 cross-user/cross-tenant、revoked enrollment、stale revision、invalid selection、idempotency、replay、Origin、status ownership、evidence/output guards 全部回归。

新增 15 个 rollout tests + 1 个实际 page loader test + 1 个 migration identity test；修改原 DB transport test 验证 OFF recovery，不削弱原有跨 owner 检查。

生产 composition 的 admin client 只用于 Agent Infrastructure；新增 lesson→course lookup 使用 `auth.supabase`。没有 service-role teaching read，Teacher/admin/platform owner 无 Student POST bypass。config list/role 不来自浏览器字段，fail-closed 结果不返回“具体哪个名单未匹配”。

目标真实 Auth/JWT/PostgREST/RLS 仍 BLOCKED；这些隔离回归并不推翻 Stage1F 的实际 target-policy 限制。

## 19. Teaching Domain Side Effects

**Agent 执行 Teaching Domain Writes=0；生产教学/Agent写入=0。** Domain repository/Tools/Skill/Prompt/Provider 没有改动；rollout resolver 只有 user-scoped SELECT；cancel 仍只写 Agent Infrastructure。

隔离 runtime/transport/UI tests 对 23 个教学域表前后指纹比较一致，包括 sessions、messages、attempts、task events、lesson_progress、node_progress 等受测表。OFF recovery 实测也保持这一结论。

必须区分：full migration verifier 在**自己新建空库**内执行历史 DDL/seed，并为了历史前置条件创建一个 synthetic platform owner；这些是隔离 bootstrap 操作，不是宣称“全部 SQL 都只读”。没有真实学生、没有恢复学生行，没有把此 synthetic owner 带到生产。所有自建容器均已清理。

本阶段 Live Provider Requests=0；未启用 live gate。模型正向/失败/取消验证使用合成 adapter 数据，不是外部 DeepSeek 请求。

## 20. Safe Supabase Staging Requirements

**Safe full Supabase staging: NOT AVAILABLE / NONE CONFIRMED。本阶段未创建。** 本机已有 stack 的归属与可销毁性未确认，不能擅自复用。R2 必须独立明确授权后开始，不能沿用 SQL bridge 当最终 evidence。

可执行的下一阶段 bootstrap/verification plan：

1. **前置 gate**：先关闭本轮 G-R1-2 的历史数据 bootstrap 阻断；审阅 §4 两个 local-only pending migrations。未解决前不宣布 R2 READY。
2. 明确全新、可销毁、非生产项目；记录 owner、唯一 project ID、独立端口/域名、数据生命周期。建立 Auth、PostgREST、JWT、数据库/RLS；Storage 对 Agent 本身可选，但完整历史 bootstrap 依赖 Storage/Realtime 平台 schema。不得把 production `.env.local` 拷入测试。
3. 在开始任何写入前，用服务端 preflight 比较 staging endpoint/project ref 与生产 ref **不同**；检查 empty/synthetic-only 标记，输出状态不输出凭证。CI/脚本不允许传 production target。
4. 在完整平台上应用审阅通过的 baseline/history 与新的 `202609140000→001→002` 顺序，逐步核对 ledger/name/checksum、tables/functions/indexes/policies/grants。若采取目标 schema-only clone 路径，需明确标识它不能替代未通过的 fresh-history Gate；不复制 public/auth 业务行。
5. 使用 **staging Auth admin API** 创建 synthetic A1/A2/B1、teacher、tenant admin、platform owner 身份；credential 只放私有测试配置，报告只显示角色/合成标签。创建 Tenant A/B、active profiles/memberships；另造同 user 的另一 active tenant 用于切换测试。
6. 建立 Korean app 的 tenant enablement、有效 A1 enrollment、A2/B1 各自范围及 expired/inactive/no-enrollment 对照。所有用户和数据只存在 staging。
7. 按现有 repository 所需关系创建一个 synthetic Korean course（稳定 UUID）、published category 祖先、**immediate-unlock lesson**、published digital textbook/version/chapter/module、published profile/teaching lesson/script version/node，原句使用 `저는 학생입니다.`。若 chapter 有 chapter_test_id，建立相应独立可证明解锁的 catalog chapter。不要复制真实教材或改生产 unlock。
8. 创建可选本人 active teaching session，及另一学生/另一tenant/invalid/completed/stale version 对照。当前产品 UI 仍 verified_selection only；session 测试验证 read port，不将其称为 verified_current。
9. 通过受限 server 运维流程发布精确 `pinStudentRuntimeDefinition` 的 tenant definition manifest/artifact digest。当前没有自动 definition bootstrap 管理 UI；必须在私有 staging harness 中实现审核步骤，不能将 client JSON 当 manifest authority。
10. 先证明 global OFF、ON+空名单均拒绝；再只在**staging process config** 设置 synthetic tenant/course/user lists，按单一共享策略显示 UI。记录这些操作不影响 production。
11. 使用真实 Auth login/sign-in 获得 Cookie/JWT，再走真实 Supabase JS→PostgREST→RLS→StudentPolicy→Selection Projection→两 Read Ports；A1 正向，A2/B1/teacher/admin/platform owner、expired/inactive/no enrollment、draft/unpublished/stale/other session 全部负向。JWT/完整 headers 不进入日志。
12. 运行真实 UI→Transport→Runtime；先用受控 server Provider fixture 验证基础设施，是否允许 live Provider 应由 R2 授权决定，不能从本轮推导。比较教学域表前后指纹，检查 evidence/output/usage，测试 OFF 后 owner GET/cancel、移除名单、跨 tenant和断连。
13. 记录 query count、cold-ish/warm smoke、pins产生数、分阶段耗时与deadline；后续再解决实际 proxy/完整45秒/真实课程coverage Gate。测试后 OFF，清理自有合成数据/环境，保存脱敏结果。

成功判据必须包括真正 JWT/PostgREST/RLS；目标 current schema 上 published-only legacy policies 的叠加行为仍需实际验证。**R1 不创建这个完整环境、不使用真实学生 JWT、不执行这些 bootstrap 写入。**

## 21. Tests

自动回归汇总留档：[regression-results.json](evidence/teaching-agent-stage-1f-r1/regression-results.json)。

| 执行项 | 结果 |
|---|---|
| Core + Stage1A/1B/1C/1D/1E + rollout tests，含 opt-in isolated DB | 284 PASS / 1 live SKIP |
| 独立 transport DB/HTTP，含 OFF cross-instance cancel | 1 PASS；23 教学表不变 |
| actual Next Node transport | 1 PASS |
| actual Next + Chromium UI | 1 PASS；mobile/keyboard/dark/Korean/cleanup 等保留 |
| classroom sidebar/video/blackboard/presentation | 56 PASS |
| actual page loader rollout | 1 PASS |
| migration identity/archive/inventory checks | 1 PASS |
| **自动回归合计** | **345 PASS / 1 SKIP / 0 FAIL** |
| **完整 fresh history verifier** | **FAIL：286成功，第287份失败，其余未执行** |
| current target schema clone + Agent SQL | PASS，3/3，5 Agent tables |
| 完整 Next production build | PASS，exit0，97.23s |
| 注入真实 src TS 错误的完整 negative build | 预期 FAIL，exit1；负向检查 PASS |
| 全项目 tsc / scoped ESLint / diff check | PASS / PASS / PASS |
| final client/credential/pattern scans | PASS |

失败的 fresh verifier 是发布必需 Gate，不因 Node regression 全绿而消失。没有把初期平台 bootstrap 不完整的失败尝试算通过。负向 build 的失败是预期测试成功，与 fresh 意外失败分别记录。

核心脱敏结果已存 `docs/evidence/teaching-agent-stage-1f-r1/`。完整 build/日志和私有 schema archive 保持 `/tmp` 运维证据，不包含于源码提交；完整 inventory/checksum 可从新报告链接追踪。

## 22. Gate Matrix

| Gate | Status | Evidence | Impact / Required Action |
|---|---|---|---|
| G-R1-1 Migration Version Uniqueness（A1） | PASS | 454唯一version，449 target name匹配；Core单路径 | 旧历史缺失已补回；两项local-only仍需发布审查 |
| G-R1-2 Fresh Migration Apply（A2） | **FAIL** | 第287份旧seed缺published题库 | 完整fresh baseline/业务前置需独立解决；不能跳过 |
| G-R1-3 Target Schema Clone Apply（A3） | PASS | 当前schema-only+新三SQL，3/3 exit0 | 仅DDL/clone范围；真实JWT/RLS留R2 |
| G-R1-4 Production Ledger Untouched（A4） | PASS | 前后449条ledger及Agent表0一致 | 生产migration仍NOT APPLIED |
| G-R1-5 Evidence Build Boundary（B1） | PASS | evidence Program files0，src1265，strict保留 | 历史内容不变 |
| G-R1-6 Full Production Build（B2） | PASS | exit0、BuildID/digest、三routes存在 | 不等于允许deploy |
| G-R1-7 Build Still Detects Real Source Errors（B3） | PASS | 临时src类型错使完整build exit1 | 未用ignoreBuildErrors |
| G-R1-8 Final Client Bundle Boundary（B4） | PASS | 成功build的323 chunks及server-only编译 | 新配置不进client |
| G-R1-9 Final Secret Scan（B5） | PASS | 新代码/报告/产物实际secret内存比对+模式 | 无secret值输出 |
| G-R1-10 Server Rollout Policy | PASS | server-only类与lesson→course resolver | 只收窄，不替代StudentPolicy |
| G-R1-11 Default-Deny Allowlist | PASS | 空/非法/wildcard拒绝测试 | global ON不能全量放行 |
| G-R1-12 UI / POST Rollout Consistency | PASS | 同resolver、实际page loader、POST矩阵 | UI不显示时backend也不能绕过 |
| G-R1-13 Kill Switch New Admission Block | PASS | OFF早期拒绝、异步lookup后复验、零新Run/调用 | 跨worker热生效仍另需运维Gate |
| G-R1-14 Existing Run Status During OFF | PASS | owner GET200、wrong owner404，SQL/HTTP验证 | 不要求仍在名单；不放宽身份 |
| G-R1-15 Existing Run Cancel During OFF | PASS | OFF持久cancel与收敛，Origin仍验证 | 无新模型/工具工作启动 |
| G-R1-16 Cross-Tenant / User Rollout Isolation | PASS | A/B/同user不同active tenant/wrong user矩阵 | 使用server身份与稳定courseID |
| G-R1-17 Teaching Domain Zero Writes | PASS | Agent执行23表指纹不变；resolver SELECT-only | 不把隔离DDL/bootstrap说成全程只读 |
| G-R1-18 Safe Staging Bootstrap Plan | PASS（计划） | §20依赖、资源、顺序、矩阵、清理明确 | 实际环境尚未创建；先解决R1-2 |

**Migration Identity Remediation=A1–A4 合取，当前 FAIL；Build Remediation=B1–B5 全 PASS。** 由于 R1–R17 并非全部 PASS，不能宣布 Stage1F-R2 READY。

## 23. Architecture Deviations

| 变化 / 新发现 | 旧状态 | 本轮处理 / 边界 |
|---|---|---|
| Admission 与 Recovery 分离 | Stage1D global OFF使POST/GET/cancel全部404 | OFF只关新admission/UI；owner GET/cancel保持；Auth/owner/Origin不放宽 |
| 强制三维 rollout | Stage1F仅global env | server tenant+course+user全部命中，默认空集拒绝；当前不加expanded模式 |
| Migration identity | Core与已发布grammar共用202609130001 | Core改为202609140000；旧SQLarchive；恢复真实历史，不改生产ledger |
| Build source边界 | evidence snapshots进入production Program | 精确exclude evidence，strict/真实src错误阻断保留 |
| Fresh-history数据依赖 | 此前仅检查schema clone和最小fixture | 本轮实际发现旧seed依赖迁移外published题库；明确FAIL，不假称可从空库重建 |

没有静默改变 Student unlock、当前视觉状态、Skill/Tool/Provider、Kim权限或长期memory。没有将名单变成权限授予，也没有添加生产 debug/test bypass。

## 24. Remaining Blockers

**R1新增明确阻断：** 完整 fresh history 在 `202608190007` 依赖 active owner与已发布题库/作业源稿。合成 owner 可以在隔离库准备，但题库/历史发布数据不是当前完整 migration chain 的自足输出。需要单独审阅的 bootstrap/历史基线修复，不能用跳过、改旧SQL或造假内容解决。本轮没有改该旧 migration。

**生产仍继承的阻断：** safe full Supabase staging未确认；目标JWT/PostgREST/RLS未实测；实际Tailscale Agent transport仍PARTIAL；当前真实课程 pilot coverage仍 **BLOCKED（0/1 under current policy）**；完整selection+POST≤45秒尚未证明；跨workerkill/drain/rollback和Provider政策/运营责任尚需确认。

另外，发布前必须处理两份 local-only旧migration与精确tenant definition publication方案，不能因本轮新Core文件名正确就一键push。

本轮没有改真实课时 `prerequisite_passed`、没有补假script、没有创建真实学生或正式pilot课程。构建与allowlist修复不等于消除这些外部和内容阻断。

## 25. Stage 1F-R2 Readiness

**NOT READY。** 用户定义要求 R1-1～R1-17 全部 PASS；当前 R1-2 FAIL，因此不能以“其余项目通过”给出 READY。

R2 计划已足够明确，且 app/build/rollout/recovery 基础已可用于下一轮验证，但执行前必须先解决完整历史链的前置数据策略，并取得新建独立 full Supabase staging 的明确授权。当前未创建 staging，不把本轮的 network-none PostgreSQL 或 SQL bridge 改称完整 Supabase。

即使之后 R2 READY，也不代表 Production Ready；Stage1F中真实RLS、代理、课程coverage等 Gate 必须分别关闭，production flag继续OFF。

## 26. Final Recommendation

**Overall: NO-GO。Migration Identity 总整改: FAIL（编号冲突已修，fresh Gate未过）。Build Remediation: PASS。Controlled Rollout / OFF Recovery: PASS。**

Production Ledger UNCHANGED；Production Migration NOT APPLIED；Feature配置OFF；Live Provider Requests 0；Agent Teaching Domain Writes 0。Safe full Supabase Staging NOT AVAILABLE；Stage1F-R2 NOT READY。

最终工作区检查：相对 2,593 文件 SHA-256 基线，12 个既有路径变化均属于本轮白名单（含旧 Core 从 runner 移出）；历史文档/证据与原有业务修改哈希未变。git diff --check PASS。旧 Stage0–1F报告和既有证据未修改；没有覆盖 Growth Toolbox / Script Studio / 课堂原有工作。只实施本轮允许的 migration identity、build boundary、server rollout/admission/recovery、测试和新报告变更。

本轮结束，不部署、不开生产flag、不执行生产migration、不创建完整staging。

[report]: </home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r1-release-blockers.md>
[tsconfig]: </home/yangzhen/projects/my-lms-system/tsconfig.json>
[rollout]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/rollout-policy.ts>
[handlers]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/student-handlers.ts>
[production]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/production.ts>
[slots]: </home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/page-projection/lesson-slots.tsx>
[core]: </home/yangzhen/projects/my-lms-system/supabase/migrations/202609140000_agent_core_foundation.sql>
[archive]: </home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r1/migration-identity/202609130001_agent_core_foundation.sql>
[inventory]: </home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r1/migration-identity/migration-inventory.json>
[reconciliation]: </home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r1/migration-identity/reconciliation.json>
[migrationrunner]: </home/yangzhen/projects/my-lms-system/scripts/verify-teaching-agent-release-migrations.py>
[rollouttest]: </home/yangzhen/projects/my-lms-system/tests/teaching-agent-student-rollout.test.mjs>
[pagetest]: </home/yangzhen/projects/my-lms-system/tests/teaching-agent-page-rollout.test.mjs>
[migrationtest]: </home/yangzhen/projects/my-lms-system/tests/teaching-agent-release-migrations.test.mjs>
[freshresult]: </home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r1/fresh-migration-result.json>
[cloneresult]: </home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r1/target-clone-result.json>
[cloneverify]: </home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r1/clone-verification.json>
[negativebuild]: </home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r1/negative-build-result.json>
[digest]: </home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r1/artifact-digest.json>
[scan]: </home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r1/secret-scan-result.json>
[legacyseed]: </home/yangzhen/projects/my-lms-system/scripts/seed-korean-level-one-tests.cjs>
