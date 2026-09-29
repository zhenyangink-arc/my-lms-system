# Stage 1F-R6A — Production Content Preparation & Authoring Validation

## 1 Executive Summary

**Overall: GO。Production Content Preparation: PASS。Content Preparation Status: READY FOR SCRIPT AUTHORING。**

已通过用户本人正常登录的既有 Chrome/CDP，在正式教材制作 UI 为 **韩语初级 / 预备课：韩文字母入门** 建立唯一 canonical Draft（logical alias `hangul-introduction`）。官方工作流创建 Textbook、Version、Chapter、Module、Teaching Lesson 各1条，关联既有 Profile；四条学习目标原文及顺序4/4一致。

第一次用户创建于05:42:23 UTC触发 `PT409 / PUBLISHED_DEPENDENCY_IMMUTABLE_USE_EDIT_WINDOW`，事务完整回滚，无残留。随后定位一个非目标教材的旧 dependency fence。在用户另行明确批准后，只向 `runtime_publish_private.retired_snapshots` 插入1条退役登记，UPDATE0、DELETE0；原 snapshot/fence、同教材另一有效 snapshot 和 publication pointer 全部保留。只读复核通过后，执行**一次新的授权 UI 创建**，没有盲目重试。

现有 Chrome 已进入刚创建的章节对应 Script Studio，确认 **韩文字母入门 / 第0章 / 课前导航**，停在“新建教学脚本”按钮之前。脚本版本/节点仍0。Feature OFF、allowlists EMPTY、Agent五表0、Provider0、Pins0。**Stage1G NOT READY；未进入R6B。**

## 2 Development-First Canonical Policy

**DEVELOPMENT-FIRST / NEW AUTHORING CONTENT IS CANONICAL**。目标目录课时保留，新增正式 Draft 为该目标的唯一新 Authoring 内容。没有删除整本教材、章节、module、lesson或script，也没有修改旧静态教材实现。

目标本身为 CASE A — NO EXISTING TARGET CONTENT。另一个教材的旧全局 dependency fence 是创建阻断项，不将它伪称目标教材冲突或扩大为整本教材退役。用户批准范围是精确登记一条旧 snapshot 退役；实际操作严格保持该范围。

## 3 Auth Boundary

复用用户提供的现有服务器 Chrome，CDP `http://127.0.0.1:9222`，Playwright Core 位于用户指定路径。没有启动浏览器、创建Profile、重新登录或关闭Chrome。

通过正常同源 own-profile GET 确认当前角色“平台负责人”；在浏览器内对账号标识散列，只用该散列与数据库匹配唯一当前身份，再用身份散列绑定退役登记的 `retired_by`。没有按姓名或“第一个owner”选择账户。没有读取、导出或保存 Cookie/JWT/password/Authorization Header/Session Token，没有magic link、Auth修改或service-role impersonation。

维护连接仅执行用户明确批准的单条退役事务；canonical skeleton 创建全部经**真实用户浏览器会话 → 官方 server action → RPC**。只读校验使用独立 READ ONLY、TLS verify-full 连接。见 [authorization-scope.json](evidence/teaching-agent-stage-1f-r6a/authorization-scope.json)、[ui-create-result.json](evidence/teaching-agent-stage-1f-r6a/ui-create-result.json)。

## 4 Foundation Preflight

| Field | Current result |
|---|---|
| Project / host identity | MATCH；与R5C/R5D锁定hash一致 |
| PostgreSQL / ledger / latest | 17.6 / 457 / 202609140007 |
| Running Build | 6IhDHN8Dm1nCewiCEZnV5 |
| PM2 | online；PID 934715；restart count 0 |
| Feature / allowlists | OFF / EMPTY |
| Agent five tables | each0 |
| Runtime / launcher / Tailscale | UNCHANGED |
| Final observation UTC | 2026-09-16T06:44:38.472046+00:00 |

