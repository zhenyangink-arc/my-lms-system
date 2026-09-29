# 源端 bootstrap provenance 独立采集

本阶段为助手 Agent 准备通过 IPv4 SESSION 连接池读取源端角色及 bootstrap 元数据的正式采集候选。源码已形成 `IMPLEMENTED_UNBUILT_NOT_FRESH_VALIDATED` 候选，五个构建输入和测试定义已形成；导出组件为 `UNBUILT`，正式集成为 `NOT_VALIDATED`。当前检查限于源码、构建输入的静态校验及合成数据的纯校验，没有实际构建或正式测试执行。这项工作用于补足后续接入需要的采集证明，助手 Agent 尚未因此获得运行或生产采用资格。

唯一规范为 [SESSION 冻结设计](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-design.json)，合同 `source-provenance-session-design/1`，原始 SHA256 为 `b445df04c4ee6a46f066d0ecd2b050e2200a8b3827e421a1622c3d5278c3ebfa`。本文说明当前实施边界和后续阶段，不代替实施、构建或验证报告。

恢复候选仍为 `SOURCE_ALIGNED_BOOTSTRAP_AWARE_STAGED_RESTORE_V4`、version 4。十成员操作包、原 D17 authority/completion/lock、固定 source query registry、`exact-single-backup/3`、`exact-single-owned-restore/3` 和 `backup-source-bootstrap-provenance/2` 保持原合同。source-only 采集不能代替 backup 的新鲜证明，也不能授权恢复。

## 单次采集与两个固定入口

权限范围为 `SOURCE_BOOTSTRAP_PROVENANCE_READ_EXPORT`。采集顺序固定为 PRE → ROLES → POST：PRE 在 ROLES 期间保持打开；ROLES 使用独立实际工具连接；随后 PRE ROLLBACK/关闭，再由新进程执行 POST，最后 ROLLBACK/关闭。只读取批准范围内的私有元数据并保存原始角色导出，不执行导出的 SQL。

固定入口格式如下；命令格式本身不授予执行许可：

```text
python3 scripts/teaching-agent-r7d-c3b/provenance_acquisition.py acquire --approval-id <hex32> --approval-sha256 <hex64>
python3 scripts/teaching-agent-r7d-c3b/provenance_acquisition.py acquire-session --approval-id <hex32> --approval-sha256 <hex64>
```

`acquire` 选择原 DIRECT profile；`acquire-session` 选择新的 `uply-source-provenance-session/1`。不接受调用者提供的 DSN、host、SQL、tool、profile、mode、路径、输出目录、fixture 或 mint 参数。没有任意 target override 或自动 fallback。

单次最多两个测量 invocation 和一个 roles invocation，不运行 FULL/SCHEMA dump、pg_restore、roles replay、迁移、Agent 或 Provider 操作，不创建数据库集群或恢复目标。controller 自动重试为 0。PRE/POST 相符只能证明已观察的数据一致，不能证明三个连接构成角色目录的原子快照，也不能排除 ABA。

## SESSION 身份、只读和传输证明

SESSION profile、transport、target、intent 均为独立 `/1` family。只接受同一冻结项目和固定获批 hostname 的 provider SESSION endpoint，端口 5432。hostname grammar 仅作拒绝过滤器；完整 hostname/project/frontend user 必须匹配各自固定或获批哈希。端口 5432 不能单独证明 SESSION 模式。TRANSACTION、6543、未知模式、IP、别名、多 host、socket、hostaddr 均拒绝。

前端用户为批准的 `postgres.<project>`，backend database/session user/current user 必须实际为 `postgres`。SESSION 仅接受 PostgreSQL 17.6 的 `170006` 和 server/client encoding 均 `UTF8`，不扩大原恢复 profile。verify-full、精确 CA、GSS disable、只读凭据挂载及固定 runtime 路径均须校验。凭据不进入 argv、环境元数据、receipt 或公开输出。

SESSION PRE/POST 在各自实际连接上先执行 `SET SESSION default_transaction_read_only = on`，再进入原 READ ONLY / REPEATABLE READ 控制流程和固定查询。实际 gate 必须得到 on/on、repeatable read、正确身份，以及该测量连接的 frontend TLS 和 backend SSL true；失败不能修改 role/database 默认值或换入口修复。

