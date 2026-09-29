# UPLY Teaching Agent — Stage 1F-R4F Reconciler Receipt Contract Closure

## 1 Executive Summary

**Overall: GO，仅限R4F回执技术闭环。Receipt Contract PASS；Operational Package READY FOR USER ACCEPTANCE；Stage 1G NOT READY。**

R4E发现的G-R4E-10/11在本报告的新评估中关闭：CLI具有明确CONFIRMED/NOT_COMMITTED/UNKNOWN、稳定JSON envelope、必填operator、可捕获异常回执及NO RETRY/只读follow-up合同。原R4E报告及证据不回写，不能将本次GO理解为历史回执自动升级或生产执行批准。

正常确认同时要求：子进程完整返回、psql exit0、严格合法RPC JSON、COMMIT之后的结束标记。未知结果一律HOLD/success=false/retryAllowed=false/followUpReadRequired=true；仅能证明未启动执行的本地失败使用NOT_COMMITTED。后续查到DB终态也不改写原UNKNOWN invocation。

24项回执单测通过；原R3A数据库测试文件通过隔离SQL transport原样运行，37项断言通过；真实psql路径的非空提交、空批次提交和权限拒绝3例通过。Tenant、CAS、deadline+6s、cancel、batch和Teaching零写语义不变，八份冻结migration字节未改。生产reconciler/DB写入/Agent/Provider请求均0。

## 2 Scope and Changed Files

| 文件 | 变更范围 |
|---|---|
| [reconcile-command.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/reconcile-command.py) | receipt envelope、严格结果验证、异常分类、operator参数、可选原子文件、稳定stdout |
| [operator-reconcile.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/operator-reconcile.sql) | 仅在原COMMIT后新增 `\echo UPLY_RECONCILE_COMMIT_ACK_V1` 和注释 |
| [operator-checks.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/operator-checks.py) | 原测试调用补synthetic operator；断言新state/success/retry/follow-up |
| [README.md](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/README.md) | 新命令、兼容性、三态、计数、文件与follow-up边界 |
| [test_teaching_agent_reconcile_receipt.py](/home/yangzhen/projects/my-lms-system/tests/test_teaching_agent_reconcile_receipt.py) | 新增离线CLI单测；不启动真实psql/不连接DB |
| [regression.mjs](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r4f/regression.mjs) | 新增隔离回归harness，执行原R3A 37项及真实CLI 3例 |
| [operations runbook](teaching-agent-pilot-operations-runbook.md) | 更新当前技术状态、命令、envelope、UNKNOWN处理；保持人员接受/生产授权未取得 |
| 本报告与 [R4F evidence](evidence/teaching-agent-stage-1f-r4f/) | 新结论、安全状态、测试汇总、hash和Gate |

未改任何业务源码、Provider、Tool、Teaching Domain、冻结迁移000–007、baseline、release manifest、生产配置或历史报告；未修改roles文档来代签人员接受。没有新增产品API或自动scheduler；未创建production receipt目录。

## 3 Commit Confirmation Contract

实际顺序：

```text
CLI validates local arguments and captures code hashes
  → subprocess.run(psql -X -qAt ..., timeout=20)
  → SQL: BEGIN / statement_timeout15s / lock_timeout2s
  → unchanged reconcile_agent_run_batch_v1(tenant, limit)
  → result JSON emitted before COMMIT
  → COMMIT under ON_ERROR_STOP
  → post-COMMIT UPLY_RECONCILE_COMMIT_ACK_V1
  → child exits; CLI receives complete output
  → require exit0 + exactly JSON line and final ACK + strict schema/counts
  → CONFIRMED / SUCCESS / success=true
```

标记必须是完整输出的第二行；不能是截断前缀、提前标记、额外输出或只有JSON。只看到marker也不够。JSON校验顶层字段、contractVersion、results数组、UUID去重、每种outcome/status/reason、整型非负计数、一致汇总及limit；非法array/null/标量/重复键/未知字段均拒绝，绝不通过`.get`异常无receipt退出。

这是在受信psql/SQL环境中确认整个脚本完成的协议，不是数据库事务ID、加密签名或跨不可信客户端证明。`reconcilerHash`是源迁移SHA，实际部署/DB对象核验仍是执行前置。未增加数据库receipt表、事务写入或改RPC算法。

## 4 Three-State and Exception Rules