退役前、退役后创建前、创建后分别只读复核。证据：[retirement-preflight.json](evidence/teaching-agent-stage-1f-r6a/retirement-preflight.json)、[retirement-post-verification.json](evidence/teaching-agent-stage-1f-r6a/retirement-post-verification.json)、[production-end-state.json](evidence/teaching-agent-stage-1f-r6a/production-end-state.json)。没有 migration、deploy 或进程操作。

## 5 Target Slot

- Exact UI label：**韩语初级 / 预备课：韩文字母入门**。
- App/course：`korean / korean-beginner`；logical alias及catalog lesson slug：`hangul-introduction`。
- 选择项唯一匹配，实际选中ID的SHA与既有目标证据一致；未选择其它课时。
- 预备章节名：**韩文字母入门**。新root slug由官方RPC生成；没有用SQL改slug。
- 既有catalog slot已发布、unlock immediate，是现有目录状态；本次未改unlock或目录发布状态。新Draft不随目录自动发布。

见 [target-slot.json](evidence/teaching-agent-stage-1f-r6a/target-slot.json)、[target-before.json](evidence/teaching-agent-stage-1f-r6a/target-before.json)。

## 6 Existing Content Conflict Inventory

创建前目标catalog lesson1，其下 textbook/version/chapter/module/teaching lesson/script version/script node及其它内容后代全部0。按真实父关系和52条实际FK（含复合键）审计，不只按名称查找。

既有目录lesson的20条引用保持：chapter_tests4、course_chapters4、lesson_progress6、其它lesson prerequisite1、live_class_sessions5。只读COUNT，没有读取学生身份或正文，也不因开发阶段将其删除。目标新Authoring分支外部依赖0。

旧阻断snapshot SHA256：`6ea0da2b328782056b721bb5ecb1eec194435871d9746dcedd9bb44e8b9df6bb`。其保存capture缺少 `runtimeAuthoringRevision`，当前capture为1，去除此项后其它semantic capture一致。`runtime_publish_private.check_authoring_statement()` 遍历所有未退役fence，故非目标教材也能阻止目标首次INSERT。

退役前再次确认：publication pointer0、未过期未撤销session0、进行中runtime request0、目标内容依赖0。同教材另一份有效snapshot保持有效且pointer引用1。证据：[first-create-failure.json](evidence/teaching-agent-stage-1f-r6a/first-create-failure.json)、[retirement-preflight.json](evidence/teaching-agent-stage-1f-r6a/retirement-preflight.json)。

## 7 Conflict Decision

目标链 **CASE A / NONE**；全局旧 dependency fence 单独按精确授权解除。旧snapshot原记录和fence原记录保留，只有retirement登记使其退出active保护集合。当前有效教材继续由另一有效snapshot及其pointer保护。

现有 `begin_runtime_textbook_edit_v1` 会处理整本教材快照，范围超出本次批准，所以未调用。没有关闭保护trigger、绕过revision比较、修改 `check_authoring_statement` 或使用CASCADE。见 [conflict-decision.json](evidence/teaching-agent-stage-1f-r6a/conflict-decision.json)。

## 8 Development Cleanup

**精确退役 PASS；目标内容删除 NOT REQUIRED。**

| Item | Result |
|---|---|
| Changed object | runtime_publish_private.retired_snapshots |
| INSERT / UPDATE / DELETE | **1 / 0 / 0** |
| Transaction count | 1 |
| Commit | CONFIRMED；COMMIT输出及唯一提交确认匹配 |
| Commit server time | 2026-09-16T06:41:11.528164+00:00 |
| Original snapshot / fence | UNCHANGED |
| Other valid snapshot / publication pointer | UNCHANGED |
| Active inconsistent fences | 1 → 0 |
| Canonical chains immediately after retirement | 0；无部分骨架 |

事务使用既有authoring advisory lock、5s lock timeout、30s statement timeout；事务内重新校验唯一对象、实际当前操作者、四类依赖为0、有效另一snapshot/pointer、目标仍空、ledger及revision mismatch精确形态。插入后断言rowcount1及retirement总数+1，原记录/另一snapshot/pointer不变，再COMMIT。新READ ONLY连接验证真实结果后才允许UI创建。

