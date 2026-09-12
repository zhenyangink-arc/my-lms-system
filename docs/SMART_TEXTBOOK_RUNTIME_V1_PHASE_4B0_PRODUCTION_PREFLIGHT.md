# Phase 4B-0：生产切换前置核验与条件性执行方案

核验日期：2026-09-10。生产 catalog SELECT 时间为 07:38–07:42 UTC（16:38–16:42 韩国时间）；另完成现行第一章 SELECT-only Reader/Adapter 编译比对。

**结论：技术就绪保持通过，但生产切换不放行。下一轮应优先处理 Publish Foundation，不应直接进行学生 Route Cutover。** 本报告是有明确阻断的前置清单，不是可直接执行的生产上线授权；没有执行 Phase 4B-1。

## 1. 状态总表

|状态|本轮结果|依据|
|---|---|---|
|`runtimeTechnicalReady`|true|4A15 frozen 证据重算通过；实时 SELECT 编译 digest 一致|
|`runtimeReady` / `learningReady` / `teacherReady`|true / true / true|原 readiness 标准未更改|
|`recordingProductionReady`|false|migration、key provisioning、首次维护切换及真实部署验收未完成|
|`productionMigrationReady`|false|catalog 适用性通过不等于可部署；发布 runner、secret/维护责任与窗口尚未确认|
|`productionCallerCutoverReady`|false|工作区统一接线已实现，运行实例/发布 artifact/首次围栏尚未封闭|
|`publishFoundationReady`|false|没有正式 immutable Manifest store、原子 publish pointer、production snapshot loader|
|`productionServiceBoundaryReady`|false|production 端口存在，但未安装生产 Route；session resolver 仍依赖审计编译器和进程 Map|
|`cutoverRollbackReady`|false|4A7 协议演练通过；实际 Runtime admission kill gate、兼容 rollback artifact 和操作链尚未验收|
|`authenticatedSmokeReady`|false|未确认专用合法 student/cohort、正常认证会话和测试写入授权|
|`productionCutoverReady`|**false**|以上生产前置为 AND 条件，不能由 runtimeReady 推导|

```ini
production migration executed = false
production caller cutover executed = false
student production Runtime switched = false
production Recording v2 gate enabled = false
production Runtime gate enabled = false
proof key installed = false
PM2 restarted = false
```

后四项指本轮未执行这些动作；不把只读观察冒充对所有外部部署系统的持续监控。

## 2. Phase 4A frozen technical baseline 复核

读取 Phase 4A5/4A6/4A7/4A15 报告和当前代码；运行 `tests/fixtures/teacher-readiness-4a15.mjs`，由已有 mounted 见证重新计算 Learning、Teacher、Runtime readiness，均通过。没有改 Registry、validator、capability 或 target。

同时调用现有 `readAuditSource()`，其两个 Reader 只查询教材/教学资源，不查普通学生进度或录音；本轮实时重新编译结果与冻结结果一致：

|项目|4A15 与本轮|
|---|---|
|Step|8|
|Activity|19|
|orientation 单选题|3|
|Teacher|published v23、8 nodes、legacy；没有 Teacher Video|
|learning targets|359，requiredUnsupported=0、danglingCommands=0|
|Teacher refs / commands|3 / 7，unsupported=0、duplicateOwners=0|
|全部 Manifest runtimeTargets|363；不能把 359 learning targets 当成全部 target 数量|
|Manifest snapshot|`snapshot-774d8fd07f5e3f6c1c1fe5f0bd6a15f2`|
|Manifest digest|`sha256:19bb72f491ae7f460d83867b09562e079e8bf1dfb3ee62b3de04775f88471f2e`|
|source revision|`0feb9264ff035a1139cde70e9b1a4611608883d4832f06be87c4a5327f279fc0`|
|teaching revision|`feb30ba7-0a5e-4e9f-83e6-8970f715ddd5`|
|remainingNonUiUnsupported|0|
|compat.learning / compat.teacher|implemented / implemented|

生产 SELECT 另独立确认第一章 published、8 modules、19 activities、orientation 3 道 `single_choice`、当前 published script revision=v23/冻结 UUID。实时 Reader 的多次 SELECT **不是事务性发布快照**；相同 digest 证明此次采集一致，不证明未来请求自动具有 immutable publication 语义。

