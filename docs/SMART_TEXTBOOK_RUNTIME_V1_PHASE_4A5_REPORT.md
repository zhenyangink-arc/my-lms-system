# Phase 4A-5：Recording Evidence 原子事务层

日期：2026-09-09。本阶段仅实现并验证版本化领域后端；未部署、未接入生产调用、未继续 Recording UI。

## 1. 结论与边界

新 v2 协议已在真正隔离的 PostgreSQL 中执行 migration，验证 speaking/roleplay 原子消费、并发互斥、故障回滚、删除 claim/finalize 与重试。不是仅 mock RPC 的测试。

```ini
atomic v2 protocol isolated verification = passed
canonical recording backend = R2
legacy compatibility backend = Supabase Storage
nonUiRuntimeReady = true
compat.learning.v1 = unsupported
compat.teacher.v1 = unsupported
runtimeReady = false
production callers switched to v2 = false
production student route switched = false
owner browser E2E = 未完成（本阶段无正常授权浏览器会话验收）
```

**隔离验证通过不等于生产领域链已经修复。** 旧 Route/verifier/Action 仍未切换，Phase 4A-4 指出的生产路径不一致仍需后续经授权的统一接入。不能把一半入口切 v2、另一半保留无 claim 的旧删除逻辑。本轮不进入该部署/切换，也不以事务层完成为由提升 Runtime capability。

## 2. 文件与既有依据

本轮新增，未修改历史 migration：

| 文件 | 用途 |
| --- | --- |
| `supabase/migrations/202609090001_recording_evidence_atomic_v2.sql` | forward-only migration：4 个 v2 RPC、私有验证函数、签名 keyring |
| `src/lib/recording-evidence-v2.server.ts` | server-only metadata decoder、proof issuer、原 grader 适配、v2 调用及删除网关 |
| `tests/fixtures/recording-v2-bootstrap.sql` | 纯合成隔离 DB 依赖 DDL，不是生产 migration |
| `tests/fixtures/recording-v2-postgres.mjs` | 自建/清理隔离 PostgreSQL；独立 psql 连接执行真实 SQL |
| `tests/smart-textbook-runtime-4a5-db.test.mjs` | 58 项真实 SQL/并发/安全/协议测试 |
| `tests/smart-textbook-runtime-4a5-proof.test.mjs` | 28 项服务端 proof/decoder/gateway 测试 |
| 本报告 | 结果、证据与尚未部署边界 |

重新查阅 Phase 4A-4 报告、原 recordings Route、`verifySpeakingRecordingEvidence`、`submitSmartTextbookActivityForContext`、`completeDialogueRoleplayAction`、R2 helper 和 Phase 4A-3/4A-4 证据测试。原无评分完成规则来自课程目录下 `smart-textbook-submission.ts → gradeSmartTextbookActivity`。

真实 SQL 依赖：

- `202608180008_open_activity_unscored_mastery.sql` 的八参数 `record_smart_textbook_attempt`。测试直接加载原函数全文，不替换内部 attempt/progress 实现。
- `202608180023_speaking_recording_evidence.sql`：原 evidence 表、RLS、旧 speaking RPC，隔离库执行该 migration 全文。
- `202608230010_add_chapter_one_dialogue_roleplay.sql`：加载既有 metadata ALTER DDL；不执行其中教材 seed。合成 node/scene/learner 代替真实学生数据。

## 3. Migration 与新 RPC

| RPC | 原子边界 / 返回 |
| --- | --- |
| `record_smart_textbook_speaking_attempt_v2` | learner/activity advisory lock → evidence `FOR UPDATE` → scope/age/state/binding/proof → 原八参数 attempt RPC → consumed；返回原 attempt/progress 字段的 JSON |
| `complete_smart_textbook_roleplay_v2` | learner/activity advisory lock → 锁内查已有完成 → 按 UUID 顺序锁 required evidence → coverage/scene/role/turn/proof → 原 attempt RPC → 全部 consumed；已有完成明确抛 duplicate/conflict |
| `claim_smart_textbook_recording_delete_v2` | 相同 activity lock + evidence row lock → owner/version/binding/backend → unconsumed 才能进入 `delete-pending`；重复 claim 返回相同目标 |
| `finalize_smart_textbook_recording_delete_v2` | 相同锁序；只能删除 `delete-pending` 且未 consumed 的行；重复 finalize 返回 `already-absent` |

