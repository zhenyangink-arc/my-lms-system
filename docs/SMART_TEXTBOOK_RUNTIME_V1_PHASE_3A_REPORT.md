# UPLY 智能教材 Runtime v1 · Phase 3A 报告

日期：2026-09-08。交付状态：**旁路契约、校验器、Registry metadata、第一章样本与测试已落地；未接入生产。**

## 1. 结论与范围

本阶段新增 25 种 Block 的闭合 TypeScript / Zod 契约、Manifest 结构与关联校验、稳定 target 工具，以及第一章完整八 Step 的结构样本。新增测试 **85/85 通过**；包含现有教材、教学 Agent、角色、黑板和教师视频回归的合并测试 **168/168 通过**；项目 TypeScript 检查通过。

第一章样本包含 **8 Step、19 个真实活动引用、14 个 Block**。orientation 三道真实单选题全部保留。其已发布 v23 教学脚本使用 `compat.teacher.v1`，没有伪造 teacherVideo。其余七个 Step 没有伪造已发布 teachingRef。

“完整样本”指八 Step、活动身份/公开题干、导航、placement、稳定目标和兼容边界的覆盖，**不表示所有旧 content/public_config 已无损转换为原生 Block，更不表示可发布或可播放**。复杂内容明确保留在 scoped compatibility capsule 引用；capsule 执行器、真实私有绑定和 Adapter 尚未实现。

未修改当前学生端、后台、API、判题、录音、Agent runtime、数据库或发布路径。未删除 legacy 代码。未进入 Phase 3B。

## 2. 使用的真实架构基线

- `docs/SMART_TEXTBOOK_CURRENT_STATE_AUDIT.md`
- `docs/SMART_TEXTBOOK_TARGET_STATE_AUDIT.md`：工作区实际存在的去留决策文档；未复制或另建历史名称的 DECISIONS 文件。
- `docs/SMART_TEXTBOOK_MANIFEST_RUNTIME_V1_DESIGN.md`

三份基线保持不变。KEEP / MIGRATE / RETIRE 决策未更改。

## 3. 新增文件

| 文件 | 内容 |
| --- | --- |
| `src/lib/smart-textbook-runtime-v1/contracts.ts` | 闭合 Zod schema、由 schema 推导的 TypeScript 类型、逐类型 Block props、安全富文本 AST |
| `src/lib/smart-textbook-runtime-v1/validator.ts` | `validateLessonManifestV1`，结构、关联、能力与 target 校验 |
| `src/lib/smart-textbook-runtime-v1/registry.ts` | 25 类型 metadata、`declaredPartIds`、`canPlayTarget`、契约能力与可执行能力分离 |
| `src/lib/smart-textbook-runtime-v1/targets.ts` | `isStableId`、`makeRuntimeTarget`、`parseRuntimeTarget` |
| `src/lib/smart-textbook-runtime-v1/index.ts` | 旁路导出；没有路由、副作用或服务连接 |
| `tests/fixtures/smart-textbook-runtime-v1/chapter-one.legacy.json` | 固定的第一章 legacy Manifest 样本 |
| `tests/fixtures/smart-textbook-runtime-v1/chapter-one.provenance.json` | 来源身份、一次性 ID 分配映射、覆盖说明、测试绑定清单；不属于公开 Manifest |
| `tests/fixtures/smart-textbook-runtime-v1/samples.mjs` | 5 个正样本、33 个具名反样本、25 类型独立 props / Manifest 样本 |
| `tests/fixtures/smart-textbook-runtime-v1/digest.mjs` | 仅测试使用的样本内容摘要检查；不是发布编译器 |
| `tests/fixtures/smart-textbook-runtime-v1/type-contracts.ts` | 编译期 discriminator narrowing 与私密/错误字段反断言 |
| `tests/smart-textbook-runtime-v1.test.mjs` | 新增 85 项单元测试 |
| `docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_3A_REPORT.md` | 本报告 |

没有修改 package.json、tsconfig 或引入新依赖。使用项目已安装的 Zod 4 与 TypeScript。

## 4. 契约落地情况

已导出：`LessonManifestV1`、`LayoutV1`、`RegionV1`、`StepV1`、`BlockV1`、`NavigationV1`、`RuntimeTargetV1`、`MediaRefV1`、`ActivityRefV1`、`ProgressRefV1`、`TeachingRefV1`、`RuntimeContextV1`，以及 `BlockTypeV1` / `RichNodeV1`。

