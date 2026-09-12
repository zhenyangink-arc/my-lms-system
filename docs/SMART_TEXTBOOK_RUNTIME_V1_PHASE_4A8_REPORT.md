# Phase 4A-8：Recording Runtime、独立口语表达与 Roleplay

日期：2026-09-10。项目：`/home/yangzhen/projects/my-lms-system`。

## 1. 结论与验收边界

新增录音执行器、隔离 Preview 音频后端、自我介绍与 Roleplay 流程、完整复现录音及服务器 Domain Adapter。第一章旁路组件检查可实际录音、回放、上传、重录、删除、恢复及进行**预览完成检查**。不把这些检查写成学生正式完成。

```ini
remainingNonUiUnsupported = 0
nonUiRuntimeReady = true
preview recording executor = implemented / isolated Chromium verified
production recording service adapter = implemented / isolated contract verified
compat.learning.v1 = unsupported
compat.teacher.v1 = unsupported
runtimeReady = false
productionMigrationReady = false
productionCallerCutoverReady = false
owner browser E2E = 未完成
production migration executed = false
production caller cutover executed = false
```

**范围限定**：本次完成的是录音组的旁路实现与隔离验收，不是“整个第一章已经 equivalent”。正式 Runtime 服务没有挂接生产路由，完整服务器学习状态投影、其余兼容执行器及正常登录 owner 验收仍未完成。严格 `LessonRuntime` 继续拒绝未实现的 compatibility capability；现有 `RuntimeBlockInspection` 承载本次交互检查。

## 2. 文件与架构

新增文件：

| 文件 | 责任 |
| --- | --- |
| `src/features/smart-textbook-runtime/core/recording.ts` | `RecordingRuntimeServices`、闭合 Zod 请求/计划/结果、`RecordingRestoreState`、稳定 turn 恢复 |
| `src/features/smart-textbook-runtime/core/recording-controller.ts` | `RecordingController` 单状态机、MediaRecorder/Stream/Blob/异步生命周期 |
| `src/features/smart-textbook-runtime/core/recording-transport.ts` | 同源 JSON/FormData/Blob transport，客户端不理解存储后端 |
| `src/features/smart-textbook-runtime/server/recording-binding.server.ts` | Capsule → safe plan；冻结 identity → 私有 legacy 坐标 |
| `src/features/smart-textbook-runtime/server/preview-recording.server.ts` | 有界、到期清理、owner/session/snapshot 隔离的音频与预览结果 |
| `src/features/smart-textbook-runtime/server/audit-recording.server.ts` | 每次重新鉴权、会话及 revision 校验、只选择 Preview backend |
| `src/features/smart-textbook-runtime/server/recording-production.server.ts` | 未挂接生产的 Domain Gateway adapter；无自建 R2/RPC/判题实现 |
| `src/features/smart-textbook-runtime/components/recording-control.tsx` | 录音操作及恢复/错误/重试界面 |
| `src/features/smart-textbook-runtime/components/recording-executor.tsx` | `RecordingExecutor`、scoped speaking/role turns、`FullRecallTrackRecording` |
| `src/app/api/smart-textbook-runtime-audit/recording/route.ts` | owner-only 审计 HTTP 入口；有界请求体、同源检查、授权音频字节代理 |

修改现有旁路文件：`core/services.ts`、`components/audit-client.tsx`、`components/learning-content.tsx`、`components/activity-executor.tsx`、`components/guided-repeat-executor.tsx`、`server/audit-session.server.ts`、owner `runtime-v1-preview/page.tsx`。跟读组件仅增加 track 内录音插槽，不重写逐句播放/marker。

领域文件唯一变动：`src/lib/recording-domain-gateway.server.ts` 增加**可选、server-only Runtime binding**，默认旧调用不变；详见第 4 节。没有修改历史 migration、旧录音 Route 请求形状、旧 React Shell 或 speech selector。

