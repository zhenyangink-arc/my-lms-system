# UPLY 智能教材 Phase 3B：第一章真实 Legacy Adapter

日期：2026-09-09；只读源采集于本次工作期间，随后通过新增 Reader 再读复核一致。

## 1. 交付结论

已实现旁路服务器侧链路：

```text
第一章 Legacy SELECT / 固定的真实源样本 + 冻结 identity mapping
  → adaptChapterOne
  → Lesson Manifest v1 candidate
  + server-only Compatibility DTO / PrivateBindings
  + 逐字段 ConversionReport
```

不是继续使用 Phase 3A 静态 Manifest 填空：Adapter 从真实 textbook/version/chapter、module/node/content、19 个活动、媒体和教学节点构建输出；没有 import Phase 3A 的静态 Manifest Fixture。

**第一章 Runtime-ready = false。** 候选 Manifest 结构合法，但有 **14 条 unsupported**，全部保留在结构化报告中。数据保留、服务绑定等价和 Renderer 可用是三个不同门槛，不能混同。

本次输出覆盖 8 Step、19 Activity、orientation 三道原生单选 Block、8 个 learning compatibility Block、1 个 legacy teacher Block，共 **12 Block / 317 part targets**。没有视频 Block，也没有 video-first teachingRef。

本阶段没有修改 Manifest v1，没有接管学生端，没有 Runtime UI，没有数据库 migration/写入，没有发布教材或制作教师视频。未进入 Phase 3C。

## 2. 架构基线及契约决定

采用并保持原样：

- `docs/SMART_TEXTBOOK_CURRENT_STATE_AUDIT.md`
- `docs/SMART_TEXTBOOK_TARGET_STATE_AUDIT.md`（实际存在的资产去留决策文件）
- `docs/SMART_TEXTBOOK_MANIFEST_RUNTIME_V1_DESIGN.md`
- `docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_3A_REPORT.md`
- `src/lib/smart-textbook-runtime-v1/`

**没有契约修正。** 第一章复杂内容通过既定 compat 引用承接。发现的播放 target 能力、跨章测试目的地等表达/服务缺口先列为 unsupported，没有扩大 Native Schema、没有新增自由 JSON 字段。

KEEP 的实体、秘密判题、录音和听力服务不动；MIGRATE 资产只增加读取/转换；RETIRE 的 Shell、ContentRenderer、骨架、角色代码全部保留。

## 3. 新增文件与调用方式

### 3.1 服务器实现

所有实现文件均位于 `src/lib/smart-textbook-legacy-adapter/`，均含 `import 'server-only'`，不从 Phase 3A 公共 index 导出。

| 文件 | 职责 |
| --- | --- |
| `reader.server.ts` | `readChapterOneLegacySource(client)`：注入已授权 Supabase client，固定第一章范围，12 类 SELECT，无 env/存储签名/写操作 |
| `source.server.ts` | Legacy 输入行边界 schema；未知 content/config 只在输入处接收，后续逐类解析 |
| `chapter-one-shapes.server.ts` | 按真实第一章逐字段建立的 strict 内容/活动/教学/metadata reader shapes；运行时不根据输入推断 schema |
| `profile.server.ts` | 固定第一章身份、八 module、当前学生标题覆盖、pageLabels、pages、slots、完成权重和活动身份/key/type |
| `identity.server.ts` | canonical/digest、持久行身份派生、冻结分配查找、显式离线 rebinding；无随机分配或写入 |
| `capsules.server.ts` | 闭合版本化 learning/teacher DTO、逐 activity key settings union、PrivateBindings 类型 |
| `report.server.ts` | ConversionReport、ConversionEntry、逐字段分类及来源定位 |
| `bindings.server.ts` | `validatePrivateBindings`：activity/media/progress/teaching/capsule/target 的离线关联检查 |
| `adapter.server.ts` | `adaptChapterOne(source, identityMap)`：主转换、扫描、Manifest 校验、unsupported 阻断 |

调用关系仅用于授权服务器/离线构建，不是新增 API：

