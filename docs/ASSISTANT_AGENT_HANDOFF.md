# 教学助手交接：单句韩语 Explain

让一名获准的内部学生在一节已发布韩语课中选择一句，点击“解释这句话”，得到准确、具有真实课程来源的解释，并看到可信的终态；解释不推进学习进度、课堂节点、attempt 或成绩。这是当前第一交付目标。

截至 2026-09-30，能力盘点、上线依赖盘点、Architecture Gate、首用准备包与独立静态审核已完成。准备包 **PASS**；真实运行、生产资格与讲解质量仍为 **NOT VALIDATED**，运行路线仍 **HOLD**。
本文件只保存已接受结论与接续范围，不授予生产读取、First Enable、ON、Provider 数据发送或 Agent Run 权限。

## 1. 接手先读什么

按角色阅读 [AGENTS.md](../AGENTS.md)、[Supervisor 手册](../CODEX_SUPERVISOR.md)、[Worker 手册](../CODEX_WORKER.md)、[Verification 手册](../CODEX_VERIFICATION.md)。
正式任务使用 [Task 模板](../.codex/tasks/TASK_TEMPLATE.md)，活动任务在 `.codex/tasks/active/`，完成任务归档到 `.codex/tasks/completed/`。
Worker 只能改 Task 的 Writable Scope；独立 verifier 默认只验证。调度前必须输出实际 Profile、Model、Effort 的可见记录。
下一任务是整理既有非秘密记录，不是再盘点全部源码、启动助手或查生产。

## 2. 已完成的工作及其含义

| 持久项目任务 | 已接受结论 | 不能推出的结论 |
|---|---|---|
| [能力盘点](../.codex/tasks/completed/ASSISTANT-CAPABILITY-INVENTORY-01.md) | 学生 Explain 的 UI/API/runtime/Tool/持久 Run 实现存在；Explain 是原定首交目标 | 源码存在不证明当前部署可用 |
| [上线依赖盘点](../.codex/tasks/completed/ASSISTANT-LAUNCH-DEPENDENCIES-01.md) | 区分产品首用与维护研究，保留恢复、安全及独立批准条件 | summary 的技术非依赖不免除全局门禁 |
| [盘点独立审核](../.codex/tasks/completed/ASSISTANT-INVENTORY-REVIEW-01.md) | 两份盘点的关键静态结论 PASS，选定首用准备任务 | 历史测试、部署、批准不是今天的资格 |
| [首用准备](../.codex/tasks/completed/EXPLAIN-FIRST-USE-PREPARATION-01.md) | Gate 允许准备、保留运行 HOLD；验收卡、七类矩阵、只读请求与 focused 独立审核 PASS | 未执行或授权真实首用、生产读取 |
| [暂停的 SESSION 诊断](../.codex/tasks/completed/SESSION-LOCK-DIAGNOSTIC-RUN-01.md) | 一次获准诊断及结果审核已记录；详见第 7 节 | 不能自动再跑或据失败码猜修复 |

教师/管理员助手和内容工作流是其他能力；summary 的服务端实现不代表公共 UI 已开放，也不是本次 Explain 首用本身。
历史 `207 PASS`、`430 PASS / 3 SKIP` 只保留原时间与范围的证据地位，不是当前 runtime 验证。
依赖盘点原报告的 Profile 元数据错误由不可变更正补充：实际 worker_high / GPT-6.1 Sol high；首交目标不需要重新询问产品偏好。

## 3. 已冻结的路线与不可省略的门禁

先资格核对**历史已获准部署的 Explain release**，证明可复用后再准备独立 First Enable 批准。
历史 R7D-B Build ID `PjpaYHAz0asyvwh0G-lBo` 是待核候选；历史部署不证明今天 serving 它。
R7D-B2 的 GO 只关闭 Tool Foundation 的只读业务域验收，当时 Agent/Provider 为零、Stage1G NOT READY；不是首用批准。
C3A `KeQ6bud_Us1ED6hnG7YB8` 是 143 路径 sealed candidate；**C3B NO-GO 仍有效**。
若必须选 C3A/C3B 路线，继续原完整前置与逐项有效批准，不能改名、拆几份文件或拼出新的“Explain 专用制品”绕过。

