# UPLY Teaching Agent / AI 韩语教师助手：项目状态与交接总结

整理日期：2026-09-21  
当前主线：Stage 1F → R7D-C3B → Attempt-2 E3 恢复方案研究  
最近停止点：D2 preflight，`BLOCKED_D2_D1_LINEAGE_DRIFT`

> 本文件是项目状态总结和会话交接材料，不是新的实施、生产执行或 authority successor 批准。内容来自已有阶段报告、保存的 evidence 和当前会话；本次整理没有连接生产数据库、检查线上进程或运行实验。历史观察不应被误读成新的线上核验。

## 1. 当前总体结论

项目已经完成大量核心开发与验证，具备能在开发、隔离环境跑通的 Agent、教学工具和课堂事实链路。目前停在**本轮生产发布前的备份恢复保障**这一关。

尚未完成本轮 R7D-C3B 发布，也尚未正式开放这条新主线的学生 Agent 试点。

当前状态：

| 项目 | 状态 |
| --- | --- |
| Agent Core、学生 Explain 基础链路 | 已有实现与阶段验证 |
| 学生解释 UI、流式 API、取消与恢复 | 已有开发验证成果 |
| 教学脚本及课堂执行事实基础 | 已有冻结内容、执行与持久化验收成果 |
| Lesson Tool Foundation | COMPLETE，限已记录验收范围 |
| 新 Skill / 生产接线代码 | 已有实现与隔离验证；本轮生产发布未完成 |
| Backup Authorization Lifecycle / Authority Resolution | 已完成实现及 fresh 266/266 验证 |
| 当前发布所需 fresh backup | 尚未取得完整恢复验证成功的有效备份 |
| E3 恢复算法 | 尚未选定可实施方案 |
| D2 local-owned 实验 | 未执行，preflight 即停止 |
| C3B Release | BLOCKED |
| R7D-C3C | NOT READY |
| 正式 First Agent Run | NOT AUTHORIZED |
| Stage1G | NOT READY |

此前混发历史指令没有造成最近这次 D2 重复执行生产操作。D2 在 Docker 前停止：没有创建 harness、没有创建 container、没有修改代码、没有读取生产凭据，也没有发布 D2 result。

**不能用一个可靠的百分比概括完成度。** 核心功能开发已经取得大量成果，但生产恢复、迁移、部署、验收和首次启用仍是必须逐项完成的门槛。

## 2. 产品主线与职责

主线顺序：

```text
Teaching Script
  → Lesson Runtime
  → Durable Runtime Facts
  → Lesson Tool
  → Skill / Tool Binding
  → Teaching Agent
  → Provider E2E
  → First Enable / 受控试点
```

| 层 | 职责 |
| --- | --- |
| Teaching Script | 教学内容、讲解顺序与活动来源 |
| Lesson Runtime | 确定性课堂执行、视频 Cue、互动与完成条件 |
| Durable Facts | 数据库中的真实作答、进度、完成与来源记录 |
| Tool | 在权限范围内读取领域事实，提供可信 evidence |
| Skill | 规定任务、工具范围、执行过程和输出合同 |
| Agent | 调用模型与 Tool，形成有来源的解释或摘要 |
| Persona / 金老师 | 展示身份、语气与表达风格；不授予额外权限 |

模型不拥有正式成绩、学习进度、脚本发布或课堂状态的最终决定权。

首个学生能力是“解释选中的韩语句子”；后续接入“根据真实课堂记录总结当前学习执行情况”。完整教师学情 Copilot 属于更后面的产品路线。

## 3. 已完成的主要阶段

这里的“完成”均指对应阶段的限定范围，不表示所有功能已经上线。