```text
Runtime scoped Recording Executor
  → RecordingRuntimeServices（共同闭合接口）
    → owner audit HTTP → requirePlatformOwner → auditSession
      → Preview store → Blob / safe DTO / preview-only completion
    → productionRecordingServices（没有生产入口）
      → trusted session + private binding + current domain revision
      → withRecordingDomain → v2 gateway
      → existing upload/restore/delete/speak/roleplay domain
```

## 3. Preview isolated backend

`createPreviewRecordingStore` 不接受数据库或对象存储 client。音频是服务器内存 Blob，不写正式 R2 prefix、Storage bucket、evidence、attempt、node progress。

- scope：owner + recording audit session + snapshot + source revision；每个对象再绑定 capsule/activity/target，对应 recording kind 从可信 plan 推导。
- ID：`preview-recording:<randomUUID>`；不会伪装 `digital_textbook_speaking_evidence.id`。
- 最大 30 分钟且不超过审计会话原到期时间；续接不延长 TTL。
- 单文件 2 KiB–10 MiB；同一录音审计 scope 20 MiB；单服务进程总量 64 MiB；最多 256 个音频条目、256 个预览完成条目。
- 每次请求清理到期项，另有每 30 秒 `unref` 清理计时器；删除/替换音频使依赖旧音频的 Preview completion 失效。
- 配额检查和 Map 写入之间没有 await；这是单进程隔离审计存储，不是分布式正式 evidence 服务。
- 进程重启/换副本会失去 Preview 音频；不会自动转正式存储。多副本的共享 Preview 存储不在本阶段冒充已解决。

Route 在读取音频请求体前执行 owner guard；拒绝跨 origin/site；实际读取流累计上限 11 MiB，而不是只信 Content-Length。JSON 上限 8 KiB；FormData 只允许各一个 request/recording，拒绝额外字段。每项操作再校验会话及 snapshot。客户端没有选择 `mode` 或 storage backend 的开关。

## 4. Production service adapter

`productionRecordingServices(authorize, expected)` 接受服务器重新授权得到的 session、owner、snapshot/source、version、已验证 plans/private bindings 和每个 activity 的 domain revision。没有生产 Route 调用它。

每次操作：

1. 校验 session/snapshot、`trackingDisabled=false` 必须来自可信服务器上下文。
2. 解析 private ActivityRef → activity/version。
3. 进入现有 `withRecordingDomain`；不是 v2 则拒绝，**不启用 gate，也不转 v1 Runtime 写入**。
4. `recordingActivityBinding` 读取当前 activity/node/version，比较可信 domain revision，防止冻结 Runtime 计划与后台后续修改混用。
5. 调用同一个 `createRecordingGateway` 的 upload/read/restore/playback/remove/speak/roleplay。

Gateway 可选 Runtime binding 将真实 snapshot/source/ref 写进既有 metadata；消费锁内仍走 Phase 4A-5 的原子协议。旧调用省略该参数时保持 `recording-domain:<versionId>` 原行为。Runtime completion 不接受没有 binding 的历史 evidence；历史只读回听仍允许。

Roleplay 当前 revision 查询和 re-record cleanup 限制相同 Runtime binding，避免清理其他 revision 或无绑定历史 evidence。没有重新实现 required turn 原子 coverage，也没有应用层二次 UPDATE consumed。

完成 DTO 只接受真实 `attempt_number` 的领域结果；`already_completed` 映射 `already-completed`，不是再次完成。读取和删除不会把 objectKey、proof、RPC、backend 或 owner 字段传给 React。

隔离测试分别验证 adapter→gateway 调用与 safe DTO、真实 gateway 的绑定拒绝，并继续运行原 Phase 4A-5/4A-7 真 PostgreSQL 事务/并发演练。**这不等于新 Runtime 已在生产使用正式 RPC，也不是已授权 owner 的真实数据端到端验收。**

## 5. 旧链路证据与本轮新链

旧 UI 文件统一位于：

`src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx`。