| 场景 | commitState | result / success | followUpReadRequired / retryAllowed | exit |
|---|---|---|---|---|
| 完整有效提交，包含空eligible批次 | CONFIRMED | SUCCESS / true | false / false | 0 |
| 参数非法、缺operator、非法batch、未存在parent/已有receipt目标等执行前失败 | NOT_COMMITTED | HOLD / false | false / false | 2（其他执行前错误通常1） |
| psql timeout、connection loss、非零或负退出、SQL拒绝 | UNKNOWN | HOLD / false | true / false | 1 |
| 已dispatch的OSError/BrokenPipe/FileNotFound | UNKNOWN | HOLD / false | true / false | 1；保守，不尝试从异常推定rollback |
| missing/partial/malformed JSON、array/null/non-object、错字段/汇总、无ACK | UNKNOWN | HOLD / false | true / false | 1 |
| 已dispatch的意外Python Exception/SystemExit | UNKNOWN | HOLD / false | true / false | 1 |
| 可捕获KeyboardInterrupt / CLI入口SIGTERM | dispatch后UNKNOWN；之前NOT_COMMITTED | HOLD / false | dispatch后true / false | 130 |
| --help | NOT_COMMITTED | HOLD / false；未执行 | false / false | 0；帮助去stderr，stdout仍为receipt |
| 可选receipt文件保存失败 | 已知commitState保持，不倒推事务结果 | HOLD / false | true / false | 1；stdout尽力输出 |

**NOT_COMMITTED不用于推测SQL拒绝或网络异常的rollback。** 目前没有解析server rollback acknowledgement的路径，所有dispatch后的未确认情况保守UNKNOWN。SQL拒绝exit3也不直接当作事务未提交证明。

stdout只输出一条机器可读JSON；不打印raw stderr、异常文本、参数解析错误原文或数据库连接URI。未知结果计数为null，不把缺信息算0。错误代码为固定白名单常量。

**Receipt Always Produced PASS的范围：可捕获的CLI执行路径、正常输出渠道可用。** 无法捕获SIGKILL、掉电、解释器崩溃，或所有输出/磁盘渠道不可用时，不可能保证落盘；dispatch后缺receipt必须UNKNOWN/STOP，不假称所有物理故障均有receipt。父CLI被捕获中断与子进程被杀是不同情况，分别有安全处理；本轮没有通过杀生产进程测试。

## 5 Receipt Schema and Compatibility

| 字段 | 语义 |
|---|---|
| receiptVersion / operation / invocationId | reconciler-receipt-v1、固定batch操作、客户端本次关联UUID |
| operator / executedAtUtc | 必填显式operator标签；UTC起点；不从whoami或OS权限推定批准 |
| tenantScope / batchLimit | 单一private tenant UUID；默认50/max100；测试只用synthetic |
| examined / eligible / processed | 已选择有界候选/results数量；eligibleScope明确为scan时本批候选，**不是全tenant eligible总数** |
| terminalized / cancelled / failed | 确认提交的新终态数；cancelled+failed=terminalized |
| skipped / fenceConflicts | already_terminal/not_eligible/not_found归skipped，fence_conflict单列；不是新终态 |
| commitState / result / success / errorCode | 三态、SUCCESS/HOLD、布尔与安全code |
| durationMs | 单调时钟，从CLI进入至receipt完成前，不冒称单独DB耗时 |
| releaseRef / buildRef | 可选safe labels；未填null；未来production必须明确核对后传入 |
| reconcilerVersion / reconcilerHash | deadline-terminal-v1 / 冻结006迁移SHA |
| operatorSqlHash / operatorCommandHash | 本次实际SQL文件和CLI源码SHA |
| followUpReadRequired / retryAllowed | UNKNOWN=true/false；从不自动重试 |
| followUpInstruction / receiptFileWritten | 安全操作说明、可选文件保存结果 |

成功计数满足`terminalized + skipped + fenceConflicts = processed`。本批成功不是drain完成，仍需独立全tenant all active=0。全tenant eligible采样写入另份manual sweep receipt，不由本批计数伪装。

保留旧service/tenant/limit/execute参数及`contractVersion/status/reconcileError/examined/reconciledCancelled/reconciledDeadlineFailed`字段，降低旧reader迁移成本；**新增必填--operator是有意的接口要求**，旧调用必须补。缺少operator时在psql启动前输出NOT_COMMITTED/exit2。`--release-ref`、`--build-ref`不自动从机器或旧candidate猜值；这些标签不是身份/授权验证。