保留 Explain1.0 / `explain_segment` / profile1 / Skill1 / lesson-context mandatory evidence / artifact1、Student Policy、同 snapshot pins、持久 completion CAS/fencing/cancel 与现有预算契约。
Explain 会写 **Run、usage、trace**，并向 Provider 发获准数据；没有“只读 AI 所以无需批准”的例外。
既知 practice-binding ACL 的当前状态及对所选 release 的安全适用性未裁定，不能因它看似不在 Explain 调用链就自行排除。
First Enable 仍需要真实学生资格、合法发布 pins、服务端一课范围、tenant definition、实际 OFF、恢复点、known-good 制品、已验证恢复能力、停止责任，以及分别批准 ON、Provider 与单次运行。

SESSION 当前可从**准备工作**后置；要从未来首用关键路径后置，必须同时证明：

1. 旧已批准 release 与实装 schema 能直接支持 Explain。
2. 没有 C3B migration/deploy 依赖。
3. 适用全局安全门禁已由有权责任方处理。
4. First Enable 有不依赖该 SESSION 链的合规恢复流程。

缺一项仍 UNKNOWN。若必须走 C3B，复用既有失败证据与 exact fresh backup/provenance 门禁；不得承诺修 probe 即能上线。
C3B runner migration 要求 exact plan/target/catalog/package 匹配、VALID backup、restore PASS、snapshotStart 不超过 900 秒及对应恢复/provenance artifacts，apply 前与事务内再核验。
存在不兼容 v2/artifact2 数据时，旧制品回退可能不安全；不能删行回退，保留 version-aware forward fix 规则。

## 4. 首用验收卡：未来获准执行时使用

范围冻结为一个 tenant、course、合格 internal Student、一节合法已发布韩语课、一句；目标、版本、学生与 pins 目前均待核对，不能自行替换。
正常首用前确认七类条件通过及 First Enable、Provider 数据、单次 Agent Run 各自批准；记录学习进度、节点、attempt、成绩基线。

| 验收项 | 必须观察的合格表现 |
|---|---|
| 解释质量 | 简洁准确的中/韩讲解，解释句意与相关语法，符合课文语境；由验收者核对原句及课文 |
| 来源对应 | 本课、本句、同一发布 snapshot/revision/segment pins；真实有效 evidence，不只显示像引用的文字 |
| 可信终态 | 正常成功有持久 completed、completion/evidence 与审计对应；流式文字出现不等于完成；failed/cancelled 明确显示 |
| 进度不变 | 前后基线一致：学习进度、节点、attempt、成绩不因 Explain 改变；Run/usage/trace 属预期基础设施记录 |
| 用量与停止 | 可定位 Run、版本、来源、终态、实际 usage；预算、期限、阈值、负责人先批准；OFF 后还需确认活动 Run 按批准流程收敛 |

解释质量、来源对应和终态分别判定，failed/cancelled 不能写成正常解释成功。
未知用量、越界、证据失效或无法确认终态即 HOLD，停止新的 admission；不能只关 flag 就声称已有 Run 停止。
一次真实首用不得自动重试、扩大用户/课时/工具或用于覆盖所有负例。
取消、断连/超时、拒绝不合格学生或越权范围、过期 pins、缺 mandatory evidence，是**未来另授权的隔离负例**。
负例须保存权限、终态、不推进进度证据；缺 evidence 不得 completed；fake Provider 只证明隔离行为，不冒充真实 AI 成功。
未覆盖项写 NOT VALIDATED。保留 Run/audit/数据库增量，未知 commit 不盲重试；恢复不能用于抹除事实。

## 5. 七类当前事实：全部 NOT VALIDATED

这是固定的一次资格核对输出，不是七轮无界设计。当前已有材料主要为历史或静态证据。
各读项仍需锁定具体方法与另行批准；不能先执行再删减原始输出。

