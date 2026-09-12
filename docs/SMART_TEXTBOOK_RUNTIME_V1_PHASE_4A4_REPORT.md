# Phase 4A-4：Recording / Speaking Evidence 一致性审计与数据库变更前置条件

日期：2026-09-09。**停止于设计/证据阶段；没有实施领域修复或 Runtime UI。**

## 1. 结论与停止条件

```ini
DB change required = true
canonical recording backend = R2（新录音的明确目标；当前三类 POST 已使用 R2）
legacy compatibility backend = Supabase Storage（既有证据受控兼容，不迁移对象）
nonUiRuntimeReady = true
compat.learning.v1 = unsupported
compat.teacher.v1 = unsupported
runtimeReady = false
owner browser E2E = 未完成
production student route switched = false
```

**应用层单独修复不足以完成本阶段验收：**

1. `record_smart_textbook_speaking_attempt` 的仓库 SQL 强制验证旧对象路径和 `storage.objects`。应用层即使正确 HEAD 验证 R2，原事务仍拒绝 R2 evidence；不能跳过这个事务改调通用 attempt RPC。
2. `completeDialogueRoleplayAction` 先查完成记录、再调用 attempt RPC、再更新 evidence，跨越独立请求/事务。原 RPC 锁只保证 attempt 编号唯一，不保证同一证据只完成一次。隔离并发测试已复现两个成功请求、两个不同编号的 attempt。
3. DELETE、POST 重录清理与 consume 之间也缺共同原子状态边界；只修 backend 分支不能保证不会删除正在被完成事务使用的对象。

因此遵守本阶段第九、十九条：**不修改 src、不编写/执行 migration、不部署 SQL、不修改真实数据库、不继续实现 recording/speaking/roleplay executor。** 本轮仅新增本报告与隔离证据测试，等待后续明确数据库变更授权。

`nonUiRuntimeReady=true` 仍是 Phase 3E 既有 finalizer 的覆盖范围，不是本轮 recording 领域完成认证；新发现的执行阻断保持存在，不能据此提升 capability。

## 2. 事实来源与证据边界

本轮重新阅读并追踪：

- `src/app/api/digital-textbook/recordings/[activityId]/route.ts`，完整 GET/POST/DELETE，包括 POST 的旧对象清理。
- 课程目录 `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/` 下：
  - `smart-textbook-submission.ts:282` 的 `verifySpeakingRecordingEvidence`。
  - 同文件 `submitSmartTextbookActivityForContext`，包括 evidence 验证、preview 返回、合格/不合格 speaking 的 RPC 分流。
  - `smart-textbook-actions.ts:84` 的 `completeDialogueRoleplayAction`。
  - `KoreanLevelOneSmartTextbook.tsx:2427` 的 `RecordingControl`、2704 行的 `DialogueRoleplayPractice`；旧恢复和可选语音识别降级。
- `src/lib/r2.ts` 全部 helper；`src/lib/supabase/admin.ts`，原 Route/verifier 内直接调用的 Supabase Storage `.upload/.list/.remove`。
- `supabase/migrations/202608180023_speaking_recording_evidence.sql`。
- `202608230010_add_chapter_one_dialogue_roleplay.sql`（新增既有 metadata JSON；角色活动为 formative、non-gating、R2）。
- `202608180008_open_activity_unscored_mastery.sql`（实际八参数 open activity RPC）、`202608180027_restore_objective_activity_recording.sql`（七参数重载，不是取代八参数 RPC）。
- `202607310013_smart_digital_textbook_chapter_one.sql` 的 attempts/node progress 唯一约束。
- 现有 runtime private activity/recording bindings、Phase 4A-3 报告及测试。

遍历仓库 migrations：speaking 专用 RPC 的 CREATE 定义只见 `202608180023`；没有发现后来替换它的仓库定义。**未连接线上 DB 读取 `pg_get_functiondef`；不能断言部署数据库完全等于仓库。** 没有查询真实学生、扫描真实录音对象或披露任何个人内容。历史数据“可能形态”来自实际写入代码和 migrations，不宣称已统计线上数量。

## 3. 当前录音领域矩阵（修复前，当前仍保持此状态）

以下 metadata 均保存在 `digital_textbook_speaking_evidence.metadata`；表列另有可信 owner/activity/id/object_key/byte_size/mime_type/created_at/consumed 标记。