| 阶段 | 已有成果 | 边界 |
| --- | --- | --- |
| Stage 0A | 宿主流式能力及模型 Tool Calling 可行性验证 | 不等于学生产品已经存在 |
| Stage 0B | Core 合同、状态机、预算、取消、权限端口、版本 Registry、Tool Executor、Provider Adapter、持久化基础 | Foundation 范围通过，不能直接开放学生路径 |
| Stage 1A | 登录身份、租户/课程权限、已发布片段绑定、只读 Domain Ports | 授权范围明确，不能任意跨课读取 |
| Stage 1B | Student Profile、两个只读 Teaching Tools、Explain Skill 与 evidence/output gate | 当阶段未接入正式生产调用 |
| Stage 1C | 真实模型 → Tool → 模型 → 持久终态的隔离闭环 | 两个 live Student Agent Run、四次 Provider 请求发生在隔离验证中 |
| Stage 1D | POST Run、GET 状态、持久取消、NDJSON、断线恢复等传输能力 | Production Enable 仍受独立 gate 控制 |
| Stage 1E | 选中韩语片段 → 解释 → 金老师面板 → 来源 → 取消/恢复的学生 UI | 开发验证通过，不等于生产功能已启用 |
| Stage 1F R2 / R2A | 完整 Supabase staging，发现并修复跨租户/私有内容读取问题，完成 RLS 与相关回归 | 保留 R2 历史失败；R2A 是后续闭合结果 |
| R3 / R4 系列 | Run reconciliation、authoring、发布元数据、网络验证、备份恢复、运维 receipt 与接受流程逐项推进 | 各报告只授权自身范围；未自动授予最终试点权限 |
| R5D | 对此前 Foundation 安装和部署进行独立验收，达到内容准备条件 | 不重写 R5C 的历史窗口未完成状态 |
| R6A–R6F | 真实教学内容建立、8 节点脚本编写、审稿、修订、最终内容冻结 | 冻结 Draft 不等于 Publish；不证明音频、实际听说效果或学生掌握 |
| R7A / R7B | 课堂执行设计和视频 Cue → 单选活动 → 完成后继续播放的 MVP | 早期 R7B 有 fixture 限制，由后续工作继续闭合 |
| R7C-B1/B2/B3 | canonical Activity、开发验收身份与 durable 作答/进度 E2E | 属于受控开发验收，不是正式学生启用 |
| R7D Tool Foundation | Lesson Tool 实现、部署和受控当前 DB 事实验收 | 只读事实能力完成，不等于 Agent 已正式调用 |
| R7D-C | 学习执行摘要 Skill、生产来源合同、发布兼容、持久完成 gate 等实现及隔离验证 | 当前生产发布和真实学生验收未完成 |
| R7D-C3A | production-compatible candidate 和部署闭包准备 | candidate 存在不等于已经部署 |

重要计数语义：最近轮次的 `Agent 0 / Provider 0` 只表示那些轮次没有调用。项目早期已经有真实模型调用的隔离验证，不能写成“整个项目从未运行过模型”。

参考：[Stage 1C](teaching-agent-stage-1c-runtime.md)、[R2A](teaching-agent-stage-1f-r2a-rls-regression-closure.md)、[R5D](teaching-agent-stage-1f-r5d-post-window-foundation-acceptance.md)、[R6F](teaching-agent-stage-1f-r6f-final-teaching-script-review-content-freeze.md)、[R7C-B](teaching-agent-stage-1f-r7c-b-canonical-activity-binding.md)、[R7D Tool Foundation](teaching-agent-stage-1f-r7d-a-lesson-tool-durable-facts-audit.md)。

## 4. 当前内容与产品能力边界

已冻结的教学内容是“韩文字母入门 / 第0章 / 课前导航”，version1 Draft，共 8 个教学节点：

1. 今天认识韩文字母。
2. 韩文字母怎么组成？
3. 先认识基础元音。
4. 再认识基础辅音。
5. 把辅音和元音放在一起。
6. 一个音节里面有什么？
7. 一起试一试。
8. 今天学了什么？

内容冻结、canonical Activity、Runtime 和事实读取分别有对应成果，但还不能据此宣称：

- 该冻结 Draft 已获准成为正式学生发布目标。
- 所有音频、视频与完整课堂体验已经验收。
- 学生真实学习效果、听说表现或 mastery 已经得到教学实测。
- 开发 actor 或 Owner 可以代替正式生产学生。
- 新学习执行摘要已经通过公开入口正式开放。

