# Phase 4A-3：跟读子链落地与录音领域阻断报告

日期：2026-09-09。范围：第一章旁路 Runtime；没有进入 Phase 4B。

## 1. 结论：本阶段尚未完整收口

已完成两轨、14 句的旁路跟读显示、Browser TTS 当前句播放、停止、隔离练习标记、重复操作幂等、Step dispose、迟到结果隔离、刷新恢复，以及旧跟读表的真实 SELECT Reader 和私有绑定调用适配器。

**录音、speaking evidence、speaking-introduction、dialogue-roleplay 尚未完成执行链验收。** 本轮执行原录音 Route 和原提交服务的隔离测试，复现了存储实现不一致；没有以新录音系统、假 evidence 或模拟完成绕过原服务。

```ini
remainingNonUiUnsupported = 0
nonUiRuntimeReady = true
compat.learning.v1 = unsupported
compat.teacher.v1 = unsupported
runtimeReady = false
production student route switched = false
owner browser E2E = 未完成
```

`remainingNonUiUnsupported=0` 是**既有 Phase 3E finalizer 覆盖范围内**的计算结果，不意味着本轮新检查出的领域执行阻断不存在。录音存储、历史 evidence 与完成服务未验收，仍阻断 executable compatibility/readiness；没有删除或降低任何 validator。

基线文档使用工作区真实名称 `SMART_TEXTBOOK_TARGET_STATE_AUDIT.md`，没有复制第二份资产决策文档。Manifest、稳定 ID、Phase 3D TTS observation 和 Phase 3E selector 均未修改。

## 2. 本轮文件

新增旁路代码：

- `src/features/smart-textbook-runtime/core/guided-repeat.ts`：闭合公开 DTO、服务接口、实践状态校验。
- `src/features/smart-textbook-runtime/core/repeat-playback.ts`：沿用 Browser TTS 的句播放与取消；不是教学 Grant，不产生正式完成。
- `src/features/smart-textbook-runtime/server/guided-repeat.server.ts`：私有 capsule/冻结身份解析、真实旧表 Reader、原 Action 参数适配、隔离 Preview store。
- `src/features/smart-textbook-runtime/server/audit-repeat-store.server.ts`：限时 Preview 记录实例。
- `src/features/smart-textbook-runtime/server/audit-repeat-actions.ts`：每次调用重新执行 `requirePlatformOwner` 的 load/mark；不接受客户端持久化模式。
- `src/features/smart-textbook-runtime/components/guided-repeat-executor.tsx`：两轨 14 句 scoped executor；没有自建根布局、Step controller、Agent 或 grader。

修改仅限旁路接线：`core/services.ts`、`components/audit-client.tsx`、`components/learning-content.tsx`；以及隔离测试入口 `tests/fixtures/runtime-4a-browser.tsx`（旧模式未改变）。

新增测试：

- `tests/smart-textbook-runtime-4a3-domain-audit.test.mjs`
- `tests/smart-textbook-runtime-4a3-repeat.test.mjs`
- `tests/smart-textbook-runtime-4a3-browser.test.mjs`

没有修改旧 Shell、原 recordings Route、判题、completion Action、进度表或 Runtime capability metadata。

## 3. Guided repeat：真实旧链与新链

### 3.1 旧代码事实

课程目录（以下简称课程目录）：

`src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/`

`KoreanLevelOneSmartTextbook.tsx:960 → ListenSpeakLearningPanel` 使用节点 `content.repeatTracks`。当前两轨分别 6 句、8 句。`playRepeatLine` 在约 1022 行，调用同文件 `speakKorean`（823 行），Browser TTS 语速 0.82；播放回调更新局部练习集合并调用 `saveGuidedRepeatProgressAction`。

`smart-textbook-actions.ts:46 → saveGuidedRepeatProgressAction`：