| recording kind | upload backend / 路径 | DB metadata | GET backend | DELETE / POST 旧资源清理 | submit verifier | completion |
| --- | --- | --- | --- | --- | --- | --- |
| independent_output | R2；`student-recordings/{tenant}/{student}/{activity}/{evidence}.{ext}` | `{durationSeconds, storage:"r2"}` | evidenceId GET 被 `isGuidedRepeatMetadata` 拒绝；无本类型列表恢复 | metadata 指定 R2，DELETE 走 R2；非原子 consumed 检查仍有竞态 | 仍要求无 `student-recordings/` 的旧路径，查 Supabase Storage `.list`，因此当前新上传不能通过 | 合格提交→专用 speaking RPC；该 SQL 又硬编码 Storage |
| roleplay | R2；同上 | `{sceneId, roleSide, turnIndex, transcript, transcriptSource}`；缺 storage | evidenceId GET 同样 404；UI 局部 Blob 不代表服务器 GET 成功 | 缺 storage 导致选择 Supabase Storage；POST 按同角色话轮清理时没有排除 consumed | 通用 speaking verifier不适配该路径；角色完成 Action 本身只检查 owner/activity/scene/role/turn 集合，不检查对象、大小、MIME、年龄或 consumed | `record_smart_textbook_attempt(8参数)`→独立 evidence update；不原子 |
| guided repeat / full recall recording | R2；同上 | `{practiceKey, trackIndex, segmentIndex}`；缺 storage | 列表按私有 metadata 坐标查最新；evidenceId 字节 GET 无条件签 R2 GET | 缺 storage，误选 Supabase Storage；同坐标重录清理也受影响 | 若交给当前通用 speaking submit，同样因旧路径/Storage 校验失败；旧 full-recall 本来主要是练习录音 | 逐句跟读练习标记由 `saveGuidedRepeatProgressAction` 保存，**不是**录音/正式完成 RPC；full-recall 上传本身不等于 speaking 完成 |
| 历史普通 speaking / 当前未命中以上 kind 的 POST 分支 | Supabase Storage；`{tenant}/{student}/{activity}/{evidence}.{ext}` | 历史可无 metadata 或 `{}` | 当前 GET 不是通用 legacy reader；不应声称历史播放已完善 | 普通 speaking 可能在 DELETE 类型门禁就拒绝；允许时才走 Storage | 路径、owner/activity、年龄、MIME、字节校验与此后端匹配 | 原专用 speaking RPC 对这种证据有锁内消费机制 |

同一个 shared bucket 还被 assignments recording 代码使用，但其 evidence/domain 不等同智能教材；此次目标不能删除/迁移整个 bucket 或改动 assignments 功能。

### R2 helper 的准确能力

`src/lib/r2.ts`：

- `assertR2ObjectUpload`：签名 HEAD，检查成功状态和 content-length；**不核对 MIME**。
- `checkR2ObjectExists`：签名 HEAD，返回 exists/size/contentType；适合后续统一 verifier 做 size + normalized MIME 比较。
- `createR2SignedObjectUrl`、`createR2SignedUploadUrl`：服务端签 GET/PUT。
- `deleteR2Object`：签 DELETE，404 视为已删除。

HEAD 只能证明当时对象存在及其存储元信息，不证明用户本人发音、不证明已经听完、不提供发音分数，也不能与 PostgreSQL 事务自动形成跨存储原子提交。

## 4. Canonical backend 与历史兼容策略（设计，未实施）

**新智能教材录音统一以 R2 为 canonical backend。** 依据是当前 independent_output、roleplay、repeat/full-recall 的真实 POST 分支、固定 R2 prefix，以及角色活动的既有 R2 配置。Supabase Storage 是明确 legacy compatibility 分支，不是与 R2 同时尝试、任选一个“能读就算”的模糊策略。

可信来源是服务端写入、客户端无直接权限的 evidence 行；不能仅根据当前 activity.public_config.storage 决定旧对象存在哪里。

建议 resolver 的闭合规则：