```ts
const source = await readChapterOneLegacySource(authorizedServerClient);
const result = adaptChapterOne(source, frozenIdentityMap);
// result.manifest：公开结构候选；并非已发布产物。
// result.bindings：私有，只能保留在服务器。
// result.report.runtimeReady：本章当前为 false，不能接入学生路由。
```

Adapter 不要求自行连接服务器；纯转换可直接使用固定 source。Reader 不做用户授权决策，调用方必须先授权，不能在公开 Route 中直接暴露 Reader/Adapter 返回对象。特别是不得序列化整个 `result` 给浏览器。

### 3.2 测试资产

| 文件 | 内容 |
| --- | --- |
| `tests/fixtures/smart-textbook-legacy-adapter/chapter-one-source.server.ts` | 真实第一章 Legacy 输入采集；不是 Manifest，含服务器侧媒体位置和受控 legacy metadata，不得公开 |
| `tests/fixtures/smart-textbook-legacy-adapter/chapter-one-identities.server.ts` | 冻结的 498 个匿名实体分配及 2 条 listening track 分配 |
| `tests/fixtures/smart-textbook-legacy-adapter/chapter-one-conversion-summary.json` | 可复查的源 revision、Manifest digest、分类计数和全部 14 条 unsupported，不含私密值 |
| `tests/fixtures/smart-textbook-legacy-adapter/register-server-only.mjs` | 仅离线 Node 测试将 Next marker 解析到其 bundled server implementation；不是 Renderer |
| `tests/smart-textbook-legacy-adapter.test.mjs` | 50 项 Adapter/绑定/安全/确定性/负例测试 |

不重复创建去留文档，没有变更既有测试、package.json 或 tsconfig。

## 4. 实际读取的数据与证据

| 来源 | 数量 | 内容与边界 |
| --- | ---: | --- |
| digital_textbooks | 1 | `7100ab2b-72b0-478e-8847-4df9b4485109`；slug/title/status/student_app_id |
| digital_textbook_versions | 1 | `939ad4f7-3238-425e-91e9-d456c130ca68`，published v1 |
| digital_textbook_chapters | 1 | `cda24fb8-c93b-4a19-9577-4418350ff708`，hello，第一章 |
| digital_textbook_modules | 8 | 身份、章关系、code、sort_order、标题/说明/accent |
| digital_textbook_nodes | 8 | 身份、module 关系、code/type/order/minutes/title/content |
| digital_textbook_activities | 19 | key/type/order/prompt/instruction/options/public_config/max_attempts/counts_toward_completion |
| digital_textbook_media_assets | 73 | 图片/音频、状态、alt、metadata、私有对象位置 |
| digital_textbook_listening_tracks | 2 | activity_id + page_index 关联、音频位置/状态；该表没有独立 id |
| learning_agent_lessons | 8 | module 关联 |
| learning_agent_script_versions | 1 published | `feb30ba7-0a5e-4e9f-83e6-8970f715ddd5`，v23；其余 module 没有伪造 published script |
| learning_agent_script_nodes | 8 | 台词、configuration、activity 引用、next/remediation/action/required |
| learning_agent_script_audio_assets | 44 | 身份、locale、segment、hash、duration/status；不读取语音对象位置和完整 voice timeline |

另扫描 grammarCards 的 **9 个例句 audioId**、**2 项 speaking/role-play recording 依赖**。未读取学生 attempts、个人 progress、录音内容、activity secrets、脚本 interaction secrets 或听力 transcript 列。

第一次探查修正了“listening_tracks 存在 id”的错误假设；正式 Reader 按实际字段读取，不使用不存在字段。source schema 也允许现有空 alt_text；公开候选中的替代说明明确记为 unsupported，而非修改数据或扩展 Manifest。

新增 Reader 对真实服务执行后：`sameRevision=true`、`manifestValid=true`，8/8/19/73/2/44/8 计数与固定源样本相同。所有真实操作均为 SELECT，没有调用 RPC、mutation、存储上传或签名服务。

注意：多次 SELECT 不等于事务性发布快照。源摘要固定的是读到的内容；本阶段不声称数据库行已被锁定或 COW 已实现。