| 能力 | 当前旧链 | 新旁路链 |
| --- | --- | --- |
| recording | `RecordingControl` / `RoleplayRecordingPlayer` → `/api/digital-textbook/recordings/[activityId]` GET/POST/DELETE → Domain Gateway | `RuntimeRecordingControl` → common port → Preview Blob store；production port → 同 Domain Gateway |
| 独立口语 | `Activity` independent_output → outlineSelections + recordingEvidenceId → `submitSmartTextbookActivityForContext` / 原 grader | frozen plan → outline/criteria + scoped recording → Preview 原 grader检查；production gateway.speak → `consumeSpeakingV2` |
| roleplay | `DialogueRoleplayPractice` → scene/role parity/turn recording → `completeDialogueRoleplayAction` → gateway.roleplay | stable scene/turn + recording → Preview required recordings；production gateway.roleplay → `completeRoleplayV2` |
| 跟读 marker | `ListenSpeakLearningPanel` → TTS → `saveGuidedRepeatProgressAction` → `digital_textbook_guided_repeat_progress` → loader | 原 Phase 4A-3 `GuidedRepeatExecutor`/Reader/冻结映射保留 |
| full recall | `ListenSpeakLearningPanel` 的 RecordingControl，`practiceKey=full-recall`、trackIndex、segmentIndex=0 | frozen track target → 相同 RecordingRuntimeServices；server 才转换旧坐标 |

正式领域表仍是 `digital_textbook_speaking_evidence`、`digital_textbook_attempts`、`digital_textbook_node_progress`。正式消费 RPC 仍是 `record_smart_textbook_speaking_attempt_v2`、`complete_smart_textbook_roleplay_v2`；旧调用/旧 RPC 未删除。

## 6. MediaRecorder lifecycle

显式 phase：idle、requesting-permission、recording、stopping、local-ready、uploading、uploaded、deleting、restoring、error。不是多个独立 boolean 控制录音主状态。

开始录音后收集真实非空编码 Blob；停止时释放 MediaStream、检查最小字节及 duration。浏览器报告时长仍只是既有口语提交语义，不声称服务器已验证真实说话或发音质量。

上传失败保留本地 Blob，可重试；删除失败保留服务器 item，可重试删除。开始重录即撤销当前 UI 的可提交 item，避免用新录音状态误提交旧证据；若新录音失败，可显式恢复上一份，未默默删除旧对象。

Step signal 或组件 unmount：停止 recorder、置空 callbacks、停止所有 tracks、abort 请求、clear timer、pause audio、revoke Blob URL。晚到的 permission stream 立即停止；晚到上传结果不回写新 Step。服务器已经接收成功而响应被取消的 Preview 录音可通过安全恢复读取，并到期清理；没有假装 HTTP abort 能回滚已成功持久化。

UI 沿用现有卡片/按钮；标题说明复用 `CardTitleWithHint`。依据本轮使用的 `ui-ux-pro-max`，错误以 alert 宣告并给出对应恢复动作，忙碌状态阻止冲突操作；没有重新设计教材 UI。

## 7. Speaking introduction

真实第一章 `speaking-introduction` 配置：5 项 criteria、requiredCriteria=4、minimumOutlineItems=4、minimumSeconds=15、maximumSeconds=60、minimumTurns=0、pronunciationScore=false。

`recordingPlans` 从闭合 Capsule 逐字段生成提纲/选项、criteria 和时长约束；选择控件使用冻结 ID。UI 保留至少选择 4 个表达节点的旧准备要求，提交 criteria 使用已知稳定 ID，服务器拒绝重复/未知 ID。

Preview 验证当前 scope 音频，再把合法 criteria 映射为原 grader 所需 boolean 数组；复用 `gradeSmartTextbookActivity({kind:'open'}, response, 'speaking', config)`。没有另写评分规则。结果：

```ini
status = preview-accepted | already-completed
formalCompletion = false
progressDelta = null
correct = null
score = null
```

