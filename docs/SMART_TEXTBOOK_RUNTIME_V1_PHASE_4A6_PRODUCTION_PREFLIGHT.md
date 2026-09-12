# Phase 4A-6：Recording Evidence v2 生产前置核验与协调切换方案

核验日期：2026-09-09，线上只读查询时间约 10:32–10:39 UTC。**本报告是阻断状态下的审查方案，不是可执行上线操作单。**

## 1. 最终结论

```ini
production catalog inspected = true
production actual RPC definitions inspected = true
blocking schema/function drift observed = 0
unknown evidence variants observed = 0
unsafe mixed-call path if independently enabled = true
secret provisioning resolved = false
productionMigrationReady = false
productionCallerCutoverReady = false
nonUiRuntimeReady = true
compat.learning.v1 = unsupported
compat.teacher.v1 = unsupported
runtimeReady = false
production migration executed = false
production caller cutover executed = false
```

现行 speaking RPC、generic attempt 的两个重载与仓库对应版本的函数体一致；v2 migration 依赖的表、列、签名和 pgcrypto 存在，未发现目标名称冲突。**这些结论不足以批准上线**：完整领域 gate/调用适配尚未实现，密钥保管与供给尚未确认，旧/新请求排空和写入 v2 状态后的安全回滚仍需实现与验收。

因此依照停止条件：不修改业务代码、不实现 gate 接线、不生成生产 key、不执行 migration/caller 切换。本轮只交付本报告。后面的部署、回滚、smoke 内容均为未来需重新授权的设计，不含可直接执行的生产 SQL/部署命令。

## 2. 真实生产证据来源及只读边界

目标由 `.env.local` 的 Supabase API 地址、`supabase/.temp/project-ref`、pooler 关联信息交叉核对，项目一致；报告不输出凭据、连接密码、个人身份或录音对象身份。

第一次 PostgreSQL 直连设置 `default_transaction_read_only=on`、`BEGIN READ ONLY`、TLS `verify-full`，但证书验证失败；**没有降级 TLS、没有借用本地库冒充生产**。随后使用服务器已有授权的管理凭据，通过官方专用只读查询端点完成查询：

