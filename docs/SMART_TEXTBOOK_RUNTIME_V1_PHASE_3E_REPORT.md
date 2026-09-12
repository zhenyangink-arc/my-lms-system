# Phase 3E — Speech Selection 一致性修复

## 修改前记录（2026-09-09）

本轮开始前工作区已有大量未提交改动；按文件内容哈希记录本轮基线，只修改 buffer selection 相关代码。未读取学生个人内容，未执行数据库操作。

Phase 3D：`remainingNonUiUnsupported=1`，`nonUiRuntimeReady=false`，`runtimeReady=false`。TTS observation 已解决，剩余 `speech.voiceTimeline`。

| 原 runtime path | expected text / preset | segment / candidate | 原校验与选择 | 原 fallback |
| --- | --- | --- | --- | --- |
| opening / restart | published 首节点 bufferLine / 文本匹配 preset | 199 / openingBufferSpeechAssets | loader 仅 node+locale+ready，未验 hash；客户端先 asset 后 preset | 无 ID 或请求失败 → 浏览器 TTS；音频播放失败 → 文本 |
| resume 首帧 | published 对齐后的 session node bufferLine | 199 / activeSessionBufferSpeechAssets | 同样未验 hash；初始化空 session ID 可能回退 opening ID | 同上 |
| re-entry / reset | activeSessionBufferLine `||` openingBufferLine | 199 / session ID 或 opening ID | 空 buffer 被覆盖为 opening 文本，可能与 session ID 不符 | 同上 |
| transition | upcomingScriptNodeBufferLine(next node) / 文本精确 preset | 199 | resolveBufferLineSpeechAssetId：preset 优先，否则 node+locale+hash+ready；未显式检查 published version / preset 配置冲突 | 无 ID → 现有浏览器 TTS / 文本；空文本 → 不播放 |
| terminal 正常结束 | upcoming helper 返回空 | 无 | respond 正常结束 session；loader 只查 active | 不播放 |
| historical active terminal restore | terminal configuration buffer | 199 ready 行 | loader 没有 hash guard；不能由代码证明历史 active terminal 不存在 | 不可假定正确 |
| owner preview opening | draft/指定版本首节点 buffer | 199 ready 行 | 同样无 hash 验证 | 同样现有 TTS / 文本 |

证据：`src/lib/smart-digital-textbook.ts` 的 opening / active session 查询；`src/lib/learning-agent-script-runtime.ts` 的 upcomingScriptNodeBufferLine / resolveBufferLineSpeechAssetId / isTerminalScriptNode；学生组件的 tutorNextBufferSpeechAssetId / activeOpeningBufferSpeechAssetId / startTutorLesson / tutorReply / playTutorBufferSpeech；owner preview/page.tsx 的 previewBufferSpeechAssets。

必须修复 null 后跨 node / locale 补选 ID 的客户端表达式，否则单修服务器不能证明文本与音频一致。仅改 buffer 取值，不重构 Shell 或教学流程。

## 最终结果

| 指标 | Phase 3E |
| --- | --- |
| 原非 UI unsupported | 1：speech.voiceTimeline |
| 本轮解决 | 1 |
| remainingNonUiUnsupported | **0** |
| nonUiRuntimeReady | **true** |
| runtimeReady | **false** |
| 剩余 unsupported | 1：runtime.capabilities（所有 Renderer / Compatibility Executor 仍未实现） |

这是**当前工作区代码 + 固定 v23 证据的非 UI readiness 结论**，不是已部署、浏览器实听或所有 preset 对象可用性的认证。本轮没有部署，也没有访问/修改生产数据库。真实数据沿用 Phase 3C/3D 于 2026-09-09 SELECT-only 核验并冻结的 source / service-evidence；没有重新制作内容或推断新资源。

架构基线：现状审计、实际存在的 `SMART_TEXTBOOK_TARGET_STATE_AUDIT.md`、Manifest/Runtime v1 设计、Phase 3A–3D 报告。KEEP/MIGRATE/RETIRE 不变，Manifest v1 类型与 validator 不变。

## 1. 根因与统一选择规则

根因不是 199 资源数据库行不存在，而是不同读取路径把「候选」误当成「已验证选择」。transition 原有 hash 条件不足以保护 loader；客户端的跨 node / locale 回退进一步破坏了文本与音频配对。

新服务器入口：`src/lib/learning-agent-buffer-selection.server.ts`。