4A15 的 835/835、严格 complete Chromium、SQL rehearsal 是上一轮完成的证据。本轮没有重新跑浏览器或产生合成 DB 写入；没有把旧测试次数当成本轮新增测试。

## 3. 当前生产 schema / RPC / 权限只读复查

复用已审查的 `/tmp/uply-recording-4a6-readonly.mjs`，仅选择 management 分支的专用 `/database/query/read-only`；补充 catalog SELECT 也使用同端点。响应再次确认：

```text
current_user = supabase_read_only_user
transaction_read_only = on
PostgreSQL = 17.6
```

项目关联由服务器既有 Supabase URL、project-ref/pooler 信息核对，凭据仅在请求内使用，不打印。未执行写 RPC、DDL、migration、生产事务回滚“试跑”，也未 GET/HEAD 普通学生录音对象。

|对象|复查结果|drift 分类|
|---|---|---|
|speaking evidence|11 列，metadata JSONB NOT NULL/default `{}`；9 个 validated constraints、3 indexes|identical（4A6 所核范围）|
|consumed pair|双字段同空/同非空；正 attempt number；与旧 migration 相同|identical|
|attempts|11 列；唯一 tenant/student/activity/attempt_number；score 可空、qualification 保留|identical|
|node progress|10 列；四列复合 PK、状态/范围 CHECK；2 个原 trigger|identical|
|旧 speaking RPC / 6 参数|prosrc 与 `202608180023` 相同|identical|
|generic attempt / 8 参数|prosrc 与 `202608180008` 相同|identical|
|generic attempt / 7 参数|prosrc 与 `202608180027` 相同|identical|
|roleplay 依赖|原 activity→node.content/scene、generic attempt、evidence metadata 路径存在；专用 v2 函数不存在|现行依赖兼容；v2 repo-only|
|`recording_private`|schema、proof_keys、domain_control/instances/requests 均不存在|repo-only，符合尚未部署基线|
|v2 / coordinator public RPC|4 个 v2 RPC 与 2 个 domain RPC 均不存在；没有同名冲突|repo-only|
|evidence RLS/grants|RLS=true、force=false；无 policy；anon/authenticated 无表/列授权|identical|
|旧三个 public RPC grants|postgres/service_role EXECUTE，invoker，空 search_path|identical|
|attempt/progress policies|与 4A6 相符；仍须结合 ACL 判断，不把残留写 policy 当作恢复写权限|identical|
|托管 ACL|PG17 MAINTAIN、service_role 附加权限等仍在|compatible-drift，非本轮扩权|
|extensions|pgcrypto 1.3 位于 `extensions`，postgres 可执行 digest/hmac；另有 btree_gist 等|compatible-drift，与 4A6 相符|
|Storage legacy|`storage.objects`/原 bucket 存在，历史精确元信息匹配计数=1|compatible；没有读取音频|

实际再次读取 `pg_get_functiondef()`、prosrc、函数 ACL/security/search_path；比较 prosrc 时只 trim 首尾、统一换行。摘要：

|函数|生产与仓库相同 SHA256|
|---|---|
|speaking / 6|`5109c5f602deb0712e046585b6aa5c92c00b10d884824fed914b34a9b40717d5`|
|generic / 8|`6290c9403765123d4005e82ef91adaa9e25527c31efb8b5d3b6303ad478ed6a3`|
|generic / 7|`248c3dbb9975fd1d6bd92199dafa88bafa4482dd68aec8a4f9fe4407cdda0713`|
|chapter completion trigger|`49fbe8a327a2b62b6b8bcfa49c78f4886be3d6c28a8486b17cfb47b888172093`|
|set_updated_at|`af93218b8e5aa734bce7dc5f0bb5e04e6b1a97b8263739820d6caa8c274d97f4`|

没有观察到相对 4A6 的新 blocking schema/function drift。这不是全库所有对象逐字无差异的保证，也不补发生产 migration 授权。

## 4. Legacy evidence 匿名形态

|形态|数量|已消费|未消费|未知/无效|
|---|---:|---:|---:|---:|
|R2 roleplay-turn，旧 metadata 无 storage|13|4|9|0|
|R2 full-recall，旧 metadata 无 storage|2|0|2|0|
|legacy Supabase Storage，空 metadata|1|1|0|0|
|合计|16|5|11|0|