1. 校验 activity UUID、`practiceKey=repeat-line` 和旧 track/segment 范围。
2. `requireActiveUser`，需要 tenant 和可见 speaking activity；非 Preview 还检查学生课程能力。
3. owner Preview 在权限/tenant 检查之后返回，不保存。
4. 正式模式 upsert `digital_textbook_guided_repeat_progress`，唯一键为 `tenant_id,student_id,activity_id,practice_key,track_index,segment_index`。
5. **仅练习标记**：没有 attempt RPC，不直接完成 speaking activity，不增加分数。

恢复：`src/lib/smart-digital-textbook.ts` 约 600–690 行，按已授权 tenant/student 和本章 activity IDs SELECT 旧表，再装入 activity 的 `guidedRepeatProgress`。旧 Panel 根据旧坐标恢复已练习状态。

旧 `speakKorean` 的无浏览器语音分支会调用完成回调。本旁路不把“无法播放”当成播放结束，显示错误且不保存；这是明确的 fail-closed 差异，不能声称像素/行为完全等价。

### 3.2 新旁路链

```text
owner 正常认证 → audit session 的真实 Reader / Adapter / finalizer
  → repeatLesson(closed scoped capsule, frozen private mapping)
  → RepeatLesson（只含稳定 ID、公开学习文本、targets）
  → GuidedRepeatExecutor → Browser TTS 当前句
  → onend → auditRepeatMark(stable trackId / segmentId)
  → owner + snapshot + source revision 隔离 store
  → RepeatState → UI 练习标记
```

不会创建 R2 mediaRef。播放内容直接来自已校验 `repeatTracks.lines[].ko`；翻译和关键词保留。服务端比对 Phase 3C 的 `fingerprint=digest(line)`，不根据位置生成新身份。当前索引只用于**服务器解释冻结坐标**，不进入请求或公开 DTO。registry 顺序反转不改变 DTO/ID；内容重排但未重新核验冻结映射时拒绝，而不是把历史记录移给另一句话。

`saveBoundGuidedRepeat` 将稳定 track/segment 解析为 `guidedRepeatServiceInput`，委派既有 Action 参数语义；测试另直接运行原 `saveGuidedRepeatProgressAction`，14 句各保存两次，合成 transport 中仅 14 行，零 attempt RPC。该 production-domain 适配函数尚未接入正式学生服务网关，不伪称生产接通。

### 3.3 身份、生命周期与 Target

两条 frozen track ID：

- `part-aa4ecd9fd103f11bc1087e87b5a3da80`：6 句。
- `part-b744a86fb2417b907e2db441d0101bb5`：8 句。

全部 segment 使用 Phase 3C 已冻结 UUID；track 和 segment 均挂载现有 `step:{stepId}/block:{blockId}/part:{partId}`。替换旧静态 repeatTracks 卡片子树，避免同一 target 重复挂载；section target 也保留。

当前句按钮由真实 Browser TTS owner 执行。停止/unmount/Step abort 清理回调、取消语音；加载/保存后检查 generation 与 mounted 状态。停止或错误不会写标记。服务器已收到的请求可能完成**隔离练习标记**，但迟到返回不会复活旧 Step，也不产生正式完成。

`reveal/focus/highlight` 按现有声明可执行；**通用 `target.play` 仍拒绝**：原 repeat parts 没有该公开 capability，本轮没有篡改 Manifest 或借用 Phase 3D 教学 Grant。跟读服务授权 play owner/track 顺序播放尚未接通，列为 partial，不伪装已实现。

## 4. Persistence 与 restore

`readGuidedRepeatHistory` 是实际 Reader，不只是接收预构造 rows 的投影函数。它使用 Supabase SELECT：

```text
digital_textbook_guided_repeat_progress
  filters: trusted tenant_id / student_id / bound activity_id / repeat-line
  columns: activity_id / practice_key / track_index / segment_index
→ projectGuidedRepeat（Phase 3C 私有映射）
→ RepeatState.production-domain（稳定 segment IDs）
```

数据库错误、未知历史 segment、未授权 scope、source revision 不一致均拒绝；不将读取失败当成零进度。没有读取他人录音、私密 transcript、object key。测试用合成 DB transport 验证 SELECT 字段和 owner/activity 过滤，以及全部 14 句恢复，未读取真实学生个人记录。