| 既有可信行形态 | 解释 | 验证/读取策略 |
| --- | --- | --- |
| `metadata.storage=r2` 且对象键严格等于 row 中 tenant/student/activity/evidence 与 MIME 扩展名构成的 R2 路径 | current R2 independent | R2 HEAD/字节代理/删除；metadata 与路径冲突则拒绝 |
| 未写 storage，但 row 的完整对象键严格匹配上述 R2 格式，metadata 为已知 roleplay 或 repeat/full-recall | legacy-metadata R2（由当前实际 POST 写入形态证明） | 明确 R2 compatibility decoder；不是因为名称相似猜后端；不回退 Storage |
| 无 storage、metadata 为已知旧形态，完整对象键严格匹配旧 Storage 路径 | legacy Supabase Storage | 原 bucket + 精确对象身份检查；历史类型不明时可保留受控读取，但不能自作主张赋予新 scene/turn/completion 身份 |
| 显式 backend 与路径冲突、未知 backend、任意 prefix/嵌套路径/owner 不符 | unsupported / invalid | 拒绝访问与消费，保留对象及行等待核验，不猜测另一个后端 |

扩展名必须由允许 MIME 的固定映射产生，不接受多余 `/`、另一个 activity/evidence 文件名或任意对象键。不移动历史对象、不批量改 metadata、不因缺少新 JSON 字段统一判废旧录音。年龄/consumed 限制分别用于“能否完成”，不能与“已完成录音能否本人回听”混为一谈：consumed 可以保留受授权 GET，但不能再消费或删除。

## 5. 统一 Metadata / verifier 目标（未实施）

不新增数据库列。复用既有列与 metadata JSON，先在服务器归一为闭合 DTO：

| 字段 | 来源/限制 |
| --- | --- |
| metadataVersion | 固定服务器 decoder 版本；旧行用显式 legacy variant |
| storageKind | `r2` 或 `legacy-supabase`，由上节可信行验证得出，不接受客户端 |
| objectIdentity | 服务器内部 backend + 固定 bucket/context + 精确 objectKey；不序列化给浏览器 |
| activityId / evidenceId | 可见 activity 与服务器生成 evidence UUID；与 row、路径完全一致 |
| recordingKind | 闭合 union：`independent-output`、`roleplay-turn`、`guided-repeat-line`、`full-recall`、`legacy-speaking` |
| scene / role / turn | 仅 roleplay variant 允许；对照当前服务器冻结 scene/required turns；不能只检查 index≥0；Runtime 仅收 stable turnId |
| track / segment | repeat variant 内部按冻结 private mapping 解释；客户端 Runtime 不提交旧 index |
| duration | 有来源标签；旧客户端报告时长不伪装成服务器测得。历史 roleplay/repeat 未保存时长必须为 unknown/null，不能恢复成凭空的“1 秒”来满足 completion |
| MIME / size | 允许类型、范围、row 值与实际 HEAD/Storage 元信息一致；客户端标签本身不是可信检验 |
| owner | 当前正常认证的 tenant/student 与 row 相等；不进入客户端提交字段 |
| consumed | 由服务器事务控制；不能接受客户端 completion/consumed/score |
| runtimeBinding（新 Runtime 上传时） | 服务器 session/snapshot/source revision/version/activityRef 绑定，建议写入既有 metadata 的闭合版本化成员；详见下一节 |

Verifier 必须重新检查正常身份、权限、可见 activity、kind、完整对象身份、大小/MIME、合法创建时间、24 小时消费年龄、未消费、未删除/删除中状态、scene/role/required turn、current version。R2 用 `checkR2ObjectExists`；legacy Storage 用原 Storage 元信息检查。**禁止 R2→storage.objects，也禁止客户端声明 HEAD 已通过。**

当前 verifier 尚未修复：它甚至不 select metadata，因此“metadata 声称 R2 + 旧路径 + Storage 中有同名对象”的冲突在隔离测试中仍被接受。角色 Action 也会接受具备 required-turn metadata 但过期/已消费/缺对象的证据集合。这些都保留为修复要求，而非声称已有保障。

## 6. Snapshot / version / source revision

当前 `PrivateBindings.activities/recordings` 包含 activity/version，Manifest 与 session 有 snapshot/source revision；但 evidence 表只有 activity FK，没有 snapshot/version 字段。**仅把旧 evidence ID 放入当前 session，或仅检查 activityId 相等，不能证明它产生于当前 source revision。**