与 4A6 一致；全部超过 24 小时，无未来时间；匿名 activity/role binding 检查通过，未出现 runtimeBinding/lifecycle 新形态。对象路径只在数据库内部精确比较，结果只返回种类和计数；报告不列学生、evidence UUID、对象键或 transcript。

这 16 条不是未来 smoke 的可消费/可删除素材。历史回听兼容与正式消费资格继续分开。

## 5. Recording migration 适用性与 pending 隔离

生产 ledger 仍有 **437** 条，production-only version=0。当前 repo-only pending 恰为：

1. `202609080004_teaching_operations.sql` — 本次禁止搭车。
2. `202609080005_completion_policy_management.sql` — 本次禁止搭车。
3. `202609090001_recording_evidence_atomic_v2.sql` — 候选 Recording allowlist。
4. `202609090002_recording_domain_coordination.sql` — 候选 Recording allowlist。

两个 Recording 文件摘要未变：

```text
202609090001  664025f0a2c3f2874bad561e45fad2b63ccb6d12faa559b1ffbff6c39b9d34fa
202609090002  8feade9424fb7b2c76716428571b699f099c5cc77b01de3c7fb4d3d30bda3646
```

0001 的旧 evidence/attempt/parent/FK、auth.role、generic 8 参数、pgcrypto namespace 依赖成立。0002 依赖 0001 创建的 recording_private；tenant/auth.users 依赖成立。0002 只新增协调对象、初始 epoch=1/state=fenced/enabled=false，不回填历史 evidence。两份文件均有明确事务边界、revoke/grant；公开 service RPC 限 service_role，operator transition 不授 service_role。

无既有大表 ALTER/全表回填；仍有 catalog/依赖锁，不能承诺零锁。将来需指定 lock_timeout/statement_timeout、遇锁退出和恢复点；本轮没有生产锁耗时试验。

### 仅部署获批文件的方案（尚未实现/演练发布 runner）

- 禁止 `supabase db push`，也不调用会扫描整个当前 migrations 目录的发布命令。
- 建立不可变 release artifact：只包含上述两份原文、SHA256 allowlist、经过审查的定向 runner；拒绝任何额外 filename/version/checksum。
- operator 的受控连接核对项目、部署角色、备份点、最新 ledger；先 0001，后 0002。全程维护围栏，不允许文件间开放流量。
- ledger 本轮实际列为 `version text NOT NULL`、`statements text[]`、`name text`。每个 migration 的 schema 变化与自己的 ledger 记录应同事务提交。
- 两份原文已有顶层 BEGIN/COMMIT：runner 需用经过验证的 SQL 解析/装配，只处理这一层事务包装，保留函数内部 dollar-quoted 文本原样，并在同一事务末尾通过参数化写 ledger。不能简单拼接成嵌套事务、字符串按分号切割，或 migration 已提交后假称 ledger 也原子。
- runner 必须先在隔离库验证：失败不登记；断连后只读辨认完整提交；已登记同版本不重跑；冲突/半部署停止人工核对，不自动 repair/跳过。
- 全量 explicit revoke 必须执行后才允许 COMMIT；schema cache 刷新与 RPC 可见性列入获批部署后的 health check。

目前没有核验通过的上述生产定向 runner，因此本报告不给出可复制执行的上线 shell/SQL。Publish Foundation 若另需 migration，必须单独审批，不能自动扩充这份 Recording allowlist。

## 6. Proof key provisioning

`src/lib/recording-domain.server.ts → EnvironmentRecordingProofKeyProvider` 已实现，真实名称为：

```text
RECORDING_EVIDENCE_PROOF_KEY_ID
RECORDING_EVIDENCE_PROOF_SECRET_HEX
```

**使用 HEX，不沿用早期 4A6 提案的 BASE64。** provider 仅 server-side，解析 32–64 bytes HEX；错误 fail closed。

只检查配置键是否存在：当前 LMS PM2 元信息、可读宿主进程环境及 `.env.local` 中未发现 Recording 配置键；没有读取或打印 secret 值。不存在 DB keyring。外部 secret manager、实际 secret 资源名、应用保管人、DB operator、日志脱敏审批均**未确认**，不得推断已经完成。