`selectBufferSpeech` 返回闭合 union：

- `preset`：现有 `learningAgentBufferPresetForText(locale,text)` 精确匹配，返回现有 `buffer-preset:{id}:{locale}`，优先于数据库候选。
- `verified-asset`：仅唯一合法 199 候选可被选择。
- `existing-browser-tts-fallback`：无合法资源，或 preset ID/文本冲突；ID 为 null，调用已存在的 TTS / 文本路径。
- `silent`：配置文本为空，ID 为 null，不启动播放。
- `unsupported`：版本/节点上下文不合法、请求文本与配置不一致、多个合法候选歧义。不给出可播放 ID；readiness 不得将其降为 warning。

规则按顺序执行：

1. 服务器读取的 script version 必须 published，node 的 scriptVersionId 必须等于该版本 ID。学生路径不接受 draft / archived；已通过平台负责人验证的现有预览路径明确传入 owner-preview 上下文，保留 draft / archived 预览（既有 preview Route 只要求版本存在，speech Route 原本允许 owner 访问）。这不是客户端可提交的授权开关。
2. buffer 文本按既有 `configuredText` 语义取 locale，缺值回退 zh-CN，`.trim()`；不新增 Unicode、内部空白、标点或富文本改写。`SHA-256(UTF-8 normalizedText)` 与 `content_hash` 精确比较。
3. 199 候选验证 node FK、locale、segment=199、status=ready、hash。资源表没有独立 script version 字段，版本归属由 `asset.script_node_id → 已验证 node.script_version_id → published version` 证明，不伪造新列。
4. 配置 preset ID 必须与真实文本匹配结果一致；`none + 非空文本` 同样视为冲突。拒绝 preset / asset，走已有 null-ID fallback；不反推 preset、不修改文本。
5. 合法 preset 优先；否则只能选择唯一合法 asset；没有合法项才使用现有 fallback。资源查询顺序不影响结果。

`selectBufferSpeechIds` 是 opening / active-session / owner-preview 的批量投影。查询使用 `BUFFER_CANDIDATE_COLUMNS`，包含 hash / status / node / locale / segment。DB ready row 不再直接成为学生端 ID。运行时 `resolveBufferLineSpeechAssetId` 也调用同一个 selector，不维护第二套判定。

## 2. 生产文件修改范围

| 文件 | 仅本轮修改 |
| --- | --- |
| `src/lib/learning-agent-buffer-selection.server.ts`（新增） | 无写操作的服务器选择策略、候选类型、批量投影 |
| `src/lib/smart-digital-textbook.ts` | opening / active-session 查询补充校验所需字段；保留 published node/version 归属；调用统一 selector 后才投影 ID |
| `src/lib/learning-agent-script-runtime.ts` | 仅 buffer resolver 的 import、可选 owner-preview 参数、version/candidate SELECT 与选择函数；不改 resolveScriptStep / node 顺序 / task / remediation / completion |
| `src/lib/learning-agent-buffer-state.ts` | 新增 `bufferPairForStage`；保留空文本、null ID，不跨节点或语言补 ID |
| 学生 `KoreanLevelOneSmartTextbook.tsx` | 只替换 buffer 初始化、恢复、重启和请求时的选择表达式，移除客户端自行补 preset；没有修改 ContentRenderer / 页面布局 / 判题 / 录音 |
| 现有 `src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/preview/page.tsx` | 原有 preview opening 也有 ready-row-first 漏洞；改为同一候选校验。未新增页面或 Renderer |
| 现有 `src/app/api/learning-agent/preview-respond/route.ts` | 仅调用 buffer resolver 时显式传入已授权 owner-preview；授权、教学流程不变 |

`SmartTextbookShell.tsx`、正式 respond Route、events Route、speech Route、smart-textbook-actions、preset 文件、全部 migration 与业务数据样本均与本轮起点哈希一致。

新增/更新旁路文件：

- `current-speech-proof.server.ts`：固定 v23 的当前路径证明，直接复用生产 selector。
- `final-proof.server.ts`：闭合路径/结果类型扩充及 private validator 重算检查；保留 revision 1 历史审计，revision 2 使用当前 selector。
- `final-readiness.server.ts`：原 Phase 3D 计算器命名为 `auditPhase3DNonUiReadiness`，历史结论不被覆盖；`finalizeChapterOneNonUiReadiness` 默认只计算当前 policy，重新验证 private bindings 后清除 speech blocker。
- `tests/smart-textbook-speech-selection.test.mjs`：Phase 3E 正反测试。
- `tests/fixtures/smart-textbook-legacy-adapter/chapter-one-speech-selection-proof.server.ts`：完整 98 条离线冻结证明、16 条资源分类和 digest，server-only，没有媒体位置。