没有 DROP/覆盖旧 RPC，没有新增 evidence 列，没有改 attempt/node progress 结构或历史行，没有内容 seed、对象迁移、旧录音清理。新增的唯一表是非公开 `recording_private.proof_keys`，用于独立保管 HMAC 验签密钥，不是第二套 evidence/progress 表。

Migration 依赖既有表与八参数函数；“可重建”指从依赖 DDL 加本 migration 在全新测试库重建，不是要求同一 migration 在同库重复 CREATE。两个全新隔离库均已验证安装，覆盖 pgcrypto 已在 `public` 和尚未安装、由新 migration 安装到 `extensions` 两种状态。没有移动既有扩展。

## 4. Speaking atomic consume

`consumeSpeakingV2 → issueSpeakingCompletionProof → record_smart_textbook_speaking_attempt_v2`。

应用签发前仍调用**原** `gradeSmartTextbookActivity`，只有原规则认定 `meetsCompletionRequirements=true` 才签发 completion proof；时长/criteria 不足明确拒绝，不发明发音分数。非合格 attempt 的原业务分支没有在本轮重写。

SQL 锁内核对 evidence owner/activity、activity→node→module→chapter 的 version、24 小时年龄（也拒绝未来 created_at）、消费双字段、lifecycle、Runtime binding、对象/metadata/response 摘要、proof 签名和 TTL。只允许 independent-output / legacy-speaking；练习跟读或 roleplay-turn 不能直接当独立 speaking completion。

调用原八参数 attempt 函数时，`is_correct=null`、`score=null`、qualification=true；原 max attempts、node completion/mastery 聚合仍由原函数执行。随后在同一事务设置 consumed_at、consumed_attempt_number、metadata.lifecycle=consumed。第二个请求不能再产生 attempt，包括使用同 proof 或新 nonce 重签同一已消费 evidence。

## 5. Roleplay atomic completion

`completeRoleplayV2 → issueRoleplayCompletionProofs → complete_smart_textbook_roleplay_v2`。

应用从可信 scene 生成 required turns；数据库又从当前 node.content.dialogueScenes 读取同一 scene，按旧 Action 的 left/right 奇偶话轮规则独立导出 coverage，**不是接受客户端给出的 required turns**。这些旧 index 只存在于私有领域协议，不修改 Runtime frozen stable identity。

在 activity 锁内检查同 learner/activity/version 是否已有合格 attempt。已有即报 `RECORDING_ROLEPLAY_ALREADY_COMPLETED`，不声称请求携带的新 snapshot/evidence 已验证完成。其余情况下按 UUID 排序锁行，检查每个 owner/activity/version、scene、role、turn、完整且无重复的 coverage、age、active、runtimeBinding 和单 evidence proof。

复用原 attempt 函数，response 保持 `{sceneId, roleSide, recordedTurns}`，无正确率/分数。全部 required evidence 的 consumed_attempt_number 指向同一次 attempt。没有“RPC 成功后应用再 UPDATE consumed”。

## 6. Delete / re-record lifecycle

```text
active/unconsumed ──consume transaction──> consumed（拒绝删除）
        │
        └──claim transaction──> delete-pending（拒绝消费）
                                  │
                             外部对象 DELETE
                             失败：保留 pending，可重试
                             成功：finalize transaction 删除 DB 行
```

显式 DELETE 和重录清理复用 `deleteRecordingV2`，不各自判断 consumed 再直接删对象。新录音应使用新 UUID/不可变对象键；“重录”不是覆盖旧 evidence 对象。