| 类别 / 责任方 | 硬通过条件与未来最小投影 |
|---|---|
| a 版本 / release-security | 实际 serving binary 与有效批准、完整 sealed source/import closure、Explain definition/artifact digest 一致且无未审 drift。只取 opaque target/worker、Build ID、archive/manifest/入口/闭包 hashes、依赖/config 身份 hash、release/security receipt reference 及匹配结论；不读 config 值或 env，不构建部署 |
| b 兼容 / schema-release-security | admission/status/events/usage/completion/cancel 与 artifact1/segment/evidence/CAS/fencing 兼容，Auth/RLS/ACL 满足批准范围，包含已知 practice-binding ACL 精确状态和有权安全结论。只取 ledger prefix digest/版本 presence、相关 RPC signature/body hash/owner/ACL、constraint/RLS fingerprint 与兼容结果；不取 function body、不调 RPC、不全库 dump |
| c 课时 / teaching-course owner | 一名真实合格内部 Student 满足完整 Policy；原句的合法发布链与同 snapshot pins 有效；course 服务端强制只放行一课。只取唯一 target 的 enrollment/发布/Policy 布尔、revision/snapshot/segment pins/hash、lesson 数或等效约束证据；不取学生列表、全课文或跨课枚举，人工“只点一课”不合格 |
| d 范围与 OFF / tenant-config operations | 精确获准 tenant definition version/digest 与单 tenant/course/internal user 匹配、allowlist 范围合格、所有 serving workers 实际加载 OFF。只取 status/version/digest、scope match、名单基数/匹配布尔和逐 worker OFF；静态 code manifest 不等于 DB definition，不输出私有名单或批准正文 |
| e 恢复 / operations-recovery authority | 本次动作与 RPO 适用的恢复点、已验证恢复能力、兼容 known-good artifact、责任与有效 restore 权限齐备。只取 opaque reference、snapshot 时间/目标摘要/manifest hash、restore 证据结果、known-good hash/兼容范围、RPO 结论与权限 reference；不取备份内容、不创建备份/restore、不重放 nonce/旧 authority；选 C3B 保留其严格 fresh backup 条件 |
| f Provider / data-policy-budget owner | 有效批准精确 Provider/model、字段/教材/user 范围、optional state、有界自由 question、tool results/metadata/同 Run 后续回合、期限与责任；费用/Token/Tool/时限上限在实际 release 可强制。责任方提供批准 reference、非秘密范围摘要和 enforceability 证据；不读私有批准正文/密钥、不探测 Provider |
| g 停止 / runtime-operations | 实际 release/target 的 owner-safe status/cancel、断连/超时收敛、OFF 拒新 Run、drain/15 秒强杀收敛与审计有效，负责人/窗口/阈值明确。只取匹配证据 reference/结果、proxy/Origin/stream 结论、限定 target active Run count；不主动 cancel/kill、浏览器操作或停止演练，缺实际证据 HOLD |

源码预算候选为 3 model calls、4 tools、每 call 16000 input / 2000 output、54000 reserved、45 秒 deadline；**不是真实花费批准**，也不是本文件确认的有效配置。
用户要求不购买服务；真实 Provider 成本需要明确、有界批准。身份/目标与批准正文不得进入公开交接材料。

## 6. 唯一立即任务：从既有非秘密记录锁定 target-to-readmethod

**当前具体只读请求 NOT RUNNABLE。** 未锁定的是请求就绪所需的最小目标—方法绑定；这不是“上线只差一个绑定”，七类上线事实仍全部未验证。
Supervisor 与授权部署/数据库操作员据现成记录整理绑定，再提交**一次单独批准的有界只读资格核对**。不要求用户自制绑定，不为填空先查生产。
此阶段只准备请求，不启动 Agent、Provider、服务、浏览器、DB/SQL/Docker，不运行测试/build/import/network，也不新造运维工具。

输入限定为上列完成任务、已接受 Gate/准备包摘要及其直接引用的非秘密项目记录；如临时报告消失，本文件保留必要结论和原哈希，不能猜补事实。
只读取为定位候选与入口必需的有限既有文本；不重复 capability inventory、源码审计或维护历史研究。
有限动作按依赖顺序：