## 5. 八 Step 及所有 content key 去向

所有 module → Step 采用原 module UUID，按真实 sort_order 排序。标题使用当前 `KoreanLevelOneSmartTextbook.tsx → chapterOneKnowledgeMap`，旧 module 标题等保留在 private sourceMetadata。page/panel/slot 配置从现有 `smart-textbook-skeleton.ts` 固定到 reader profile；Adapter 不把索引或旧页码变成长期身份。

每个 Step 有独立 `compat.learning/1` Capsule，仅包含该 node 所需内容、其活动 settings、panels/slots/完成权重；不包含整本教材、Shell 状态、用户/session 或另一个导航 store。

| Step / 学生标题 | content key（全部识别） | 去向 |
| --- | --- | --- |
| orientation / 初次见面交流目标 | lead、coach、targets、nextNode、completion、dialogueGroups | 逐 slot 闭合 section；4 group / 14 line 均有识别；三题另为 multiple_choice Block |
| vocabulary / 问候与人物身份 | lead、coach、nextNode、vocabulary | 12 个词的 ko/zh/pos/collocation/transcription 全保留 |
| grammar / 主题助词与判断句 | lead、coach、nextNode、grammarCards | 3 张卡，form/rules/source/caution/function/examples 及 9 个音频标识全保留并扫描 |
| patterns / 姓名与身份介绍 | lead、coach、pattern、nextNode、patternCards、quickResponse、substitutions、personalOutput、substitutionGroups | 连续流程语义留在版本化兼容 section；不拆成伪原子 Block |
| dialogue / 初次见面对话结构 | lead、coach、nextNode、dialogueFlow、dialogueScenes | 2 场景/14 line、words/context/coverage 保留；role-play 依赖单独识别 |
| listen_speak / 听辨与口头表达 | lead、coach、nextNode、listenFor、repeatLines、repeatTracks、speakingFrame、listeningFocus、outputChecklist、listenSpeakPages、listeningContext、speakingCriteria、formalAudioStatus | 2 repeat track / 14 segment、6 旧 repeatLines 等完整保留；进度等价仍阻断 |
| read_write / 个人介绍读写 | lead、coach、rubric、reading、nextNode、questions、writingFrame、originalExample | 阅读原文、3 问题、4 项量规、写作支架/示例全保留 |
| review / 独立交流能力 | lead、coach、nextNode、checklist、returnMap | 5 项 checklist、4 项 returnMap 保留；外部 chapter-test 目的地尚未映射 |

测试对八个 node 分别重建 `sections → 原 content` 并做深相等断言；不以“只保留顶层 key 名称”代替内容保留。未知 key、未知嵌套字段、错误类型均不会透传进入 Capsule，报告 unsupported。

虽然私有 section 使用旧语义的字段值，但它是由明确 discriminator 和 strict schema 约束的 DTO，不是 `props: oldNode.content` 或开放 JSON fallback。Native Block props 只有 capsule/activity/progress 引用及稳定 parts。

## 6. 十九 Activity 转换

| Step | 全部 activity_key | 处理 |
| --- | --- | --- |
| orientation | orientation-check、orientation-jimin-occupation、orientation-wangming-occupation | 3 个 multiple_choice Block，真实四选项；ActivityRef 保留 single_choice；showScore=false |
| vocabulary | vocabulary-check | 12 内部 items 及选项/展示设置保留在该 key 的 closed activity DTO |
| grammar | grammar-choice、grammar-judgment、grammar-fill | 六项选择、六项判断、六项填空及 group/practiceKind/normalize 全保留 |
| patterns | pattern-choice、pattern-order、pattern-compose | conversation 8 steps、pathLabels/resettable、composition 6 steps 分别识别 |
| dialogue | dialogue-fact-check、dialogue-response、dialogue-roleplay | 理解/回应及角色扮演配置保留；recording evidenceService 引用现有服务 |
| listen_speak | listening-identity、speaking-introduction | 8 听力 items、2 配置 track、限次、口语 outline/criteria/时长等保留 |
| read_write | reading-profile、write-profile | 阅读多题、写作句数/短语/信息/字数要求留在兼容 settings 和领域绑定 |
| review | review-multiple、self-check | 多选及 Can-do/returnNodes/requiredChecks 保留 |