claim 返回的 backend/objectKey 是 **server-private DTO**，不进入客户端。网关只调用对应后端的删除能力，成功后才 finalize；外部错误直接传播，不执行 finalize。并发重复 claim 可得到同一 pending 对象，外部删除适配器必须沿用已存在的“对象不存在视为已删”的幂等语义。finalize 超时/丢响应可安全重试；已无行返回 already-absent。claim 在行已不存在时仍报不存在，调用者不能把所有异常都吞成成功。

PostgreSQL 不知道 R2 DELETE 是否成功，**这不是跨存储分布式事务**。本轮网关测试使用可失败的隔离 DELETE adapter，没有调用真实 R2/Storage 删除。

## 7. R2 proof 协议与密钥

`ObjectProof = {keyId, payload, signature}`，payload 为规范化 JSON，signature 为 HMAC-SHA256。

| 签名字段 | 作用 |
| --- | --- |
| protocol / purpose | 固定 `recording-object-proof.v2`；speaking-completion / roleplay-completion 不互换 |
| evidenceId / tenantId / studentId / activityId | 单 evidence、单 owner、单活动 |
| versionId / runtimeBinding | 单教材版本、snapshot/source revision/activityRef/kind |
| backend / recordingKind | 明确后端与证据种类，不允许 fallback 猜测 |
| objectDigest | SHA256(backend + 完整对象身份)；payload 不保存对象键 |
| metadataDigest | 锁定行全部 metadata 摘要，包含 Runtime binding 与 lifecycle |
| byteSize / mimeType | HEAD 元信息必须与 evidence 行相等 |
| responseDigest | 完成请求内容也纳入签名；不能签好后更换 criteria/scene/turns |
| issuedAt / expiresAt / nonce | 签发 45 秒有效，SQL 上限 60 秒；256-bit 随机 nonce |

默认 R2 HEAD 调用现有 `src/lib/r2.ts → checkR2ObjectExists`。必须存在、size 完全一致、标准化 content type 与行 MIME 相同；路径先通过可信行 decoder。没有 `verified=true` 客户端布尔值。SQL 以 `clock_timestamp()` 检查 TTL，包括等待锁的时间，而不是仅用事务开始时刻。

keyring 为空或 key disabled 均 fail closed。migration 不含任何 secret；未来需经独立授权，通过运营者安全通道把同一高熵密钥置于应用 secret provider 和私有 keyring。仅数据库运营角色能管理 keyring；service_role 也不能 SELECT 它。keyId 支持轮换/撤销，撤销会拒绝尚未完成的 proof，需重新 HEAD/签发。

应用测试只使用本轮随机合成密钥和 fake HEAD，DB 测试只把该密钥写入一次性隔离库；不读取生产密钥或环境文件。Proof 本身含 owner/private binding，**也不能发送浏览器**；不仅仅是 secret 不公开。新文件有 `server-only`，没有 Route / Server Action / 客户端 import。

nonce 不另建消费表：同 evidence 的 consumed 行锁是单次消费依据。事务回滚后、TTL 内的 proof 可重试；事务成功后任何 nonce 都不能再次消费该行。前提是 evidence UUID 与对象身份不可复用、不可原地覆盖；不要把 HEAD 当成实际音频内容/发音质量证明。

## 8. Legacy Storage 兼容

`decodeRecordingEvidence` 与 SQL `recording_private.identity` 解释明确 variant：

- 完整 R2 prefix + known independent/roleplay/repeat metadata → R2。roleplay/repeat 旧 metadata 没有 storage 字段仍可明确解析。
- 完整旧 Storage 路径 + 既有 legacy-speaking metadata → legacy-supabase。
- storage 与路径冲突、未知 variant、异常 owner/evidence 文件名、未知 metadata 字段 → 拒绝。

不先查 R2 再猜 Storage。legacy 应用 verifier 由显式 headLegacy adapter 注入，SQL 还在事务内核验原 bucket 的 `storage.objects` 精确名称、size、MIME；R2 分支不查 Storage 对象表。原旧 speaking RPC 在 migration 后实际执行仍通过，历史 evidence 不需要强制 Runtime 绑定或搬迁对象。