生产文件没有 import Legacy Adapter。共享依赖方向为 **Adapter → production selector**，没有反向接管学生路径。

## 3. 所有当前路径的结果

所有下表 buffer 路径都按 `真实配置文本 → preset → 199 候选 → hash-safe selector → paired ID/null → 既有播放器/fallback` 执行。

| runtime path | 来源 / 校验 | v23 结果（含 zh-CN、ko-KR） |
| --- | --- | --- |
| opening-loader | published sort_order=1 node，统一 batch selector | 2 preset |
| restart | 同一 opening 的 text/ID 配对，不使用恢复节点 ID | 2 preset |
| resume-loader | published 对齐后的 active session node；相同 selector | 4 preset + 12 silent |
| resume-reentry | 与 resume 同源配对；空文本不再 `|| opening` | 4 preset + 12 silent |
| reset | 复用 activeBufferPair；不跨 locale / node 补 ID | 4 preset + 12 silent |
| buffer-transition | `upcomingScriptNodeBufferLine` / `upcomingScriptNodeForBufferLine` 提供真实 successor；统一 resolver | 2 preset + 12 silent |
| terminal-restore | 不假定历史 active terminal 不存在；同一 selector | 2 silent |
| terminal-completed | 正常完成后的 session 不在 active loader 中 | 2 silent（排除证明，不是额外播放） |
| script 非 199 | 原 exact script/hash/timeline 规则保持 | 28 verified asset |

共 **98 条证明 = 70 条 buffer/恢复路径（18 preset、52 silent）+ 28 条普通 speech**。这是「路径 × 节点 × locale / segment」证明数，不是 98 个媒体资源。18 preset 选择对应 4 个不同 preset/locale 引用。当前快照不需要以 Browser TTS 作为首选 buffer；preset 请求失败等情形的现有 fallback 仍保留。

### 按真实节点的完整覆盖

每个非 terminal 节点都有 zh-CN / ko-KR 的 resume-loader、resume-reentry、reset；除首节点外均有进入该节点的 buffer-transition。首节点另外覆盖 opening 与 restart；terminal 另外覆盖 restore 与 completed exclusion。普通 script asset 逐条列在冻结 proof 文件，未省略任何一条现有 28 条证据。

| node_key | 配置 buffer / preset（两种 locale） | buffer 结果数 | 非 199 asset 证明数 |
| --- | --- | --- | --- |
| step-8-bbfc46（当前实际首节点） | teacher-introduction 精确文本 | 10 preset | 3 |
| welcome | 空 / none | 8 silent | 5 |
| observe-scene | focus-learning 精确文本 | 8 preset | 4 |
| explain-order | 空 / none | 8 silent | 4 |
| model-dialogue | 空 / none | 8 silent | 4 |
| check-understanding | 空 / none | 8 silent | 3 |
| lesson-mission | 空 / none | 8 silent | 3 |
| ready-for-practice | 空 / none；terminal | 12 silent | 2 |

首节点不是按名称猜测的 welcome，而是源数据 sort_order=1 的 `step-8-bbfc46`。

四条实际非空 buffer（不是从 asset 名称推断）：

| preset / locale | expected normalized text | SHA-256 |
| --- | --- | --- |
| teacher-introduction / zh-CN | 你好，我是你们的韩语老师，金老师。接下来由我陪伴你们学习韩语。 | `1a807e5f2f7878bbdebe3d48a70d485c1be5ab466abb288311072cd6fd6f49e9` |
| teacher-introduction / ko-KR | 안녕하세요, 여러분의 한국어 선생님 김 선생님이에요. 앞으로 여러분의 한국어 학습을 함께할게요. | `7e805acd5faa1c5526b00099acf7d64bf411e7d7052e91e2011113cde47a6ff5` |
| focus-learning / zh-CN | 接下来，请把注意力放到学习区。 | `8b3d0573b006a5ffe29f55a5a75ac58c5d8deabd2aafda0865e19cf539c96074` |
| focus-learning / ko-KR | 이제 학습 영역에 집중해 주세요. | `af1f888dabcd47d3cccb677d7dca341ccfcd8213a1ce3ec7c233937b7e9f2399` |