`RepeatState` 明确区别于 formal `ServerLearningState`：其 `formalCompletion=false, progressDelta=null, score=null`，UI 只能显示实践标记，不能覆盖服务器正式完成。**完整 `ServerLearningState` 的 speaking evidence / recording restore 尚未接通。** 生产 Reader 输出与组件契约已对齐，但生产 Reader→正式学生网关→UI 全链未接入/验收；浏览器刷新测试使用真实隔离服务的实践状态，不冒充 DB 历史 E2E。

### 两种服务模式

| 模式 | 当前状态 | 持久化边界 |
| --- | --- | --- |
| `preview-isolated` | 已接 owner audit load/mark、同一 executor | 服务端限 32 个 owner/snapshot/revision/capsule 命名空间，固定约 30 分钟 TTL；同进程刷新可恢复；进程重启/跨副本不承诺保留 |
| `production-domain` | Reader + 原 Action 参数适配已实现；未接生产网关 | 原表/原服务，不新增表；不会由客户端 boolean 选择 |

Preview store 只存稳定 segment IDs，**没有录音 Blob/evidence 功能**。本轮没有伪造一个“隔离 evidence 上传成功”的第二套录音领域系统。

## 5. Recording：旧链与阻断

### 5.1 真实旧链

`KoreanLevelOneSmartTextbook.tsx:2427 → RecordingControl`：`getUserMedia → MediaRecorder → Blob → POST /api/digital-textbook/recordings/[activityId]`；局部 Blob 回放、重录/删除、上传状态、短录音检查。带 repeat/full-recall metadata 时尝试 GET 恢复；独立介绍没有同样的完整恢复。

Route：`src/app/api/digital-textbook/recordings/[activityId]/route.ts`。

- GET/POST/DELETE 要求正常 active user、tenant、activity 可见和 speaking 类型。
- POST 使用 `digital_textbook_speaking_evidence`；independent_output、roleplay、guided repeat 走 R2。
- 原 POST 以 `student-recordings/{tenant}/{student}/{activity}/{evidence}.{ext}` 保存上述 R2 资源。
- 原 evidence 表记录 owner/activity、大小、MIME、metadata、消耗标记；没有 Manifest snapshot 身份列。

### 5.2 实际执行原服务复现的问题

| 问题 | 代码证据 | 本轮结果 |
| --- | --- | --- |
| 上传 R2，提交仍核验旧 Supabase Storage | Route 约 223–295 行；`smart-textbook-submission.ts:282 → verifySpeakingRecordingEvidence` 期待不带 `student-recordings/` 的路径，并调用 Storage `.list()` | 原 POST 成功返回 evidence 后，原 submit 在 RPC 前拒绝“未找到可核验的本人录音”；隔离测试复现 |
| 独立/角色录音无法通过原 GET evidenceId 回放 | Route 约 82 行要求 `isGuidedRepeatMetadata` | 同一合成 owner/activity 的 independent/roleplay evidence 均得到 404 |
| roleplay/repeat 上传未写 `metadata.storage=r2` | Route 三元 metadata 分支约 282–295 行，仅 independent 分支有 storage | 原 DELETE 约 394 行误选 Supabase Storage；隔离 transport 返回 503，R2 测试对象未删除 |
| 原 speaking RPC 仍依赖 Storage 对象 | `supabase/migrations/202608180023_speaking_recording_evidence.sql:50/119` | 仓库函数核验 `storage.objects`，有 `FOR UPDATE`、consumed guard；**当前线上 RPC 是否另有变更未确认**，未连接 DB 推断 |
| owner 无 tenant 不能直接借用旧上传/跟读写服务做审计 | 原 auth 检查在 preview 分支前 | 合成 owner 无 tenant：录音 403，旧 repeat Action 返回失败；未冒用学生补 tenant |

这些是原 handlers + 合成 auth/DB/对象传输的测试，不是生产数据变更。对照测试只在**合成 evidence 行**使用旧格式路径，确认原 verifier 能达到其原 Storage 分支；没有重写真实路径、hash 或存储后端。

