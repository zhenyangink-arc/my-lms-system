# 第一章教材制作闭环：已完成、缺口与执行顺序

日期：2026-09-13。结论：**限定字段的编辑—发布闭环已验证；完整教材制作尚未闭环。学生能运行不等于负责人能修改全部内容。**

## 1. 核验范围与基线

- 本轮读取实际发布源码 `/home/yangzhen/releases/uply-first-enable-20260910/source`，下文相对路径均相对此目录，不把主开发目录当作当前部署版本。
- 上轮导航部署证据见 `AUTHORING_RESPONSIBILITIES_REORGANIZATION.md`，部署 Build ID 为 `z3R-kXi6vrpDHJLLoR9GM`。
- 主工作区 HEAD 为 `b1672390ae96357a2143358235cc10edeff8d488`，原有六个业务文件修改和其他未跟踪成果全部保留。
- 在 `/tmp/uply-authoring-closure.J324oo` 复制发布源码验证，排除 `.env*`、构建、Git 和根素材目录。测试不加载真实运行配置。
- PostgreSQL harness 使用独立 `--network none` 容器和临时数据目录。认证、数据库传输、对象字节传输隔离；应用 compiler/publisher/Loader 及相关 SQL 使用真实实现。
- 本轮未修改业务代码、数据库、线上教材、发布指针、运行服务或任何学生记录。没有真实负责人/学生浏览器验收，不把隔离 Chromium 称为线上 E2E。

## 2. 四板块的职责不是四套教材数据

| 板块 | 应承担的职责 | 本次发现的边界 |
| --- | --- | --- |
| 课程结构 | 课程、课时和章节定位 | 不能替代 Runtime 内容制作和快照发布 |
| 教材制作 | 章节内容、题目、编辑窗口、校验发布 | 当前第一章工作台仅覆盖部分字段；旧词汇入口不等于新发布链已支持词汇修改 |
| 教学脚本 | 教师讲解与 Agent 脚本 | 脚本发布与教材快照发布是两步；新脚本版本仍受到 Adapter 限制 |
| 练习工具 | 独立练习与教材材料引用 | 不应把修改独立练习库当成修改教材源内容；本轮没有改动引用策略 |

四板块入口整理已完成，但入口职责清晰不能消除下面的数据/制作缺口。

## 3. 第一章八 Step 的制作能力

下列活动取自仓库冻结的真实第一章样本，不是本轮 SELECT 线上活动清单。共 19 个；单选题能否编辑，还必须通过工作台服务的答案形态校验，不能仅按活动类型认定。

| Step | 活动 | 当前制作能力 | 尚缺 |
| --- | --- | --- | --- |
| orientation | orientation-check、orientation-jimin-occupation、orientation-wangming-occupation | 三题的中韩题干、正确选项索引，隔离实测 | 选项文字、场景图、对话内容的受控编辑 |
| vocabulary | vocabulary-check | 单选题条件编辑；旧词汇表有编辑入口 | 词汇编辑与稳定身份、媒体证据、发布的一致闭环 |
| grammar | grammar-choice、grammar-judgment、grammar-fill | 三张语法卡的 form/function/caution/source；合格单选题条件编辑 | 例句、规则、音频及填空配置的编辑闭环 |
| patterns | pattern-order、pattern-choice、pattern-compose | 工作台可查看；合格单选题条件编辑 | 连续对话、排序、组合配置的整体编辑与校验 |
| dialogue | dialogue-fact-check、dialogue-response、dialogue-roleplay | 工作台可查看；合格单选题条件编辑 | 场景、角色、轮次及录音要求的制作 |
| listen_speak | listening-identity、speaking-introduction | 工作台可查看活动 | 听力、跟读文本/音频、口语 outline/criteria 的制作 |
| read_write | reading-profile、write-profile | 合格阅读单选题条件编辑 | 阅读正文、写作规则等受控编辑 |
| review | review-multiple、self-check | 工作台可查看活动 | 多选、自查、返回目标等配置制作 |