当前 production GET 中 `isGuidedRepeatMetadata` 的限制、旧 DELETE backend 分支、旧应用 verifier 尚未改动。本轮只为后续一致接入提供可执行 v2 领域边界，不声称已修复上述线上行为。

## 9. runtimeBinding 与服务器信任边界

`runtimeRecordingMetadata()` 在未来服务器创建新 evidence 行时生成：

```text
metadata.runtimeBinding = {
  snapshot, sourceRevision, versionId, activityRef, recordingKind
}
```

闭合 Zod schema 拒绝未知字段；已有 binding/lifecycle 的对象不能通过此创建 helper 重绑。SQL 锁内比较整份 binding，核对 version 和 kind；NULL 只表示未绑定 legacy domain，不是绕过 Runtime binding 的方式。历史没有 binding 的行不能直接传当前 snapshot 完成。

新 gateway 是内部 DAL，**不是新认证入口**。将来调用者仍须通过正常 active-user/session 授权、私有 activity binding 和 source revision reader，生成可信 RecordingScope；不能从 HTTP body 复制 owner、snapshot、source。SQL 能核对 row/proof/expected binding 与教材 version，不会凭空读取一个尚未部署的 Manifest snapshot 表，也不代替正常身份验证。

本轮没有在现有 POST 自动写入 binding，没有修改线上录音创建行为。Preview 也未连接这套正式完成 RPC；继续 trackingDisabled，不以客户端 mode/Boolean 选择正式 persistence。

## 10. 真实并发 / 回滚 / 删除测试结果

| 隔离实验 | 结果 |
| --- | --- |
| 同 speaking evidence，两条独立 psql 连接并发消费 | 1 成功、1 拒绝；仅 1 attempt、consumed_attempt_number=1 |
| 相同 roleplay，两条连接并发 completion | 1 成功、1 already-completed conflict；2 个 required turn 均绑定 attempt #1 |
| speaking：attempt 已插入后触发 consumed UPDATE 故障 | attempt、node progress 全部回滚，evidence 未消费 |
| roleplay：第二条 evidence consumed UPDATE 注入故障 | 已插入 attempt、第一条 consumed 更新及 progress 一并回滚 |
| consume vs explicit delete / re-record cleanup | 只能一种状态胜出，不会同时消费与进入 pending |
| 控制 consume 先持锁 / delete 先持锁 | 从 pg_stat_activity 观察另一连接真实 Lock 等待；随后明确 conflict |
| evidence 行锁 | 一个连接持 FOR UPDATE，另一连接 lock_timeout；不是内存 mutex |
| two delete / delete retry | 重复 claim 一致；pending 拒绝 consume；finalize 可重试 |
| 真实 SQL + 网关，外部 DELETE 注入失败 | DB 保持 pending；重试成功后才删除 DB 行；0 attempt |
| fake/expired/revoked proof、跨 owner/activity/version/snapshot/source、错 size/MIME/path/backend、错 purpose/response、未知字段 | 均拒绝，无正式 attempt |
| 原 max-attempts 规则 | 原 RPC 拒绝后 v2 evidence 未消费 |

测试容器由 harness 自建：`postgres:15-alpine`，`--network none`，不发布端口，不挂主机 DB volume，数据目录 tmpfs；连接仅经 `docker exec psql` 进入本容器 loopback。没有接生产 Supabase、真实学生表或 R2。结束后按本轮创建的精确容器 ID 清理，不触碰其他容器。

这验证了真实 PostgreSQL 函数/行锁/事务行为，但**不是整个项目所有历史 migration 在全新 Supabase 环境的端到端部署认证**。测试使用合成依赖表，加真实必要历史函数/DDL和本轮 migration。

## 11. Migration 安全自审

