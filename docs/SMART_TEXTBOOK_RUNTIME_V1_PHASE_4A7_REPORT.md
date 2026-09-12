# Phase 4A-7：Recording Domain v2 协调接线与隔离演练

日期：2026-09-09。范围以本轮附件为准；仍属于 Phase 4A，不进入 UI 或 Phase 4B。

## 1. 结论

Recording Domain 的服务器 gate、共享 maintenance/drain/epoch、v2 CRUD/完成网关、历史读取、回滚保护及 proof key provider 已接线。隔离环境执行了真实 PostgreSQL migration、旧/新 RPC 和章节完成下游；不是仅 mock RPC 的验证。

```ini
application recording domain wiring = implemented
isolated coordinated rehearsal = passed
productionMigrationReady = false
productionCallerCutoverReady = false
nonUiRuntimeReady = true
compat.learning.v1 = unsupported
compat.teacher.v1 = unsupported
runtimeReady = false
production migration executed = false
production caller cutover executed = false
```

两个 production Ready **不以测试通过自动放行**：首次从没有 coordinator 的线上版本进入共享围栏，仍需真实发布实例清单、旧实例停写/在途请求排空与逐实例配置确认；生产 key 的保管负责人及 Phase 4A-6 发现的高权限 catalog reader 对 keyring 的可见性还需安全批准。本轮只实现配置接口并用临时测试 key 演练，没有做这些生产动作。第 12 节列出精确边界。

## 2. 文件与统一 Gateway

新增：

- `src/lib/recording-domain.server.ts`：`recordingEvidenceV2`、`withRecordingDomain`、`RecordingDomainRequest`、`EnvironmentRecordingProofKeyProvider`、`supabaseRecordingRpc`、闭合 `RecordingDomainError`。
- `src/lib/recording-domain-gateway.server.ts`：`recordingActivityBinding`、`createRecordingGateway`，统一 `upload/read/restore/playback/remove/consumable/speak/roleplay`。
- `supabase/migrations/202609090002_recording_domain_coordination.sql`：3 张私有协调表、2 个 service-role-only 请求 RPC、1 个仅 operator 使用的控制函数；没有修改 evidence/attempt 的既有列、旧 RPC 或历史对象。
- `tests/smart-textbook-runtime-4a7-domain.test.mjs`、`tests/smart-textbook-runtime-4a7-rehearsal.test.mjs`。
- `tests/fixtures/recording-4a7-entry.ts`、`recording-4a7-schema.mjs`、`recording-4a7-transport.mjs`：同一服务器 bundle、真实 SQL 依赖、隔离 Supabase-shaped transport。

修改的业务文件仅 3 个：

1. `src/app/api/digital-textbook/recordings/[activityId]/route.ts`：导出 GET/POST/DELETE 统一先进入 `recordingRoute → withRecordingDomain`；原分支成为非导出的 legacy handler。
2. `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts`：speaking 的正式提交包裹统一域；原 grader 不改，其他活动不切 v2。
3. 同目录 `smart-textbook-actions.ts`：`completeDialogueRoleplayAction` 的提交和 mount/history 同步都使用同一个 gate；v2 不再在 RPC 后应用层 UPDATE consumed。

`RecordingControl`、`DialogueRoleplayPractice`、正式学生路由、`SmartTextbookShell`、`ContentRenderer`、Renderer Registry、Phase 3E speech selector 均未在本轮修改。工作区已有其他任务的改动，不属于本报告实施范围。

## 3. Caller migration matrix

以下 v1/v2 是**代码路径**，不是声称线上已部署。