证据：`src/features/digital-textbook/workbench/contracts.ts`、`service.server.ts → chapterWorkbenchOperation`、`chapter-workbench.tsx`；`tests/fixtures/smart-textbook-legacy-adapter/chapter-one-source.server.ts`。

服务仅允许 `single_choice` 且私有答案符合 `{kind:'index',value}`、索引在 options 范围内的题目编辑；保存字段只有 activityId、prompt、koreanPrompt、answerIndex。选项不在保存契约内。负责人需要查看正确项，服务只显式返回该编辑字段，不把完整私有答案配置返回浏览器。

## 4. 已经成立的闭环

1. 工作台每次操作重新验证 `platform_owner`；非负责人拒绝读取/编辑/发布。
2. 进入编辑窗口，停用该教材的旧测试会话，等待已有请求排空；不删除历史作答。
3. 单选题保存使用 `editChapterOneActivity → edit_runtime_chapter_activity_v1`。
4. 语法卡保存使用 `saveChapterOneGrammar → edit_runtime_grammar_card_v1`，同时提交原内容和身份映射做冲突检查，事务内保存文字和身份重绑定。
5. `compileChapterOnePublication → assertPublishableSnapshot → publishChapterOne → loadPublishedRuntimeSnapshot`，校验 digest、CAS 和依赖，不绕过发布 fence。
6. 已经测试修改语法后再次修改，稳定身份保持；两个相同 expected 的并发修改不会互相覆盖。

语法不是“没有”，也不需要重新建另一套语法表。当前统计读 `nodes.content.grammarCards`；本轮测试复核种子中 16 章共 63 张卡、第一章 3 张。此数字是种子/隔离 Reader 验证，不是本轮线上库存查询。

## 5. 确认的关键缺口

### P0：工作台预览与正式编译并非同一源解析路径

工作台 `previewHref` 指向 `teaching-scripts/runtime-v1-preview`，页面调用 `readAuditSource()`。该函数使用静态 frozen identities；正式 publisher 使用 `publicationIdentities(dependencies.digital_textbook_nodes)`，合并已保存的语法身份修订。

因此“正式发布支持语法修订”和“这个预览一定能加载修订”不能画等号。审计页面还有“完整兼容执行器尚未通过验收”的历史文案。当前链接不是 published Loader 的学生效果验收。

证据：`src/app/[space]/dashboard/admin/apps/[appSlug]/textbooks/workbench/page.tsx`；对应 `teaching-scripts/runtime-v1-preview/page.tsx`；`src/features/smart-textbook-runtime/server/audit-source.server.ts`；`src/lib/smart-textbook-publishing/{publisher,grammar-identities}.server.ts`。

处理建议：优先统一保存内容的身份解析与校验来源，继续共用已有 Runtime，保留 trackingDisabled；明确区分“已保存内容预览”和“学生已发布版本”。不能通过忽略 Adapter 错误让预览看似正常。本轮为代码链证据，未模拟真实负责人线上点击。

### P0：词汇旧编辑入口不能证明再次发布成功

`src/app/dashboard/admin/digital-textbook/actions.ts → updateVocabularyWordAction` 读取整个 node.content，以数组 index 替换词条，再写回。`cleanWord` 仅保留 ko/zh/pos/collocation/transcription；没有同步更新 frozen identity allocation。

Adapter `walkIdentities` 按冻结 fingerprint 定位匿名词条。**本轮隔离测试实际修改一条词汇中文释义，产生新增 unsupported**；并非推测。身份重绑定函数虽然存在，当前词汇保存链没有使用它。

另一个独立保护是 `mediaPublicationAudit`：核对关联 node 的内容 digest；仅语法规定文字字段有专门例外。因此即便补身份映射，也不能承诺词汇/音频相关改动自然通过媒体准入。