|步骤|必须落实的交付/责任；本轮状态|
|---|---|
|生成|获批 secret manager/受控 provisioning 环境 CSPRNG；禁止 Codex/终端打印或本地 env 落盘；未执行|
|保管|指定应用 secret custodian、DB operator、发布负责人及安全审批人；姓名/值守窗口待明确|
|应用注入|secret manager 仅向服务器进程注入两项；禁止 NEXT_PUBLIC、构建产物、PM2 dump、调试 env 输出；provider 接口已具备，实际管道未确认|
|DB 安装|受控管理连接参数绑定写 `recording_private.proof_keys`，相同 keyId/原始字节；不在 migration/SQL 文本/命令行中带 key|
|脱敏|先确认 DB bind-parameter/error logging、APM、CI、shell tracing、PM2 save/dump 和备份策略；参数化本身不保证日志安全|
|轮换|先装新验证 key，所有 signer 切新 keyId，再等待旧 proof TTL 和在途请求结束，最后 disable 旧 key；按实例核验|
|紧急撤销|先停新 admission/签发，operator disable keyId；失败不能降级为 v1 消费|
|回滚|保留 evidence/consumed；不导出 key、不删历史行；只保留必要 keyId 审计|

再次确认 `supabase_read_only_user` 属于 `pg_read_all_data` 且 bypass RLS。未来 bytea keyring 对此类运营读者不是秘密隔离；需明确接受/收紧此信任边界。此安全确认未完成也是阻断。

## 7. Recording caller matrix：代码已统一，部署未证实

以下 COURSE 指 `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/`；状态针对当前源码，不把 dev/hot compilation 当成已冻结发布 build。

|caller|当前真实入口|域边界|
|---|---|---|
|POST upload|recordings Route:429 `recordingRoute`，导出 POST|`withRecordingDomain` → v1 legacyPOST / v2 gateway.upload|
|GET / restore / bytes|同 Route GET|同 gate；v2 read/restore/playback，legacy Storage 明确解码|
|DELETE|同 Route DELETE|同 gate；v2 remove → claim/DELETE/finalize|
|re-record / failed upload cleanup|`recording-domain-gateway.server.ts` upload/remove|仍在同 lease 内；不是另一个无围栏清理入口|
|speaking submit/verify/qualified/non-qualified|COURSE `smart-textbook-submission.ts:938`|真实 speaking 提交先 withRecordingDomain；v2 不调用旧 Storage verifier|
|speaking completion|同文件 `submitActivityInDomain`|旧 grader + v2 consume，不能只切完成不切 DELETE|
|roleplay completion|COURSE `smart-textbook-actions.ts:86`|同 gate；v2 gateway.roleplay 原子 RPC，v1 分支受 rollback guard|
|roleplay reload/mount|旧 Shell 的两个 completeDialogueRoleplayAction 调用|同 Action，不存在单独无门禁 completion 路径|
|full recall / repeat recording|旧 RecordingControl → 同 recordings Route|共用 CRUD 与 gate；guided-repeat marker Action 仍是独立保留领域|
|Runtime recording port|`server/recording-production.server.ts → run()`|private ref → withRecordingDomain → gateway；若不是 v2 明确拒绝|
|Runtime history|`learning-history.server.ts` → recording.restore|服务端安全 DTO，不让 React 读 evidence 行|

未发现当前上述导出生产入口可独立“completion v2、DELETE v1”的配置开关；但旧未登记 build/脚本/外部部署不受这份源码证明保护。旧 verifier、legacy handler 的残留是受控 v1 分支，不应误删。管理员级联删除、批量脚本和普通学习模式外的运维写入必须纳入维护冻结清单。

Recording gate 原有四项服务器配置：`RECORDING_EVIDENCE_V2_ENABLED`、`..._SCOPE`、`..._EPOCH`、`RECORDING_EVIDENCE_INSTANCE_ID`。cohort 由真实认证 tenant/student 解析，DB control 再校验 enabled/cohort/epoch；浏览器不能选择。保持默认关闭，不在本轮接线或启用。

## 8. 真实进程观察与首次 drain 方案

通过已存在 PM2 daemon 的只读 jlist（仅输出白名单字段），并在宿主 `/proc` 核对：

- LMS `uply-dev`：PM2 id=0，online、fork_mode、PID 366400，工作目录为本项目；启动链是 `npm run dev` → PID 366451 `next ... dev` → PID 366463 `next-server`。
- `package.json` 的 dev=`next dev --webpack`；start=`next start`。**当前观察到的是 dev，不是已确认 hash 的不可变 production build。**
- 同 cwd 还有 PM2 `cezar`（id=1）辅助服务，不能凭 cwd 把它当 Next 学生服务或随意停止。
- 3000/3001/3002/3003 等有监听；本轮没有充分证据确认所有对公网入口、Cloudflare 部署/其他主机/备用进程的流量关系。`package.json` 同时存在 OpenNext Cloudflare deploy 命令，不能由 PM2 单点观察推断全局只有一个实例。