没有UNKNOWN、timeout或重试。原一次性attempt guard保留发起时UNKNOWN状态用于防重；最终结果以提交receipt及独立post-verification为准。见 [retirement-commit-receipt.json](evidence/teaching-agent-stage-1f-r6a/retirement-commit-receipt.json)、[retirement-post-verification.json](evidence/teaching-agent-stage-1f-r6a/retirement-post-verification.json)、[retirement-final-verification.json](evidence/teaching-agent-stage-1f-r6a/retirement-final-verification.json)、[cleanup-result.json](evidence/teaching-agent-stage-1f-r6a/cleanup-result.json)。

## 9 Canonical Draft Creation

第一次用户尝试失败并完整回滚；没有重新提交该未知结果。用户批准精确退役及其成功后的新尝试后，在当前登录Chrome填入精确slot、章节名和四条目标，**只点击一次“创建教学内容草稿”**。

本次点击：2026-09-16T06:42:37.800Z；数据库created_at：2026-09-16T06:42:38.037548+00:00。页面显示“教学内容草稿已创建”，返回“进入教学脚本”链接。累计已知logical attempts为2：此前失败1 + 退役后新授权成功1；盲重试0。

真实调用链：`CreateTeachingContentForm` → `createTeachingContentAction` → 当前用户Supabase client → `public.create_teaching_content_skeleton`。保留Platform Owner、auth.uid、非provisioned身份校验、authoring lock、lesson/course锁、updated_at CAS、existing-tree protection及atomic draft-first创建。

数据库安装函数正文与007合同相同。未通过维护SQL手工INSERT五张新内容表。见 [official-workflow-contract.json](evidence/teaching-agent-stage-1f-r6a/official-workflow-contract.json)、[ui-create-result.json](evidence/teaching-agent-stage-1f-r6a/ui-create-result.json)、[creation-result.json](evidence/teaching-agent-stage-1f-r6a/creation-result.json)。

## 10 Canonical Structure

| Object | Count / association |
|---|---|
| Existing catalog lesson | 1，原slot |
| Textbook | 1，关联原lesson及正确app |
| Textbook Version | 1，version_number1 |
| Chapter | 1，chapter_number0 / preparation / 韩文字母入门 |
| Module | 1，orientation / sort_order1 / 课前导航 |
| Teaching Lesson | 1，revision1，关联该module |
| Profile | 复用既有published uply-korean-teacher；Textbook和Teaching Lesson两条FK相同 |
| Script versions / script nodes | 0 / 0 |
| Content nodes / activities / teaching steps | 0 / 0 / 0 |

父链精确连接；canonical chain=1，duplicate=0，无partial skeleton。没有强求007不负责创建的Profile新行或script。资源只记录SHA256，见 [canonical-structure.json](evidence/teaching-agent-stage-1f-r6a/canonical-structure.json)、[duplicate-check.json](evidence/teaching-agent-stage-1f-r6a/duplicate-check.json)。

## 11 Learning Objectives

数据库 `objectives.zh-CN` 恰好4条，原文及顺序均匹配：

1. 认识韩文字母由辅音、元音和音节块组成的基本结构。
2. 能辨认并朗读基础元音和常用基础辅音。
3. 理解初声、中声、终声组成韩语音节的基本方式。
4. 能将基础辅音与元音组合成简单韩语音节。

UI输入为四行原文，不含编号。上面编号仅用于报告展示。验证：**4/4 PASS**，见 [learning-objectives.json](evidence/teaching-agent-stage-1f-r6a/learning-objectives.json)。

## 12 Draft / Publication State

Textbook、Version、Chapter、Teaching Lesson均为 **draft**；Version published_at为空。Module无独立status字段，不制造额外要求。共享Profile的既有published状态未变，不是本次发布。

新内容Published NO，学生发布链尚未成立；未进行学生请求或Agent admission测试。Publish0，Pins生成0，Definition Publication0。见 [draft-status.json](evidence/teaching-agent-stage-1f-r6a/draft-status.json)。