| Caller | 默认/回滚 v1 | 授权 cohort v2 | 共同边界 |
| --- | --- | --- | --- |
| POST recording | 原上传语义；拒绝客户端注入私有控制字段 | 新 UUID、R2、服务器 metadata/binding、HEAD size/MIME | 同一个 request lease |
| GET evidenceId | 保留旧读取限制 | owner/activity 读取 + decoder 选择 R2/legacy Storage；independent/roleplay 不再天然 404 | gate + 私有引用；不回传 object key |
| GET historical restore | 原 repeat lookup | independent、role turn、repeat/full recall lookup → 安全 recording DTO | consumed/过期可恢复；pending/上传中不可用 |
| DELETE | 原后端；域回滚保护先执行 | claim → 正确后端 DELETE → finalize | 每个阶段检查 epoch；不删除 consumed |
| re-record cleanup | 原清理分支；新增跳过已知 consumed 记录 | 与 DELETE 同 `remove`；只处理创建时间早于本次的新录音前序记录 | 不清理仍在 PUT 的 identity |
| failed-upload cleanup | 原旧分支保留 | 已有服务器 row/UUID 才 PUT；确定失败通过 claim/finalize 补偿 | 不确定 PUT 保留共享预约，不假装清理完成 |
| speaking verify | 原 verifier，但位于已授权 v1 域内 | decoder、owner/binding、age/state、R2 HEAD 或显式 Storage 元信息 | 不将 R2 送进 Storage verifier |
| qualified speaking | 原 speaking RPC | 原 grader → proof → `record_smart_textbook_speaking_attempt_v2` | correctness/score 保持 null |
| non-qualified speaking | 原不合格 attempt | 同 v2 verifier/lease → 原 generic 8 参数 RPC，qualification=false | 不消费 evidence，不增加新评分 |
| roleplay complete | 原 generic + consumed 更新，仅安全 v1 scope | required turns → proofs → `complete_smart_textbook_roleplay_v2` | SQL 内单次 attempt/批量消费 |
| roleplay mount/history | 同 Action | 可信 completed attempt/progress read；并发 duplicate 回读 | 不因重试新增 attempt |
| RecordingControl / RoleplayPractice | 请求形状不变 | 同一 Route/Action 自动选择域 | 浏览器不必理解 epoch、proof、backend |
| guided repeat marker | 既有 Action/table 不变 | 同左；不是 evidence 消费 | 两轨/14 segment 稳定 ID 不变 |
| full recall / repeat recording | 同 recording Route | 同 v2 CRUD/claim | 不把录音或播放当正式完成 |
| 旧 progress loader | 既有 attempts/page/repeat SELECT | 同左 | 无迁移、无清零 |
| platform-owner Runtime preview | 既有 trackingDisabled 旁路保留 | 本阶段没有将它接入正式 recording persistence | 未新增 Preview Recording UI |

`verifySpeakingRecordingEvidence` 本身保留旧 Storage 实现；正式 speaking 调用必须经过外层 gate，v2 明确不调用它。Preview 仍走原只读/不写正式完成的路径，不能把这里的演练当成 Runtime preview 录音已实现。

## 4. Gate、维护围栏与 epoch

`recordingEvidenceV2(env, trustedOwner)` 只接受服务器环境和认证得到的 tenant/student：

- `RECORDING_EVIDENCE_V2_ENABLED`：仅 `true`/`false`，默认 false。
- `RECORDING_EVIDENCE_V2_SCOPE`：严格 JSON 数组，每项只有 tenantId/studentId UUID；不接受任意表达式、客户端 header/query/cookie/body。
- `RECORDING_EVIDENCE_V2_EPOCH`：正安全整数。
- `RECORDING_EVIDENCE_INSTANCE_ID`：服务器实例标识，协调模式必需；必须由发布清单登记，不使用浏览器身份。

DB `domain_control` 保存 authoritative epoch/state/enabled/cohort；`domain_instances` 是 operator 核对的全部实例和 acknowledged_epoch；`domain_requests` 保存每个正在执行请求的 owner/domain/epoch。环境决定预期域，DB 再独立检查实际域；不匹配就拒绝。

V1 采用**全 Recording Domain 的保守维护围栏**，cohort 决定 learner 的 v1/v2。即切换时全部 recording 请求先暂停，而非实现复杂多租户独立调度。

```text
open
  → draining：拒绝新 admission；已进入请求允许完成及补偿
  → leases = 0
  → fenced
  → 所有登记实例确认下一 epoch / gate / cohort 配置
  → switch：epoch 只递增，不回退
  → open
```

所有 control/admission/check/release 操作先锁同一个 control row。切换要求没有任何请求；old epoch 的 `beforeWrite` 拒绝。真实业务 RPC 和外部 PUT/DELETE 前均重新检查。检查到真实写入之间的时间窗由仍存续的 shared lease 保护——**不是**把一次客户端配置读取当成数据库锁。