因此实例清单只是本机已观察部分，不是经过发布负责人签字的完整 inventory。不得直接使用 PM2 reload 滚动混跑旧 bootstrap 与新 coordinator build。

首次切换必须在另行授权后按以下顺序执行；本轮全部未执行：

1. 发布维护层 fence：阻止所有 Recording 新写入，包括课程 URL 的 Server Action、录音 API、旧浏览器重试、后台脚本/worker。只挡 `/api/.../recordings` 不够。若不能精确识别旧 action，就对 LMS 写请求实施明确维护窗口；不干扰无关应用。
2. 列出所有实例、host、process树、release hash、Server Action build、入口路由、后台写任务、值守人；查明其他 deployment 是否也服务同数据库。
3. 排空既有请求及外部 PUT/DELETE/cleanup；首次没有 coordinator，**leases=0 不代表旧请求已结束**。不能靠等待固定秒数或 kill 进程假称远端 I/O 已取消。
4. 保持 fence，确认旧请求结果已知，再停止/替换全部旧 build。对结果不明的 R2 操作保持阻断，由 operator 核对，不删除 lease/证据来凑排空。
5. 定向安装 0001→0002；catalog/ACL/ledger 验证。0002 初始 fenced/epoch1/enabled=false。
6. 登记新实例 ID 并确认 epoch1；新兼容 build gate=false 启动，绝不能重新启用无门禁旧 binary。核验 schema cache、配置与健康。
7. 安全安装 key、核验 provider；按 DB operator 协议 open epoch1 v1，再 drain→fence、实例确认 epoch2、switch 到 approved Recording cohort v2、open。也可保持维护直至测试窗口，不能跳过实例一致性条件。
8. Recording smoke 完成后，才可考虑 Runtime cohort admission；两类 gate 分开，Runtime cohort 必须是 Recording v2 已通过 cohort 的子集。

## 9. Student Runtime gate / old-new 路由方案

真实入口：`COURSE/page-content.tsx:752 → loadSmartDigitalTextbook(:754) → SmartTextbookShell(:790)`；re-export 指向 `KoreanLevelOneSmartTextbook.tsx`。当前保持旧 Shell。

建议新增的服务器概念 gate 名为 `chapter1RuntimeV1`，**目前未实现**。将来在原有认证、课程权限和章节解析之后决定：

- 默认 false；只允许 canonical textbook/chapter ID 对应 Korean Level One Chapter 1，不能只根据标题或 query 字符串决定。
- 认证主体属于服务器维护的明确稳定 cohort；query/header/cookie/body 均不能打开 gate。
- immutable published snapshot 和 private bindings 均通过；Recording cohort v2 已可用；production services 已安装；完整 capability 校验通过。
- 满足才进入同一 `LessonRuntime validationMode="complete"`。Chapter 0、2–16、非 cohort 全部继续旧 Shell，所有原课程访问控制保留。
- 必须有独立集中 admission kill switch；不可仅靠每台进程 env 缓存等待重启。关闭立即拒绝新 Runtime session admission，同时按既有 session/领域 drain 规则处理在途操作。
- Runtime 错误不能在已写 v2 状态后自动偷偷回退旧业务 binary；可呈现受控维护/重试。是否转旧 Shell 还需 rollback 数据兼容检查。

旧 Shell、ContentRenderer、skeleton、legacy Teacher、Agent routes、旧 Chapter 1 source 全保留。此处只设计，不修改 route 或新增 gate。

## 10. Publish Foundation：明确未就绪

证据：

- `audit-source.server.ts → readAuditSource()` 每次 SELECT 后调用 finalizer；frozen identity ledgers 仍从 `tests/fixtures/...` 导入。
- `learning-session.server.ts → current()` 在 issue/resolve 时调用同一个 `readAuditSource()`，并用进程 Map 保存 opaque session。
- `production-learning-boundary.server.ts` 明确注明 NOT a deployed route；production ports 没有 production route import。
- 仓库搜索未找到正式 Manifest 发布存储、pointer mutation/loader 链；生产 catalog 对 manifest/snapshot/release_pointer 的名称搜索只命中一个无关 course completion policy index，不能当作教材 Manifest store。