现有 R7D-C 报告中，公开 summarize transport 仍存在 deferred 边界，需要在后续实际激活前核实和闭合。

## 5. 为什么当前转入备份、权限和迁移工作

R7D-C 产品代码准备发布时，真实数据库 ACL 基线与原预期不一致，因此不能直接安装新 migration 和切换应用。

后续形成的发布依赖顺序为：

```text
fresh preflight / backup
  → 000 ACL 前向修复 → verify
  → 001 → verify
  → 002 → verify
  → sealed candidate deploy
  → safe health
  → 后续单独批准的生产只读验收
```

这里的 `000/001/002` 是当前这组前向迁移的简称，不是重新构建整个数据库。当前 `acl-000-v1` plan 文件已经是 `READY_FOR_INSTALL`，但这个状态本身不代表 migration 已安装，也不替代 fresh backup、preinstall 和执行授权。

为支持受控执行，已经补齐：

- 精确单迁移 runner。
- 生产只读基线采集与计划封存。
- TLS 客户端证据及 transport 风险边界。
- 备份失败诊断和 phase 记录。
- 一次性 backup authorization 生命周期。
- consume-before-credential、claims、防重放、归档和禁止自动重试。
- implementation completion、validation 和 package lock 的 raw-SHA 绑定。

当前 operational package 有 10 个成员。Backup Lifecycle / Authority Resolution 已完成 fresh 266/266 验证：12 authority tests、96 targeted、158 remaining，没有复用历史 PASS。

**授权机制正确，不等于实际恢复算法已经能处理当前 source role 语义。** 现在主要卡在后一项。

参考：[R7D-C 发布与执行背景](teaching-agent-stage-1f-r7d-c-skill-tool-binding-audit.md)。

## 6. 最近各轮的实际结果

| 阶段 | 结果 |
| --- | --- |
| Historical V5 compatibility revalidation | 属于已发生的历史验证/修复链；不应因为消息顺序混乱再次执行 |
| Implementation Evidence Authority Resolution | 新固定成功 authority 路径已实现，fresh 266/266 PASS，completion 和 forward lock 已发布 |
| Post-resolution Production Attempt 1 | wrapper 用错 private-directory helper，repo evidence 父目录 0775 与 helper 要求 0700 不匹配；未进入 mint、credential 或 backup |
| Production Recovery Attempt 2 | fresh approval、formal mint、consume、credential gate 和真实 production read-only backup 路径进入；5 次 production client invocation 对应 5 份 fresh TLS proof |
| Attempt 2 failure | local-owned 恢复 E3 / OWNED_ROLES_SQL 失败；return code 3，safe classifier PERMISSION_DENIED |
| Attempt 2 finalization | BACKUP_FAILED；fresh authorization consumed 后 terminal archive；canonical absent；owned cleanup PASS；没有自动重试 |
| Forensics | roles.sql、database.dump、schema.dump 在失败前尚未持久化；不能从 hash 还原 SQL，也不能确定 exact failing statement |
| 16-case synthetic reproduction | 16/16 PASS，其中 9 项为预期负向；15 clusters，全部清理；无生产访问 |
| D1 static refinement | C2 零 tracked footprint 未闭合，selected algorithm = NONE |
| D2 preflight | D1 blocking reasons exact 集合不匹配，`BLOCKED_D2_D1_LINEAGE_DRIFT`；实验没有开始 |

### 6.1 Attempt 2 的安全与证据状态

- consume-before-credential：PASS。
- credential identity runtime check：PASS。
- production backup attempts：1。
- production client invocations：5。
- fresh TLS proofs：5；reuse：0；client verify-full：PASS_ALL。
- production DB writes：0；COMMIT：0。
- OwnedCluster restore validation attempts：1；cleanup：PASS；该 attempt 剩余 owned containers：0。
- production restore attempts：0，local-owned restore 不属于 production restore。
- lifecycle outcome：BACKUP_FAILED。
- authorization：已消耗、终态归档，不允许重用。
- backup manifest：未创建为 VALID。