orientation 真实 ID：

- `aafa6ccc-4d4a-4dba-9315-2f30381e8a13`
- `6c8f70d4-a9be-4d58-b431-fa966b60f463`
- `cb3f6d75-4a6a-4610-84dc-7d19db6ef3a5`

全部 19 ActivityRef 保留原 activity UUID。公开 settings 只投影 Manifest 已允许的有限字段；完整旧公开配置通过各 activity_key 的闭合私有 DTO 保留，不随意扩充 ActivityRef Schema。maxAttempts/countsTowardCompletion/version 进入私有 domain binding，判题服务不改变。

这不等于服务端分组/归一化/录音消费已接入；尤其原子 options 为空的内部题组不被冒充为一道空题渲染。新 Capsule Renderer 尚未实现。

## 7. Teacher / 黑板兼容

真实 v23 的 8 个节点全部扫描并保留在一个 `compat.teacher/1` Capsule：

- teacherScript、nodeType、title、nextKey/remediationKey、activityRef、action、required 独立字段。
- configuration 拆成具名 section：blackboard、character、performances、student-task、visual-cue、hint、example、terminal、opening-line、opening-preset、continue-label。
- 当前 slides/elements 黑板和旧 kind/items/title/korean/translation 黑板均有闭合形状，不删除或擅自改坐标。
- virtualCharacter 的角色/位置及 pose、voice、响应式坐标、scale、learningLayout、autoContinue 等只在私有 compat DTO，不进入 LayoutV1/Block native props。
- 所有 8 节点含角色，0 teacherVideo；只有 orientation 指向 published v23，不为其他 Step 伪造教学内容。
- 44 个 speech 元数据以闭合 DTO 保存；完整 voice timeline 和授权解析未验证，保留 unsupported。

`dialogue:greeting:0` 与 `orientation:page:scene` 可以定位到稳定 part target；前者的真实播放/完成事件能力未承接，因此不是“target 字符串能解析就教学任务通过”。

## 8. 稳定身份方案

| 对象 | 身份策略 |
| --- | --- |
| module → Step | 原 module UUID，不依赖排序或标题 |
| node → learning Block/Capsule、activity → question Block | 以持久 node/activity UUID + 有限职责 slot 确定性派生 |
| activityRef | 原 activity UUID |
| 自带 id 的 group/scene/track/item | owner + 持久 collection identity + 旧 id 派生 |
| 无 id 的 line、vocabulary、grammarCard、option、segment 等 | 首次采集分配并冻结 UUID；后续仅查映射，不随机、不按现数组 index 分配 |
| panel | module UUID + 固定 page semantic key，不使用页号/标题 |
| 无独立 id 的 listening row | 冻结的 2 个 UUID；旧 activity/page 与音频摘要只用于私有匹配验证 |
| runtimeTarget | 既有 `step:.../block:...[/part:...]` 工具 |

匿名实体的内容 fingerprint **只用于找到既有分配**，不是 Runtime ID。改写内容、重复歧义或映射缺失会 unsupported；不会静默生成新身份。`rebindLegacyIdentity` 仅生成离线显式 rebinding 提案，保持已有 id；调用方审查后另行保存。嵌套匿名子对象必要时分别重绑，不按当前索引猜测。

私有 `identities` 保存 source path ↔ part 对照，路径内可以有旧 index，但输出身份不由该 index 生成。测试证明词汇数组重排仍对应相同身份；仅改文字必须显式重绑。当前分配清单不能被当成能自动识别任意编辑的智能对齐算法。

sourceRevision 包含规范化捕获内容、reader profile 与冻结 mapping。数据库返回的行数组按持久身份规范化；内部语义数组保留作者顺序。相同 source + adapter revision 重复运行时，Manifest、bindings、报告分类和 digest 完全一致。compiledAt 为固定离线构建标记，不是生产发布时间；摘要排除 snapshot。

## 9. 私有绑定与公开边界

`PrivateBindings` 包含：