Production port 提交网关已有原子完成；失败/重复不会由浏览器增加分数、attempt 或 completion。Preview 不调用正式 attempt RPC，也不把预览通过写入 `ServerLearningState`。

与旧完整 UI 尚有差异：新 UI 是显式提交及提纲/criteria controls，不复制旧五节点自动提交编排、参考表达展开全部视觉行为。因此整体等价表标 partial，不把可操作 Preview 写成所有旧 UI 细节 equivalent。

## 8. Dialogue roleplay

真实 `dialogueScenes` 两场景：`first-meeting` 8 句、`introduce-and-correct` 6 句。服务只返回冻结 scene/turn ID。左右角色按旧 lines parity：第一场每侧 4 轮、第二场每侧 3 轮；**不按 speaker 名称重新分配**，因为原 scene 中同名 speaker 与左右位置并非一一固定。

选择场景/左右位置 → 对方台词与可选 Korean TTS → 当前学生轮次录音 → 上传接收 → 下一必需轮次 → required recordings 齐全后提交。每轮可重录；场景/角色切换和 Step dispose 释放当前 recorder/TTS。

Preview required coverage 仅检查隔离录音存在；不制造 consumed evidence 或正式 attempt。Production port 将 scene/side 交给原 Domain Gateway / `completeRoleplayV2`，不重新实现其 SQL coverage/事务。

当前录音 executor 使用“无 SpeechRecognition 仍可录音”的安全降级路径；没有移植旧可选识别的转写/文本相似度 UI，更没有把浏览器文本匹配当正式评分。counterpart TTS 只用于练习，没有接入教学 Agent 的 `audio_completed`，没有改变 Phase 3D Grant 语义。

## 9. Full recall 与跟读保护

实际旧 UI 存在 full-recall 录音入口，因此已接相同录音 port。`legacyRecordingCoordinates` 从冻结 `content.repeatTracks[...]` identity 私有解析 trackIndex，segmentIndex=0 与旧调用一致。

`GuidedRepeatExecutor` 增加可选 `trackRecording` 插槽，`FullRecallTrackRecording` 挂在**已有 track RuntimeTarget 内**；不重复 mount target，不改 2 track / 14 segment 原 marker、播放和保存逻辑。不带 guidedRepeat service 的检查上下文可用独立 full-recall 卡片挂同一个 declared track target。

完整复现上传不会保存逐句 practiced marker，更不能满足 `speaking-introduction`：同 activity 不同 target/kind 的证据被服务拒绝用于独立口语完成。

## 10. Restore 与审计刷新

`RecordingRestoreState` 是闭合 DTO：recordings、completion、currentTurnId；录音项只有 opaque ID、stable part、duration（未知可为 null）、MIME、state、reusable。拒绝重复 ID/part、consumed/expired 却 reusable 的矛盾对象。

Preview 从隔离 store 恢复；Domain adapter 从 gateway scoped restore/read DTO 转换。删除 pending 不可恢复成有效录音；consumed/expired 可通过授权 byte proxy 回听但不可重新消费；其他 snapshot 历史不能成为当前正式完成。

Roleplay 使用最近已保存轮次所在场景/side 及首个缺失 turn 恢复，不把旧 index 传入客户端。部分历史 role/repeat metadata **没有 durationSeconds**：返回 null，不沿用旧 UI 的伪造 duration=1。新正式 Roleplay 录音 schema 仍不持久化 duration；本阶段没有为了显示时长修改 SQL。这是完整 production restore 等价仍需评估的已知限制。

原 owner Preview 整页刷新会新建审计 session。本轮 `createRecordingAuditContinuation` 通过 `recordingAudit` opaque query 标识续接**同 owner、snapshot、source revision**的录音审计范围，TTL 保持原值；新页面仍生成全新教师 session/generation，不继承 TTS grant。独立新标签/新审计不自动合并；跨 owner、未知/过期 session、源版本变化拒绝并显示重新开始入口。query 标识不是登录凭据，仍必须 server owner guard。

## 11. Stable targets 与学习状态