- 固定 `schemaVersion="1.0.0"`、`runtimeContract="uply-runtime/1"`。
- Block 使用 `type` discriminator，25 种 props 各有 strict object schema；没有开放 JSON props、任意 child Block 或 `Record<string, unknown>` 兜底。
- Layout 只接受设计中枚举 preset、比例、断点与呈现策略，不接受 style、坐标或 CSS。
- Region 仅允许三个根和 interaction 的 main/support/feedback 一层子区。navigation 不接收作者 Block。
- 富文本只允许 text/paragraph/list/strong/em/link/lang AST，最多四层；链接只允许 HTTPS；无 HTML 属性透传。
- ActivityRef 使用现有活动类型的闭合公开 settings。旧 `single_choice` 对应 Block `multiple_choice`，旧 `multiple_choice` 对应 Block `multiple_select`。
- 完成条件只有 none 或 server policyRef。章节完成 authority 固定 server；没有客户端分数或完成百分比字段。
- RuntimeContext 的 draft 必须 trackingDisabled；没有 Preview 专用 Renderer 类型。

设计文档未详细展开的 patterns、roles、turns、source、scaffold、examples、公开 settings，本次补为有限的语义结构，不引入递归流程或任意旧 JSON。它们是可验证的第一版契约，不应被误读为已经证明覆盖全部旧字段。

## 5. Validator 实际检查

`validateLessonManifestV1(input, options)` 返回 `{ success: true, data }` 或 `{ success: false, issues: [{ path, message }] }`，不修改输入、不访问服务器、不执行提交。

| 检查组 | 已实现规则 |
| --- | --- |
| 结构 | 必需字段、未知字段、版本、闭合枚举和逐类型 props |
| 身份 | 各 catalog 身份唯一、Step key 唯一、activityId 唯一、选项/自查项目身份唯一、Composite part 唯一 |
| 顺序 | 正整数；Step order 唯一；同 Step/Region Block order 唯一；placement 按 order；允许不同区域同时 order=1 |
| Region | 必需四区、受控可选子区、parent/role/content 一致、Registry 和模板均允许 Block 类型 |
| Placement | Block 必须属于存在的 Step；恰好一个 placement；placement 的 Step/Region 与 Block 一致；不存在的 Block 拒绝 |
| 导航 | items 唯一完整且按 Step.order；entryStep 是第一步；nextStep 只能指向下一步，末步为 null |
| 引用 | activity/media/progress/teaching 和返回 target 不悬空；Activity 类型、媒体种类、章节/node/repeat progress kind 对应 |
| Target | 地址和 stepId/blockId/partId 一致；每 Block 有根 target；part 必须来自该 Block 的闭合 props；重复 target 拒绝 |
| 事件 | 提交必须 server-attempt；练习确认必须 server-practice；media-ended 只能 playback-observation；无活动的文本不能宣称提交事件 |
| 播放 | play/media-ended 必须对应实际声明媒体的 Block 或 part，不能因同级别的别处有音频就让静默 part 获得 play |
| 能力 | 未知、重复、缺失的 required capability 拒绝；支持传入 Runtime 实际支持列表 |
| 安全 | 禁止私密/可执行/装饰字段、原始 HTML/脚本协议/样式代码；禁止非 JSON、循环及超深输入 |
| 兼容 | compat Block 要求非 native profile 和 adapterRevision；legacy teachingRef 必须与所属 Step、legacy mode 一致 |
| 视频 | teacher video 必须对应 video-first teachingRef；published 检查拒绝 step-preview 或 pending/rejected 媒体 |

### 校验边界不得混淆