## 6. Speaking evidence 与 speaking-introduction

第一章真实 `speaking-introduction` 是 `independent_output`，不是普通开放文本题。旧 Activity 的 outline/criteria 选择与 RecordingControl 组合，达到所需选项数和录音时长后调用原 submit。配置/原服务要求至少 4 项 criteria、至少 15 秒（服务端正式条件还检查时长上限和输入结构）；不计算 AI 发音评分。

真实链：

```text
outline/criteria + recordingEvidenceId
→ submitSmartTextbookActivityForContext
→ gradeSmartTextbookActivity(open speaking，correct/score 为 null)
→ verifySpeakingRecordingEvidence(owner/activity/age/consumed/bytes/storage)
→ record_smart_textbook_speaking_attempt
→ existing attempt + node progress
→ smart-digital-textbook loader
```

注意：`preview:true` 返回分支也位于 speaking evidence 验证之后，不能把 preview 当成跳过证据的开关。

原 SQL 证据锁与消耗可作为后续复用基础；本轮没有完成 R2 evidence→当前 snapshot/version→原完成服务的安全闭环。尤其 evidence 表自身没有 snapshot 列，不能仅因 activity 相同就声明跨 snapshot 可安全复用。本轮没有实现/宣称跨活动、跨学生、跨 snapshot 的新 recording gateway 或重复消费完成保障。

**当前状态：unsupported（Runtime 完整录音/提交/恢复执行链）。** 旧系统服务保持原样，真实配置静态内容投影不被记作可执行验收。

## 7. Dialogue-roleplay

真实旧组件：课程目录 `KoreanLevelOneSmartTextbook.tsx:2704 → DialogueRoleplayPractice`。使用 `dialogueScenes` 的 scene、role、turn；对方台词 TTS→学生话轮录音→角色 evidence→原 completion Action。SpeechRecognition 是可选辅助，缺失/失败不阻断录音；客户端文本匹配不是正式分数。

`smart-textbook-actions.ts:84 → completeDialogueRoleplayAction`：

- 查询原 node `content.dialogueScenes`；left/right 根据奇偶取所选角色所需话轮。
- evidence 按可信 tenant/student/activity 和 sceneId/roleSide 查询，所有 required turn 有录音后才可继续。
- preview 返回非正式完成。
- 正式分支先查已完成 attempt；存在时返回 node progress。
- 否则调用原 `record_smart_textbook_attempt`（correct/score 为 null），随后更新 evidence consumed。

后两步不是同一个 evidence-consumption RPC；本轮没有证明并发重复请求的原子等价，不能声称“重复消费绝不产生两次完成”。也没有用新开放题表单替代角色扮演。

旧 UI 可从 activity completion 恢复完成标志，并尝试原 completion Action；完整逐话轮 Blob/evidence 历史恢复仍需解决原 GET/DELETE 与绑定问题。**新 Runtime role/turn executor、录音和恢复/retry 未完成，状态 unsupported。**

## 8. 五项验收与剩余工作

| 能力 | 当前分类 | 已完成 | 尚未完成/阻断 |
| --- | --- | --- | --- |
| guided repeat | **partial** | 两轨 14 句、稳定 IDs、当前句 Browser TTS、隔离标记、原 Action 参数语义、真实 SELECT Reader、刷新/取消测试 | authorized target.play、track 生命周期的旧分页等价、生产 Reader 网关接入、完整 full-recall recording；不是全部 equivalent |
| recording | **unsupported** | 原 Route 的真实隔离诊断与数据边界追踪 | 新 Runtime 录音组件/上传/删除/重录、隔离 preview recording storage；原存储链不一致 |
| speaking evidence | **partial** | 原表/RPC/消费/恢复边界追踪；原 evidence 校验执行测试 | 当前 snapshot 安全绑定、实际历史 Reader→UI、跨上下文拒绝和消费闭环 |
| speaking-introduction | **unsupported** | 原配置、outline/criteria、完成规则与缺陷证据 | 原录音/evidence/submit 成功闭环、restore |
| dialogue-roleplay | **unsupported** | 原 scene/role/turn/可选识别/原 completion 链追踪 | mounted role-turn executor、录音证据、restore/retry、并发完成保障 |