## 13 Existing Unrelated Content Protection

目标之外11类catalog/authoring表的数量及id/parent/status/revision/updated_at聚合hash与before一致；没有读取完整正文。既有snapshot、dependency_fence和pointer完整记录只在DB内聚合散列，前后hash一致。唯一旧对象管理变化是已明确批准的retirement登记。

**未删除整个教材；未删除任何内容行；无关内容UNCHANGED。** 这是已定义对象与安全元数据比对，不夸称逐字比对全库正文。见 [unrelated-content-diff.json](evidence/teaching-agent-stage-1f-r6a/unrelated-content-diff.json)、[retirement-final-verification.json](evidence/teaching-agent-stage-1f-r6a/retirement-final-verification.json)。

## 14 Script Studio Handoff

点击创建成功后的“进入教学脚本”一次。URL chapter参数SHA与新建chapter的SHA一致：`5672961a0fc8222118a1071b0446c45c609ad320bf42983e25f3b1189d7c9f0d`。页面确认 **韩文字母入门 / 第0章 / 课前导航**，且“新建教学脚本”可见。

停在该按钮之前，没有点击新建、Save、Publish、Run或AI生成。首次导航后自动化文本读取遇到两个main元素的选择器歧义，随后仅改用body读取确认；没有重复导航、创建或其它写操作。Chrome保持打开。见 [script-studio-handoff.json](evidence/teaching-agent-stage-1f-r6a/script-studio-handoff.json)。

## 15 Agent / Provider / Pins Boundary

Feature OFF；三allowlists EMPTY；Agent五表各0；Agent Runs0；Provider Requests0；Pins生成0；Definition publication0；Auth writes0；Agent infrastructure writes0。没有reconciler、persistent cancel、StudentPolicy Pilot或First Enable。

**实际授权写入非零**：1条精确snapshot retirement登记 + 官方workflow创建5条目标skeleton记录。不能将本阶段写为Production Writes0。Unauthorized Content Writes0。Provider0指本任务没有调用，不代表审计了整个供应商账户流量。见 [agent-provider-boundary.json](evidence/teaching-agent-stage-1f-r6a/agent-provider-boundary.json)。

## 16 Production End-State

2026-09-16T06:44:38.472046+00:00：ledger457/latest202609140007、批准Build、PM2 online；Feature OFF、allowlists EMPTY、Agent0。Runtime/launcher/Tailscale与批准值一致，Foundation schema的列/default、函数body/config/owner/ACL、约束、policy、relation/RLS/ACL摘要一致。

Production migration0、deploy0、PM2 mutation0、runtime/launcher/Tailscale mutation0、Auth0。迁移源码未修改。原content目录和其它教材不受影响；新增目标Draft，旧无效fence仅登记退役。见 [production-end-state.json](evidence/teaching-agent-stage-1f-r6a/production-end-state.json)。

## 17 Gate Matrix