1. 默认调用验证**离线契约结构和 Manifest 内部引用**，不等于通过生产激活或发布授权。
2. capsule、固定 teaching cue、playback policy 是服务器外部绑定，不是增加到 Manifest 的自由策略目录。`requireBindings: true` 要求调用方提供 `resolveBinding`；不存在或解析失败即拒绝。published 检查也要求这些外部引用解析。测试使用 provenance 中的固定清单，不声称有真实 Gateway。
3. media/activity/progress 的 catalog 引用存在，不证明媒体授权、课程资格、源行不可变或服务器政策已经落地。这些仍需要未来 Adapter/Gateway 的依赖校验。
4. `supportedCapabilities` 默认使用契约列表，专用于 Phase 3A 的 schema 测试；`executableCapabilitiesV1` 当前是空数组。传入它会拒绝激活当前样本，不能拿 schema 通过假装 Renderer ready。
5. contentDigest 校验格式；真实样本摘要另有测试验证。正式 Loader 的摘要核验、完整发布依赖锁定、原子 pointer、权限与回滚均未实现。测试摘要函数不是 Runtime Compile 实现。
6. Schema 能拒绝私密字段，不能凭文字内容判断某段台词是否被错误标为 safeTranscript。未来编译器必须验证公开来源和访问策略；本阶段真实 Fixture 没有 safeTranscript 或私密稿件。

## 6. Block Registry v1

每个 entry 声明 type、capability、allowedRegions、propsValidator、atomic/composite、progressKinds、targetPartsRule；renderer / dispose / migrationReader 均明确为 `unimplemented`。

下表 teaching=T，interaction.main=M，interaction.support=S；它们是报告缩写，不是新增 Manifest 字段。

| Block | 原子/复合 | 允许区域 | 核心契约 |
| --- | --- | --- | --- |
| video | atomic | T/M | 视频 ref、poster/captions、角色、回退 |
| image | atomic | T/M/S | 图片 ref、alt、fit |
| text | atomic | T/M/S | 本地化段落 |
| rich_text | atomic | T/M/S | 安全文档 AST |
| audio | atomic | T/M/S | 音频 ref、公开文字、播放策略绑定 |
| dialogue | composite | M/S | 稳定 group/line |
| multiple_choice | atomic | M | single_choice 活动引用 |
| multiple_select | atomic | M | multiple_choice 活动引用 |
| fill_blank | atomic | M | 活动引用、inline/form |
| ordering | atomic | M | 活动引用、list/expression |
| listening | composite | M | 活动、音轨、exercise part、播放策略 |
| shadowing | composite | M | guided-repeat ref、track/segment |
| pronunciation | atomic | M | speaking ref、示范音频、公开量规 |
| role_play | composite | M | speaking ref、scene/role/turn |
| writing | atomic | M | writing ref、支架、量规 |
| self_check | atomic | M | 自查活动与稳定返回 target |
| supplemental_visual | composite | T/M/S | 顺序 slide、text/list/image，不含坐标 |
| vocabulary_practice | composite | M | entries、活动引用、panels |
| grammar_practice | composite | M | sections/examples、活动引用、panels |
| pattern_practice | composite | M | patterns/groups、活动引用、panels |
| listen_speak | composite | M | listening/speaking/repeat refs、tracks、panels |
| read_write | composite | M | reading/writing refs、source/scaffold、panels |
| review | composite | M | 活动/进度 refs、返回 targets、panels |
| compat.teacher.v1 | atomic | T | 固定 legacy teachingRef + capsuleRef |
| compat.learning.v1 | composite | M | scoped capsule、活动/进度 refs、parts |

**全部 25 个类型只有契约，没有新增 React Renderer。** Composition 表达流程边界，不表示支持任意 Composite 嵌套。part 的合法身份来自各闭合 props 的 id/exercisePartIds；实际展示、展开、focus、visualCue 和 Agent Bridge 均未实现。

## 7. 稳定 ID / Runtime Target

支持两个地址：

```text
step:{stepId}/block:{blockId}
step:{stepId}/block:{blockId}/part:{partId}
```

ID 是最多 128 字符、字母数字开头的 `[A-Za-z0-9._-]` 不透明身份。构造器拒绝路径、冒号、空白和 selector 控制字符；解析器拒绝额外层级、query、编码路径和错误后缀。

第一章 Step 直接沿用真实 module UUID。新增 Block/option/line/panel 使用一次性分配并写入静态 JSON 的 UUID；测试执行时不重新生成。来源旧 option/line 位置只保存在 provenance 对照清单，不成为 ID、target 或 Core 运行参数。原有 dialogue group 自带稳定 id 时保留。

语法工具不能证明调用方是否曾从标题生成一个合法字符串；长期稳定性须由未来编译器的持久身份映射保证。当前工具不读取数组索引、DOM、CSS、页码或标题。

## 8. 第一章真实 Fixture

### 8.1 来源复核

