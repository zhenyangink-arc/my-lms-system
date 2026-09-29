# UPLY Teaching Agent — Stage 1F-R4 Production Authorization Gate

## 1. Executive Summary

**Overall: NO-GO。Stage 1G: NOT READY。** R4 审查完成，但真实生产内容、授权身份、网络实测、组织批准、值守及恢复安排未满足硬条件。本任务没有提供 production change authorization；没有执行生产 migration/content/publish/deploy/PM2 restart/definition/allowlist/enable/Agent Run/Live Provider。

R3D 之后，1,306 个产品 release inputs、八份迁移、Definition、Rollout 及原始候选制品字节均未变化。**Release Artifact: LOCKED，仅指可核验的 R3D 工程制品，不表示 Production Ready 或获准部署。** 无需重复 build 或完整 Full Supabase 大套件。

新增发现两个原有问题，未修复：baseline manifest 的迁移明细有八份，但版本索引只有七份，遗漏007；R3D `author-browser.mjs:41` 命中 Next 的禁止赋值 `module` 变量 lint 规则。前者阻断 Migration Plan LOCKED，后者使本轮 scoped lint 总结果 FAIL。R3D 的历史报告保持原样，这两项不是本轮造成的源码漂移。

生产只读确认 ledger449、cutover202609130003、Agent tables0、Candidate0、flagOFF、三名单EMPTY；应用 schema 与R3D快照相同。Production Writes=0；Live Provider Requests=0。

## 2. Current Release Candidate

完整阅读了以下十份阶段报告，并核对 R3D Gate Matrix、Content Owner Checklist、Tailscale/Provider批准包、运维角色表、R3 §30 first-enable runbook、R3A README/reconciler合同。当前源码与本轮生产只读状态优先，历史通过不视作新授权。

[1f-production-readiness](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-production-readiness.md); [1f-r1-release-blockers](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r1-release-blockers.md); [1f-r1b-baseline-bootstrap](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r1b-baseline-bootstrap.md); [1f-r2-full-supabase-staging](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r2-full-supabase-staging.md); [1f-r2a-rls-regression-closure](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r2a-rls-regression-closure.md); [1f-r3-production-operations-gate](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r3-production-operations-gate.md); [1f-r3a-run-reconciliation](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r3a-run-reconciliation.md); [1f-r3b-pilot-readiness](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r3b-pilot-readiness.md); [1f-r3c-pilot-content-closure](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r3c-pilot-content-closure.md); [1f-r3d-authoring-workflow-closure](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r3d-authoring-workflow-closure.md)。

Release input freeze：