所有 target 保持原 `step:{stepId}/block:{blockId}/part:{partId}`：speaking 使用既有 speakingFrame part；Roleplay 使用冻结 scene line part；full recall 使用冻结 track part。

被录音执行器拥有的 part 不再同时由静态 Card 注册；未启用 recording service 的原静态投影完全保留。未 mount 的 Roleplay part 不假装可操作。reveal/focus/highlight 使用现有有界 target handle；local playback 是组件内部操作，**没有给未声明 play 的 part 添加 play**，没有 DOM/CSS selector 或数组 index 身份。

所有录音临时状态属于 ClientTemporaryState。Preview result 显示到局部 feedback，不写 ServerLearningState 的 attempts/completedStepIds/speakingEvidence。Production 完成返回的真实结果尚未挂接完整 Runtime server-state refresh：后续不能把本地录音成功当服务器完成。

## 12. Chromium 验证

`tests/smart-textbook-runtime-4a8-browser.test.mjs` 使用真正 headless Chromium、真实 MediaRecorder、Chromium fake microphone 音频设备及真实编码 Blob。控制 permission denied、unsupported 和浏览器报告时钟；时长加速明确只验证原提交 policy，不声称录满了现实 15 秒。只有“空录音反例”使用输出空 Blob 的 recorder shim，且明确验证拒绝。

HTTP 实际执行新增 audit Route / request validator / Preview store；只替换可信 owner auth 和使用冻结第一章 source。后来进一步改为**真实 auditSession/续接实现**，整页 reload 创建不同 teacher session 仍恢复同一录音范围，不再用固定 session 冒充刷新测试。

覆盖 permission granted/denied、unsupported、真实 start/stop/playback、空/过短拒绝、上传失败重试、重录、删除失败重试、整页恢复、Step dispose、延迟 permission、stale upload；speaking criteria 不足/通过及 null score；full recall 与 repeat marker 隔离；第一场左右全部学生 turns、counterpart TTS、逐轮重试、中途恢复和重复完成。第二场左右完整 coverage 由服务器服务测试覆盖，未声称已在浏览器逐一跑完第二场。

截图只用于本地视觉检查：`/tmp/runtime-4a8-speaking.png`、`/tmp/runtime-4a8-roleplay.png`。没有下载或读取真实学生音频。

`owner browser E2E = 未完成`：当前环境没有用户正常已登录的远端 owner 浏览器会话。没有 impersonation、magic link、读取 Cookie/token 或绕过正常认证；合成认证测试不写成真实 owner E2E。

## 13. 安全与旧系统回归

浏览器请求/响应扫描不包含 objectKey/object_key、存储签名 URL、proof/keyId、secret、tenantId/studentId、service role、answer_key 或私有 metadata。只有授权代理 Blob，在客户端创建 URL，退出/替换时 revoke。Route 错误不回传 DB/R2 原始错误。

Domain port 测试覆盖 gate=false、session/snapshot/version/revision 错误、错误 activity/target/scene、重复/私密字段、consumed/过期/pending、不可信领域 success。真实网关测试确认新 Runtime binding 不一致在 HEAD 前拒绝。原 SQL consumption replay、rollback、并发和 delete/re-record race 继续由 4A-5/4A-7 隔离真 PostgreSQL 测试验证。

本轮未修改 `RecordingControl`、`DialogueRoleplayPractice`、旧 recording Route、正式学生课程路由、Phase 3E speech selector、Agent 推进/判题/录音 SQL。可选 gateway 参数缺省时保留旧领域行为。没有 production import 指向 `productionRecordingServices`。

## 14. 能力状态（不扩大 completed 定义）