1. 整理已有部署/worker 定位与目标范围记录，标明来源、日期、摘要 hash；历史定位明确写“未确认当前 serving”。
2. 对 a–g 每个读项绑定已有合格入口与直接满足第 5 节最小投影的读取能力；逐项说明必要性和边界。
3. 锁定过滤、最多结果数、时间窗、操作者与授权 reference，生成可审阅的单次只读请求；未知值保留未知。
4. 仅做静态一致性、链接/哈希与范围检查，写 Worker Report；由独立 verifier 核对后交 Supervisor 审核。

输出必须包含下列字段，不能只写“检查数据库/部署”：

| 字段 | 内容要求 |
|---|---|
| target / worker | opaque identity 与部署/环境定位；范围限制到冻结目标；来源 reference/date/hash，历史或当前状态明确 |
| category / object / necessity | a–g 类别、具体只读对象、为何必要；不能扩大数据域 |
| read_method / entry / parameters | 精确已有入口、文件/方法 reference 与 hash、必要参数；不得编造 endpoint 或工具能力 |
| projection / filters / max_results | 直接投影必要 hash/reference/布尔/计数，tenant/course/lesson/student 等必要过滤，明确数值上限；不先全量导出再过滤 |
| operator / window / authorization_refs | 有权操作者、具体窗口/超时边界、各生产或受限元数据读范围的有效授权 reference；缺失保持 HOLD，不伪造批准 |
| evidence / output / disposition | 最小私有证据保存位置与模式、公开脱敏摘要、每类 PASS/HOLD/NOT VALIDATED、阻断原因和责任方；绑定完成不等于观察完成 |
| stop_conditions | 来源漂移、目标不明确、投影/过滤/上限不能由既有入口满足、缺权限、只能全量导出、意外敏感数据、超界或 active Run 等停止条件 |

已有入口限制已确认，下面链接仅供静态定位，**未执行**：

- [operator-monitor.sql](../scripts/teaching-agent-r3/operator-monitor.sql)：参数 tenant_id/since，READ ONLY 与 5 秒 timeout；tenant 时间窗聚合的 active 不证明全部目标 active=0。
- [operator-active-runs.sql](../scripts/teaching-agent-r3/operator-active-runs.sql)：输出 Run IDs，没有 course/lesson filter、count-only 或最大行数；不能原样用于本请求。
- [operator-run-lookup.sql](../scripts/teaching-agent-r3/operator-run-lookup.sql)：tenant_id/run_id，用于未来单 Run 审计，本次不需要。
- [C3B runner](../scripts/teaching-agent-r7d-c3b/runner.py)：`capture --plan acl-000-v1` 是维护路径，会写 authority/receipt 并读取 protected catalog；preflight/verify 也要求各自 authority，不能借来资格核对。

R3 历史定位为 HTTPS → 127.0.0.1:3000 → PM2 `uply-first-enable` 及 release cwd；只是历史提示，不是当前服务确认或访问授权。
缺合格入口或具体记录时，该项 HOLD，提交精确缺口给 Supervisor，不扩张 Scope，不读取秘密、私有批准正文或生产来填空。
验收条件是：绑定与单次请求具体、来源可追溯、范围/上限/操作者/窗口/授权状态清楚，未知值如实保留，七类边界无放宽；不是执行成功。
未来获准读取只保存必要 opaque references、hashes、布尔/计数/结果与缺证据原因：另获准私有目录 0700、文件 0600，避免原始响应。
不保存 tokens、headers、连接串、学生身份、完整课文或私有批准内容；观察到 active Run 只 HOLD，不擅自取消它。

## 7. 暂停 SESSION 诊断：只沿用完成 Task 的事实