其余 buffer 均为空字符串；空文本不对应需要播放的 199 speech。普通 28 条 speech 保留各自文本/segment/hash/timeline 检查，不把 buffer 的空文本语义套用到 teacher_script。

## 4. 原 16 条 segment 199 如何处理

全部 **candidate-but-rejected**，0 selected current asset，0 删除、0 改 hash、0 改 status、0 重新生成、0 擅自标记 stale。

| node_key | zh-CN asset ID | ko-KR asset ID | 当前 buffer 选择 |
| --- | --- | --- | --- |
| step-8-bbfc46 | 03e9c447-ac05-4f21-a1ee-aed5bc407503 | 87da82fe-5cbe-4e47-9246-96cddab8bd3f | teacher-introduction preset；旧候选不覆盖 |
| welcome | 0aaa0b27-740a-4fc7-8eee-5e5747804a35 | 7b805fee-2608-440c-85ee-a460d49bd32b | silent |
| observe-scene | 6873c663-fb5f-4779-9384-8fee0b65641b | 4c231d36-abe7-43be-b683-beaf25c532c0 | focus-learning preset；旧候选不覆盖 |
| explain-order | 9e27f5e3-3f17-4b05-9879-61e9c76f8b8b | a0a554c4-42da-4ef0-ba72-3894888fd18f | silent |
| model-dialogue | d47641f8-2e64-4103-8fc2-2adbccd428df | d4444750-9c2d-4ce4-af88-4e9011b1c893 | silent |
| check-understanding | 975156c1-c730-41f3-a063-63857bca064a | b4334fd7-1c63-45ff-b75e-6f2b9dec216c | silent |
| lesson-mission | 764d1a44-a97f-47a6-9dad-ba7ca1f7c9ae | 0269cfba-ecd4-43bf-bd50-29e9523bd658 | silent |
| ready-for-practice | ba1280a3-3e32-4ed3-b2dc-cd57dfbb63a3 | b7e3ef6d-5332-4001-8ecd-7e800e34ed28 | terminal restore 也为 silent |

### ready-for-practice 两条原 unresolved

`learning-agent-script-runtime.ts → resolveScriptStep/isFinalStep` 与 `respond/route.ts → scriptedSessionCompleted/sessionStatus` 表明：正常完成 terminal 教学、且必需 task 满足后，session 变 completed。`smart-digital-textbook.ts` 只加载 active session。新会话正常从脚本起点执行，不能据此证明历史 active terminal 一定不存在。

本轮不查询任何学生会话内容，也不清理历史记录。对可能的 terminal restore，服务器使用同一 published-node selector。当前 v23 terminal 两种 locale 的 buffer 都为空，因此得到 silent；ready row 存在也不能成为播放依据。两条 blocker 退出不依赖“历史不可达”的假设。

## 5. Existing fallback 证据与边界

学生组件 `tutorReply` 已有：

```text
activeBufferLine 为空 → 不启动 buffer speech
activeBufferLine 非空且 ID 为 null → browserSpeechFallback()
speech fetch / response 失败 → catch → browserSpeechFallback()
browserSpeechFallback → speakTutorCharacterLine
没有 SpeechSynthesis / voiceEnabled=false → 显示文本并结束本次语音
Audio 播放失败 → playTutorBufferSpeech.finish("error") → 显示原文本
```

`Audio` 播放失败并不总是抛异常给 fetch catch；因此这里只证明已有 **TTS 或文本**，不声称所有音频失败都会自动重读。preset 对象是否实际存在、浏览器语音是否可用，不是 hash selector 能认证的内容；已有失败路径明确成立。没有发明新的产品 fallback。

本轮移除了 `requestedBufferSpeechAssetId ?? 客户端重算preset`，所以服务器拒绝 preset/text 冲突后，null 不会被客户端补回。`bufferPairForStage` 同时阻止 session null ID 继承 opening ID、ko-KR 缺失 ID 继承 zh-CN ID，以及空恢复文本被 opening 覆盖。

buffer selector 只返回播放资源或 null，不更新 Agent 状态。Browser TTS observation 的 Phase 3D 服务未修改；onend 仍不是正式学习完成，grant 输出 `formalCompletion=false`、`progressDelta=null`，不凭 buffer ended 改成绩、attempt、chapter progress。

## 6. Readiness / Private Binding 验证