处理建议：先限定现有词条的安全文字修订，使用稳定 ID + expected 内容，事务内保持身份；逐字段审查媒体语义。韩语朗读文字变化必须重新验证音频/fallback，不能统一豁免 content hash。新增、删除词条和复杂结构调整单独验收。可能需要独立 migration，应在后续任务明确列出后隔离验证，不能在线上试写。

### P1：新教学脚本版本尚非自助发布能力

`adapter.server.ts` 明确 `version.version_number !== 23` 则 unsupported。**隔离测试把 published 版本号改成 24，实际触发新增阻断**。八节点数量也受控。

这不表示旧教学脚本 UI 不能保存，而表示“保存/发布新脚本 → 新教材编译 → 学生使用”不能据此宣布闭合。

处理建议：保留现有 resolver、稳定目标和语音选择，按新版本真实节点/媒体/target 做校验；移除固定数字前必须验证实际兼容规则，不能直接去掉安全检查。不要重造 Teacher Runtime。

### P1：发布失败说明不足

`chapterWorkbenchOperation` 对多类编译/媒体/依赖异常返回同一“读取或发布前置检查未通过”消息，负责人无法判断要修哪一步。`packageSnapshot` 又把未就绪归为 `PUBLICATION_COMPILE_BLOCKED`。

处理建议：闭合的 owner-only 诊断 DTO，指出 Step、内容类别、阻断原因和可去的入口；不返回原始 SQL、object key、完整 secret 或私有脚本配置。先提升可操作性，而不是降低准入。

### P2：其余内容没有完整制作入口

图片/音频关联、对话组、复杂练习、目标与步骤配置，不能因为 Runtime 已显示就算后台可制作。当前 layout 等仍由 Adapter 中的受控配置输出；不在本轮扩展模板编辑器、任意布局或 video-first。

## 6. 建议执行顺序和验收标准

| 顺序 | 任务 | 完成标准 |
| --- | --- | --- |
| 1 | 预览路径一致性 + 可操作的失败诊断 | 改语法 → 保存 → 预览正确；错误能定位，不泄露私密字段；正式发布校验不降标 |
| 2 | 词汇文字安全编辑闭环 | 修改释义 → 保存 → 编译 → 发布 → 新会话显示；稳定 target 不变；并发拒绝；音频规则仍成立 |
| 3 | 单选题选项编辑 | 保持活动身份、题目与答案原子一致；越界/并发拒绝；学生用同一已发布配置判题 |
| 4 | 教学脚本修订闭环 | 实际新修订可校验发布，目标和 speech proof 成立；不伪造音频、不改 Agent 语义 |
| 5 | 按教学需求补复杂内容制作 | 每次只做一个真实流程及完整隔离验收，不一次造通用编辑平台 |

这些是后续实施清单，不是已实现声明。当前最小下一任务建议选第 1 项；不能继续用“部署一个新布局”代替制作能力补齐。

## 7. 本轮验证

- 现有三个测试文件：`digital-textbook-workbench.test.mjs`、`smart-textbook-legacy-adapter.test.mjs`、`textbook-grammar-consistency.test.mjs`：**63/63 通过，0 跳过**，约 58 秒。
- 新增诊断 `authoring-closure-audit.test.mjs`：**3/3 通过**，验证八 Step/十九活动/三题不变、词汇修改身份阻断、published v24 阻断。
- 总计 **66 项通过**。正向 SQL/Chromium 验收范围是单选题和限定语法文字，不扩大解释为所有内容可制作。
- 未修改业务代码，因此不重复全量构建。上轮完整回归 1222 通过、4 可选跳过为历史证据，不能计作本轮重跑。
- 本轮诊断测试副本与测试结果记录存入 `docs/evidence/chapter-one-authoring-closure-20260913/`；副本应放入隔离发布源码的 tests 目录执行，不直接基于可能不同的主目录运行。
- 没有线上发布、部署、迁移、数据写入、旧代码删除、账号变更或新增测试作答。本轮不声明真实账号 E2E 完成。