|发布环节|当前状态|
|---|---|
|Draft / legacy authoring|原教材/脚本后台存在；不是 Manifest Publish Foundation|
|Validate / Compile|v1 validator、Adapter、finalizer 已实现|
|schemaVersion/contentDigest|契约与编译结果具备|
|immutable snapshot store|未实现/未接生产|
|dependency pinning|私有 refs/proofs 存在；没有完整发布时持久冻结关联与读取闭环|
|atomic publish pointer|未实现|
|private binding association|目前编译结果对象；没有按 published snapshot 安全持久读取的生产关联|
|production Loader|未实现；不能将当前审计逐请求编译当成它|

`publishFoundationReady=false`。下一轮优先：实现并验证获授权的 Publish Foundation（不重设计 Manifest v1），包括 immutable artifact、digest/schema 校验、private association、依赖固定、原子 publish pointer、回滚/pinning、正式 Loader。identity ledger 必须成为受控版本化服务器资产，而非把测试 fixture 打包上生产。

在此之前不得 student Route Cutover。后台后续编辑不得改变已发布 snapshot；现有 domain service 若只能接受当前 revision，需在依赖不一致时明确拒绝，不能在旧 Manifest 下暗用新题目/脚本。跨 replica 的 session 重建/绑定也须基于正式 snapshot，而非浏览器提交 revision。

## 11. Production service composition 前置

|服务|已有实现|仍缺的生产安装条件|
|---|---|---|
|LearningSession|normal auth/RLS + opaque resolver/boundary|换正式 published Loader；消除审计 compiler/test-ledger 依赖；明确实例 affinity/失效重建|
|Learning/grading/history|productionLearningPorts、原 submit/page/repeat Actions、LearningHistoryReader|生产授权 transport 与 snapshot scope、缓存/no-store、错误/重建协议|
|TeacherSession/Agent|productionTeacherBackend → 原 respond/events；4A15 SQL+mounted proof|在同一 production learning scope 安装，不调用 owner audit route；明确跨实例 session/grant 隔离|
|Recording|productionRecordingServices → unified gateway|migration/key/cohort/epoch 部署前置；gate=false 明确拒绝 Runtime recording，不能替换成 preview store|
|listening/transcript|原授权 audio/transcript Route 经 production ports|正式 session/ref 绑定；不能给浏览器 asset/private identity|
|speech/character/media|Teacher opaque byte port + 3E safe selection|生产 composition 提供既有授权字节代理，禁止测试 WAV/PNG、signed URL、跨 node 补选|

不能因为端口存在就认定 production boundary 已全部安装。Map 的缺失当前是 fail closed，不是数据泄露；但多实例/重启可用性尚未形成获批部署策略。不得把 owner audit in-memory store、合成认证或 fixture transport 用作生产服务。

## 12. 合法身份与 smoke 计划（全部未执行）

上线前必须由负责人提供专用、真实授权的测试 tenant/student，拥有 Korean course/Chapter 1 权限，通过正常登录/MFA，加入明确 cohort；另准备非 cohort 和 Chapter 2 对照。已有 owner 邮箱/远端 Chrome 登录不等于已获准学生测试 cohort。

不冒用普通学生、不用 service-role 登录模拟、不生成 magic link 绕过认证、不复制 cookie/token。授权需包含仅测试范围的录音、作答、清理策略和个人数据保留期限。

|Smoke|通过证据|
|---|---|
|login / Chapter 1|正常权限、正式 published digest、完整 Runtime、8 Step、无 audit route 请求|
|orientation / grammar / patterns|三题与原 grader；分页、反馈、历史恢复；客户端无答案|
|listening / repeat|2 tracks、14 segments、播放限制/transcript 权限，marker 不当完成|
|recording CRUD|R2 upload、HEAD、GET、re-record、DELETE/retry；private identity 不出客户端|
|speaking / roleplay|真实 required criteria/turns，原事务完成；重复串行/并发不新增 attempt|
|read/write / review|原 submit、completion、return/chapter-test gate|
|Teacher|opening/speech/blackboard → cue/TTS grant → task feedback → question/wrong/remediation → terminal；Teacher 完成不写 Learning completion|
|full reload / logout-login|Learning history 恢复、Agent native state 按原语义恢复；旧 grant/blob/generation 不复用|
|对照|Chapter 2–16、Chapter 0、非 cohort 仍旧 Shell；客户端 gate 注入无效|
|故障/rollback|录音失败与 pending retry；stop new admissions；保留正式 evidence/attempt，不裸退旧 binary|