| 能力 | 本轮隔离 Preview | 总体去向/状态 |
| --- | --- | --- |
| recording | 可操作、真实 Chromium 验证：录/停/播/传/重录/删/恢复/取消 | **partial**：Preview executor implemented；正式 Runtime 路由未接、正常 owner 验收未做 |
| speaking evidence | Preview opaque recording 与 completion 契约通过；production port + 既有原子域测试通过 | **partial**：Preview 刻意不生成正式 evidence；完整正式学习状态联动未接 |
| speaking-introduction | 真实 4 项/15–60 秒配置、原 grader、Preview completion/恢复通过 | **partial**：未复制全部旧准备/参考/自动提交 UI，未完成正式 Runtime 验收 |
| dialogue-roleplay | 两场景冻结计划，左右录音/coverage、第一场 Chromium 全流、retry/restore通过 | **partial**：旧可选识别辅助未移植；正式 role duration 历史可能 null；正式 Runtime 未接 |
| guided repeat | 原 2 track/14 segment 不变，新增共享 full recall recording | 保持既有 **partial**，未声称解决其他跟读/Agent capability |

“partial”在这里不是静态占位：本轮录音组已由不能操作提升为可隔离执行。也不是因测试通过而宣称 production equivalence。

`executableCapabilities` 仍是 `layout.v1`、`navigation.linear.v1`、`progress.server.v1`、`block.text`、`block.multiple_choice`。没有把 compat.learning/teacher 提升 implemented，没有 fake renderer；其它 grammar/pattern/review/history/teacher blocker 未在本轮处理。

## 15. 测试结果

新增：

- `tests/smart-textbook-runtime-4a8-recording.test.mjs`：36 项。
- `tests/smart-textbook-runtime-4a8-production-port.test.mjs`：13 项（包含真实 gateway 的 Runtime scope 拒绝）。
- `tests/smart-textbook-runtime-4a8-browser.test.mjs`：12 项（含外层 Chromium 测试计数）。
- fixtures：`recording-4a8.server.ts`、`recording-4a8-http.ts`；复用/扩展 `runtime-4a-browser.tsx` 共同 renderer harness。

本轮 **61/61**；合并 **712/712**（既有 651 + 新增 61），无失败、跳过或取消。包含 Phase 3A–3E、4A/4A-2/4A-3/4A-4/4A-5/4A-7、legacy、Chromium 与隔离 SQL 测试。TypeScript 和 `git diff --check` 通过。

执行命令：

```bash
node --no-warnings --experimental-strip-types --test --test-reporter=tap \
  tests/smart-textbook-runtime-v1.test.mjs tests/smart-textbook-legacy-adapter.test.mjs \
  tests/smart-textbook-readiness.test.mjs tests/smart-textbook-final-readiness.test.mjs \
  tests/smart-textbook-speech-selection.test.mjs tests/smart-textbook-sidebar.test.mjs \
  tests/learning-agent-*.test.mjs tests/teaching-video.test.mjs \
  tests/teacher-kim-*.test.mjs tests/teaching-blackboard.test.mjs \
  tests/smart-textbook-runtime-4a*.test.mjs
npm run typecheck -- --incremental false --pretty false
git diff --check
```

日志保存在本地 `/tmp/runtime-4a8-regression.log`、`/tmp/runtime-4a8-types.log`；不含真实学生内容。隔离 SQL 用既有 disposable harness，不使用生产 Supabase/R2。

## 16. 最终生产保护与停止

- 第一章 8 Step、19 Activity、orientation 三题和 published v23 legacy fixture 保持；未制作或伪造 Teacher Video。
- Manifest v1/stable IDs、Phase 3D TTS observation、Phase 3E speech selection 未修改。
- 未新增/修改 migration，未执行生产 DDL/DML，未安装生产 proof key，未上传/删除真实学生录音。
- 未启用 production gate，未切生产 caller、学生 Runtime 路由或 release pointer，未删除旧 Shell。
- 本轮工作区本来已有大量前期/其他任务改动；本报告只把第 2 节列出的文件变更归入 Phase 4A-8，没有回滚或归并其他修改。
- 本阶段结束；不进入 Phase 4B，不因 Preview 通过自动推进生产部署。

```ini
production migration executed = false
production caller cutover executed = false
```