此段来自 [完成诊断 Task](../.codex/tasks/completed/SESSION-LOCK-DIAGNOSTIC-RUN-01.md)，没有重新查询容器或诊断。
获准单次命令已执行，attempt 已消耗；一次 test/error、runner returnCode 1，原 shell completion rc NOT_OBSERVABLE。
诊断证据 audit PASS；原 test ERROR；Supervisor 最终因严格输出最小化偏差为 **REVISE**，更深根因 **UNDETERMINED**。
安全定位为 `acquire1819 → image_preflight1362 → require58`，exporter-package probe rc 非零。
具体数值 package rc、stderr 与失败子命令缺失；此前 image identity 检查返回，不能断言 image 不存在。
历史 local30 `_Run` 构造失败是不同事件，仍 UNDETERMINED，不合并根因。
原 cleanup 返回且无新增 recorded framework error；物理残留 NOT_OBSERVABLE，不能声称清理为零。
Worker 曾暴露原始 traceback/tool 输出超出安全字段；不能事后改写成严格 PASS，保留偏差；未来只读明确安全投影。
有限 61 inputs / 60 unique 匹配、runtime inputSnapshot UNCHANGED，只证明有限绑定，不是全仓库不变。

原完成 Task 的潜在后续是另行准备 isolated package-probe：单 512 MiB container、network none、无 mounts，保存数值 rc、封闭失败检查标识与私有 stderr；不重跑 source/pooler/SESSION001。
这不是当前立即任务，也未获准执行；只有首用依赖证明需要该分支时，才复用旧证据另锁 Scope/批准。isolated PASS 也不能证明旧瞬态根因。
不自动 rerun/pull/build/生产、不猜修复、不扫描或删除用户保留的无归属旧容器。
保留的旧无关容器 `0e3b36cc35285c64e3b0b29e76a44e5abf76b7778513262565b5a0b4f837dc89` 不查询/删除；只允许原 Task 声明的 test-owned cleanup。
旧 D 系列里程碑是历史记录，不是当前执行权限；formal qualification 仍 NOT VALIDATED。

## 8. 后续顺序：按实际发现进入

1. 静态绑定完成并审核后，提交具体单次只读范围批准；入口或授权缺失继续 HOLD。
2. 获准后只观察七类，报告证据与准确阻断；未知不写 PASS，不自行修复或开启运行。
3. 如证据证明要变更 release/schema/security/recovery，按实际影响建立最小 Task、Scope、Gate 与动作批准；仅必要时返回 SESSION 分支。
4. 七类硬条件通过后，另准备 First Enable、Provider 数据/费用与单次 Agent Run 批准；获准才按验收卡执行并停止收敛。

不承诺剩余轮数、完成日期或首用成功。准备请求与批准是不同阶段，任何旧批准/nonce 都不自动转移到新动作。

## 9. 工作树与操作边界

本次只读快照：branch `main`，HEAD `8cf97261037ffbce53e55e083ea9026be4e993f1`；不是 sealed package 的权威标识。
工作树已有大量无关 tracked/untracked 修改，包括 `.codex` 规则/agent 配置/任务、AGENTS/CODEX 手册、SESSION evidence 与测试、图片及文档；这些不是本交接的新工作。
保留全部已有改动；禁止 broad git add/reset/revert/commit/push，不把旧工作提交为本任务成果。
交接任务只新建本文件与私有 WorkerReport；没有改源码、测试、Schema、Auth/RLS、公共 Contract、agent-core 或历史权威。
不得读取 `.env*`、凭据或私有 approval，尤其敏感的 `approval-b2-provisioning.before-initial-ban-workflow.json`。

## 10. 原证据索引：哈希用于追溯，临时路径不保证持久

下列 `/tmp` 文件均为**机器本地、不可移植、可消失**的旧证据；必要结论已写入本文。报告哈希按完成 Task/准备包保留，不把路径存在当资格证明。
持久 Task 链接见第 2 节；临时证据缺失时报告缺失，不重造原报告或伪称验证。