新组件为 `PG176_SESSION_READONLY_ROLES_EXPORTER`、version 1。其实际 ROLES PGconn 必须在 secure search_path 和任何角色目录查询之前，完成三个固定 SET：只读 on、statement timeout 30000、lock timeout 5000；随后执行固定一次测量 SELECT。该结果必须是 1 行、11 列、全部非 NULL 的 text/OID 25/文本格式，并严格校验：

| 字段 | 实际要求 |
|---|---|
| transactionReadOnly / defaultTransactionReadOnly | `on` / `on` |
| backendPid | 严格正十进制 PID |
| serverVersionNum | `170006` |
| database / sessionUser / currentUser | 均 `postgres` |
| serverEncoding / clientEncoding | 均 `UTF8` |
| statementTimeoutSetting / lockTimeoutSetting | `30s` / `5s` |

初始化结果、连接状态、事务状态、行列数、类型或值不符，都必须在角色目录导出前失败。`PGOPTIONS` 被请求或工具退出 0，均不能代替这份实际同连接测量。

frontend TLS 与 backend TLS 分开报告。PRE/POST 的 backend SSL 只能证明各自连接；ROLES 的固定 11 列 gate 不测 backend TLS，因此不能借用 PRE/POST 的 TLS/PID/只读观察补齐 ROLES 证明。所有 provider 物理连接尝试数均为 `NOT_OBSERVABLE`；三个逻辑 invocation 不等于三个已测得物理连接。

## 原 DIRECT 语义保持

DIRECT 的 profile/transport/target/intent 保留原 `/1`、同项目 provider direct hostname、postgres 身份和固定 stock 17.6 image。仍要求实际 PRE/POST startup on/on gate，不添加 SESSION 的 SET 修复；原 SQL_ASCII 编码域保持，不用新的 SESSION UTF8 条件扩大或替换它。

DIRECT ROLES 使用 stock `pg_dumpall --roles-only --no-role-passwords`，证明边界仍为实际固定工具的 libpq startup enforcement，而非逐事务只读查询 receipt。ROLES TLS version/cipher 为 null、backend SSL unavailable；不借用 PRE/POST 观察。

新源码中的 DIRECT 也必须通过新 current completion 和 tagged approval/auth `/3`。旧 D28 completion 不能给改变后的源码执行资格。

## 当前授权、消费和准入版本

current human approval、authorization、approval bindings、client proof、proof bundle 均为 `/3`；fresh-validation 为 `/3`，completion 为 `/4`。DIRECT 与 SESSION 使用显式 tag 和各自 closed fields，未知字段、混合 profile、旧版本及 generic fallback 均拒绝。历史 `/2` 只用于明确的离线历史校验，不能提升当前资格。

claim、consumed、dispatch、observation、profile-review、acquisition result、terminal 保留原 `/1` shape/meaning。只有完整校验新 auth、target、intent、source/context、dispatch、invocation、proof 和原始文件 SHA 的关联后，才接受这些记录。

SESSION 的授权和连接目录从既有可信 canonical 目录确定性派生，调用者不能选择：authorization child 为 `source-bootstrap-provenance-session`；connection sibling 为 `db-source-provenance-session`。DIRECT 保留各自既有固定目录。legacy/DIRECT/SESSION 使用共享 lock 和跨根 claim 冲突检查。四项 durable claims 与 consumed 必须在凭据读取前完成；部分 claim、已消费 attempt、失败或丢失 terminal 都不能删除重建后重试。

旧 D17 authority 和 pooled transport-risk acceptance 仍须通过真实 lineage/risk guard，但它们只证明原操作包来源，不批准新的 SESSION 采集。人工审批必须绑定真正发布的新 completion、当前 source/context、精确 profile/intent、凭据身份和显式权限。D33 的失败预检已消费；旧批准不可复用。

## FD3 receipt、私有辅助证据与输出

controller 只创建固定私有 staging parent，不生成成功测量 receipt。流程为：先冻结实际 Docker argv 和其 SHA，持久化 dispatch；再 exclusive-create `producer.env`，写入七项安全 identity/hash 元数据并 fsync/readback；最后运行该唯一 argv。dispatch 不包含尚未产生的 env、receipt、stdout 或 proof 哈希。