`AsyncLocalStorage` 只传递本请求的句柄，既不存储多实例 gate，也不作为排空锁。没有进程 Map 协调、无按时间自动过期的 request lease。进程崩溃/网络结果不明可留下阻断，必须确认旧进程和远端 I/O 已终止后由 operator 安全处置；本轮未实现自动强制清除，也没有提供 web 解除围栏入口。

### 4.1 首次部署前的 bootstrap 边界

为了不让**尚未安装任何新 RPC、未配置 gate 的旧生产环境**立刻失效，只有精确 `PGRST202 + recording_domain_request_v1 missing + 全部 gate 配置缺省` 才允许 bootstrap v1；每次写前 SELECT 确认该 owner 没有 runtimeBinding/lifecycle。连接失败、权限错误、已配置 gate、epoch 冲突均不能降级。

Bootstrap 没有共享 lease，不能在仍有 bootstrap/旧构建实例服务时做首次 cutover。首次安装必须由发布维护层阻断并排空旧流量、结束旧实例，再统一配置新实例，安装 fenced coordinator，核验 PostgREST schema cache 后才开放。**不能仅凭 DB 的 leases=0 判断未接线旧实例已经排空。** 本次两实例演练覆盖登记后的实例；未伪造真实部署清单确认。

## 5. Upload、读取与 lifecycle

### 5.1 Canonical R2 与确定补偿

V2 upload 使用服务器 UUID，严格 MIME/2 KiB–10 MiB，服务端校验角色 scene/side/turn 与现有 node lines；客户端只能提交旧录音/练习字段。`backend/objectKey/object_key/runtimeBinding/lifecycle/tenantId/studentId/score/completion` 等不在允许字段中。

`runtimeRecordingMetadata` 复用 Phase 4A-5 闭合 decoder，服务器写 `storage=r2`、`lifecycle=active` 与 binding。新旧 kind 和路径不猜测、不尝试 R2 失败后转 Storage。

流程为：

```text
reserve 新 evidence UUID（shared request）
→ insert 精确服务器 evidence row
→ PUT
→ HEAD existence/byte size/content type
→ settle upload reservation
→ 清理旧未消费 evidence（相同 remove gateway）
→ 安全 DTO
```

提前建 row 是为了让失败补偿具有真实 claim 对象，不是表示音频已 ready。`recording_domain_upload_v1` 的预约使上传中 identity 不可读/消费/删除。reserve 必须在 row 存在前；同 UUID 以后不能再次 reserve/PUT，因而 settled 检查不会与随后重用同 UUID 的新上传竞争。

HTTP 失败或 HEAD 不匹配：settle 已结束 PUT → claim delete-pending → 外部 DELETE → finalize。DELETE 失败保留 pending。网络异常无法确认 PUT 是否结束：不 settle、不删除、不自动 release；保留共享阻断。这里没有宣称 PostgreSQL 与 R2 是分布式原子事务。

### 5.2 Restore 与 completion 不混用

`read/playback/restore` 校验 owner/activity 和严格 row decoder；历史 consumed/过期只影响消费资格，不阻止本人回听。R2 使用现有签名工具，legacy 使用旧 bucket 签名读取，两者都经服务器代理返回字节；签名 URL、私有 object identity 不返回 UI。

正式消费另校验 24 小时、未消费、active、owner、activity、version、binding 与对象 HEAD。读取不是新的学习证据，GET 不写 attempt/progress。

DELETE/re-record 调用既有 `deleteRecordingV2`；SQL claim 在 evidence row lock 下拒绝 consumed，pending 可重试；外部成功后才 finalize。确定 R2 DELETE 失败保留数据库行。旧 v1 清理也新增“已知 consumed 直接跳过”，没有把旧非原子流程描述成已修复的 v2 流程。

## 6. Speaking、roleplay 与 binding

`recordingActivityBinding` 从已授权 activity 的 node→module→chapter 获取真实 version，并对当前 version/activity/public_config/node.content 生成 source digest。旧 UI 新上传的 binding：

- snapshot = `recording-domain:<versionId>`（明确是旧域快照标识，**不是**伪造 Lesson Manifest Snapshot）。
- sourceRevision = 当前可信配置 digest。
- versionId、activityRef、recordingKind。