- `POST /v1/projects/{ref}/database/query/read-only`；HTTP POST 是只读查询传输，不是数据库 mutation。
- 实际查询返回：`current_user=supabase_read_only_user`、`transaction_read_only=on`、PostgreSQL `17.6`、database `postgres`。
- 官方说明该端点以 `supabase_read_only_user` 执行 SQL，权限为 database read：[Supabase Read-only query API](https://supabase.com/docs/reference/api/v1-read-only-query)。这里只用文档确认访问机制，生产事实来自 catalog/聚合查询。

执行内容只有 SELECT：`pg_class`、`pg_attribute`、`pg_constraint`、`pg_indexes`、`pg_policies`、`pg_trigger`、`pg_proc`、`pg_namespace`、`pg_roles`、`pg_auth_members`、`pg_default_acl`、`pg_extension`、`pg_available_extensions`、`information_schema.columns`、migration version 列表，以及 evidence 的匿名聚合。函数使用 `pg_get_functiondef()`，同时读取 `prosrc` 做本地摘要比较。没有调用任何业务写 RPC，也没有用“BEGIN 后 ROLLBACK”试跑生产 DDL。

所有 evidence 条件都在数据库中完成，仅返回数量/固定形态标签；没有下载 evidence 行、UUID 列表、studentId、objectKey、transcript 或录音字节。仅对旧 Storage 做精确关联的元信息匹配**数量**，未 GET/HEAD 真实 R2 对象。

核验是时间点证据，不是持续冻结生产 schema；未来上线前必须重跑只读 preflight。

## 3. Production Schema Drift 总表

`identical` 表示本轮列明的对象范围相同，不表示全项目全部 schema 已逐字比对。`compatible-drift` 包含 Supabase 托管默认权限/扩展环境与最小仓库声明的差异；不是自动批准权限。repo-only 表示存在于仓库但未部署。

| 对象 | production actual vs repository | 分类 | 判断 |
| --- | --- | --- | --- |
| speaking evidence 表 | 11 列：原 10 列 + metadata；类型、nullability、默认值与 `202608180023` + `202608230010` 相符 | identical | 没有新 snapshot 列；metadata 为既有 JSONB |
| metadata schema | `jsonb NOT NULL DEFAULT '{}'`，没有闭合 JSON 数据库 CHECK | identical | 不得误称旧表已经强制 v2 metadata schema |
| consumed 字段 | consumed_at、consumed_attempt_number；两者同空/同非空，attempt_number>0 | identical | 与旧 migration 相符 |
| evidence constraints/indexes | PK id、UNIQUE object_key、3 个 owner/activity FK、size/MIME/consumption CHECK；owner/activity/created_at 索引 | identical | 共 9 个约束、3 个索引；约束均 validated |
| attempts | PK id、唯一 `(tenant_id,student_id,activity_id,attempt_number)`、qualification boolean；score nullable，保留原 FK/CHECK/default | identical | 唯一编号不是 evidence 幂等键；v2 仍须行锁 |
| node progress | 四列复合 PK、状态及 0–100 CHECK、attempt_count>=0；原 FK/default | identical | 原聚合和完成触发器仍在 |
| 旧 speaking RPC，6 参数 | prosrc 与 `202608180023` 相同 | identical | 仍先锁 evidence，再调用 activity/node 锁；仍只验证 Storage |
| generic attempt，8 参数 | prosrc 与 `202608180008` 相同 | identical | v2 调用的真实依赖存在 |
| generic attempt，7 参数 | prosrc 与 `202608180027` 相同 | identical | 不能误拿 8 参数定义替代此重载 |
| roleplay 专用 v2 RPC | 当前无；旧 roleplay 原子专用函数也未发现 | repo-only | 现行 Action 是 generic RPC + 独立 consumed update |
| 全部 v2 RPC/private helper/keyring | `recording_private` schema 不存在；4 个 v2 RPC 未发现；目标 migration version 未登记 | repo-only | 本轮无名称冲突；不代表已部署 |
| evidence RLS | enabled=true、force=false，无 policy；anon/authenticated 无表或列授权 | identical | 客户端不能直接读写 evidence |
| attempts/progress RLS | 与 `202608160001` policy 及 `202608180005` 的写权限收紧相符 | identical | 残留 INSERT/ALL policy 本身不恢复被 revoke 的表权限 |
| 三个旧 RPC grants | 只有 postgres/service_role EXECUTE，invoker、search_path 空 | identical | 没有客户端 EXECUTE 扩张 |
| evidence/table ACL 额外权限 | service_role 除 SELECT/INSERT/UPDATE/DELETE 外还具 TRUNCATE 等托管默认权限；PG17 ACL 含 MAINTAIN | compatible-drift | 不是本轮 v2 授予；部署不能依赖“服务角色只有四种权限” |
| attempts 额外 ACL | authenticated 有 UPDATE/DELETE，但没有对应 UPDATE/DELETE policy；anon SELECT 无可用 policy | compatible-drift | 不等于实际可改行；本轮不调整既有 ACL |
| `storage.objects` | 存在，RLS 开启，托管角色/default grants 与业务最小 fixture 不同 | compatible-drift | 不能把表 grants 当成文件授权；录音 bucket 未发现 authenticated 直读写 policy |
| pgcrypto | version 1.3，namespace `extensions` | compatible-drift | 早期仓库 CREATE EXTENSION 未指定 namespace；v2 已按 catalog 绑定实际 namespace |
| node progress triggers | set_updated_at + sync_smart_textbook_chapter_completion，函数体与仓库相同 | identical | Phase 4A-5 合成依赖库没有覆盖完整下游触发器，见第 5 节 |

未发现本领域 production-only 函数或 migration version；不是对所有托管系统对象作“没有 production-only”的断言。

### 3.1 函数定义可复核摘要

从线上 `pg_get_functiondef()` 确认签名、语言、security/config；以下 SHA256 比较的是 `prosrc` 函数体，仅统一 CRLF 并 trim 首尾，不去掉内部空白或注释。

| 函数 | 最后对应仓库 migration | 线上与仓库共同 SHA256 |
| --- | --- | --- |
| `record_smart_textbook_speaking_attempt` / 6 | `202608180023_speaking_recording_evidence.sql` | `5109c5f602deb0712e046585b6aa5c92c00b10d884824fed914b34a9b40717d5` |
| `record_smart_textbook_attempt` / 8 | `202608180008_open_activity_unscored_mastery.sql` | `6290c9403765123d4005e82ef91adaa9e25527c31efb8b5d3b6303ad478ed6a3` |
| `record_smart_textbook_attempt` / 7 | `202608180027_restore_objective_activity_recording.sql` | `248c3dbb9975fd1d6bd92199dafa88bafa4482dd68aec8a4f9fe4407cdda0713` |
| `private.sync_smart_textbook_chapter_completion` / 0 | `202608180007_chapter_two_golden_smart_textbook.sql` | `49fbe8a327a2b62b6b8bcfa49c78f4886be3d6c28a8486b17cfb47b888172093` |
| `private.set_updated_at` / 0 | `202607200002_multi_tenant_foundation.sql` | `af93218b8e5aa734bce7dc5f0bb5e04e6b1a97b8263739820d6caa8c274d97f4` |

三个 public RPC 都由 postgres 拥有、`SECURITY INVOKER`、`search_path=''`；执行 ACL 为 postgres/service_role。章节完成 trigger 函数为 `SECURITY DEFINER`，其下游会关联 chapter_tests、写 course_ebook_progress；这是既有生产行为，不能在 v2 回归时忽略。

### 3.2 Migration ledger 差异

线上登记 437 个 migration version；没有发现仓库缺失的线上 version。本次仓库未登记到线上的文件是：

- `202609080004_teaching_operations.sql`
- `202609080005_completion_policy_management.sql`
- `202609090001_recording_evidence_atomic_v2.sql`

**不能用批量 db push 顺便部署这些其他业务 migration。** 后续需独立审查发布工具如何只执行获批 migration并正确登记版本；本阶段不 repair ledger、不跳版本、不执行 dry-run CLI 中的任何上线动作。

## 4. Legacy evidence 匿名聚合

| 真实形态 | 数量 | consumed | unconsumed | v2 decoder 覆盖 |
| --- | ---: | ---: | ---: | --- |
| R2 roleplay-turn，旧 metadata 缺 storage | 13 | 4 | 9 | 已覆盖；scene/role/turn 与当前活动配置的匿名关系检查全部通过 |
| R2 full-recall，旧 metadata 缺 storage | 2 | 0 | 2 | 已覆盖；track/segment 字段类型和范围通过 |
| legacy Supabase Storage，空 metadata | 1 | 1 | 0 | 已覆盖；Storage catalog 对象 size/MIME 精确匹配数量=1 |
| independent-output / metadata.storage=r2 | 0 | 0 | 0 | 代码支持，但本轮没有生产样本证明该分支实际历史覆盖 |
| repeat-line recording | 0 | 0 | 0 | 无历史录音样本；不代表没有 guided repeat marker |
| unknown / invalid shape | 0 | — | — | 未发现 |
| 合计 | 16 | 5 | 11 | 所有当前样本均属于已知 variant |

额外聚合：R2 精确对象路径 15、Storage 精确路径 1、未知路径 0；未知 metadata key 0、未知 storage 0、非 object metadata 0、runtimeBinding 0、lifecycle 字段 0、consumed 双字段不一致 0、活动/版本关系缺失 0、roleplay scene/role/turn 关系无效 0。

检查只返回匿名数字：数据库内部按完整 owner/activity/evidence/MIME 路径进行相等判断，不能靠 prefix 相似推断。metadata 按已知字段白名单及类型验证，包括角色 transcript 的类型/长度，**未返回其内容**。现有样本无 duration 字段，不能据此证明未来任意 metadata 都合法。

**16 条均已超过 24 小时；未来 created_at 数量 0。** 这不是 schema drift，更不是删除理由：应能受权恢复/回听，但不能拿这批旧 evidence 做新的正式消费 smoke。v2 restore 不能直接调用“必须未消费且 24 小时内”的 completion verifier。5 条 consumed 保留历史绑定；11 条过期未消费也不自动清理。

这里没有验证真实 R2 对象存在、音频质量或字节内容；未来授权 smoke 使用隔离测试身份和新建测试录音，不能消费/删除这 16 条真实记录。

## 5. Migration 生产适用性检查

目标：`supabase/migrations/202609090001_recording_evidence_atomic_v2.sql`。

- 文件 SHA256：`664025f0a2c3f2874bad561e45fad2b63ccb6d12faa559b1ffbff6c39b9d34fa`。
- server-only gateway SHA256：`8790dbe6bf06d16a39281f326e22429d153f735c016b72ebba9d1ac0662d01b8`。

| 检查 | 结果 |
| --- | --- |
| evidence/attempt/progress 与 activity→node→module→chapter 依赖 | 当前线上存在；必需列类型匹配 |
| 8 参数 generic RPC、auth.role | 正确签名存在；auth.role 支持 request.jwt.claim.role / request.jwt.claims |
| v2 schema/function/table 名称 | 未发现冲突 |
| extensions | pgcrypto 1.3 已在 extensions；digest/hmac 参数签名可用；postgres 具 EXECUTE/USAGE |
| 部署角色能力 | postgres 非 superuser，但拥有数据库 CREATE/public CREATE/扩展 USAGE；此结果不授予只读检查角色部署权限 |
| 新权限 | SQL 显式 revoke PUBLIC/anon/authenticated，4 个公开 RPC 仅授 service_role；private helper/schema/keyring 也限制，RLS 启用 |
| 默认 ACL | 线上 public 对象有较宽 default privileges；本 migration 的显式 revoke 必须完整执行，不能逐段提交或省略 |
| 历史数据假设 | 目前匿名样本被覆盖；不存在新绑定的历史数据，不允许上线时自动跨 revision 补绑定 |
| 旧数据修改 | migration 不改 evidence/attempt 行，不迁移对象，不删除旧 RPC |
| table lock | 静态上无 ALTER 既有大型业务表、无全表回填；新表/函数/schema 仍有 catalog/依赖锁，不承诺“零锁” |
| 生产规模锁耗时 | 未测；没有生产 DDL dry run。以后需明确 statement/lock timeout 与遇锁退出机制，禁止自动重试无限等待 |
| 完整 trigger/FK 集成 | catalog 已确认，下游章节完成触发器属于真实执行链；4A-5 最小合成 DB 未覆盖全部真实 FK/trigger，需后续完整隔离 rehearsal |

**结论：目录级依赖与历史形态检查通过；生产上线放行不通过。** 不把 catalog 分析等同执行 migration 编译或部署成功。不在本阶段创建另一套 DB 来重新执行 DDL，也不修改已审 migration。

## 6. 阻断清单

| ID | 阻断 | 证据 / 解除条件 |
| --- | --- | --- |
| B1 | unsafe mixed-call path | 新 gateway 无任何生产 import；旧 speaking evidence→activity 锁序，v2 activity→evidence；旧 DELETE/re-record 无 claim。所有领域入口协调接入并通过排空验收前不得开 gate |
| B2 | secret provisioning unresolved | `ProofServices` 仅接收依赖注入 keyId/secret；真实 secret provider、保管负责人、操作日志脱敏验证未落地；不得临时复制 key 到 env 文件或聊天里凑齐 |
| B3 | 回滚不能无条件 gate=false | v2 delete-pending 被旧消费忽略，旧 roleplay/repeat 清理可删 consumed；出现 v2 状态后，裸退旧版本不安全，需要写入围栏与回滚兼容性验收 |
| B4 | release 范围与排空机制未实现 | 多实例/旧 Server Action、重试/在途上传尚无共同 domain gate；仓库另外两份待部署 migration 不得顺带推送 |
| B5 | 实际集成验收缺口 | 全生产 schema 的隔离 rehearsal、完整 GET/restore 适配、原业务返回格式适配、授权 smoke 尚未完成；不是 4A-5 单元测试可替代的内容 |

未观察到 blocking schema/function drift，也没有 unknown evidence variant。但 B1/B2 已满足本阶段停止条件，故两个 Ready 必须 false。B3–B5 是额外的上线检查要求，不借此扩大本阶段实施范围。

## 7. Recording Domain Caller Matrix

状态定义：`old-v1`=当前旧线上入口形态；`requires-change`=切换时必须修改；`v2-ready` 仅用于已实现的内部网关，不代表已接入；`legacy-only`=应保留的历史/旁域能力。以下依据**当前工作区代码**；本轮未检查 PM2 进程环境/已部署构建 hash，不能声称逐文件证明正在运行的生产 bundle 就是工作区。

课程代码目录以下简记为 `COURSE = src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/`。

| 入口 | 文件 / 函数 | 当前状态 | cutover 必须一起完成 |
| --- | --- | --- | --- |
| Upload POST | `src/app/api/digital-textbook/recordings/[activityId]/route.ts:148 → POST` | old-v1 → requires-change | canonical R2、闭合可信 metadata、新 UUID、HEAD size/MIME、客户端无 storage/owner 控制；上传失败补偿也走明确生命周期 |
| GET evidence 字节 | 同 Route `GET` evidenceId 分支 | old-v1 → requires-change | 修复仅 guided-repeat 可读限制；按可信 row decoder 选 backend；consumed/过期可本人回听，pending 不作为可用录音恢复 |
| GET historical lookup | 同 Route practiceKey/track/segment 分支 | old-v1 → requires-change | independent/roleplay/repeat 的 scoped restore 适配；旧索引只在私有映射内部，输出安全 DTO |
| 显式 DELETE | 同 Route `DELETE` | old-v1 → requires-change | v2 claim→对应后端 DELETE→finalize；不能旧 SELECT consumed 后直接删 |
| re-record cleanup | 同 Route `POST` 的 previousEvidenceQuery / 删除循环 | old-v1 → requires-change | 与显式 DELETE 共网关；不删已消费；未建 DB 行的上传失败对象不能伪装已有 claim |
| Speaking verify/submit | `COURSE/smart-textbook-submission.ts:282 → verifySpeakingRecordingEvidence`；`:847` 的 qualified speaking 分支 | old-v1 → requires-change | R2 HEAD/proof→v2 RPC；原 grader、无分数规则保留；不合格 attempt 分支也必须经过统一域状态检查，不能用 v1 verifier 绕路 |
| Roleplay completion/历史同步 | `COURSE/smart-textbook-actions.ts:84 → completeDialogueRoleplayAction` | old-v1 → requires-change | 事务内 coverage、attempt、consumed；将 v2 duplicate/conflict 映射为可信已完成读取，不再应用层 UPDATE |
| RecordingControl | `COURSE/KoreanLevelOneSmartTextbook.tsx:2427` | old-v1 → requires-change（服务响应适配） | 保持旧 UI；录音 metadata/response 格式要兼容，后端不能要求旧浏览器提供新 snapshot；恢复目前只在 uploadMetadata 存在时做 GET，不能声称通用恢复已完善 |
| Roleplay UI 上传/重载 effect | 同文件 `DialogueRoleplayPractice`，`:2797/:2917` complete Action | old-v1 → requires-change（统一服务） | mount 时也会尝试完成同步；不能只切“最后一轮提交”而遗漏刷新时 completion |
| Guided repeat marker | `COURSE/smart-textbook-actions.ts:46 → saveGuidedRepeatProgressAction` | legacy-only（保留） | 现有 marker 表独立；不是 evidence consumption，不新增正式完成含义 |
| Guided repeat/full recall 录音 | RecordingControl 上传 metadata → 同 recordings Route | old-v1 → requires-change | 全部录音 CRUD 包含在同 cutover 中；不能因 marker 保持旧服务而让 full-recall DELETE 漏切 |
| 旧 loader restore | `src/lib/smart-digital-textbook.ts:630–665` attempts/page/repeat SELECT | legacy-only（保留） | 历史进度不迁移；不要把此 reader 当成通用 speaking evidence reader |
| Runtime repeat reader | `src/features/smart-textbook-runtime/server/guided-repeat.server.ts → readGuidedRepeatHistory/saveBoundGuidedRepeat` | legacy-only（既有旁路） | 两轨/14 段映射不动；Preview isolated 不转正式 persistence |
| Runtime evidence projection | `src/features/smart-textbook-runtime/server/progress-projection.server.ts` | requires-change | 目前 evidence schema 仅 repeat-line；不能拿它宣称 13 roleplay + 2 full-recall 已可 UI 恢复 |
| v2 内部服务 | `src/lib/recording-evidence-v2.server.ts → consumeSpeakingV2/completeRoleplayV2/deleteRecordingV2` | v2-ready（内部协议） | 无生产 import、无真实 secret provider；`RecordingRpcTransport` 还需 Supabase result/error 解包，不能直接忽略 RPC error |
| 历史 Storage verifier/reader | 原 bucket 与 v2 headLegacy adapter | legacy-only（显式兼容） | R2 不退回 Storage；历史 Storage 也不能凭 activity 当前配置误选 R2 |
| 安全/fixture 脚本 | `scripts/smart-textbook-security-helpers.mjs → createSpeakingEvidence`、chapter security scripts | legacy-only（测试） | 有上传/INSERT/DELETE，**本轮未执行**；不得误当只读 preflight 或跑到普通学生环境 |
| assignments recording | `src/app/api/assignments/…` | legacy-only（旁域） | 共用 bucket 不代表同 evidence 表；不切 assignments，不全桶迁移/清理 |

补充边界：evidence FK 有 ON DELETE CASCADE。未来维护期间不得同时删除 tenant/student/activity 或执行清理脚本绕过 domain gate；这类运营动作应进入发布变更冻结清单。本轮未执行也未修改这些行为。

## 8. 不可混跑的 Coordinated Cutover

一个 release 必须包含 **upload + verify + consume + roleplay + GET/restore + DELETE + re-record cleanup + 失败补偿/重试** 的统一分流。业务版本切换不等于学生 Runtime 切换；旧 Shell 继续运行并调用兼容 API。

设计中的路由原则：

1. 所有入口先正常认证，得到可信 learner/tenant/activity；再由服务器作一次域版本决策。
2. 控制范围以稳定、服务器配置的测试 tenant/learner cohort 为单位，该 cohort **所有 activity 和旧/新客户端**统一选同一个 domain 版本；不得按随机请求、HTTP method 或单个 evidence 年龄分流。
3. 同一 scope 中不存在“完成 v2、删除 v1”。历史 Storage 在 v2 域中由 v2 的明确 legacy backend 处理，不是返回旧 RPC。
4. v2 缺 key/RPC/绑定、对象验证失败：明确不可用/冲突；绝不自动 fallback 到旧消费或删除。
5. 更新 gate 前先阻止范围内的新写请求，等待在途 upload/cleanup/consume/roleplay 和后台重试退出；确认所有服务实例运行同一 release 和 gate epoch 后才解除围栏。不是滚动部署中逐台开 env。
6. 旧页面携带的 Server Action/build ID、旧 HTTP 重试都必须落到新统一入口或明确要求刷新；不能仍被旧实例执行。未上传的浏览器 Blob不是在途服务器事务，不应被丢弃或自动提交。

如果当前架构无法实现排空/一致的域决策，保持关闭，不把单机内存 Map 当成多实例发布互斥锁。

## 9. Server-side Feature Gate（仅设计，未实现）

仓库没有找到 Recording v2 已有 gate 命名规范或有效接线。建议统一业务名称 `recordingEvidenceV2`，部署配置名如下，均为**拟定名称**：

- `RECORDING_EVIDENCE_V2_ENABLED`：默认 false；只由可信服务配置加载。
- `RECORDING_EVIDENCE_V2_SCOPE`：服务器测试 cohort allowlist；不是请求 query/cookie/header/body 字段。
- `RECORDING_EVIDENCE_V2_EPOCH`：协调发布标识，所有实例一致后才能放行。

gate=false 且范围仍为 legacy-safe 时，完整走原路径，不能 POST 新 schema、DELETE 旧路径。gate=true 对范围内整个 domain 统一启用；未在范围内的 learner 保持全部 v1，各 cohort 不共享 evidence。

另需一个入口层 **maintenance/drain 围栏**，它不是“第三套后端”。出现 v2 pending/已绑定 evidence 后回滚，不允许通过关闭 gate 立即让旧请求穿透；先围栏和排空，满足第 12 节条件才恢复 v1。否则“关闭完全走旧路径”和“永不破坏 v2 状态”两要求不能同时成立，应停服该录音域而非伪造可回滚。

Preview 的 trackingDisabled / 隔离服务优先于此 gate；任何请求都不能利用客户端 `mode=preview` 或 `v2=true` 切 persistence。gate=false/true 均不得让 owner 审计写学生正式记录。

## 10. Keyring / Proof Secret 部署设计

**本轮没有生成生产 key，没有读取或写入 DB keyring。** keyring 当前不存在。

| 项目 | 设计与待确认事项 |
| --- | --- |
| 生成 | 获批时在受控 secret provisioning 环境用 CSPRNG 生成至少 32 字节；不复制到终端输出、聊天、Markdown、Git |
| 责任 | 指定应用 secret 保管人和 DB 运营人，双人核对 keyId/环境；本轮尚未确认实际负责人，因此 unresolved |
| 应用名称 | 拟 `RECORDING_EVIDENCE_PROOF_KEY_ID`、`RECORDING_EVIDENCE_PROOF_KEY_BASE64`；优先 secret manager 运行时注入，不用 NEXT_PUBLIC 前缀，不打包进客户端 |
| 格式 | Base64 严格解码为原始 bytes，长度校验；keyId 使用现有允许字符/长度；不要把 Base64 字符串直接当 HMAC 原始 key |
| DB 安装 | 授权运营通道采用参数绑定写 `recording_private.proof_keys(id,secret,enabled)`；不在 migration/SQL 文本/命令参数中内嵌 secret；仅记录 keyId/操作结果 |
| 日志 | 先核验数据库语句参数、错误详情、APM、CI、shell tracing、进程 env dump 和审计系统不会记录 secret/proof；参数化**本身不能保证**日志不泄露 |
| 绑定/验证 | 应用 keyId 对应 DB 同一行；在隔离测试身份做不暴露 proof 的端到端验证，密钥缺失 fail closed，不切回 v1 |
| rotation | 先供给新 DB keyId，所有新签发切新 key并确认实例一致；旧 key仅保留验证窗口。等待至少 60 秒加在途/排空裕量后 disable 旧 key；禁止重新启用旧 key“救请求” |
| revoke | 紧急撤销可立即禁用 keyId并围栏写入口；未消费 proof 失效，重新 HEAD/签发或显式失败；已消费 attempt 不回退 |
| rollback | 不打印/导出 secret，不删历史 evidence，不修改 consumed。新 RPC/keyring 可留存禁用；备份/恢复同样按 secret 资产管控 |

**额外真实权限事实：**线上 `supabase_read_only_user` 是 `pg_read_all_data` 成员并具 bypass RLS。future private keyring 并不对数据库超级/全库只读运营者提供秘密隔离。`REVOKE service_role`、private schema、RLS 能阻止业务客户端，但不能宣称能阻止所有运营读权限。上线前必须明确接受并收紧管理凭据、备份和只读工具的访问边界；如果要求这些运营角色也看不到 key，则当前 bytea keyring 方案需要另行安全评审，不能本轮擅自替换为新秘密架构。

## 11. 条件性部署顺序（全部未执行）

以下是顺序设计，**B1–B5 未解除前不可转为执行单**；需要下一次明确生产授权。

1. 完成所有域 caller/gate/maintenance adapter，并在完整隔离 schema 中验收旧 trigger/FK、权限、回滚和并发。
2. 重新生产只读 preflight：函数摘要、migration ledger、形态、依赖、名称、权限及正在执行的录音写任务；确认变更审批与值守人员。
3. 确认数据库备份/可恢复点及 restore 演练证据，不在此次任务创建或测试生产恢复点。
4. 明确只部署获批 `202609090001` 的路径及 ledger 策略；不得捎带另外两份 migration，不篡改 ledger。
5. 获批后部署该 migration，设置有界 lock/statement timeout；超限退出，不扩大锁等待；catalog 核验新对象权限。
6. 按第 10 节安装 proof key，应用 secret provider 保持不可公开；keyring/密钥核验通过。
7. 部署完整应用 release，gate=false；所有实例先确认版本、依赖及旧路径健康，未完成不得开灰度。
8. 对明确测试 cohort建立写围栏、排空旧请求；统一 gate/epoch，解除围栏。禁止部分方法/部分实例先开。
9. 执行第 13 节授权测试数据 smoke，任何异常保持围栏/回滚分支，不盲目重新提交完成。
10. 只有权限、状态、对象、并发/回滚均通过且获得扩围许可后，按 cohort重复同样排空/切换；不切学生 Runtime路由。

计划中不包含生产故障 trigger、生产测试 migration、真实普通学生录音操作或 PM2 即时命令。

## 12. Rollback：不能把 gate=false 当万能恢复

### 12.1 仅部署 migration，尚无 v2 请求

保持 gate=false，应用继续 v1；新 RPC/private schema 可保留不使用。forward-only migration 不 DROP 回滚，不删除 keyring/evidence/attempt；未使用 key 可经审批 disable。此时才能成立“关闭 gate→完整旧路径”。

### 12.2 已有 v2 请求/状态

先开启录音域写围栏，停止新签发/提交/cleanup、排空 v2 在途事务和删除重试，再检查匿名 pending、已绑定 evidence 和已消费状态。

- `delete-pending` 不能交旧消费，不能修改成 active；由受控 v2 删除重试按原协议完成，或者继续保留 pending并关闭对应写操作。
- consumed 不可删、不可取消、不回滚分数/进度；attempt 已正式完成则保留。
- Runtime-bound 新 evidence 不得交旧不检查 binding 的 verifier/Action；旧代码并非安全的所有 v2 数据 reader/consumer。
- 在确认没有 pending、且所有仍可访问 v2 行在回退代码中受到明确保护前，不能解除围栏恢复原 v1。若需改 legacy-compatible rollback adapter，另行实现和测试；不通过则该录音域保持不可写。
- rollback artifact 必须保留门禁与新状态保护；不能回到完全不认识 gate/lifecycle 的旧二进制后继续接收请求。

因此本报告**不批准当前“直接关开关/回滚旧包”的生产执行**。不删除 v2 evidence、不修改历史 metadata、不把跨存储删除称为可撤销事务。

### 12.3 Key rollback

停止签发→撤销/disable 指定 keyId；未完成请求显式失败，不能自动改走 v1补完成。保留 keyId 级审计，不把 secret 加入故障日志；不为回滚导出数据库 key表。正常轮换和疑似泄露撤销的等待策略不同，疑似泄露优先立即撤销。

## 13. Production Smoke Test 计划（未执行）

使用预先批准、隔离的测试 tenant/student/activity；不能随机找 owner/student、冒用登录或使用上节 16 条历史记录。测试录音使用合成/测试人员自愿内容，新 UUID 对象；测试范围写入须另行授权。

| Smoke | 预期证据 |
| --- | --- |
| R2 upload | 新对象和 server metadata/backend一致；HEAD size/MIME；浏览器无 objectKey/proof/secret |
| GET restore | 本人可刷新回放，跨 owner/activity拒绝；consumed/过期与“可消费”区分；pending 不恢复为可用 |
| DELETE | claim→对象删除→finalize；已 consumed拒绝；对象不存在重试幂等 |
| re-record | 新 UUID，不覆盖旧对象；同槽旧未消费资源按 claim 清理；已消费证据不被清理 |
| independent speaking completion | 原 criteria/duration策略，原无分数语义；同事务 consumed与attempt一致 |
| duplicate speaking | 同 evidence串行/并发最多一个完成 attempt；错误不可被吞成另一条成功 |
| roleplay full turn | 正确 scene/role完整 required turns，所有 evidence指向同一次attempt，历史同步也使用同域服务 |
| duplicate roleplay | 锁内已完成冲突；UI读取原结果而非新增 attempt |
| failed upload | 测试范围受控故障，不能遗留被声明可消费但对象不存在的 evidence；补偿路径明确 |
| failed R2 delete retry | 测试专用故障注入，不停全站R2；pending保留、消费拒绝、安全重试最终一致 |
| legacy Storage playback | 专门隔离的合法 legacy fixture可播放；不使用真实旧学生对象；不尝试搬迁 |
| concurrency | 专用测试 evidence 的 consume/delete/re-record 两请求时序；不能用生产 SQL trigger制造回滚故障 |
| rollback rehearsal | 原消费结果不丢，pending不进入旧路径，各实例 gate一致；仅在隔离环境先完整演练 |

只记录匿名计数、测试运行标签、结果类别，不把学生语音、对象键、proof、token写进测试报告/APM。测试失败时不删除真实数据“恢复现场”。

## 14. 本阶段验证与停止

- 实际完成线上 catalog、`pg_get_functiondef/prosrc`、匿名 evidence、RLS/grants/default ACL、extensions、migration ledger SELECT 核验。
- 未执行任何生产 CREATE/ALTER/DROP/INSERT/UPDATE/DELETE/TRUNCATE；没有业务写 RPC，没有密钥生成/安装、真实对象上传/删除、PM2/部署操作。
- 未执行 4A-5 的 DB 测试 harness（会创建隔离库），也未重复把其 609 项旧结果当成本轮新增测试；本轮是只读审查，不是实现阶段。
- 只新增本报告；原 migration/gateway 摘要保持不变，生产 import/gate 搜索仍为空；`git diff --check` 文档检查通过。
- 全局 Runtime状态不提升，不更改第一章 8 Step/19 Activity/v23，不继续录音 React executor、speaking/roleplay UI或 Phase 4B。

**停止：请先审阅协调切换、密钥供给和回滚保护缺口；本报告不构成生产执行授权。**

```ini
productionMigrationReady = false
productionCallerCutoverReady = false
production migration executed = false
production caller cutover executed = false
```