bound C launcher 在验证 parent 身份后用 `openat`、O_EXCL/O_NOFOLLOW 创建 `readonly.json`，要求 owner 为实际非 root operator、目录 0700、文件 0600、nlink 1。它将 receipt FD 复制到 FD3 并 exec 固定 exporter；exporter 立即恢复 FD3 的 CLOEXEC，避免 companion 继承。成功 gate 后先 writeall/fsync/close receipt，再执行角色目录查询。普通 shell 重定向不能代替此 exclusive-create 协议。

receipt 为 canonical UTF-8 JSON 加恰好一个末尾 LF，raw SHA 包含 LF、canonical SHA 不含 LF。它是程序从实际 PGresult 生成的结构化测量记录，`rawResponseAvailable=false`、`rawResponseSha256=null`，不得声称保留了 PostgreSQL wire response。receipt 最多 8192 字节；producer.env 最多 1024 字节、恰好七个指定键及固定顺序。reader 必须在持有 parent/文件 FD 下复核身份、大小、字节、invocation/dispatch/artifact/query 等关联。

成功采集目录仍严格六文件：

- `pre.json`
- `post.json`
- `roles.sql`
- `transport-proofs.json`
- `profile-review.json`
- `acquisition.json`

receipt 和 producer.env 留在授权根下、成功采集目录之外的固定私有 `proof-staging/<acquisitionId>/<invocationId>/`，通过 ROLES client-proof `/3` 内嵌的 `source-provenance-roles-exporter-proof/1` 及 private references 关联。不增加第七个 success payload，成功和失败都保留 staging 辅助证据。roles stdout 按原始 bytes 保存，完成 EOF/hash/字节数检查；不执行 SQL，不将 receipt 混入 SQL。

实际混合 stderr 管道可能包含 launcher 安全错误码以及 Docker/libpq/companion 的不可信原文。raw bytes 仅在 controller 的有界私有内存中捕获，最多 1 MiB；proof 绑定实际 bytes/hash，退出后不保证 raw 可取回，不新增 raw-stderr 文件。公开输出只能使用固定安全 status/phase/code/ID/SHA，不回显 endpoint、凭据、SQL、角色配置、注释或 PQerror 文本。超限、截断、写入失败或 disconnect 均失败，不能截断后声称成功。

成功路径 controller SELECT 保持 PRE 14 + POST 13 = 27。工具自己的 3 SET + 1 SELECT 只计在嵌套 ROLES proof/receipt，不能加到 controller SELECT。controller control 数按实际 dispatch 记录；顶层 `toolInternalSQLStatements` 和 `physicalServerConnections` 保持 `NOT_OBSERVABLE`。

## 构建输入、正式 lock 与阶段顺序

本次实施范围为三个既有文件的修改和五个新构建输入：固定 C patch（含生成 launcher source）、build recipe、receipt contract、Dockerfile、entrypoint。最终总范围中的第六个新文件 `roles_exporter/artifact-lock-v1.json` 必须等待真实构建。

正式 lock 路径在构建前保持缺失。UNBUILT candidate 只可放私有候选目录，`outputs=null`；不能在正式路径放 UNBUILT 再覆盖为 BUILT。当前 closure 尚不能视为已封存的 final17。代码必须在读取凭据前拒绝缺失、非 BUILT、错配或依赖不完整的正式 lock。

recipe、Dockerfile、image 不内嵌未来自己的 image digest、lock SHA、final source digest 或后续成功 receipt SHA。实际 runtime 必须使用 lock 中固定的 exporter/companion/launcher/libpq 路径、真实文件 bytes/hash、image ID 和完整 loader dependencies；不允许使用未绑定的主机默认库。工具链和输出 SHA 均来自真实文件，不能填假值。

后续顺序严格为：