只读查询了教材、章、module、node 身份、活动公开题干/选项、Agent lesson / published version，以及 script configuration 的布尔存在情况。没有查询 activity secrets，没有写数据库、上传资源或生成生产媒体。

| 来源 | 固定身份/事实 |
| --- | --- |
| textbook | `7100ab2b-72b0-478e-8847-4df9b4485109`，`korean-level-one-smart` |
| textbook version | `939ad4f7-3238-425e-91e9-d456c130ca68`，v1（基线身份） |
| chapter | `cda24fb8-c93b-4a19-9577-4418350ff708`，hello，你好？/안녕하세요? |
| orientation node | `9fe730cd-a102-496e-adc5-9973b697af68`，mission-map |
| published script | `feb30ba7-0a5e-4e9f-83e6-8970f715ddd5`，v23，8 节点 |
| legacy/video | 8 节点含 virtualCharacter，0 teacherVideo；只有 orientation 查到 published script |

Step 标题使用当前 `KoreanLevelOneSmartTextbook.tsx → chapterOneKnowledgeMap` 的学生导航标题；旧 module 标题另由 provenance 的 module 身份定位。内部 panel 文案来自 `src/lib/smart-textbook-skeleton.ts`，固定复制进样本；新契约代码没有 import 旧骨架。

`textbook.appId="korean"` 表示现有路由 app key，不冒充数据库 UUID。template/snapshot/capsule/ref 的新增身份均为测试契约身份，不表示服务器已经保存或发布这些对象。

### 8.2 八 Step 覆盖

| Step | 真实活动数 | 样本表达 |
| --- | ---: | --- |
| orientation | 3 | 1 legacy teacher、1 lead text、1 dialogue（4 group / 14 line）、3 单选 Block、1 剩余目标/提示 scoped capsule |
| vocabulary | 1 | compatibility Composite，2 个稳定 panel，保留词汇练习活动身份 |
| grammar | 3 | compatibility Composite，2 个稳定 panel，保留选择/判断/填空身份 |
| patterns | 3 | compatibility Composite，3 个稳定 panel，保留选择/排序/组合输出身份 |
| dialogue | 3 | compatibility Composite，4 个稳定 panel，保留理解/回应/角色扮演身份 |
| listen_speak | 2 | compatibility Composite，4 个稳定 panel，保留听力/口语及 repeat/page progress 引用 |
| read_write | 2 | compatibility Composite，4 个稳定 panel，保留阅读/写作身份 |
| review | 2 | compatibility Composite，3 个稳定 panel，保留综合多选/自查身份 |
| 合计 | 19 | 8 Step；14 Block；所有活动恰好一个学习 owner |

orientation 三题（均 4 个真实选项，无正确性字段）：

| activityId | activity_key | 题干 |
| --- | --- | --- |
| `aafa6ccc-4d4a-4dba-9315-2f30381e8a13` | orientation-check | 王明和智敏初次见面时先说了什么？ |
| `6c8f70d4-a9be-4d58-b431-fa966b60f463` | orientation-jimin-occupation | 智敏的身份／职业是什么？ |
| `cb3f6d75-4a6a-4610-84dc-7d19db6ef3a5` | orientation-wangming-occupation | 王明的身份／职业是什么？ |

本阶段没有将 vocabulary-check 等内部多题活动误当成“空选项的一道原子题”渲染：它们只属于 compatibility Composite，原有题组配置仍由未来私有 capsule/Adapter 承接。公开 settings 是保守的闭合契约投影，不替换服务器评分/次数/完成政策；特别是不计分题仍有服务器记录引用，而不是由客户端计算分数。

### 8.3 媒体与复杂能力边界

真实 legacy Fixture 的 mediaRefs 为空，不声称已为旧媒体生成新 Resolver 绑定。现行黑板、角色、speech 的控制留在 teaching capsule；听力、稿件权限、跟读、录音和复杂练习留在 learning capsule。progressRef 是稳定关联占位，不携带用户答案或证据内容，不改变原表。

独立 `futureVideoDraft` 是明确的 synthetic pending 视频样本，用于验证 video-first 契约；published 校验拒绝它。它不是第一章真实发布数据。

## 9. 正反样本及测试

正样本：最小合法 Manifest、完整第一章结构样本、legacy teaching、dialogue Composite、独立 future video draft。另对全部 25 个 Registry entry 验证合法 props、未知/缺失 props、完整 Manifest 与声明 part。