`validatePrivateBindings → validateFinalProof` 对 revision 2 重新运行同一 selector 构建完整证明，与提交 proof 做确定性全量比对。检查缺失/重复路径、hash/preset/版本不一致、候选被错误选中、被拒绝资源进入 selectable catalog、伪造 fallback；不以 caller 的 ready 布尔值为证据。

历史 revision 1 仅用于明确命名的 Phase 3D 审计和其历史回归；当前 finalizer 强制构建 revision 2，不通过历史 policy 激活章节。任何无法验证的当前路径或剩余非 UI unsupported 都使 readiness=false。Renderer unsupported 永不由这层移除。

固定结果：

- source revision：`0feb9264ff035a1139cde70e9b1a4611608883d4832f06be87c4a5327f279fc0`
- readiness revision：`chapter-one-readiness.3`
- selection revision：`speech-reachability/2`
- proof digest：`2e6d6c871116a1be3e800ddfead33b1cc85d1400af083281f82bad880813c594`
- public Manifest digest（未变）：`sha256:423bc16d7056e2060198cd4873aa34fabdea45d2d7b48581168da8f6084f476f`

冻结 proof 包含完整路径/expected hash/preset/候选/选择/fallback/classification。全部 server-only；公开 Manifest 不含这些内部细节、object key、secret、private transcript 或 TTS grant。重复运行、speech evidence 数组反向排序均得到同一 proof、分类、TTS binding、digest，且不修改输入。

## 7. 测试与最终自查

Phase 3E 测试执行真实 loader 查询/投影片段，注入 SELECT-only 假结果；不是复制 selector 做自证，也没有 fake Renderer。覆盖错 hash/node/locale/version/status/segment、preset 冲突、缺失资源、空 buffer、恢复/重入/重启/terminal、非 199 保留和 private proof 篡改。

Phase 3D 的 53 项仍执行：仅将其修复前计数/优先级断言明确绑定到历史审计函数，并把原来要求生产代码存在 unsafe loader 的源码断言更新为安全接线。所有 TTS grant / replay / expiry / generation / score 注入等测试原样保留。没有删除历史失败证据来制造 ready。

| 验证 | 结果 |
| --- | --- |
| TypeScript：`npm run typecheck -- --incremental false --pretty false` | 通过，exit 0 |
| Phase 3A | 85/85 |
| Phase 3B | 50/50 |
| Phase 3C | 55/55 |
| Phase 3D（包括全部 Browser TTS grant 测试） | 53/53 |
| Phase 3E | 44/44 |
| 相关 legacy regression | 83/83 |
| 合并回归 | **370/370**，0 fail / skipped |
| `git diff --check` | 通过 |

合并回归命令：

```bash
node --no-warnings --experimental-strip-types --test \
  tests/smart-textbook-runtime-v1.test.mjs \
  tests/smart-textbook-legacy-adapter.test.mjs \
  tests/smart-textbook-readiness.test.mjs \
  tests/smart-textbook-final-readiness.test.mjs \
  tests/smart-textbook-speech-selection.test.mjs \
  tests/smart-textbook-sidebar.test.mjs \
  tests/learning-agent-*.test.mjs \
  tests/teaching-video.test.mjs tests/teacher-kim-*.test.mjs \
  tests/teaching-blackboard.test.mjs
```

最终只读反查：

- 8 Step、19 Activity、orientation 三道真实单选、published v23 legacy 均保持；没有 Teacher Video。
- 本轮源 fixture、service evidence、identity ledger、preset 和全部 Supabase 文件哈希不变；没有数据库命令、写入、migration、重新生成语音或发布。
- wrong-hash 199 不能由 opening/active/transition selector 产生 selected ID；恢复/重入/重启不再跨 node/locale 补 ID。
- 正常 terminal session 生命周期、Agent 推进、events、判题、录音和进度未修改。相关关键文件使用本轮起始哈希作为测试保护。
- 完整 98 条 proof、16 条 candidate 分类与 digest 已冻结并再次重算一致。
- 公开 Manifest 与 Phase 3C digest 相同；没有 secret/object key/private speech metadata 泄露。
- 生产未 import Adapter；没有 Runtime v1 UI、Preview 新页或 Renderer。唯一新接入生产的能力是本阶段获准的 buffer speech selector 及配对修复。
- 工作区既有未提交改动全部保留；本轮无文件删除。既有 migration 文件不代表本阶段创建或执行了 migration。

本阶段结束，**不进入 Phase 4**。