未来测试需要真实浏览器录音和网络，不以本轮无写入检查代替 smoke。计数/trace 只记录匿名 runId、阶段、错误类别、digest，不记录学生语音、对象键、secret 或 proof。

## 13. Rollback 与自动/明确停止条件

任一 Runtime 5xx、Manifest validation failure、Recording domain error、Agent restore failure、state mismatch、key mismatch、migration/ledger 异常：立即停止新 Runtime admissions，停止扩围，保留现场；值守负责人可直接 fence，不等统计阈值。

|情形|必须动作|
|---|---|
|只装 DB，尚无 v2 state|保持 gate=false；新 RPC 留存；不要 DROP；核验没有绕过围栏的写入|
|已有 v2 evidence/attempt|Recording drain→fence→下一 epoch；回滚只能用具 gateway/lifecycle/binding 保护的兼容 build|
|v2 learner 回退 v1|保留 4A7 rollback guard；存在 runtimeBinding/lifecycle 时 fail closed，不能删字段让旧分支运行|
|delete-pending / 不确定 PUT|不自动清理 lease、不当成已删；确认外部 I/O 后由受控 v2 路径处理|
|Manifest/pointer 故障|关闭新 admission；回退到已审 immutable artifact；旧 session 依赖继续固定或受控停止，不静默换 revision|
|密钥故障|停签发/撤销 keyId；不输出 key，不降级为旧消费补成功|

原始不认识 v2 状态的旧 binary 禁止重新开放写流量。保留旧 Shell 是 UI 回滚能力，不是无条件的数据协议回滚许可。迁移 forward-only，不删除 evidence/attempt、compat Renderer、v23 或 16 章资产。

## 14. Phase 4B-1 前必须逐项关闭的阻断

|ID|阻断|放行所需证据|
|---|---|---|
|P1|Publish Foundation 缺失|immutable store/pointer/private association/production Loader 的真实实现、发布与回滚测试|
|P2|production service composition 未安装|正式授权入口、同一 scope、无 audit/test transport、跨进程/重启/reload 验收|
|P3|key provisioning 未确认|实名责任人、secret-manager 资源/注入链、keyring 参数化操作、权限与日志脱敏批准|
|P4|首次 maintenance/drain 与实例 inventory 未封闭|真实入口/实例/worker 清单、旧请求及外部 I/O 排空证据、不可变 build/兼容 rollback artifact|
|P5|定向 migration runner 未验证|仅两个获批文件，checksum、依赖、ledger 原子记录、失败/半部署恢复与 schema cache 验证|
|P6|Runtime admission gate / rollback 未实现验收|默认关闭、chapter/cohort 限定、立即停止新 admission、Recording cohort 子集约束|
|P7|测试身份/恢复点/窗口未确认|正常登录专用 cohort、smoke 数据授权、备份恢复点、值守与停止职责|

没有新的 blocking schema drift，不代表 P1–P7 可以跳过。下一阶段应先申请 Publish Foundation 实现范围，待这些条件全部真实满足后才能生成获准执行的 cohort 上线单；本轮不执行其任何生产步骤。

## 15. 本轮验证与交付边界

- 完成生产 catalog/函数体/ledger/RLS/grants/extensions/匿名 evidence 复查；只读编译实时第一章，digest/source/v23 一致。
- 完成宿主 PM2/Next 只读元信息检查；没有 restart/reload/save、build/deploy、gate/key 操作。
- 完成 readiness 证据重新计算与 caller/import/发布基础源码反查；未降低任何技术标准。
- 本项目只新增本报告；临时只读查询脚本/匿名结果位于 `/tmp/uply4b0-*`。没有新增业务代码、migration 或配置。
- `git diff --check` 及报告路径反查作为最终文档自检；本轮不声称重新执行 835 项测试或真实登录 smoke。

```ini
productionCutoverReady = false
production migration executed = false
production caller cutover executed = false
student production Runtime switched = false
```

完成报告后停止，不自动执行 Phase 4B-1。