没有把这些 partial 升级 `compat.learning.v1`。`compat.teacher.v1` 以及其他 Phase 4A 剩余项没有在本轮扩展。

与上轮相同的 executable capabilities：`layout.v1`、`navigation.linear.v1`、`progress.server.v1`、`block.text`、`block.multiple_choice`。此次跟读是 unsupported composite 内部可审计子能力，不是把整个 composite 标 implemented。

## 9. 测试与证据边界

| 测试 | 结果 |
| --- | --- |
| 新原领域诊断 | 7/7 |
| 新 repeat DTO/private binding/Reader/store/auth/播放单元测试 | 10/10 |
| 新 Chromium 挂载 | 7/7（含父测试与 6 个子测试） |
| Phase 3A–3E、4A、4A-2、4A-3 与相关 legacy 合并 | **505/505**，无失败/跳过/取消 |
| TypeScript（含非增量） | 通过 |
| `git diff --check` | 通过 |
| 正常已授权 platform_owner 浏览器 E2E | **未完成** |

本轮新增共 **24 项**。诊断测试通过表示准确复现并锁定阻断，不表示 recording 功能成功。

Chromium 使用真实 React scoped executor/Step controller/TargetRegistry 与隔离 HTTP 服务；只替换操作系统语音输出和认证/数据传输边界。没有登录他人账号、没有真实学生数据，不能冒充 owner E2E。

录音 UI 的 start/stop、MediaRecorder 权限拒绝、上传取消、角色全话轮完成、真实 evidence restore、跨 snapshot 消费等用户要求测试**尚未满足**；没有创建空测试或将未测项标为通过。

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

## 10. 只读自查与停止边界

- 冻结样本仍是 **8 Step、19 Activity、orientation 三题、published v23 legacy**；没有虚构 teacher video。未读取线上新 revision，因此线上是否在他处更新不作推断。
- 与上一阶段记录的内容哈希比较：`src/lib/smart-textbook-runtime-v1/`、`src/lib/smart-textbook-legacy-adapter/`、`src/app/dashboard/courses/`、`src/app/api/learning-agent/`、`supabase/migrations/`、`learning-agent-script-runtime.ts`、`smart-digital-textbook.ts`、Phase 3E `learning-agent-buffer-selection.server.ts` 均一致。
- 本轮未执行真实 DB SELECT/写入、migration、发布或媒体上传；诊断 DB/upsert/R2 PUT 都在合成 transport 中。原 recordings Route 仅被读取/隔离测试，没有编辑。
- 新 gateway 仅 owner audit 可调用；strict request 拒绝 studentId、tenantId、旧 indices、score、completion、objectKey、mode。Manifest 与公开 repeat DTO 不包含 secrets/object keys。
- `trackingDisabled=true` 的 owner 页面不写正式进度；同一个 scoped executor 接受服务返回模式，没有客户端切换持久化后端的按钮/字段。
- 没有接管正式学生页面，没有删除旧 Runtime。UI 按 ui-styling/ui-ux-pro-max 保留既有样式、使用 CardTitleWithHint，并加可访问状态/停止/错误反馈，不做视觉重设计。
- 用户的正常 Chrome 登录在其个人电脑，本执行环境没有可用已授权浏览器会话；没有读取 Cookie、创建 magic link 或使用 service role 冒用 owner。

**停止于本轮安全子集，不宣告 Phase 4A-3 完整收口。** 后续先确认旧录音存储/证据服务的一致性修复范围。若需要修改仓库 SQL 所示 RPC，必须再次取得明确授权；本轮不能用数据库迁移或第二套证据系统跨过这一边界。之后仍须完成本阶段剩余 executor、binding、restore 和 owner 验收，不进入 Phase 4B。