| 原报告或产物（/tmp 路径） | 原 SHA256 |
|---|---|
| `/tmp/assistant-capability-inventory-qxh1uhq8/WorkerReport.md` | `484f460023fdcb65ce350afef014b8733d9f9fa0dbc0e07479b0d4ab8c464815` |
| `/tmp/assistant-launch-dependencies-z1_y47wk/WorkerReport.md` | `1c3ef83823a51d09bc34cad9142b5243987bc342d91ab9b6e08909dcbc4f1dbf` |
| `/tmp/assistant-launch-dependencies-z1_y47wk/ReportCorrection.md` | `bf2352148f8daaba44f9a0af7deced45c4bde447f1c18985ec17bcea4719c917` |
| `/tmp/assistant-inventory-review-2EPqQ6dY/VerificationReport.md` | `ff3b5da93d1ac75ae579bcb3a7a75fc2ff8667a9050d99b1519b2e8c87c7a8ea` |
| `/tmp/explain-first-use-gate-B1QE9dvY/GateReport.md` | `6790252d9fe2131a1e930e064ae996737d4bf93f4efe6ab3d685fdf9691ef25f` |
| `/tmp/explain-first-use-gate-B1QE9dvY/SourceHashes.txt` | `e55fd2ad34973b17c371581ea0954561afb86c9f1e6943fe703a11bc56fd9911` |
| `/tmp/explain-first-use-preparation-mf7u65_t/WorkerReport.md` | `ee5c024110814a9a64ce4c434b7591423cbaee54bfac3cdc7f062c3314cd3e3e` |
| `/tmp/explain-first-use-preparation-mf7u65_t/FirstUseAcceptanceCard.md` | `e9ed60393b3273d50d72c1b36f7acf8094f0dbe8c83a88cd3d29902cdd51b7ca` |
| `/tmp/explain-first-use-preparation-mf7u65_t/LaunchGapMatrix.json` | `43d746e13fbdc2aadf7d14de984e37b1a7b9309d6496f2cf5280916756acbdcd` |
| `/tmp/explain-first-use-preparation-mf7u65_t/ReadOnlyQualificationRequest.md` | `c7c6eedfa72af1803c7b0d0ebfec6d7a0da40b72a94ee4c78688a768b8f6ffd3` |
| `/tmp/explain-first-use-verify-rqmw8p6x/VerificationReport.md` | `9ef01c7babf127515ce81fa9b5e6f06e3eaa46aa4eb4f9c3f39a70eeb85a9352` |
| `/tmp/session-lock-diagnostic-run-3q2tg_hf/WorkerReport.md` | `3e04b28f5dd06ad82eb444b4de87ee5a7801c4998866d41cf2b81790a9d7e6ae` |
| `/tmp/session-lock-diagnostic-run-3q2tg_hf/ResultReceipt.json` | `d67a26362fdc1e007916c6efd58c1793c7166613767bb0ceb5cfee4781191828` |
| `/tmp/session-lock-diagnostic-result-verify-wqslcbbp/VerificationReport.md` | `e3709ae586e97a634538cf61302a9e65cce62deac17efb9f88e47d9a936d2739` |

SESSION 报告哈希由完成 Task 引用，本文未读取其原始诊断输出；不扩大成新诊断。
SourceHashes 是原绑定清单，本文不重新审计它指向的全部源码，也不把历史 active Task 路径当目前所在路径。

## 11. 可复制给 Claude / Codex 的接续提示

```text
请先读 AGENTS.md、CODEX_SUPERVISOR.md 和 docs/ASSISTANT_AGENT_HANDOFF.md。
按当前角色读 CODEX_WORKER.md / CODEX_VERIFICATION.md；保护已有 dirty 工作树。
恢复唯一立即任务：依据现成非秘密记录整理 target-to-readmethod 绑定和具体单次只读请求。
先建立有限 Task/Scope，按实际复杂度选择 Profile/Effort，调度前输出可见记录，Worker 后独立验证并写报告。
不要重复已完成盘点、Gate 或 SESSION 诊断，不读 env/秘密/私有批准，不查生产填未知值。
当前请求 NOT RUNNABLE；七类上线事实均 NOT VALIDATED；不启动 Agent/Provider/服务或任何运行。
绑定只完善请求，不创造读取、First Enable、ON、Provider 数据/费用或单次 Run 的批准。
缺目标/入口/投影/过滤/上限/窗口/权限 reference 时 HOLD，报告精确缺口给 Supervisor。
后续实际读取必须另行批准具体有界操作；按手册维护 Worker/Verifier 报告和证据，保留历史权限边界。
```