| 输入 | 本轮重新计算 / 结果 |
|---|---|
| Product source | 1,306文件；`48b8e7b979b0a158635c82e31e9e0f948742e0e5a0f2ca5e5bab553ec458708c` |
| Source digest 算法 | src/**、public/**、package.json、package-lock.json、next.config.ts、tsconfig.json、postcss.config.mjs；每文件SHA256，路径键排序的紧凑JSON再SHA256 |
| 与R3D比较 | R3D开始快照 + 结束scope中before/after和新增文件SHA重建最终集合；新增/删除/改变均0；不是只比较Git HEAD |
| 八份迁移清单digest | `4735e8bb64b2619160eb1ad665e6a12f6a5c282f001a684b306f21d3b261a605`；路径/版本/SHA排序紧凑JSON |
| Definition | `4b6299be0d5fcb33b9bdc10e8c35ac894905cfbf55540522e8628380e2ff3d8c`，实际离线执行pinStudentRuntimeDefinition重新计算 |
| Rollout源码 | `afc063f8ae03094a95885b29980733023b9903e46e9613069c389202ecbfd5af`；没有独立语义版本，用source SHA识别 |
| RLS版本 | 202609140005，SHA见§4；未应用生产 |
| Reconciler | deadline-terminal-v1 / 202609140006，SQL与运维程序hash均未变 |
| Baseline SQL | `e5de2f48fa40da53ebcae5353aa4907b1738e15998a304a37b3d0fc555c7bac5`，UNCHANGED |
| 环境/依赖 | 已安装Next16.2.10；package/lock/config已冻结，未安装升级；不声称另有全node_modules二进制归档 |

完整path→SHA与逐项结果：[release-integrity.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4/release-integrity.json)；运维hash：[validation-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4/validation-result.json)。R3D没有独立release-inputs文件，本轮从其既有快照/scope恢复 provenance 并补齐冻结记录；不虚构旧build记录中不存在的source digest字段。

## 3. Production Read-Only State

| 核验 | 结果 |
|---|---|
| 开始/结束migration ledger | 449→449；全部version/name逐项相同 |
| Cutover | 202609130003 / runtime_authoring_nonretryable_error |
| Agent五表 | 0→0；未部署基础设施schema |
| 应用schema | 与R3D演练输入schema-only archive比较3,565个应用dump对象块，新增/删除/变更均0；owner/ACL/函数正文保留比较 |
| 结束schema复核 | 15类OID-independent实际生产catalog与本轮首次catalog逐项一致 |
| 课程元数据 | 5门Korean课程、19课时；开始/结束内容状态与计数相同 |
| PM2只读 | uply-first-enable / online / PID1176676 / instances1 / kill_timeout15000；未重启 |
| Runtime配置 | OFF / EMPTY，hash与R3D相同；没有读取或宣称热更新进程environ |

SQL采用TLS验证、default_transaction_read_only、BEGIN READ ONLY、statement/lock timeout；课程查询不访问学生/enrollment/progress/messages。schema-only导出仅为对象差异检查，**不是生产数据backup或恢复点**。dump/连接资料仅留私有临时目录，不归档到文档。

不能直接拿恢复后的clone catalog摘要等同真实生产：恢复会改变dropped-column物理序号、部分owner隐式ACL表示及extension owner。为避免误判，本轮直接比较原始生产schema-only dump的相同应用对象块，SQL定义完全相同；再用实际生产catalog验证本轮前后未变。[schema-comparison.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4/schema-comparison.json)。

## 4. Migration Inventory

从真实active目录扫描cutover之后的全部SQL，与manifest明细及R3D rehearsal逐项比较；共八份，不按任务示例猜测，不遗漏非Agent reissue。

| Version | Filename | SHA256 | Purpose |
|---|---|---|---|
| 202609140000 | [202609140000_agent_core_foundation.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140000_agent_core_foundation.sql) | `7abc5545f6cb926c37a74a890fc6fcdbad4f89a5c35474a4628af67b7e0afa8b` | Agent 五表、准入/CAS/事件/usage 与基础权限 |
| 202609140001 | [202609140001_agent_runtime_completion_evidence.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140001_agent_runtime_completion_evidence.sql) | `a0ece84b6030f029ff68781e3dcffa73e5d7ea2448c33c750ff76c1098f3456b` | definition artifact、完成证据与输出事务门禁 |
| 202609140002 | [202609140002_agent_run_cancel_request.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140002_agent_run_cancel_request.sql) | `a8c0d60432a39f08dd45cea08b7ea0e6565885a8d0a65d15118c1f093dc9fb62` | 持久取消、owner status、事件序列 |
| 202609140003 | [202609140003_teaching_operations_reissue.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140003_teaching_operations_reissue.sql) | `cb2a1e90011f154185f4b5695e3a14d00dce9a60e37063c1b38d2ca854fac794` | 教学运营与考试派发 reissue |
| 202609140004 | [202609140004_completion_policy_management_reissue.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140004_completion_policy_management_reissue.sql) | `20358b17f0deed997263660f15bb0e4c2551caffa6b950d09fc9d4c5d609573e` | 结课政策管理 reissue |
| 202609140005 | [202609140005_student_teaching_content_isolation.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140005_student_teaching_content_isolation.sql) | `ec4454eea39f38bb9f8a7313b203cea444b831bc90cc1e7d30b070400d4c7674` | 教学内容租户隔离、raw node 限制与安全 view |
| 202609140006 | [202609140006_agent_run_reconciliation.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140006_agent_run_reconciliation.sql) | `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a` | deadline-terminal-v1、service-only reconciler 与索引 |
| 202609140007 | [202609140007_teaching_content_skeleton.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140007_teaching_content_skeleton.sql) | `9d5c34d4e9ef0ff2e9de72db9d3ab1e5ac02bd248f222ddd312042a8c94339a4` | 平台负责人从零教学骨架原子创建 RPC |

**Manifest一致性FAIL**：[baseline-manifest.json](/home/yangzhen/projects/my-lms-system/supabase/bootstrap/baseline-manifest.json) 的 `postBaselineMigrations` 正确包含000–007及匹配SHA；`postBaselineMigrationVersions` 只到006。[build-supabase-app-baseline.py](/home/yangzhen/projects/my-lms-system/scripts/build-supabase-app-baseline.py) 正常生成时应同时派生两者。现有迁移runner/rehearsal读取明细数组，R3D八步执行证据有效；现有RLS静态测试只检查索引自身唯一性，未检测两个数组相等。因此不能以36项测试PASS掩盖本缺口。

该不一致已经存在于R3D结束文件中，本轮未改manifest或任何迁移。**Migration Plan: NOT READY**，需后续获准整改并重新冻结相关release metadata；不通过忽略字段或重写历史报告放行。

## 5. Production Content Status

目标catalog course `korean-beginner`：`2f79a679-6e25-4cf9-9f71-455905584787`；lesson `hangul-introduction`：`6ad20a2b-2306-4173-9d3f-73eb9691ff58`。课时published/immediate、非manually locked；生产内容计数如下。

| 对象 | 当前数量 |
|---|---:|
| Digital textbook / version / chapter / module | 0 / 0 / 0 / 0 |
| Teaching lesson / 关联profile | 0 / 0 |
| Script（包括草稿）/ node（包括草稿） | 0 / 0 |
| Published script / published node / 韩语链节点 | 0 / 0 / 0 |

全局published内容Profile `uply-korean-teacher`存在，不等于该lesson已关联它。R3D正式创作入口尚未部署生产。

内容审批证据：Teaching Content Owner姓名 **NOT FOUND**；内容复核签名、正式发布批准、课程权利确认 **NOT FOUND**。[teaching-agent-hangul-content-owner-checklist.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-hangul-content-owner-checklist.md) 的工程项已勾选，生产批准/作者/权利/发布项仍空白。READY FOR CONTENT OWNER是工程交接状态，不是APPROVED。范围限定为本会话及当前可读仓库，没有声称检查了未知外部审批系统。

## 6. Pilot Candidate

**Production Pilot Candidate=0。** 本轮直接读取生产元数据已足以否定published chain条件；没有使用synthetic目标充当生产Candidate，也没有以“UI已有入口”推定内容可用。

同一course只有basic-pronunciation有published链（8 published nodes），但其prerequisite_passed不被当前StudentPolicy支持。其他Korean课程同样没有符合必要条件的发布链。全19课时当前必要条件筛选eligible=0；这是源码+元数据否定结论，非使用真实学生跑全量投影的结果。

## 7. Production Selection Pins

**BLOCKED**：缺少真实生产目标内容，且没有明确批准的internal/pilot identity、tenant和有效用户范围。未创建账号、未拿普通学生Cookie/JWT、未读取其选课/进度、未运行production projector或Agent。

[selection-projection.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/page-projection/selection-projection.ts)、[lesson-slots.tsx](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/page-projection/lesson-slots.tsx) 仍从caller授权数据生成revision/segmentRef。R3D的4个合成Pins仅证明工程能力。未来必须在明确批准的内部身份下真实验证，且先满足原StudentPolicy；不能靠service-role投影或浏览器displayText。

## 8. Single-Lesson Scope

| 同course课时 | 当前unlock | 发布链 | Policy必要条件结果 |
|---|---|---|---|
| hangul-introduction | immediate | 无 | 不eligible |
| basic-pronunciation | prerequisite_passed | 有8published nodes | 不支持该unlock，拒绝 |
| daily-greetings | prerequisite_passed | 无 | 不eligible |

[access-rules.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/policies/access-rules.ts) 的independentlyUnlocked仅支持非手动锁定的immediate/manual，以及已到时的scheduled；不读取成绩推导prerequisite。三维名单仅限tenant/course/user，源码没有lesson allowlist。

**Single-Lesson Scope: BLOCKED；当前0≠恰好1。** 在兄弟课时/解锁/Policy不变条件下最多1，但未收到内容冻结承诺或实际冻结证据。按本阶段严格门槛，当前不能依赖三名单放行；在范围无法冻结状态下 **Lesson Allowlist REQUIRED（发布阻断，未实现）**。若后续能正式冻结并证明恰好1，可重新评估是否仍需工程整改；若>1或仍不能冻结，必须另行授权实现并验证lesson名单。操作员只点一课不算范围控制。

## 9. Tailscale Approval

**Approval REQUIRED；Verification BLOCKED。** 现有 [teaching-agent-tailscale-verification-request.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-tailscale-verification-request.md) 提案为独立HTTPS9443→loopback43183，三个probe路径stream/origin/disconnect，最长30分钟绑定、目标10分钟采样。批准人、执行人、客户端/窗口、撤销负责人未签署；提案参数不是批准。

本轮仅只读serve status，仍443/4000/8443；未新增9443，未probe，未修改ACL/Funnel/serve或任何生产进程。实际Streaming、Origin/Host/Scheme、Compression/Buffering、Disconnect均BLOCKED。现有loopback/Full Supabase结果不替代实际Tailscale证据。

## 10. Provider Policy Approval

**BLOCKED**。当前代码离线计算Provider=DeepSeek、Model=deepseek-v4-flash、configVersion=deepseek-tools-disabled-v1；endpoint为adapter固定的chat/completions。未调用Provider，也没有用公开网页代替组织批准。

[teaching-agent-provider-policy-approval.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-provider-policy-approval.md) 字段逐项审阅：

| 审批字段 | 当前事实 |
|---|---|
| Data/Policy Approver、批准日期/编号 | 未指定/未填写 |
| Provider / Model | 源码已识别，组织批准未取得 |
| Allowed data / optional state | 技术白名单已有；允许发送范围未签署 |
| Tenant/course/user/content revisions | 未批准；目标course只是提案 |
| Retention / training usage | Unknown，未确认 |
| Region / cross-border / DPA /合同 | Unknown，未确认 |
| Revocation / expiry | 有撤销建议，无批准记录/有效期限 |

任何关键项未确认都不能APPROVED。教材/自由问题可能含个人信息，opaque refs不等于法律匿名。技术最小化、工具只读和fixture模型通过不提供组织数据处理许可。

## 11. Operator Staffing

| 角色 | 实际姓名/窗口/权限证据 | 状态 |
|---|---|---|
| Release Operator | 无 | NOT ASSIGNED |
| Pilot Operator | 无 | NOT ASSIGNED |
| Incident Operator | 无 | NOT ASSIGNED |
| Backup | 无 | NOT ASSIGNED |
| Teaching Content Owner | 无 | NOT ASSIGNED |
| Data/Policy Approver | 无 | NOT ASSIGNED |

[teaching-agent-pilot-operations-roles.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-pilot-operations-roles.md) 只定义职责。仓库账户、当前系统登录用户或平台角色不能推定为已接受以上责任；本轮没有代签或发送消息。

## 12. Reconciler Operations

**技术合同PASS；Operations PENDING。** R3A的deadline-terminal-v1保持，R4实际执行18项独立network-none PostgreSQL检查PASS；不重跑Full Supabase或强杀全场景。真实JWT与两会话/强杀证明沿用源码未变的R3A/R3D，未说成本轮重做。

现有 [README.md](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/README.md) 和 [reconcile-command.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/reconcile-command.py) 要求：独立获批infrastructure service连接、明确tenant、limit50且上限100，只接受COMMIT后receipt；失败/timeout/不明提交立即停止并查状态；复查全部active，不把空eligible批次当drain完成。

| 运维确认项 | 本轮状态 |
|---|---|
| 谁执行/备班/何时执行 | PENDING |
| Infrastructure credential使用授权 | 未提供；能读取生产不代表获准执行reconciler |
| Approved tenant scope | 未填写 |
| Receipt受限保存位置、保留期、复核人 | 未批准 |
| pre/post Pilot、deployment drain、incident触发 | 已有提案，责任人未接受 |
| 值守期间每5分钟人工safety sweep | 建议存在，**未被实际运维负责人接受** |

未安装scheduler、未运行production维护RPC。服务端权限存在不等于人员业务授权；不能给任何tenant自动全局sweep。

## 13. Monitoring Ownership

**Monitoring Owner NOT ASSIGNED；STOP Pilot决策人/备班未落实。** 以下为现有工具可支持的未来检查，均待实际责任人接受：

| 信号 | 来源 / 限制 |
|---|---|
| new Run / failed / cancelled / deadline | tenant-scoped runs和固定terminal reason |
| expiredActive / eligible / reconciled | R3A operator-monitor；区分deadline与+6s资格 |
| unknown/missing usage | 每modelCallId对齐model.started与usage；缺失记UNKNOWN，不填0 |
| missing evidence / source / output | Tool/evidence/output事件及source_refs；一次异常停止 |
| selection latency | 冷/暖页面手工采样与Pin数；未持久化server投影span，不能报告生产p95 |
| 教学域写入/late activity | 仅获准审计的实际Agent路径，证据不够记Unknown并停止放行 |

运维查询入口在scripts/teaching-agent-r3/operator-*.sql和r3a/operator-monitor.sql。生产Agent表未安装，本轮未尝试查Run、不触发普通学生流量。

## 14. Backup / Recovery

**BLOCKED**。已有历史DB恢复材料确实存在，不能写成“完全没有backup”：9月10日两个database.dump本轮只读SHA匹配历史记录；9月13日历史preflight/恢复校验文件存在。但没有为本次变更确认新鲜恢复点、恢复窗口、RPO、持权操作员与回滚访问批准。

[deployment-backup-preflight.json](/home/yangzhen/projects/my-lms-system/docs/evidence/textbook-grammar-consistency-20260913/deployment-backup-preflight.json) 明确freshPreDeploymentRestorePoint=false；[backup-freshness.json](/home/yangzhen/projects/my-lms-system/docs/evidence/textbook-grammar-consistency-20260913/backup-freshness.json) 的比较是当时证据，不提供9月15日本轮恢复批准。

当前known-good release目录和Build ID `LuAZe2VMY32YjOo1WvtrC`存在；R3做过同旧源码的staging回滚。没有据此宣称已取得本轮可恢复的完整制品/依赖/数据保全和人工权限。未创建生产backup、未恢复任何生产数据；schema-only读取不能替代数据恢复点。

## 15. Release Artifact

**LOCKED（工程字节冻结）**，与R3D候选匹配：

| 项目 | 本轮核验 |
|---|---|
| Build ID | `6IhDHN8Dm1nCewiCEZnV5` |
| Archive SHA256 | `1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28` |
| .next非cache文件数 | 1377 |
| Artifact digest | `b088781734cd2191c9027b208da70f04d8931b095afaf8a5bd2efe97a777185b` |
| Archive位置 | `/tmp/uply-r3d-release-candidate/candidate-build.tar.gz`，未移动/部署 |
| 原始构建 | R3D完整next build --webpack，96.28s、exit0；本轮直接重算归档内每文件SHA和BuildID |
| Public/package/Next config | 归档与当前源文件相同；配置与生产runtime未漂移 |

没有重新打包或用instrumented Full Supabase产物冒充该候选。无release input变化，本轮按要求不重复build；新发现manifest索引和harness lint问题与应用编译制品完整性分开记录。它们使整体发布准备不通过，不是archive被篡改。

`/tmp`非长期制品库：获准执行前必须仍能验证同SHA；需要持久归档时另行遵守授权范围。任何source/migration/definition/config/依赖/归档变化均STOP，相关REBUILD / REVERIFY后重新冻结，不能靠本报告继续部署旧候选。

## 16. Migration Execution Plan

**NOT READY / NOT EXECUTED。** 八份精确SQL及用途已列§4，但manifest索引不一致、执行人/窗口/备份/变更授权未满足，当前不签LOCKED。以下为可审阅的未来顺序，不是一键执行指令：

1. Preflight：核明确生产变更授权、operator/backup、恢复点、target、ledger449完整version/name、cutover、应用schema、所有八份SHA、definition、exact artifact、OFF/EMPTY；任一变化STOP并重做兼容性/受影响演练。
2. 不向现有生产安装baseline，不重写历史ledger。每步执行前核前序ledger和对象；SQL事务成功后验证对象/owner/ACL/RLS/函数定义及安全边界，再确认该步ledger后继续。

| Step | 预期ledger | 必须verify的内容 |
|---|---|---|
| 202609140000 | 449→450 | 5 Agent表、scope/CAS/event/usage、immutable guard、service权限 |
| 202609140001 | 450→451 | definition artifacts、event v2、完成/evidence/output事务约束 |
| 202609140002 | 451→452 | owner status/cancel/check与public event sequence；普通角色无privileged执行权 |
| 202609140003 | 452→453 | curriculum_plan_assessments、派发/运营函数与租户/教师guard |
| 202609140004 | 453→454 | completion draft/publish/health/retry四函数及owner权限 |
| 202609140005 | 454→455 | caller-bound helpers、safe view无configuration列、raw owner-only、tenant/publication链与anon拒绝 |
| 202609140006 | 455→456 | partial index、三个reconciler函数、service-only grants、deadline-terminal-v1 |
| 202609140007 | 456→457 | atomic skeleton函数、auth/PO guard、authenticated execute、anon/service-role拒绝、无自动发布 |

3. Definition publication：按§17的exact manifest，仅向批准tenant通过受限operator发布，回读全部字段/digest一致；不得代填tenant/actor。
4. Deploy exact artifact：仅部署§15同SHA，global仍OFF；检查所有serving worker已加载该配置、旧课堂/媒体/导航与新Agent OFF smoke，不能只编辑runtime文件宣称生效。
5. 内容作者在独立授权下通过正式UI创建/复核/发布；获批internal identity验证Pins和scope。保持OFF，任何Agent Run/first enable必须另行批准。

每步失败立即停；SQL已commit但验证/ledger结果不明时保持OFF、保存安全receipt并核实，禁止盲目重放CREATE、repair/mark失败步骤或继续下一步。禁止db push entire migration directory。保留已成功additive对象和Agent审计数据，不自动down/drop。

R3D双路径各八步、schema等价和007故障回滚仍为有效**历史隔离技术证据**；本轮schema未漂移，未重跑大套件。生产应用：**NOT APPLIED**。

## 17. Definition Publication Plan

实际离线pin得到student-ai-teacher@1.0.0，definition digest `4b6299be0d5fcb33b9bdc10e8c35ac894905cfbf55540522e8628380e2ff3d8c`；完整精确manifest存于 [definition-manifest.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4/definition-manifest.json)，不包含Prompt正文或Provider密钥。

| 字段 | 状态 |
|---|---|
| Exact manifest / refs / digests | 已计算、与R3A/R3D一致 |
| Target tenant | NOT APPROVED / 未填写 |
| Actor/operator及相应membership/运维授权 | NOT ASSIGNED |
| Publication procedure | 原受限控制面准备pin.profile、验证actor_guard、写指定tenant定义并回读；不是教材内容Profile，也不是migration自动seed |
| Wrong digest / 同版本不同manifest | STOP；不得覆盖不可变定义、不能用浏览器传入manifest |

发布合同来源 [student-runtime-definition.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/runtime/student-runtime-definition.ts)、140000/140001 definition guard、R2/R3已验证受限流程。没有生产写入或新增definition API；精确对象可审阅但执行授权/目标未锁定。

## 18. Final Pilot Allowlist

**NOT READY。global OFF，现有配置三个名单EMPTY。**

| Wave1字段 | 当前值/批准 |
|---|---|
| Allowed Tenant | 未指定/未批准；配置EMPTY |
| Allowed Course | 目标提案korean-beginner，上述UUID；未批准，配置EMPTY |
| Allowed User | 没有明确获批internal/test身份；配置EMPTY |
| Verified Lesson | hangul-introduction提案，Candidate0 / Pins BLOCKED |
| Single-lesson冻结 | 未证明；见§8 |

最大1tenant/1course/1internal user/1verified lesson，没有一项可以用合成UUID或普通生产学生补空。名单只收窄权限、不替代StudentPolicy；所有字段填齐但仍OFF才可进入后续启用评估。

## 19. First-Run Monitoring Plan

仅供未来另行授权的Stage1G执行：实际Pilot Operator和Backup值守，确认scope/revision/Pins及前次active=0；只做一次明确选句Explain。完成后逐项核Tool evidence、source、validated output、usage reported/unknown/missing、duration、Agent Teaching Domain writes、active orphan与terminal一致性，再由指定责任人决定继续或OFF。

任何越权/教学写入/缺evidence或source、范围漂移、无法定位、取消或deadline失效立即停止新admission。需要drain时保留owner GET/cancel，等持久deadline+6s，授权operator有界reconcile、保存COMMIT receipt并再查全部active=0。不得自动重答、扩围、续预算或把未知用量填0。无人值守、政策撤回或scope失效即暂停。

目前无人接收和签署该方案，本轮没有第一条生产Run，也没有以测试调用代替批准。

## 20. Updated R3 Gate Matrix

这是R4新评估，不修改历史报告；PASS标明本轮验证还是继承的隔离技术证据。

| Gate / 能力 | 状态 | 证据与边界 |
|---|---|---|
| R3-1 Real inventory | PASS | 本轮READ ONLY 5课程/19课时 |
| R3-2/3 Real Candidate / published target | FAIL | 目标全链0，Candidate0 |
| R3-4 Real Pins | BLOCKED | 生产内容与明确内部身份缺失 |
| R3-5/6 Formal classroom / authoring | PASS，工程 | R3D Full Supabase历史闭环，产品1306输入未变；本轮11 Action+36定向测试 |
| R3-7 Actual Tailscale topology | PASS，只读 | 现有Serve/PM2稳定；不代表流测试 |
| R3-8/9/10/11 Streaming / Origin / Buffering / Disconnect | BLOCKED | 无临时binding批准，无实际测试 |
| R3-12 Inventory / execution plan | PARTIAL / NOT READY | 八份SQL SHA匹配，但manifest version索引少007 |
| R3-13/14/15 Migration rehearsal / ordered checks / failure stop | PASS，历史隔离 | R3D两路径8步、007回滚；本轮schema/SQL未变；生产NOT APPLIED |
| R3-16 Definition rehearsal | PASS，工程 | exact digest重算相同；生产tenant/actor缺失 |
| R3-17/18 Build / artifact | PASS，LOCKED字节 | 原始archive/1377文件/BuildID相同；无rebuild/deploy |
| R3-19/20 Kill admission / OFF recovery | PASS，工程 | 本轮rollout tests；继承原Runtime验证，生产未执行 |
| R3-21 Drain | PASS，技术；PENDING运营 | R3A历史强杀 + 本轮18 DB assertions；5分钟方案无人接受 |
| R3-22/23 Rollback / data preservation | PASS，历史隔离 | R3已有演练；本轮生产Backup/Recovery BLOCKED |
| R3-24 Operator lookup | PASS，工具合同 | 现有SQL未变；生产表0，不执行查询 |
| R3-25 Monitoring / staffing | PARTIAL / NOT ASSIGNED | 无监控/STOP实际owner、备班、窗口 |
| R3-26 Stop rules | PASS，方案 | 未获实际责任人接受，不宣称运营落地 |
| R3-27 Data minimization | PASS，代码范围 | 不变的Prompt/Tool字段合同，未发live请求 |
| R3-28 Provider Policy | BLOCKED | 批准人/date/scope/retention/training/region/DPA等缺失 |
| R3-29 RLS | PASS，工程 | 005未变、本轮critical静态PASS；真实138项沿用R3D；生产005未安装 |
| R3-30 Teaching zero writes | PASS，限定范围 | 本轮18项隔离fixture教学23表不变；无production Agent Run，不伪称生产动态E2E |
| R3-31/32/33 Ledger / production writes / OFF | PASS | 本轮开始/结束只读一致、写入0、OFF/EMPTY |
| R3-34 Allowlist / single lesson | BLOCKED | eligible0、无批准身份或冻结；无法冻结时lesson名单REQUIRED |
| R3-35 First-enable plan | 方案存在，执行BLOCKED | 本报告§16–19，无授权 |
| R4 Expanded lint | FAIL | R3D author-browser.mjs:41，no-assign-module-variable；产品文件无error |

最小验证：Node36/36、实际Action端口替身11/11、network-none PostgreSQL reconciler18/18、tsc PASS；scoped lint **1 error**。未重跑Full Supabase、未声称再次验证全部真实JWT/强杀/视频场景。新增检查发现的问题不自动修复；见 [validation-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4/validation-result.json)。

## 21. Stage 1G Readiness

**NOT READY**。生产Candidate、Pins、恰好1范围或已验证lesson名单、actual Tailscale四项、Provider批准、实际人员、reconciler方案接受、监控owner、Backup/Recovery、精确Migration Plan、final allowlists均未全部满足。唯一LOCKED的是可核验应用artifact，不能用其替代其他条件。

本任务没有生产变更授权。历史安装命令的工具许可、已有runtime凭证、用户“继续”以及工程Gate PASS均不构成本阶段的生产migration/deploy/content/definition/enable许可。

## 22. Production Safety

[production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4/production-safety.json)：ledger449→449、Agent表0→0、course metadata相同、schema前后相同、配置与PM2/Serve只读状态相同；Production Writes0、Live Provider0、production Agent Runs0、migrationNOT APPLIED、deployfalse、FeatureOFF、三名单EMPTY。

读取时间以inventory的 `2026-09-15T03:01:38.69961+00:00` 至 `2026-09-15T03:08:14.467566+00:00` 为准；runtime/PM2首次核验发生在完整性检查期间，末次复核一致且runtime hash与R3D一致，不冒称读取了不可见的进程内环境。零写指本任务未发起生产变更，非声称全站其他用户也零活动。

本轮只新增报告与R4安全证据；原3111个已有文件按开始SHA复核，保护已有dirty工作区。没有修改旧报告、manifest、migration、业务源码、测试、依赖或.env。定向DB由既有fixture在finally清理；没有新Full Supabase栈。凭证、JWT/Cookie、private logs、schema dump不归档。最终scope/secret/diff检查见同evidence目录。

## 23. Final Recommendation

接受本次R4审查结果：**NO-GO，停止在授权与执行准备Gate。**

下一次放行前需要有可核验的真实内容审核/权利/发布与内部身份、生产Pins和范围冻结、Tailscale授权及实际测试、Provider组织批准、具名人员与reconciler/监控接受记录、新鲜恢复点及回滚授权；还需关闭manifest索引不一致、验证脚本lint，并重新冻结受影响输入。不得通过继续新增Agent功能绕过这些条件。

Production Candidate仍0。没有进入Stage1G，没有部署、生产migration、内容发布、Tailscale变更、allowlist写入或FeatureON。