| Gate | Name | Status | Evidence / scope |
|---|---|---|---|
| G-R6A-1 | Foundation Ready | PASS | Verified by current R6A evidence；[preflight.json](evidence/teaching-agent-stage-1f-r6a/preflight.json) |
| G-R6A-2 | Auth Boundary | PASS | Existing own Platform Owner session verified; CDP reused; no secret extraction；[authorization-scope.json](evidence/teaching-agent-stage-1f-r6a/authorization-scope.json) |
| G-R6A-3 | Target Slot Exact | PASS | Verified by current R6A evidence；[target-slot.json](evidence/teaching-agent-stage-1f-r6a/target-slot.json) |
| G-R6A-4 | Target Snapshot | PASS | Verified by current R6A evidence；[target-before.json](evidence/teaching-agent-stage-1f-r6a/target-before.json) |
| G-R6A-5 | Conflict Inventory Complete | PASS | Verified by current R6A evidence；[conflict-inventory.json](evidence/teaching-agent-stage-1f-r6a/conflict-inventory.json) |
| G-R6A-6 | Canonical Policy Applied | PASS | Verified by current R6A evidence；[conflict-decision.json](evidence/teaching-agent-stage-1f-r6a/conflict-decision.json) |
| G-R6A-7 | Dependency Safety | PASS | Four dependency counts zero inside retirement transaction; valid sibling snapshot and pointer preserved；[retirement-post-verification.json](evidence/teaching-agent-stage-1f-r6a/retirement-post-verification.json) |
| G-R6A-8 | Cleanup Scope Exact | PASS | Exact retirement INSERT1 / UPDATE0 / DELETE0; no content deletion；[cleanup-result.json](evidence/teaching-agent-stage-1f-r6a/cleanup-result.json) |
| G-R6A-9 | Cleanup Commit Known | PASS | CONFIRMED commit acknowledgment plus new read-only verification；[cleanup-result.json](evidence/teaching-agent-stage-1f-r6a/cleanup-result.json) |
| G-R6A-10 | No Unrelated Deletion | PASS | Verified by current R6A evidence；[unrelated-content-diff.json](evidence/teaching-agent-stage-1f-r6a/unrelated-content-diff.json) |
| G-R6A-11 | Duplicate Removed/Avoided | PASS | Exactly one canonical chain; no duplicate；[duplicate-check.json](evidence/teaching-agent-stage-1f-r6a/duplicate-check.json) |
| G-R6A-12 | Official Authoring Workflow | PASS | Actual user-session UI -> server action -> installed official RPC；[official-workflow-contract.json](evidence/teaching-agent-stage-1f-r6a/official-workflow-contract.json) |
| G-R6A-13 | Single Logical Create | PASS | Prior failed transaction retained; one newly authorized creation after retirement; no blind retry；[creation-result.json](evidence/teaching-agent-stage-1f-r6a/creation-result.json) |
| G-R6A-14 | Atomic Skeleton Creation | PASS | Official atomic RPC; complete five-row chain observed；[official-workflow-contract.json](evidence/teaching-agent-stage-1f-r6a/official-workflow-contract.json) |
| G-R6A-15 | Canonical Chain Count One | PASS | Canonical chain count1；[duplicate-check.json](evidence/teaching-agent-stage-1f-r6a/duplicate-check.json) |
| G-R6A-16 | Textbook Association | PASS | Verified by current R6A evidence；[canonical-structure.json](evidence/teaching-agent-stage-1f-r6a/canonical-structure.json) |
| G-R6A-17 | Version Association | PASS | Verified by current R6A evidence；[canonical-structure.json](evidence/teaching-agent-stage-1f-r6a/canonical-structure.json) |
| G-R6A-18 | Chapter Association | PASS | Verified by current R6A evidence；[canonical-structure.json](evidence/teaching-agent-stage-1f-r6a/canonical-structure.json) |
| G-R6A-19 | Module Association | PASS | Verified by current R6A evidence；[canonical-structure.json](evidence/teaching-agent-stage-1f-r6a/canonical-structure.json) |
| G-R6A-20 | Teaching Lesson Association | PASS | Verified by current R6A evidence；[canonical-structure.json](evidence/teaching-agent-stage-1f-r6a/canonical-structure.json) |
| G-R6A-21 | Profile Association | PASS | Both new objects reference same existing published uply-korean-teacher profile; no profile created；[canonical-structure.json](evidence/teaching-agent-stage-1f-r6a/canonical-structure.json) |
| G-R6A-22 | Draft State | PASS | All four status-bearing objects draft; module has no status field；[draft-status.json](evidence/teaching-agent-stage-1f-r6a/draft-status.json) |
| G-R6A-23 | Four Objectives | PASS | 4 objectives persisted；[learning-objectives.json](evidence/teaching-agent-stage-1f-r6a/learning-objectives.json) |
| G-R6A-24 | Objectives Exact | PASS | Exact text and order match；[learning-objectives.json](evidence/teaching-agent-stage-1f-r6a/learning-objectives.json) |
| G-R6A-25 | No Publish | PASS | Verified by current R6A evidence；[agent-provider-boundary.json](evidence/teaching-agent-stage-1f-r6a/agent-provider-boundary.json) |
| G-R6A-26 | Script Studio Handoff | PASS | Exact created chapter hash in Script Studio URL; title/chapter0/orientation visible; stopped before new script；[script-studio-handoff.json](evidence/teaching-agent-stage-1f-r6a/script-studio-handoff.json) |
| G-R6A-27 | Feature OFF | PASS | Verified by current R6A evidence；[production-end-state.json](evidence/teaching-agent-stage-1f-r6a/production-end-state.json) |
| G-R6A-28 | Allowlists EMPTY | PASS | Verified by current R6A evidence；[production-end-state.json](evidence/teaching-agent-stage-1f-r6a/production-end-state.json) |
| G-R6A-29 | Agent Rows Zero | PASS | Verified by current R6A evidence；[agent-provider-boundary.json](evidence/teaching-agent-stage-1f-r6a/agent-provider-boundary.json) |
| G-R6A-30 | Provider Zero | PASS | Verified by current R6A evidence；[agent-provider-boundary.json](evidence/teaching-agent-stage-1f-r6a/agent-provider-boundary.json) |
| G-R6A-31 | Pins Zero | PASS | Verified by current R6A evidence；[agent-provider-boundary.json](evidence/teaching-agent-stage-1f-r6a/agent-provider-boundary.json) |
| G-R6A-32 | Definition Publication Zero | PASS | Verified by current R6A evidence；[agent-provider-boundary.json](evidence/teaching-agent-stage-1f-r6a/agent-provider-boundary.json) |
| G-R6A-33 | Auth Writes Zero | PASS | Verified by current R6A evidence；[agent-provider-boundary.json](evidence/teaching-agent-stage-1f-r6a/agent-provider-boundary.json) |
| G-R6A-34 | Foundation Schema Unchanged | PASS | Verified by current R6A evidence；[production-end-state.json](evidence/teaching-agent-stage-1f-r6a/production-end-state.json) |
| G-R6A-35 | Runtime Unchanged | PASS | Verified by current R6A evidence；[production-end-state.json](evidence/teaching-agent-stage-1f-r6a/production-end-state.json) |
| G-R6A-36 | Tailscale Unchanged | PASS | Verified by current R6A evidence；[production-end-state.json](evidence/teaching-agent-stage-1f-r6a/production-end-state.json) |
| G-R6A-37 | Canonical Receipt | PASS | Completed UI and read-only DB receipt；[creation-result.json](evidence/teaching-agent-stage-1f-r6a/creation-result.json) |
| G-R6A-38 | Evidence Boundary | PASS | Safe metadata only; no session secrets, raw resource UUID or credentials；[workspace-scope.json](evidence/teaching-agent-stage-1f-r6a/workspace-scope.json) |

文件范围、JSON parse、helper语法、敏感信息扫描和git diff --check结果见 [workspace-scope.json](evidence/teaching-agent-stage-1f-r6a/workspace-scope.json)。原R5C/R5D历史报告及产品源码未修改。

## 18 Next Stage

当前内容基础 **READY FOR SCRIPT AUTHORING**。候选下一阶段为 **R6B — TEACHING SCRIPT AUTHORING**，本任务未进入。后续仍需相应任务范围；不提前编写脚本、创建节点、Publish、Pins、Agent Definition或真实AI测试。

**Stage1G NOT READY**，Feature继续OFF，allowlists继续EMPTY。

## 19 Final Recommendation

签署当前R6A **GO / PASS**：唯一canonical Draft及4条目标已建立，dependency fence按精确批准解除，正常用户会话的正式UI创建和Script Studio定位均通过。保留首次失败和完整回滚事实；不将新的成功抹写为第一次尝试成功。

保持现有Chrome停在Script Studio“新建教学脚本”按钮之前，停止本阶段。没有发布、运行Agent、调用Provider或进入R6B/Stage1G。