这次失败没有形成满足当前发布条件的有效 fresh backup。此前 R4D 有成功备份恢复技术验证，但旧恢复点不能代替本轮要求的 fresh backup。

证据对 DB 内部连接/查询数没有完整独立枚举，因此不能把 5 次客户端调用写成“恰好 5 个数据库连接”或编造总读取条数。

### 6.2 已证明和未证明的根因

实际 Attempt 2 只能确定失败边界为 E3 roles SQL。safe classifier 的 PERMISSION_DENIED 不等于完整错误文本，更不自动证明某条 SQL 的权限根因。

synthetic reproduction 证明：PG17 bootstrap postgres 的 NOSUPERUSER 修改会被拒绝，return code 3、SQLSTATE 0A000，rolsuper 仍为 true，后续 sentinel 不执行。

因此：

- H6：有强 synthetic reproduction 支持。
- H1“bootstrap 成功降权，然后下一条失败”：不受该实验证据支持。
- Option B“把降权推迟到最后”：不能作为独立完整修复。
- Attempt-2 Exact Root Cause Confirmed：false。
- Historical Root Cause：UNRESOLVED。

## 7. D1 的四个真实 blocker 与 D2 的任务

不可变 D1 evidence 中实际有四项：

```text
C2_BUILTIN_MEMBERSHIP_GRANTOR_FOOTPRINT
C2_BUILTIN_EXTENSION_OWNER_FOOTPRINT
C2_SHARED_SOURCE_FIXTURE_IDENTITY_COUPLING
C2_COMPLETE_FIDELITY_NOT_ESTABLISHED_BY_16_CASES
```

| Blocker | 意义 | D2 希望验证的方向 |
| --- | --- | --- |
| builtin membership grantor | dedicated bootstrap admin 可能留在内置 membership 的 grantor 中；原样 dump/replay 不必然消除 | 用官方 GRANT/REVOKE/GRANTED BY 实际恢复六字段完全一致的 membership |
| builtin extension owner | plpgsql owner 可能变成 destination admin，它属于 tracked catalog | 在 E4 前，以 RESTRICT 的 drop/create 和正确 creator 身份恢复，不能改系统表或使用 CASCADE 掩盖损失 |
| shared fixture identity coupling | 全局改 OwnedCluster/OwnedTransport 会影响 source、capture、TLS fixtures | 独立 destination-only cluster/transport，保留现有 source postgres 语义 |
| complete fidelity not established | 前面三项局部通过也不等于完整备份恢复通过 | combined 实验验证 roles、memberships、owner、ACL、catalog、counts、data、plpgsql-dependent restore 和 cleanup |

D1 的 footprint 判断属于静态审计结论。D2 尚未运行，不能把预期 footprint 差异标为已在 D2 实测。

候选算法名称：

```text
C2R_DESTINATION_ONLY_ADMIN_WITH_EXACT_BUILTIN_RECONCILIATION
```

只有 builtin reconciliation、destination-only identity 和 combined full fidelity 全部通过，才允许选择 C2R。比较时最多移除一个 exact infrastructure admin role 行；membership、grantor、owner、ACL、extension 等必须在真实 destination 状态中恢复正确，不能过滤差异。

数据库 owner 的现有边界为 `LOCAL_RESTORE_INFRASTRUCTURE_ONLY`，不声明与生产数据库 owner 相等。这个边界不豁免 extension owner。

### 7.1 最新 D2 为什么没有开始

用户 D2 指令要求 D1 blocking reasons **exact 三项**，但绑定 SHA 对应文件实际含 **四项**。

fresh 检查结果：

- D1 raw SHA：匹配。
- overall / status / selected algorithm / Option C2：匹配。
- blocking reasons exact 集合：不匹配。
- 按明确 STOP 条件停止。

这是输入预期与实际 D1 内容不一致，不是 D1 文件被改坏，也不是新的 PostgreSQL 实验失败。

当时执行计数全部为 0：D2 experiments、cluster creation、Docker、production access、mint、backup、source/test/README changes。D2 result 文件没有创建。

### 7.2 下一轮应如何接续