已有 runtimeBinding 必须与当前服务器期望完全一致；没有 binding 的历史 evidence 按 Phase 4A-5 显式 legacy 规则处理，不批量补绑定。读取允许历史回听；新的正式完成不能忽略绑定。

本 gateway 是旧浏览器 Recording Domain cutover 的实现。它不接受浏览器声明 Manifest snapshot，也没有宣布未来完整 Runtime session/private ActivityRef 桥已实现；真正 Runtime Recording Executor 仍未接入。

Qualified speaking：原 `gradeSmartTextbookActivity` 不变，再调用既有 `consumeSpeakingV2`/proof/v2 RPC；结果仍 null/null。Non-qualified：严格 response、同 backend verifier、same lease/epoch 后调用旧 generic qualification=false，不消费 evidence，不新建判题系统。

Roleplay：当前 node 的 scene.lines/parity 定 required turns；每 turn 最新 active row 经绑定和 HEAD proof 后交给既有原子 RPC；SQL 再独立确认 coverage/owner/scene/role/turn/version，固定顺序锁行并原子消费。并发 duplicate 只通过 owner/activity/version 的正式 completed attempt/progress 回读映射为已完成，不根据客户端声称成功。应用层不再执行 v2 consumed UPDATE。

## 7. Rollback compatibility

回滚也是 drain→fence→下一 epoch→v1，而非裸改一个 Boolean。DB admission 与 bootstrap fallback 都检查整个 learner scope 是否存在 runtimeBinding 或任意 lifecycle：有就拒绝 legacy lane，包括 active、delete-pending、consumed。没有 v2 状态的 learner 可继续原 v1。

此实现选择 **fail closed**，不是在 v1 回滚状态下强行让所有 v2 历史录音继续可听；如需查看，可恢复安全 v2 服务后通过其授权 reader。不会删除证据、去掉 metadata 或重绑 revision 来制造兼容。

必须回滚到**仍带本 gateway 的兼容应用版本**；原始无 gate 的旧二进制不能安全带着 v2 state 恢复流量。运营直连 SQL、脚本、tenant/student/activity 级联删除也不受应用 lease 自动保护，必须包含在发布维护冻结清单。

## 8. Proof provider 与错误语义

`RecordingEvidenceProofKeyProvider` 为 server-only 接口；环境实现仅读取：

- `RECORDING_EVIDENCE_PROOF_KEY_ID`
- `RECORDING_EVIDENCE_PROOF_SECRET_HEX`（32–64 bytes 的 HEX）

不读 NEXT_PUBLIC、请求参数或浏览器 cookie。缺失/格式错 fail closed；public response 不含 proof、key、对象路径或原始数据库错误。Phase 4A-5 的 HMAC/45 秒 proof 与 SQL keyring 校验保持不变。

`supabaseRecordingRpc` 必须解包 `{data,error}`：即便 data 看似成功，只要 error 非空就拒绝；无 error 但 data=null 也拒绝。错误分类为 duplicate/conflict/consumed/pending/proof-invalid/max-attempts/unavailable/fenced/invalid；旧 SQL 的组合 `NOT_CONSUMABLE` 映射 conflict，不凭空断言具体是过期还是已消费。

演练使用随机内存 ephemeral key，测试库 keyring 包含初始/轮换 key；验证缺 key、错 key、禁用 key 均不能产生 attempt，启用正确轮换 key 才可消费。没有生成、打印、保存或安装生产 secret。

生产仍按 4A-6 方案：密钥管理员负责 secret-manager 注入与 DB keyId 对齐；先装验证 key 再切 signer，等待旧 proof TTL/在途请求排空后禁旧 key；不通过日志/Markdown/migration 放明文。`pg_read_all_data` 等特权运维主体的 keyring 可见性是实际信任边界，不能声称本 provider 消除了它。

## 9. 更完整的隔离 rehearsal

执行环境：Docker `postgres:15-alpine`，`--network none`、tmpfs、无宿主端口/volume/env-file，不使用 Supabase production URL、真实 R2 或普通学生数据。结束停止并销毁测试容器，只有合成行和临时 key 被清除。

`recording-4a7-schema.mjs` 在空库加载/补齐：