33 个具名 invalid fixture 均实际执行并断言失败，包含用户列出的全部反例，并补充版本、缺字段、未知字段、重复 order、错误 progress/teaching/activity 类型、缺 root target、未知 part、错误导航、客户端完成和弱证据提交。另测超深 AST、循环输入、播放 part 权限与无活动的提交事件。

执行命令：

```bash
npm run typecheck -- --incremental false --pretty false
node --experimental-strip-types --test tests/smart-textbook-runtime-v1.test.mjs
node --experimental-strip-types --test tests/smart-textbook-runtime-v1.test.mjs tests/smart-textbook-sidebar.test.mjs tests/learning-agent-*.test.mjs tests/teaching-video.test.mjs tests/teacher-kim-*.test.mjs tests/teaching-blackboard.test.mjs
git diff --check
```

| 检查 | 结果 |
| --- | --- |
| 项目 TypeScript（含编译期反断言） | exit 0 |
| 新增测试 | 85 passed，0 failed，0 skipped |
| 新增 + 现有相关回归 | 168 passed，0 failed，0 skipped（现有 83 项） |
| invalid fixtures | 33/33 被拒绝 |
| 第一章摘要、8 Step、19 活动、三题、legacy 模式 | 通过 |
| diff 空白检查 | 通过 |

没有启动/接管学生路由，没有执行 DB integration/migration 测试或浏览器学习提交。现有 Node 的 module-type 提示未通过修改项目配置消除。首次编译期测试发现新测试文件相对导入路径错误，已修复并重新通过完整 typecheck；没有压制类型错误。

## 10. 生产保护与自我验证

通过工作区既有 src/tests/supabase/docs/package.json/tsconfig 文件的 SHA-256 基线比较，排除本阶段新增目录后，**没有既有文件发生变化，也没有新增范围外文件**。对 src 反向搜索，没有任何生产文件 import 新契约目录。工作区原本已有的业务改动与未跟踪 migration 均保留，不属于本阶段产物。

| 自查项 | 结果 |
| --- | --- |
| 学生入口、SmartTextbookShell、ContentRenderer、现有八 Step 行为 | 未改动、未接入新代码；相关回归通过 |
| 数据库 schema、migration、数据写入 | 本阶段均无 |
| 判题、录音、listening、guided repeat、Agent runtime | 原代码/表/行为保留；新代码仅声明 refs |
| activity secret / 答案 / object key / service role / 私密 transcript | 真实 Manifest 未包含；反样本的故意非法字段仅用于拒绝测试 |
| 第一章 8 Step / orientation 3 题 | 静态 Fixture 和测试双重检查通过 |
| legacy 第一章被误标 video-first | 否；唯一 teachingRef 为 legacy，视频样本单独且 pending |
| invalid 只生成未验证 | 否；33 个逐项拒绝测试通过 |
| 两套 Preview/Production Renderer | 没有实现任何 Renderer；共用契约及 RuntimeContext |
| 既定资产决策 | KEEP 原样；RETIRE 未删；MIGRATE 只新增旁路契约 |

## 11. Phase 3B 之前仍缺什么

以下仅列缺口，不开始实现：

1. **真实 Legacy Adapter**：逐字段覆盖报告、19 活动内部题组完整映射、稳定 option/line/panel 身份延续和 unsupported 阻断；不能把本次静态样本生成过程当正式 Adapter。
2. **私有绑定**：真实 media/activity/progress/teaching/capsule revisions、旧 page/track/segment 对照、播放政策、课程/用户授权与 secret 隔离。
3. **契约与实际内容的等价性验证**：特别是 vocabulary/grammar 多题、角色扮演整轮录音、听说限次/稿件、写作与自查政策；目前 capsule 是边界声明，不是运行实现。
4. **所有 Renderer 与生命周期**：25 entry 均未实现；没有 focus、visualCue、Agent Bridge、Media Resolver、Learning State 或学生 Runtime UI。
5. **发布基础设施**：生产摘要协议核验、不可变依赖、权限收敛到 platform_owner、Preview tracking 服务隔离、发布 pointer 与回滚；本阶段完全未接入。

下一阶段必须先确认这些契约和边界，再获得授权后做 Adapter。不能因离线 validator 通过就绕过依赖绑定、Renderer readiness 或生产验收。

**Phase 3A 到此停止。**