下一轮 D2 指令应把 exact blocking reasons 补全为实际四项，再按有效批准和 fresh gates 执行原定 local-owned 实验。

必须保留 D1 原始 bytes。第四项对应 combined full fidelity 证明要求，不能为了让 gate 通过而删除该项或改写历史。

不要退回重新执行 Historical V5、已完成 authority-resolution implementation 或旧 Attempt 2。

## 8. 后面大约还有多少步

从当前停止点走到首轮受控学生试点，按依赖关系拆分，大致还有 **10～12 个里程碑**。下面使用 12 项便于交接；这不是已经批准的执行清单，也不是保证只需 12 轮对话。

| 顺序 | 里程碑 | 完成标志 |
| --- | --- | --- |
| 1 | 修正 D2 输入，完成 local-owned 实验 | membership、plpgsql、独立目的端身份和 combined fidelity 有实际结果 |
| 2 | 关闭恢复算法与 exact implementation scope | C2R 或其他方案被选定；allowed/forbidden regions、测试与失败语义闭合 |
| 3 | Forward authority successor design | 明确新源码如何获得新的合法 validation/completion/package authority，保留旧 artifact |
| 4 | 独立批准实施，fresh 测试 | 恢复逻辑及必要 authority 修改完成；20 项恢复测试合同及 fresh 266/明确超集验证闭合 |
| 5 | 新 authority publication / package relock | 实际新 package digest、validation、completion、lock 精确绑定 |
| 6 | 新的人类生产执行批准与下一次备份尝试 | 新 approval、新 mint、一次 production backup、owned restore 完整成功 |
| 7 | Fresh preinstall 与 000 安装/验证 | ACL 前向修复独立通过 |
| 8 | 001、002 分别安装与验证 | 按明确 scope 逐项执行，不把一项批准解释成全量迁移授权 |
| 9 | 锁定应用候选部署与 safe health | 生产应用与相应 schema 配套，部署验收通过 |
| 10 | R7D-C3C 生产只读验收 | 合法已发布 target、专用验收 Student、真实 provenance/Tool/Skill 输出通过 |
| 11 | 产品启用前提闭合 | 必要公开入口、内容发布、definition/Pins、学生资格、Provider policy、值守和回执安排闭合 |
| 12 | 首次正式 Agent E2E / Stage1G 受控试点 | 独立授权下运行、观察和验收，再决定是否继续开放 |

部分准备可合并或并行，但备份、迁移、部署、验收和首次启用不能因为上一项成功而自动连跑。

如果 D2 无法保持完整 fidelity，需返回恢复设计，会增加工作轮次。当前没有足够依据给出准确完成日期或“已完成 95%”一类比例。

## 9. 为什么修复后还要处理 package authority

当前 10-entry package 已绑定固定 validation、implementation completion 和 package lock。现有 authority 还会检查冻结 operational member hashes。

若未来修改 backup_adapter.py 或 maintenance_transport.py：

- package membership 可以仍为 10，但 digest 必然重新计算。
- 当前 completion 和 lock 不能直接授权修改后的 package。
- 必须保留旧文件，建立新的 forward authority。
- 不能只改 lock，保留旧 completion package map。
- 不能忽略 package mismatch，也不能使用 latest、glob、mtime 或 mutable pointer 绕过固定 authority。
- 历史 266 PASS 不能代替改动后的 fresh 验证。

恢复算法 scope 与 authority successor scope 是两个不同范围。当前恢复候选主要涉及 backup_adapter、maintenance_transport、backup tests 和 README；capture_authorization 的未来变化属于 successor scope，不应混成“恢复算法已批准”。

D2 尚未产生已选定的 exact source delta，也没有设计或发布 successor。

## 10. 长期产品路线还包括什么

首轮 Stage1G 学生试点完成，也不等于整个 AI 教师产品全部完成。原架构后续路线包括：