后续最小策略建议：

1. Runtime 网关每次从正常服务器认证/session 读取 snapshot 和 source revision；客户端只提交 runtime session、snapshot、activityRef、stable target 和操作必要数据，拒绝客户端身份、路径、成绩。
2. private binding 解析真实 activity/version；重新读取 activity→node→module→chapter→version，匹配当前冻结 snapshot，并按 kind 解析 scene/role/turn。若版本行内内容已修改，也要重新校验 source digest，不能只比 version UUID。
3. 新 Runtime 上传由服务器将不可变 `runtimeBinding` 存入既有 metadata JSON；同一次证据不得在后续 session 自行换绑 revision。该字段不是客户端提交的 metadata。
4. 消费事务锁内比较期望绑定与 row 的不可变绑定。Session ID 更换但 snapshot 相同的恢复需要显式服务器授权，不能以“当前 session 任意接受这个 ID”代替。
5. 无 runtimeBinding 的历史证据继续支持旧流程与受控回听；要进入新 Runtime 正式完成，必须证明历史内容修订关系或经明确授权的一次性绑定规则。**本轮没有这种证据，也未实现批量补绑定**；不确定则该 Runtime 完成请求继续阻断，而不是让所有旧 evidence 失效。

不需要先新增 snapshot 列，但需要在新的原子消费边界核验绑定，且未来上传/修改权限必须保证 metadata 不被客户端改写。单进程内存 Map 无法给生产跨副本/刷新提供不可变证据绑定；不能用它伪称解决跨 revision 复用。

## 7. 并发与失败一致性结论

### 7.1 Independent speaking

仓库 `record_smart_textbook_speaking_attempt(6参数)`：`FOR UPDATE evidence → owner/activity/age/consumed/path检查 → storage.objects检查 → 原 attempt RPC → consumed update` 位于一个 PostgreSQL 函数事务。对**合法旧 Storage**同一 evidence，行锁与 consumed 检查可阻止第二次合格完成；后续语句失败由事务回滚。二次提交被拒绝，不是一定返回第一次结果。

这个保障不能迁移到当前 R2，只改应用 verifier 不够。现有应用在不满足 completion requirements 时仍可走普通非合格 attempt 分支；必须保留其原无评分规则，不把全部录音行为都改成正式消费。

新增 speaking 并发测试调用真实提交函数，RPC 使用明确的“锁内消费契约模型”合成 transport；它说明应用依赖原子 RPC，**不是运行真实 PostgreSQL 证明**。SQL 行锁结论来自仓库函数阅读；真实数据库并发验收留待授权后的隔离 DB 环境。

### 7.2 Roleplay

实际竞态：

```text
A: required evidence 查询通过 → existing completed attempt = 空
B: required evidence 查询通过 → existing completed attempt = 空
A: generic RPC 获取 activity 锁 → attempt #1 + progress → 提交事务
B: generic RPC 获取 activity 锁 → attempt #2 + progress → 提交事务
A/B: 分别更新同一组 evidence.consumed_attempt_number
```

`unique(tenant_id,student_id,activity_id,attempt_number)` 接受 #1 和 #2；它不是证据幂等键。既有 activity advisory lock 序列化编号，不重查“该 roleplay 已完成”；外部 Action 预检查不在锁内。node progress 有唯一行/聚合逻辑，不能据此声称两次完成会增加 completion_percent 超过 100，但 attempt 数量和两次派生写入确实不再是一次消费语义。

新增测试运行**原 Action**，将两次“无完成记录”读取同步后释放；RPC transport 串行模拟仓库编号行为，得到两次成功、attempt `[1,2]`、两次 consume update，最终 evidence 指向第二个 attempt。序列重试对照仅创建一次；说明不能拿串行测试代替并发测试。

另测试让原独立 consume update 返回错误：原 Action 仍返回成功，attempt 已存在而 evidence 未消费。崩溃发生在两个请求之间也有同类窗口。应用 mutex 只覆盖单进程；先 CAS consumed 再写 attempt 会引入“占用成功但没有 attempt”的另一种窗口，仍不是安全解法。

### 7.3 Delete / re-record 与 consume