旧`status=committed`不能单独作为新operational success判定；使用CONFIRMED+SUCCESS+success=true。`reconcileError=1`是失败/歧义调用计数，不是rollback次数。

## 6 Optional Receipt File and Sensitive Boundary

`--receipt-file <new-private-path>`：parent必须已存在，使用获授权operator独占/受信目录；已有目标或symlink在dispatch前拒绝，不自动创建或有意覆盖历史receipt。同目录mkstemp、fchmod0600、flush/fsync、atomic rename；文件写成功时与stdout相同。临时文件异常时清理。

文件写入失败仍尽力从stdout输出安全HOLD/exit1；即使DB已CONFIRMED，也不能将这次receipt保存故障当作可自动重跑的理由。DB已知提交状态保持；保存/归档问题需要人工处置。输出管道不可用时只报固定安全诊断，不能通过再次reconcile“补回执”。

生产private目录仍PROPOSED，未创建；700目录/600receipt、保留期限/复核人仍待接受。命令不读取/输出学生姓名/email、原问题/回答、JWT/Cookie或Provider secret；DB stderr和异常message不输出。operator为显式运维标签，不是学生身份字段。原tenant值只允许private receipt，repo evidence不含真实tenant值。

## 7 Follow-up Read Contract

**UNKNOWN → STOP → NO RETRY → NEW READ-ONLY CONNECTION → READ-ONLY VERIFY → OPERATOR REVIEW。**

Runbook§9提供文档模板而非自动执行helper：

1. 原receipt保持不变，保存invocationId与安全metadata；暂停后续batch。
2. 获授权operator通过新read-only连接核对target、DB身份、tenant与schema/release；不用原有不确定连接继续执行。
3. 使用R3 `operator-active-runs.sql` / `operator-run-lookup.sql` 和R3A `operator-monitor.sql` 查真实all active/status/version/events/deadline/eligible。不得将R3 since-filtered monitor的active冒充全部active。
4. 独立follow-up记录：originalInvocationId、checkedAtUtc、operator、tenantAlias、followUpDatabaseState、计数/evidenceRef/operatorDecision。
5. 即使发现terminal，也可能是另一worker/reconciler赢CAS；**original invocation remains UNKNOWN**，不覆盖为CONFIRMED。后续任何动作由人工判断并另行授权，本CLI无read/retry/write自动跟进。

本轮没有连接production执行reconcile或follow-up mutation，未更改active=0的drain判据。

## 8 Non-production Verification

| 验证 | 结果 |
|---|---|
| 离线receipt suite | 24 test methods PASS，0fail/0error/0skip，含多项subcases |
| 正常/空/default50/max100 | CONFIRMED，计数、success、exit、retry与follow-up字段一致 |
| invalid0/101、缺operator/tenant/非法参数 | NOT_COMMITTED，真实子进程调用数0 |
| timeout/lost connection/OSError/broken pipe/killed child/SQL拒绝 | UNKNOWN，HOLD/false/NO RETRY/read-only follow-up，exit1 |
| bad/missing/partial/non-object/emptyarray/重复键/坏row/错count | UNKNOWN且结构化receipt，stderr secret sentinel未泄漏 |
| 意外异常/SystemExit/KeyboardInterrupt | receipt存在；分别exit1/130，无重试 |
| 文件 | 0600、file/stdout相同、existing-parent、不有意覆盖、rename失败HOLD/临时清理 |
| 原R3A database-checks.py | **原文件字节未改，37 assertions PASS** |
| 真实CLI+psql 3例 | 非空batch CONFIRMED/SUCCESS/processed1；空batch CONFIRMED/SUCCESS/processed0；ACL拒绝UNKNOWN/HOLD/exit1 |
| Cleanup | owned network-none容器销毁、临时wrapper/合成metadata目录清除；未发布host port |