- 原 evidence migration `202608180023` 和 roleplay metadata DDL；不执行教材种子。
- attempt/node progress 使用 `202607310013` 的实际 CREATE TABLE，含 PK、FK、CHECK、defaults；qualification 列与现行 generic 8 参数 RPC；generic 7 参数用 `202608180027` 实际定义。
- synthetic auth/users/profiles/tenants/student_applications/version/chapter-test 父级记录；chapter/module/node/activity 真实第一章结构，8 Step/19 Activity。
- `private.set_updated_at` 实际函数。
- `private.sync_smart_textbook_chapter_completion` 使用 `202608180007` 实际函数体并挂接 node progress trigger。
- ebook 所需父级 FK、唯一约束、范围约束、completion_source/read_pages/reading_seconds 等字段。
- `sync_student_app_ownership` 与 `validate_student_app_activity` 使用现行仓库实际函数，挂接 ebook 所需 trigger；service-role 路径与现有语义一致。
- Phase 4A-5 `202609090001_recording_evidence_atomic_v2.sql` 和新 coordinator migration 原文执行。

DB transport 保留 Supabase `{data,error}`/查询调用形状，但发出真实 SQL；proof signer、Route、原 submit/roleplay Action 都在同一服务器测试 bundle 中执行。只有正常认证上下文、R2/Storage I/O 被隔离替换，不伪造 RPC 成功。

这不是整个 437 migration/Supabase 托管平台的复制：auth/RLS 浏览器端集成、PostgREST schema cache 行为和生产 PG17 权限环境不能由 PG15 隔离库完全证明；4A-6 的实际 catalog 证据仍只是其当时的时间点核验。未把合成 auth 当真实 owner E2E。

演练顺序：v1 原 Storage completion → 安装 v2/coordination → gate=false 旧 UI upload → 两实例 drain/fence/epoch → cohort v2 → CRUD/qualified/non-qualified/roleplay → 延迟与失败补偿 → key rotation → 原章节/ebook trigger → rollback → 不确定 PUT 保留围栏。

## 10. 测试与回归

Phase 4A-7 单元及真实 SQL 演练包括：gate 配置/跨 scope、provider、Supabase error；匿名/应用控制权限拒绝；两实例和旧 epoch；未排空不得 fence；旧 UI form；HEAD；GET/restore；历史 Storage consumed/expired；full recall；单证据两并发仅一个 attempt；roleplay 两并发仅一个正式 attempt且重复回读；DELETE pending 重试；延迟 PUT、上传中 GET/DELETE 拒绝、延迟 cleanup；客户端私有字段注入；不确定 PUT 不放行切换；rollback v2 状态拒绝和无 v2 状态允许。

章节触发器测试执行原 generic RPC 合成其他已完成活动，真实形成 8 个 completed node，并把 ebook progress 更新为 100 / smart_textbook；没有把它当作“UI 真的学完一章”的证据。4A-5 原并发/rollback/proof/consume-vs-delete 测试保留。

回归 fixture 的必要调整：

- 4A-3/4A-4 合成 transport 增加精确 missing-coordinator 响应，仍执行新 gateway 的 legacy guard；原 defect 诊断没有删除。
- 服务器测试 bundle 加 server-only marker；submission 用服务器 bundle 执行，避免 Node 裸 TS 无法解析服务器 alias。
- Phase 3E 原测试对整个 `smart-textbook-actions.ts` 的 hash 冻结改为 4A-7 获准修改的例外；Agent/events/speech Route 与旧 Shell 的 hash 保护仍在。不是把新 Action 的 hash 填回旧基线蒙混通过。
- 4A-5 隔离 harness 仅增加可选 beforeV2 hook，默认路径不变；旧 migration/server protocol 文件未改。

最终合并测试：**651 / 651 通过，0 failed、0 skipped**。其中 Phase 4A-7 新增 42 项（25 个 gate/provider/error 测试 + 17 个真实 SQL rehearsal 测试，后者包含外层测试计数）；既有 Phase 3A–3E、4A/4A-2/4A-3/4A-4/4A-5 与 legacy 合计 609 项通过。现有浏览器测试也包含在 `smart-textbook-runtime-4a*.test.mjs` 中；这不等于真实登录 owner E2E。

最终 TypeScript 检查通过（exit 0）；`git diff --check` 通过。隔离测试容器均已正常停止，未留下运行中的 recording test PostgreSQL。

执行的合并命令（日志用 TAP 统计，pipeline 开启 pipefail）：