- activities：activity/version/maxAttempts/completion policy 原关联。
- progress：chapter/node/activity/page/repeat refs 和 partIds；page/repeat 等价仍未认证，详见阻断项。
- media / mediaMetadata：实际 objectKey、assetKey、purpose、hotspots/制作信息/受限文字只在服务器。
- listening：冻结 track ref、旧 page、audioRef、`existing-authorized-service` transcript 策略。
- recordings：原 speaking 或 role-play activity/version、现有 evidenceService；没有读取用户录音。
- teaching / speech：固定脚本版本、入口、capsule、语音依赖。
- aliases：旧 target key 到稳定 target 映射，只在服务器。
- capsules：按当前 Step 作用域的闭合 DTO。
- identities / sourceMetadata：身份对照、旧 module/node 显示/类型/时间信息。

`validatePrivateBindings` 检查 catalog/绑定一一对应、capsule 归属和 target/part 悬空，但不是 Supabase 授权、证据校验或生产发布服务。测试刻意移除 activity/media/progress binding、破坏 alias，均发现具体错误。

公开 Manifest 不包含 answer_key、正确答案、object key、signed URL、service role、私密 transcript、原始 teacher_script/configuration 或 script secret。真实媒体对象位置逐项断言未出现在序列化 Manifest。源样本与 binding **本身是私有服务器资产**，不能放在 public 目录或作为下载 JSON 暴露。

## 10. Conversion Report 结果

可复现的摘要位于 `tests/fixtures/smart-textbook-legacy-adapter/chapter-one-conversion-summary.json`。完整逐字段报告由每次 `adaptChapterOne` 返回，不需写数据库。

| 项目 | 结果 |
| --- | ---: |
| modulesScanned / nodesScanned / activitiesScanned | 8 / 8 / 19 |
| media assets / listening tracks / grammar audio refs / speech / recording dependencies | 73 / 2 / 9 / 44 / 2 |
| teachingNodesScanned | 8 |
| converted | 1241 |
| preservedInCompat | 2883 |
| ignoredSafe | 0 |
| unsupported | 14 |
| runtimeReady | false |

分类数包括对象容器及嵌套字段，不等于 Block 数。没有为了减少阻断而使用 ignored-safe；未来只有提供不影响体验的具体证据才能采用该分类。

每项保留 source 的 module/node/activity/media/teachingNode 身份、legacy JSON path、result/reason，并在可映射时提供 Step/Block/part/ref/capsule。对话行等优先落到实际分配的 part，而非只指向整个 section。针对同一精确 source path，unsupported 优先，不会同时把它当成功字段统计。

固定摘要：

```text
adapterRevision = chapter-one-adapter.1
sourceRevision = 0feb9264ff035a1139cde70e9b1a4611608883d4832f06be87c4a5327f279fc0
manifest digest = sha256:32e2a1f75eddc82eed402fdb69191648da1f2e31cac8ee128e1836d9fe952259
```

## 11. 所有 unsupported（14 条，未降为 warning）

| 项目 | 数量 | 事实/阻断原因 |
| --- | ---: | --- |
| 跟读音频 alt_text 缺失 | 6 | 6 条 pending audio 的 alt 为空；候选有明确通用替代，但未证明等价，不能宣布 ready |
| 听力旧 audioId 别名未解析 | 2 | public_config.audioId=`chapter-01-listening-identity`、tracks[1].audioId=`chapter-01-listening-dialogue-normal` 在本次 media asset key 集合没有对应项；实际 listening row 两条均已保留，仍需补证别名对应关系 |
| review 的 nextNode 外部目的地 | 1 | `chapter-test:korean-level-one-01` 是旧章节测试目的地，不是本章 node；新运行绑定尚未承接，不能假装是普通 nextStep |
| studentTask 播放完成能力 | 1 | `dialogue:greeting:0` 已映射 identity，但 compat.learning 当前不能声明 playable media / audio_completed 证据；尚无 Teaching Bridge |
| activity-page 关联/聚合等价 | 1 | 当前保存的是 module panel 身份和 node 侧依赖描述；不能把它谎称为旧 activity-page item grouping 服务绑定 |
| guided-repeat 历史索引关联等价 | 1 | track/segment 身份保存，speaking 依赖识别，但原 activity/track_index/segment_index 写入与恢复映射未认证 |
| speech timeline / segment 一致性与授权 | 1 | 44 个语音身份/segment/hash/status 已保留，完整 voice timeline 和版本固定的授权解析尚未核验 |
| Renderer / 兼容执行器未实现 | 1 | Phase 3A Registry 仍全部 unimplemented，本阶段没有实现 UI/Runtime |