| 路线 | 目标 |
| --- | --- |
| P2 Teacher Copilot | 负责范围内的只读学情诊断、课程结构与教学建议 |
| P3 受控 Draft / 更多 Skills | 经明确确认的私有草稿能力，不能绕过正式 owner/publish 权限 |
| P4 Conversation | 会话练习文字能力整合 |
| P5 Guide | 导览模型分支整合 |
| P6 旧实现收敛与推广 | 依据验收结果逐步迁移旧路径、扩大部署与使用范围 |

这些是后续规划，当前不能宣称全部完成。参考：[架构路线图](teaching-agent-architecture-v1.md)。

## 11. 关键证据与 SHA 交接

以下缩写 E 表示 `docs/evidence/teaching-agent-stage-1f-r7d-c/`。文件链接相对本 Markdown 所在的 docs 目录。

| 对象 | 证据 |
| --- | --- |
| Attempt 1 result | [execution-attempt-1-result](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-post-resolution-production-backup-execution-attempt-1-result.json) |
| Attempt 2 result | [execution-attempt-2-result](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-post-resolution-production-backup-execution-attempt-2-result.json) |
| E3 forensic design | [forensics-recovery-design](evidence/teaching-agent-stage-1f-r7d-c/approval-r7d-c3b-attempt2-owned-restore-e3-roles-sql-forensics-recovery-design.json) |
| 16-case reproduction | [local-owned-synthetic-reproduction-result](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-attempt2-e3-local-owned-synthetic-reproduction-result.json) |
| D1 | [recovery-design-refinement-d1](evidence/teaching-agent-stage-1f-r7d-c/approval-r7d-c3b-attempt2-e3-recovery-design-refinement-d1.json) |
| Fresh authority validation | [authority-resolution-validation-completion](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-backup-authorization-lifecycle-authority-resolution-validation-completion.json) |
| Implementation completion | [implementation-completion](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-backup-authorization-lifecycle-implementation-completion.json) |
| Forward package lock | [package-lock](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-backup-authorization-lifecycle-package-lock.json) |
| D2 result | 尚未创建；不得将本状态总结冒充 D2 result |

```text
Attempt 1 result SHA:
8d4f1db71db72b50cbe8726b1ee9a301bb6e075ad5f8cdd292aa997d7ff570f7

Attempt 2 result SHA:
e07614149148bed273a1d2459e973314d3fff20dc067e14d208e1a87182e3942

Forensic design SHA:
cee3f5a0ec7c1d5a5642e882db9e3eb79fc8ebcbdb88fcb31793ba271b1e76f9

16-case reproduction SHA:
a07a9931f4b1e683f41e2c7de5b08a78883e69217deab4a8ff009c59b22411f4

D1 SHA:
8d6f871052f70a7f2b529b306c57050ef3ef188f6b2a8248ad4a1a438fdc8816

Fresh resolution validation SHA:
99c60824866aff120b94b1a094864c0d7ac59562b813966f05d40b2d1c5255f2

Implementation completion SHA:
28950dfae946e7fbb1c72712f1cfa7b5793ddadb16d28c958c556fd2ee8786cd

Forward package lock SHA:
4b2cbaea079c194f48c6e592abc0b16e24c627c1a6a1bb9afb969668dd780f08

Current operational package digest:
cab17ec2b2cd81ad79a1b6bc67994c0f0037b4074cbfdac279c99dc47d4cbbb0
```

SHA 用于下一轮定位与 fresh 核验，不代替读取对应 artifact 的 contract、status、scope 和授权边界。

## 12. 交接时必须避免的误读