Route DELETE 是 `SELECT consumed → 删除外部对象 → DELETE row`，没有与消费锁共享的 pending 状态。POST 对 roleplay/repeat 的同槽旧录音清理没有 `.is(consumed_at,null)`；修好错误 backend 分支后，若不先处理这个问题，反而可能真正删除历史已消费对象。independent 清理虽筛选 null，仍存在筛选之后被消费的竞态。

不能仅加一次应用层 consumed 判断就宣称对象与完成状态一致。必须让**所有**删除/重录清理入口遵守与 consume 互斥的服务器事务协议，见下一节。

## 8. 最小数据库/RPC 改动建议（待授权；没有 SQL 文件）

目标保持现有表、bucket、attempt 评分/完成聚合规则；不做对象迁移。

### 必需改动 A：专用 speaking 消费函数

修改或版本化 `public.record_smart_textbook_speaking_attempt`，保留旧调用兼容入口：

- 保留 service-role-only、evidence 行锁、owner/activity/version、年龄、消费状态、既有无评分 attempt 规则。
- 锁内解析可信 storage variant：legacy Storage 继续原 `storage.objects` 校验；R2 不查询 Storage。
- R2 HEAD 在可信应用服务完成，生成**服务端私有、短时、绑定 evidence+object identity+metadata digest+size+MIME+expected revision**的验证证明。SQL 不能自行访问 R2；只允许服务端受控 RPC 接收/核验该证明与当前锁定行一致，不能增加一个客户端可传的 `verified=true`。
- 消费和 attempt 写入在同一事务；同一 evidence 的重复请求只允许一次正式写入。决定“返回旧结果或拒绝重复”的响应策略时保持调用端可识别，不重新打分。
- Runtime binding 比较进入锁内；legacy 入口不得为新 Runtime 绕过绑定检查。

这里的外部对象可信条件还依赖下一项删除协议和不可变对象键；不能宣称 HEAD 与 DB 是跨系统事务。

### 必需改动 B：原子 roleplay 消费函数

新增一个专用、service-only 的 roleplay completion RPC（名称可在后续授权方案中确定），替代当前 Action 的分散写入，而不是复制判题：

1. 先取得 learner/activity 的事务锁；**锁内**重新查询同版本已完成 roleplay attempt。按当前“活动已有完成即返回”语义，不新造按场景累计评分。
2. 固定顺序锁定本次所有 required-turn evidence，检查完整 coverage、同 owner/activity、scene/role/turn、kind、age、未消费、未删除中、runtime binding 和服务端对象证明。
3. 调用原八参数 `record_smart_textbook_attempt`，correct/score 继续 null。
4. 在**同一事务**更新全部 evidence consumed；任一步失败整体回滚。无调用端事后批量 consumed update。

现有编号 unique constraint 可以继续使用；不必先加一个会错误限制正常 objective/非合格 attempt 的全局“activity 唯一完成”约束。生产验收必须实际测试并发、失败回滚、max-attempt 边界和旧响应兼容。

### 必需改动 C：删除/重录清理与消费的互斥状态

最小候选是不新增列，使用已有 metadata 的服务器专有 lifecycle 成员，由 service-only RPC 在 evidence 行锁下从 unconsumed 进入 `delete-pending`；consume 必须拒绝此状态。外部 R2/Storage 删除可幂等重试，成功后再由受控 RPC 清理行；失败保留 pending 状态供重试，不误宣称删除成功。

需要覆盖显式 DELETE 和 POST 自动清理，禁止删除 consumed evidence。pending claim/finalize 的状态校验必须在 DB 事务内；不采用“先删对象后检查行”。操作与外部存储仍非分布式事务，但通过先禁止消费、可恢复删除实现明确状态，而不是制造不存在的原子性。

以上函数/metadata 状态需一起设计和回归；本轮只给最小边界建议，**未创建新函数、constraint、表、列、migration 或可部署 SQL**。如果后续审查认为现有 metadata 不适合承载可信证明/绑定/生命周期，也必须在授权方案中明确 schema 需求后再实施。

## 9. Preview isolation / Runtime 执行状态

现有 owner Preview `trackingDisabled=true`，Phase 4A-3 store 只保存隔离 repeat markers，**不是录音/evidence store**。本轮没有绕过旧上传 tenant 检查，没有使用 service-role 冒用 owner，没有向正式 evidence 表或 R2 prefix 写 Preview 对象。