| 项目 | 结果 / 边界 |
| --- | --- |
| SECURITY DEFINER | 仅 4 个公开 v2 RPC；固定 `search_path=''`，进入函数先检查 auth.role=service_role |
| EXECUTE 权限 | 显式 revoke PUBLIC/anon/authenticated，仅 grant service_role；真实 SQL 测试即使 authenticated 设置假 claim 也不能执行 |
| keyring / 私有 helper | 私有 schema 不授予调用角色访问；keyring RLS 开启且无客户端 policy；helper EXECUTE 也 revoke |
| RLS bypass | definer 内可读私有表/Storage；每次按服务器 scope核对 owner/activity/version，不依据浏览器身份字段 |
| SQL injection | 业务函数无动态 SQL；扩展适配仅 migration 从 pg_extension 读取 namespace，以 `%I/%L` 安全生成封闭 wrapper |
| JSON | metadata variant、绑定字段、proof claims 完整相等；Zod 与 SQL 双层校验；不含客户端 backend/score/consumed 控制入口 |
| 锁序 | 新 v2 全部 activity advisory → evidence UUID 升序 → 原 attempt 的 node advisory；同 activity 的争用真实测试通过 |
| deadlock / 旧路径混用 | **未宣称旧/新任意混跑安全**：旧 speaking 是 evidence→activity 锁序，旧 DELETE 根本无 claim。未来必须协调切换同一域的所有 consume/delete/re-record caller，不能交叉启用；数据库 40P01/40001 只能整事务重试，必要时重新 HEAD/签 proof |
| retry / rollback | 成功消费后拒绝重复；回滚不留 attempt；pending 不因删除错误改回 active；proof 过期/撤销失败关闭 |
| 向后兼容 | 保留旧函数签名/实现/权限与旧调用；真实旧 Storage RPC 及 legacy regressions 通过 |
| 外部存储边界 | proof 是短时 HEAD attestation；要求不可变对象键及统一 deletion protocol，无法防止绕过领域服务的外部管理员直接改/删对象 |

## 12. 回归与最终状态

最终执行：

```bash
npm run typecheck -- --incremental false --pretty false
node --no-warnings --experimental-strip-types --test \
  tests/smart-textbook-runtime-v1.test.mjs \
  tests/smart-textbook-legacy-adapter.test.mjs \
  tests/smart-textbook-readiness.test.mjs \
  tests/smart-textbook-final-readiness.test.mjs \
  tests/smart-textbook-speech-selection.test.mjs \
  tests/smart-textbook-sidebar.test.mjs \
  tests/learning-agent-*.test.mjs tests/teaching-video.test.mjs \
  tests/teacher-kim-*.test.mjs tests/teaching-blackboard.test.mjs \
  tests/smart-textbook-runtime-4a*.test.mjs
git diff --check
```

- Phase 4A-5：**86/86**，其中 58 项真实 DB / 协议测试、28 项应用 proof/gateway 测试。
- Phase 3A–3E、4A、4A-2、4A-3、4A-4、4A-5 与相关 legacy 合并：**609/609**，0 failure / skip / cancel；包含既有隔离 browser regressions。
- TypeScript 非增量与 diff 检查：通过。
- 第一章冻结样本 8 Step、19 Activity、orientation 三题、published v23 legacy 保持；没有改变 Phase 3D observation / Phase 3E selector，没有伪造 Teacher Video。
- 新 server-only 模块没有生产 import；没有修改 recordings Route、旧提交/roleplay Action、学生路由、Manifest 或 Renderer。生产 GET/DELETE/UI 等尚未接 v2 的问题不冒充已修复。
- 本轮唯一数据库执行发生于新建的隔离容器；没有真实录音上传/删除、生产 schema/data 写入、历史对象迁移或旧 evidence 清理。
- Recording executor、speaking-introduction、dialogue-roleplay UI 不在本轮继续实现；compat.learning / compat.teacher 仍 unsupported，runtimeReady 仍 false。

后续需要另行授权和安排：部署审查/密钥供给、所有录音领域入口的协调接入及正式认证/私有 Reader 连接。**本报告不授权、不执行这些后续动作，也不进入 Phase 4B。**

## 13. 生产 migration 执行记录

```ini
production migration executed = false
```