1. 完成 source/test/doc 与五构建输入，只交付 interim 实施报告，明确 `UNBUILT` / `NOT_VALIDATED`。
2. 独立授权真实构建、输出/依赖检查和 smoke。
3. 用真实产物以 O_EXCL、0600、fsync/readback 创建不可变 BUILT lock。
4. 在 lock 完成后冻结 final17 source + 2 test/doc context snapshot。
5. final implementation 与 build evidence 绑定同一个 snapshot 和 lock，二者不互 hash。
6. 独立授权并运行精确九 phase 新鲜验证：915 次 method executions、613 个 unique IDs。
7. 所有实际结果 PASS，且 fail/error/skip/notRun 均 0 后，最后发布 completion `/4`，再进行只读真实 eligibility admission。
8. 如后续需要，分别取得新的单次生产 preflight 批准和新的 source-only export 批准，再 claim/consume/dispatch。

最终 implementation schema 要求 `IMPLEMENTATION_BUILT_AWAITING_FRESH_VALIDATION`，build evidence 要求 `BUILT_ARTIFACT_VALIDATION_PENDING`；UNBUILT interim 不能占用它们的正式槽位。

固定后续证据位于 `docs/evidence/teaching-agent-stage-1f-r7d-c/`：

- implementation：`r7d-c3b-session-source-acquisition-implementation.json`。
- build：`r7d-c3b-session-roles-exporter-build-receipt.json`。
- validation：`r7d-c3b-session-source-acquisition-fresh-validation.json`。
- completion：`r7d-c3b-source-acquisition-v4-validation-completion.json`。

915/613 是冻结方法选择的计划数，不是已通过结果。原 D27/D28 的 885/885 PASS、583 unique 仅保留历史 lineage；源码或 context 改变后须重新验证，不能复制旧 PASS、更新旧 completion/lock/pins 或接受 latest 查找。

## 后续实际本地验证与当前状态

新九 phase 保留既有八 phase 的精确 ordered IDs，追加 `sessionFocused` 的 30 项方法。测试文件保留原 84 个方法名并定义新的 30 个方法；P1/P2/N5/N6 已包含未来实际 owned client/endpoint 的测试体，但本阶段尚未执行。除授权、版本、重放、proof、gate、artifact、计数、隐私和清理负向测试外，P1/P2/N5/N6 必须有实际 packaged client 和 owned endpoint 证据。

P1 为完整 PRE → ROLES → POST：实际 PRE 占用 backend A 并在 ROLES 期间保持打开，池至少两个 backend，ROLES 在自己的 backend B 完成 gate/catalog，POST 独立证明自身连接。不能把 PRE 替换成 mock，也不能用单 backend pool 卡住 held PRE。

P2 为独立的 warm exporter 组件测试，不是完整 capture：poolsize 1，普通合成 client 先观察并污染 readonly/search_path/timeouts 后释放；exporter 必须实际复用同一 PID，完成自己的 SET/gate/catalog；再由普通 client 观察同一 warm backend 的 reset。新 PID、断开或未观察 reuse 都是 `NOT_VALIDATED`，阻断 SESSION promotion。

完整验证拓扑峰值需要四个同时运行的自有容器：PostgreSQL、SESSION pooler、保持打开的 stock PRE client、单独的 ROLES runtime。它需要新的独立本地运行授权，不能复用先前 R2 最多三个容器的实验批准。配置内存上限不能写成未采样的实际 RSS。

R2 本地实验只支持新会话机制的可行性；其程序校验与同连接日志并未保存正式 11 列 producer receipt，也未完成正式 packaged tool、warm reset 或新 source 九 phase 验证。

当前 `productionBootstrapProvenance=NOT_ACQUIRED`、`productionProfile=NOT_OBSERVED`、`productionAdoptionReady=false`、`productionExecutionAuthorized=false`、`AgentRunAuthorized=false`。构建、新鲜验证及生产操作均另属后续阶段。

## 历史证据

[D26 DIRECT 设计](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-d26-direct-source-acquisition-design.json)、[D27 新鲜验证](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-d27-direct-source-acquisition-fresh-validation.json) 和 [D28 completion](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-direct-source-acquisition-v3-validation-completion.json) 是原 DIRECT 链的不可变历史。[D22 completion](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-source-bootstrap-provenance-acquisition-v2-validation-completion.json) 保留更早的 865/865 PASS、563 unique。

D21 失败、修订及后续历史 evidence 保持原样，不删除或改写。上述成功资格均不授权新的 SESSION profile 或改变后的源码。哈希沿用 operator-owned 文件信任模型，不是抵御恶意同 UID 操作者的数字签名。