1. **D2 没有跑过。** 最新停止不是 reconciliation 实验失败，而是输入 lineage gate 不匹配。
2. **D1 不应修改。** 它实际有四项 blockers，下一轮应调整请求的预期集合。
3. **16/16 PASS 不等于 C2/C2R 完整恢复 PASS。** 其中包括预期负向实验和不同 bootstrap topology。
4. **266/266 PASS 不等于 production backup SUCCESS。** 它验证了当时的 authority/lifecycle/package 合同。
5. **Attempt 2 已消耗。** 不能复用 approval、authorization 或把旧 auth 放回 canonical。
6. **没有确定 Attempt 2 的 exact root cause。** synthetic 证据只能证明兼容的 failure class。
7. **历史 R4D 成功不替代当前 fresh recovery point。** 当前发布依然缺少完整验证通过的新备份。
8. **已有生产基础不代表当前新发布完成。** 早期 Foundation 安装和当前 C3B 000/001/002 是不同执行链。
9. **最近 Agent/Provider 0 不代表项目历史总数 0。** 早期隔离实验有真实调用。
10. **阶段名与方案名可能重名。** R7D-C2 产品实施阶段、恢复 Option C2、候选 C2R 是不同概念。
11. **当前状态总结不是执行批准。** 不自动授权实施、Docker、生产 backup、migration、deploy 或 First Enable。
12. **不清理历史证据。** 保留失败备份目录、旧 approval/auth archive、TLS、diagnostics、validation 与 package locks。

## 13. 可直接转发给 ChatGPT 的摘要

> UPLY Teaching Agent / AI 韩语教师助手已经完成 Core、学生 Explain 链路与 UI、教学脚本冻结、课堂 durable 执行事实、Lesson Tool，以及新 Skill/生产接线的多项工程实现和隔离验证。目前停在 Stage1F / R7D-C3B 发布前置，直接阻塞是生产备份的 local-owned E3 roles restore fidelity。
>
> Backup Authorization Lifecycle 和 Authority Resolution 已通过 fresh 266/266，并形成绑定当前 10-entry package 的 validation/completion/lock。Post-resolution Attempt 1 在 wrapper evidence publication 前置失败，没有进入运行生命周期。Attempt 2 已正式 mint、consume 并进入 production read-only backup；5 次 production client invocation 对应 5 份 fresh TLS proof，但 isolated restore 在 E3 / OWNED_ROLES_SQL 失败。授权已终态归档、canonical absent，owned container 清理完成，无 retry。该 attempt 没有生成有效 backup manifest。
>
> Forensics 确认失败前未持久化 roles/full/schema dump，因此不能确定 exact failing SQL。后续 16 项 synthetic reproduction 已全部通过，但不能将 synthetic bootstrap NOSUPERUSER failure 直接认定为 Attempt 2 的 exact root cause。Historical Root Cause 仍 UNRESOLVED。
>
> D1 未选定 C2，四项 blockers 是 builtin membership grantor footprint、builtin extension owner footprint、shared source fixture identity coupling、complete fidelity not established by 16 cases。
>
> 最新 D2 尚未执行，原因是指令要求 exact 三项 blockers，但不可变 D1 文件实际包含四项。D1 SHA/状态等均匹配，仅集合不匹配，因此 Docker 前 STOP：BLOCKED_D2_D1_LINEAGE_DRIFT。没有 harness、container、source/test/README 修改或 D2 result。下一轮应修正 D2 预期集合，保留 D1 bytes，再执行有效批准范围内的 local-owned reconciliation 和 destination-only identity 实验。不得退回重做 Historical V5，也不得复用 Attempt 2。
>
> 只有 builtin membership/plpgsql reconciliation、独立目的端身份和 combined full fidelity 全部通过，才能选择 C2R。然后仍需 exact implementation scope、forward authority successor design、独立批准实施、fresh 验证、新 package authority publication、新生产执行 approval/mint 和成功备份，之后才能 fresh preinstall、000/001/002、候选部署、C3C 验收及最终正式 Agent 试点。
>
> 当前 C3B BLOCKED、C3C NOT READY、正式 First Agent Run NOT AUTHORIZED、Stage1G NOT READY。从当前停止点到首轮受控试点，按工作依赖大致还有 10～12 个里程碑；失败可能增加轮次，不是执行授权或工期承诺。

## 14. 本次文档整理范围

- 新增本状态与交接 Markdown 文件。
- 未修改历史 evidence、source、tests、README、plan、registry 或 migration。
- 未运行 tests、Docker、生产凭据读取、生产 DB、backup、mint、preinstall、migration install 或 deploy。
- 未授予或执行 authority successor design/publication。
- Legacy cleanup candidates：0；safe deletions：0。