```bash
node --no-warnings --experimental-strip-types --test --test-reporter=tap \
  tests/smart-textbook-runtime-v1.test.mjs \
  tests/smart-textbook-legacy-adapter.test.mjs \
  tests/smart-textbook-readiness.test.mjs \
  tests/smart-textbook-final-readiness.test.mjs \
  tests/smart-textbook-speech-selection.test.mjs \
  tests/smart-textbook-sidebar.test.mjs \
  tests/learning-agent-*.test.mjs tests/teaching-video.test.mjs \
  tests/teacher-kim-*.test.mjs tests/teaching-blackboard.test.mjs \
  tests/smart-textbook-runtime-4a*.test.mjs
npm run typecheck -- --incremental false --pretty false
git diff --check
```

## 11. Migration 安全自审

| 项 | 结果 |
| --- | --- |
| Forward-only | 只创建私有协调对象，不 DROP/替换旧 RPC，不修改真实 evidence/attempt 行 |
| SECURITY DEFINER | 仅公开 request/upload RPC；固定空 search_path，所有关系显式 schema |
| caller 权限 | auth.role 必须 service_role；PUBLIC/anon/authenticated revoke；operator transition 连 service_role 也无 EXECUTE |
| 私有表 | RLS enabled；应用、anon/authenticated 无直接权限；只有 DB operator 管实例确认和 transition |
| SQL injection | 控制函数没有动态 SQL；operation 闭合分支、UUID 参数、cohort 形态校验 |
| 锁顺序 | coordinator control row 先锁；短 admission/check/release transaction；实际 consume 内保持 4A-5 activity→evidence 顺序 |
| 外部 I/O | 不把数据库锁长持到 R2 请求；共享 lease 保留其生存期，cutover 必须 leases=0 |
| crash/retry | 无 TTL 自动解锁；不确定上传保留预约；pending delete 有安全重复 claim/finalize |
| rollback | scope 有 runtimeBinding/lifecycle 就拒绝旧写；epoch 单调递增 |
| 权限限制 | 不会阻止有权直连修改 DB 的管理员绕过协议；发布必须冻结这些旁路操作 |

Phase 4A-5 文件摘要仍为：

```text
202609090001_recording_evidence_atomic_v2.sql
664025f0a2c3f2874bad561e45fad2b63ccb6d12faa559b1ffbff6c39b9d34fa
recording-evidence-v2.server.ts
8790dbe6bf06d16a39281f326e22429d153f735c016b72ebba9d1ac0662d01b8
```

## 12. 剩余生产前置与停止点

1. **首次 bootstrap→coordinator 切换仍需生产维护窗口证明**：登记清单不能靠任意实例自行消失；operator 应据真实 release/实例探针确认 acknowledgements。测试里的 app-a/app-b 是两个协议参与者及独立 PG 请求，不是已经核验 PM2 的真实进程。
2. **生产 key provisioning/security approval 未执行**：provider 实现、临时 key 轮换验证已完成；真正 secret manager/DB keyring 操作、保管责任及高权限读者可见性审查仍待授权。
3. **生产适用性需重新只读核验**：本轮没有重新连接生产 catalog；新 coordinator migration 也未获得生产部署授权。不能使用批量 db push 顺带部署工作区其他 migration。
4. **不确定 I/O 的运维恢复需人工确认**：实现选择安全停写，未开发自动修复 worker。恢复前确认远端 PUT 不再进行；不能仅因请求超时/实例失联就删 lease。
5. **真实浏览器 owner E2E 未完成**：本轮没有可用的已授权本机登录会话，也没有冒用账号、magic link 或复制 cookie。没有做完整 Runtime Recording UI，因此 Runtime capability 仍 unsupported。

由此 productionMigrationReady=false、productionCallerCutoverReady=false；这不否认已完成的应用接线及隔离演练，而是未把部署前置当成已经发生。

第一章 source/Manifest 仍为 8 Step、19 Activity、orientation 三题、v23 legacy；没有 teacher video、Manifest schema 或稳定 ID 变更，没有正式学生路由切换，没有删除 legacy，没有生产数据库/录音对象操作。完成报告后停止，不进入 Recording Runtime UI 或 Phase 4B。

```ini
production migration executed = false
production caller cutover executed = false
```