证据：[receipt-tests.json](evidence/teaching-agent-stage-1f-r4f/receipt-tests.json)、[database-regression.json](evidence/teaching-agent-stage-1f-r4f/database-regression.json)。可复现命令：

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p test_teaching_agent_reconcile_receipt.py -v
node --experimental-strip-types scripts/teaching-agent-r4f/regression.mjs
```

SQL回归复用`withStudentRuntimeDatabase({transport:true})`创建synthetic PG17 fixture，装未改的000/001/002/006；当前Runtime用synthetic Provider产生合法completed evidence template，再将原R3A测试通过guarded Docker Unix-socket SQL transport运行。每次核owned container ID/label/network none/read-only rootfs/无bind/无hostport；不接受远程target，不导入生产凭据。原37项中的独立DB双session、completion先赢/reconciler先赢、事务回滚、幂等、tenant、deadline/cancel、batch/index/active0仍为真实SQL执行。

本轮不是Full Supabase Auth/PostgREST/JWT安全矩阵重测，也未重跑强杀Next场景；SQL和CLI合同验证不冒充生产运维演练。原`operator-checks.py`更新了兼容参数/断言，本轮其production-shape SQL/CLI行为由新harness验证，没有重新创建旧Full Supabase栈。

首次回归已通过37项及empty/denied 2例；补充真实nonempty CLI用例后最终完整重跑37项及3例均通过。单测补充dispatch后SystemExit后最终24项通过；没有调整产品deadline/batch/CAS来换取通过。

Synthetic fixture基础设施写入NONZERO；Teaching表在运行/回归观测窗口hash不变；Provider fixture调用2次，**Live Provider请求0**。不把合成Provider调用记为真实DeepSeek请求，也不把隔离DB写入称为全环境零写。

## 9 Production Safety and Frozen Inputs

生产开始只读采样2026-09-15T07:12:41.696428Z，结束采样2026-09-15T07:28:20.948005Z。固定READ ONLY catalog/ledger及PM2/runtime/Tailscale安全摘要检查，无业务行读取。证据：[database-start.json](evidence/teaching-agent-stage-1f-r4f/database-start.json)、[database-end.json](evidence/teaching-agent-stage-1f-r4f/database-end.json)、[production-safety.json](evidence/teaching-agent-stage-1f-r4f/production-safety.json)。

| 项目 | 结果 |
|---|---|
| PG / ledger / latest | 17.6 / 449 / 202609130003，UNCHANGED |
| Ordered ledger SHA256 | `d864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981`，一致 |
| Agent tables / 全public agent_* tables | 0 / 0 |
| 202609140000–007 | NOT APPLIED；全部源文件SHA与本轮开始完全相同 |
| Reconciliation migration006 SHA | `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a` |
| Feature / allowlists | OFF / 三名单EMPTY，未写入 |
| PM2 | online，PID1176676，restart_time0，kill_timeout15000ms，前后相同 |
| Runtime / launcher | 文件SHA、OFF/EMPTY及启动器hash相同；未读/声称验证不可见的完整进程env |
| Tailscale | 完整Serve canonical hash相同；443/4000/8443原binding，9443不存在 |
| Production reconciler / persistent cancel / Agent | 0 / 0 / 0 |
| Production DB writes / migration / deploy | 0 / NOT APPLIED / 0 |
| Provider live / scheduler installs | 0 / 0 |

“0”限本任务动作，不宣称其他用户同期业务写入为0。生产表不存在，因此production reconciler仍NOT AVAILABLE / NOT EXECUTED，不能写生产运行PASS。

新CLI SHA `12842a373fd85fdc19cebafef40505387c970711376718c5f164b1ef71d21437`；新operator SQL SHA `b774e2cf72e12dba59d9ba06a4d14cec684b9555c47787dfdff33da1554bf36d`。全部当前hash见 [code-hashes.json](evidence/teaching-agent-stage-1f-r4f/code-hashes.json)。

**Operator bundle已改变，历史R3A operator hashes不能代表本次CLI。** 应用源码/制品和冻结migration未变，不触发本轮应用build；历史manifest不回写。未来执行必须锁定并审核新的operator bundle及对应release metadata，不能拿旧hash称其未变化；本报告不替代生产release批准。

最终已有文件保护、JSON/Markdown/Python语法、diff/敏感边界检查见 [workspace-scope.json](evidence/teaching-agent-stage-1f-r4f/workspace-scope.json)。原dirty业务文件、历史R4E报告/evidence、roles、配置和迁移均保留；无gitadd/commit。

## 10 Gate Matrix

PASS范围仅为R4F技术合同和本轮明确测试/安全检查，不是生产执行许可。

| Gate | Name | Status | Evidence / scope |
|---|---|---|---|
| G-R4F-1 | Normal Commit Confirmation | PASS | 真实非空/空batch完整psql+ACK，严格JSON校验 |
| G-R4F-2 | Explicit CONFIRMED State | PASS | SUCCESS/true，仅完整确认路径 |
| G-R4F-3 | Explicit UNKNOWN State | PASS | HOLD/false/NO RETRY/新只读连接 |
| G-R4F-4 | NOT_COMMITTED Conservative | PASS | 仅证明未dispatch；SQL拒绝保守UNKNOWN |
| G-R4F-5 | Receipt Always Produced | PASS | 可捕获路径与可用输出；SIGKILL/掉电等明确缺receipt=UNKNOWN |
| G-R4F-6 | Timeout Handling | PASS | TimeoutExpired后单次调用、receipt存在 |
| G-R4F-7 | Connection Loss Handling | PASS | exit2/OSError/broken pipe/killed child未知 |
| G-R4F-8 | Malformed Output Handling | PASS | missing/partial/array/null/标量/ACK/计数/重复键 |
| G-R4F-9 | Unexpected Exception Handling | PASS | Exception/SystemExit/KeyboardInterrupt结构化输出 |
| G-R4F-10 | No Automatic Retry | PASS | 所有测试runner调用≤1，retryAllowed=false，无循环重试 |
| G-R4F-11 | Follow-up Read Contract | PASS | 新连接、只读、独立记录、原UNKNOWN不改写 |
| G-R4F-12 | Operator Identity Field | PASS | 必填显式标签，测试synthetic；不等于授权认证 |
| G-R4F-13 | Receipt Schema Complete | PASS | 必需字段齐全；未知null、eligible范围明确 |
| G-R4F-14 | Receipt Sensitive Boundary | PASS | 不回显raw错误/凭据；safe projection、600文件 |
| G-R4F-15 | DB Reconciler Regression | PASS | 原R3A文件37项、未改迁移 |
| G-R4F-16 | Tenant Scope Regression | PASS | 错tenant not_found/null拒绝、SQL ACL |
| G-R4F-17 | Batch Limit Regression | PASS | 默认50/max100，非法边界拒绝/有界批次 |
| G-R4F-18 | Deadline Regression | PASS | persisted deadline+6s、future/grace/lease规则 |
| G-R4F-19 | CAS Regression | PASS | 双session、terminal不可变、迟到completion拒绝 |
| G-R4F-20 | Teaching Domain Writes Zero | PASS | 路径无Teaching写，合成Teaching表hash一致 |
| G-R4F-21 | Provider Reexecution None | PASS | reconciler不恢复Runtime/Provider/Tool |
| G-R4F-22 | Production Reconciler Runs Zero | PASS | 本轮无生产维护调用 |
| G-R4F-23 | Production DB Writes Zero | PASS | 生产只读；不隐瞒synthetic fixture写入 |
| G-R4F-24 | Production State Unchanged | PASS | 开始/结束catalog、ledger、PM2/runtime/Serve一致 |

## 11 Operational Acceptance and Remaining Gates

**Operational Package: READY FOR USER ACCEPTANCE（本次技术闭环后的材料）；未签署杨震ACCEPTED。** Runbook技术合同可供接受，production execution仍BLOCKED。

仍未完成：明确值守窗口/人工sweep接受、维护credential holder/tenant范围及实际psql执行环境、private receipt保存/保留/复核、独立Backup/Standby；Data/Policy Approver及Provider Policy；真实production内容、合法internal/test user、StudentPolicy/Pins、single-lesson范围冻结；生产migration/deploy/definition/名单/First Enable授权；实际go-live新鲜备份、broader rollout前off-host，以及其余未闭合传输Gate。

主机PATH无psql的既有运维环境问题不因隔离Docker wrapper测试自动消失。可选文件能力不意味着production private目录已创建或retention获批。原R4D备份技术通过不永久满足未来≤15分钟freshness。新增operator bundle须作为未来精确执行输入审核。

## 12 Final Assessment

R4F技术目标完成：R4E提交回执、未知结果和异常缺回执三个缺口已关闭，可捕获路径不再因array/AttributeError等直接无receipt退出。正常确认与不确定状态可机器判读，错误不触发自动retry，follow-up不能倒签原调用；数据库收敛语义和生产状态保持。

**GO仅针对R4F；Stage 1G NOT READY。** 停止于本次源码/测试/文档闭环，不production migration、不deploy、不运行production reconciler、不启用Feature、不安装scheduler、不进入Stage1G。