这些是**新 Adapter 的承接缺口，不是对现有学生系统故障的断言**。例如现行 audio Route 使用 listening_tracks 后再 fallback secrets，不单纯依赖 public_config.audioId；chapter-test 也有原路由。不能因此静默忽略，亦不能因为旧系统能运行就声称新绑定已经完成。

证据：`src/app/api/digital-textbook/audio/[activityId]/route.ts` 的 track/secret fallback；`smart-textbook-actions.ts → saveGuidedRepeatProgressAction` 的 speaking activity + track/segment 关联；源样本中的 review.nextNode 和 model-dialogue.studentTask。

因此当前允许检查/存档候选，**禁止发布、激活或接入学生路由**。

## 12. 测试与只读自查

执行：

```bash
npm run typecheck -- --incremental false --pretty false
node --no-warnings --experimental-strip-types --test tests/smart-textbook-legacy-adapter.test.mjs tests/smart-textbook-runtime-v1.test.mjs tests/smart-textbook-sidebar.test.mjs tests/learning-agent-*.test.mjs tests/teaching-video.test.mjs tests/teacher-kim-*.test.mjs tests/teaching-blackboard.test.mjs
git diff --check
```

| 验证 | 结果 |
| --- | --- |
| Phase 3B 新增测试 | 50 项通过 |
| Phase 3A 原测试 | 85 项通过，未修改原测试 |
| 相关旧系统回归 | 83 项通过 |
| 合计 | 218 passed，0 failed，0 skipped |
| TypeScript | 通过；未抑制错误或修改编译配置 |
| 真实 Reader / Adapter 复核 | SELECT-only；源摘要与固定样本一致，候选通过 Validator，ready=false |
| 确定性 | 同输入两次全结果相同；源行读取顺序颠倒仍相同；源对象不变 |
| 字段保留 | 八 node 完整 roundtrip；逐 node/activity/teacher JSON leaf 均有分类 |
| 安全/负例 | 未知 module/content/config/type、activity/media 悬空、坏 capsule/teacher/pose、未知 target、缺 identity 和坏 binding 均被具体拒绝 |
| 生产引用反查 | src 中没有范围外文件 import Adapter；所有实现均 server-only |
| 数据库变更 | 无新增 migration、无写入、无 RPC、无发布 |

开发期间发现并修复新文件的 TypeScript 问题（Supabase 动态 SELECT 推导和 union 在闭包中的窄化），以及报告条目共享 target 对象导致具体 part 定位被覆盖的问题；回归测试确认 dialogue 字段定位与冻结 alias 一致。没有修改旧代码规避错误。测试中只给 Node 进程配置 server-only marker，不创建 fake renderer。

## 13. 生产路径保护与停止

本阶段新增文件仅限上述 Adapter 目录、其 tests/fixtures/summary 和本报告。开始时工作区已有大量业务改动和未跟踪 migration；本次保留它们，没有用 reset/checkout 覆盖，没有将既有改动视为本阶段产物。

未修改学生课程路由、SmartTextbookShell、ContentRenderer、learning-agent runtime、判题、录音、Supabase schema 或 Phase 3A 契约。没有新的生产 import 链，没有环境凭据读取代码进入 Adapter，没有任何 DB mutation API。未迁移其他 15 章。

后续若继续，必须先针对上述 unsupported 单独明确承接与验收，尤其不能将 node-panel progress 当作已经完成的 activity-page 服务映射。当前结果如实保持 **Runtime-ready=false**。

**Phase 3B 到此停止，不自动进入 Phase 3C。**