后续隔离 recording 设计必须由服务器 owner audit session 决定：独立 `preview-recording:<opaque>` ID namespace、明确 TTL/容量/字节上限、到期清理、单 session/owner/snapshot 访问；不得使用正式 UUID evidence 返回值冒充正式证据，不进入正式 attempt RPC，也不存入 `student-recordings/` prefix。若用单进程 Blob store，需诚实说明重启/多副本限制。客户端不能传 mode 选择 backend。

由于 DB change required 已成立，本轮不实现该 backend、不开展完整录音 UI测试，避免在领域未一致前继续堆叠 executor。

| 能力 | Phase 4A-4 状态 |
| --- | --- |
| recording | unsupported；POST/GET/DELETE 未修改，问题有证据但未修复 |
| speaking evidence | partial；兼容与事务方案明确，原子 R2/roleplay 消费尚未实现 |
| speaking-introduction | unsupported；等待领域事务修复，未实现 Runtime outline/criteria/recording/submit/restore |
| dialogue-roleplay | unsupported；未降级开放题，未实现新 role/turn executor |
| guided repeat | 保持 Phase 4A-3 partial；两轨/14 segment 旁路与测试不变，full-recall 共享 backend 问题未绕过 |
| compat.learning / compat.teacher | 均 unsupported |
| runtimeReady | false |

不处理 grammar、patterns、chapter-test、teacher timeline，不进入 Phase 4B。

## 10. 测试

新增 `tests/smart-textbook-runtime-4a4-evidence.test.mjs`，**18/18 证据测试通过**：

- 原 roleplay Action 两请求并发竞态、串行重试对照、consume update 错误仍成功。
- 原 legacy Storage speaking verifier 正常路径、消费后重复提交拒绝。
- speaking 专用锁内消费的明确契约模型（非真实 SQL 执行）。
- wrong student/tenant/activity、过期、已消费、对象缺失、MIME 不符的原 verifier 拒绝。
- R2 路径失败、backend metadata 冲突未校验的缺陷复现。
- 错 scene/role/缺 required turn 拒绝；原 role completion 不核验对象/年龄/消费状态的缺陷复现。
- 全 migrations 查找专用 RPC 定义；SQL 的锁、Storage 依赖、原子顺序、attempt 编号约束的只读断言。

既有 Phase 4A-3 的实际原 POST→合成 R2 PUT→原 submit/GET/DELETE 诊断继续通过。失败路径被正确复现不等于修复成功。

| 验证 | 结果 |
| --- | --- |
| Phase 3A–3E、4A、4A-2、4A-3、4A-4、相关 legacy 合并 | **523/523**；无失败/跳过/取消 |
| TypeScript 非增量 | 通过（退出码 0） |
| `git diff --check` | 通过 |
| 既有隔离 Chromium browser regressions | 纳入上述合并；不等于 owner E2E |
| 本轮新增 Recording UI / Preview recording 全流程测试 | 未执行：触发 DB change required 停止条件，未实现相关 UI/backend |
| 真实 PostgreSQL RPC 并发测试 / R2 线上录音测试 | 未执行；无 DB/存储连接，不宣称部署函数已验证 |
| 正常 owner browser E2E | 未完成；没有可连接的用户已授权浏览器会话 |

执行命令：

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

## 11. 最终自查与授权边界

- 本轮只新增上述证据测试与本报告；没有应用层“半修复”。不把停止前发现的问题报告成已经修好。
- 旧课程目录、Manifest/Adapter、learning-agent API、Phase 3E selector、migrations 与前一阶段保存的哈希一致；本轮也没有编辑 recordings Route/R2 helper。
- 第一章冻结样本仍是 8 Step、19 Activity、orientation 三题、published v23 legacy；未伪造 Teacher Video。没有声称核验了实时线上修订。
- 没有真实数据库写入、对象上传/删除、migration、SQL 部署、生产页面接管、旧代码删除或 capability 提升。合成 DB transport 的写入只发生在测试内存中。
- 没有将对象键、secret、学生内容加入公开 Manifest 或 Runtime props；报告只列格式与代码结构，不列真实学生录音身份。
- **等待下一轮对最小 RPC/事务方案的明确授权。授权前不继续领域实现，也不继续 Recording Runtime / speaking / roleplay executor。**
