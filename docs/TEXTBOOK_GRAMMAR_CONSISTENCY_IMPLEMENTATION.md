# 教材语法数据一致性：隔离实施报告

日期：2026-09-13。范围：承接四个制作板块及数据库审计，先修语法读取、第一章文字编辑、发布与章节引用。不是四个板块全部重构完成，也不是部署报告。

## 1. 结论与边界

- 根因不是数据库没有语法：当前教材保存 `digital_textbook_nodes.content.grammarCards`，旧管理读取/编辑链使用 `content.grammar`，二者字段不同。独立 `growth_toolbox_grammar` 又是另一种资产。
- 已完成隔离实现：16 章真实种子中的 63 张卡可读取，第一章 3 张；第一章实际 8 模块不再被查询过滤成 2 个。0 章无语法卡。异常内容拒绝解析；查询错误不展示假零数量或编辑入口。
- 第一章语法卡支持 **form / function / caution / source** 四个字段的受控文字修改，双语结构原样保留。保存后必须经过原编辑窗口、校验和正式发布；不是即时修改学生已发布内容。
- 规则、例句、comparison、音频关联均完整保留和显示，但本轮不开放其编辑；不开放卡片增删、重排或另外 15 章的写入。
- 教材卡与旧格式分别保留；混合时显式说明两类数量，不自动去重、覆盖或迁移独立库。
- 章节练习确认快照可以原样引用语法卡。未自动创建任何线上 binding；未把阅读材料变成题目或新判题系统。
- 教材管理与教材引用写权限限定 `platform_owner`；未修改共用题库管理权限函数。
- **线上数据库、运行源码、服务与 gate 均未修改。没有部署、提交或 push。**

## 2. 基线与交付位置

| 标识 | 位置及意义 |
| --- | --- |
| M：主工作区 | `/home/yangzhen/projects/my-lms-system`；保留全部已有未提交修改 |
| R：补丁真实基线 | `/home/yangzhen/releases/uply-first-enable-20260910/source`；本轮只读 |
| C：隔离候选 | `/tmp/uply-grammar-consistency.CRGmOO`；代码、构建、测试均在这里 |
| 持久补丁 | `/home/yangzhen/projects/my-lms-system/docs/TEXTBOOK_GRAMMAR_CONSISTENCY.patch` |
| 每文件基线与摘要 | `/home/yangzhen/projects/my-lms-system/docs/evidence/textbook-grammar-consistency-20260913/patch-manifest.json` |
| 测试摘要 | 同证据目录 `validation-summary.json` |
| Chromium 截图 | 同证据目录 `grammar-1440.png`、`grammar-375.png` |

M HEAD 为 `b1672390ae96357a2143358235cc10edeff8d488`；**它不是本补丁可直接应用的基线**。R Build ID 为 `l9HmPxSMluZWoirjL544P`。R 已包含前轮部署的 Studio、工作台及发布作者服务，M 尚有缺失/不同文件。

本补丁是 **R → C 的增量**，不包含把 M 补成 R 的前轮全部改动，不能在 M 上盲目应用、不能与前轮累计补丁重复叠加。`patch-manifest.json` 逐文件记录 R、C、M SHA256；其中 10 项 M 与 R 不一致/缺失。原审计 14 项源码基线再次核对一致。当前六个业务修改文件及其他未跟踪工作均保留。本轮仅在 M 新增本文、补丁和证据。

29 个候选变更文件：23 个应用文件、2 个新 migration、4 个测试文件。精确路径、SHA、新增/修改依据见 patch manifest；补丁已在仅复制 R 对应文件的临时目录通过 `git apply --check --whitespace=error-all`，未应用到 R 或 M。

## 3. 读数与数据模型

### 3.1 当前语法卡

`src/lib/textbook-grammar-content.ts` → `textbookGrammarCardSchema` / `readTextbookGrammarCards()`：

- 闭合校验 `form`、双语 `function/caution/source`、字符串 `rules[]`、`examples[{ko,zh,audioId,audioStatus}]`；允许真实存在的双语 `comparison`。
- 字段缺失、未知字段或损坏的 `grammarCards` 不冒充空数组。
- 没有该字段才返回空集合；旧 `grammar` 保持原模型，不转写。

`src/features/digital-textbook/api/service.ts` → `getDigitalTextbookManagementData()`：

- 同时投影 `grammarNodes.items`（旧）与 `grammarNodes.cards`（当前），保持节点、章节、版本归属。
- 去除只取 vocabulary/grammar 的嵌套 module 过滤；模块信息反映真实 8 Step。返回的教学卡仍只从对应模块提取，未把其他节点原始 JSON 交给浏览器。
- `digital-textbook-listing.tsx` 遇到 `hasError` 提前返回读取告警，不显示统计和编辑。
- `textbook-studio.tsx` 显示卡片形式和来源；混合格式显式区分教材卡数量、旧格式数量。

验证使用前轮已核对的仓库第一章源快照和其余 15 章种子，经真实管理 Reader + 合成只读 DB transport；本轮没有再次查询远端数据库。前轮生产聚合与来源证据见 `TEXTBOOK_DATA_AND_AUTHORING_WORKFLOW_AUDIT.md`，不要将本轮种子验证描述成重新检查生产。

### 3.2 显示和旧编辑保护

`grammar-card-content.tsx` 完整显示规则、双语例句、注意事项、来源及可选对比；功能说明复用 `CardTitleWithHint`。这里不实现音频播放器，也不展示存储对象身份。

旧 `digital-textbook-action-dialogs.tsx` 将当前卡显示为只读内容，并指引第一章工作台；旧 Action 的 `loadGrammarNode()` 遇到 `grammarCards` 明确拒绝。不会使用旧 CRUD 向同节点另写一套 `content.grammar`。

## 4. 第一章真实保存与发布链

```text
负责人正常鉴权
→ 原工作台「进入编辑」/ authoring_control
→ GrammarTextEditor（四字段闭合 payload；稳定 cardId + expected）
→ chapterWorkbenchOperation(save-grammar)
→ saveChapterOneGrammar：重新鉴权、capture、解析已有身份、CAS
→ edit_runtime_grammar_card_v1：全局 authoring lock + node row lock
→ 原子写入该卡文字和身份 fingerprint override
→ 原 compiler / check / Publisher / immutable store
→ 原 Published Loader / private bindings / 学生内容 projection
```

新 DAL 文件：`src/lib/smart-textbook-publishing/grammar-authoring.server.ts`。

UI 文件：`src/features/digital-textbook/workbench/grammar-text-editor.tsx`。复用原 `run()` 和服务错误处理；有未保存表单时阻止全局步骤/页签切换及发布。失败保留输入，不把冲突当成功；需要刷新重新核对后才能继续。

`chapter-workbench.tsx` 不创建新的 Runtime、状态机或发布入口。教材内容变化仍走现有单版本编辑窗口，旧会话不得用新配置继续写入；本轮未改会话恢复/失效规则。

### 4.1 为什么需要最小身份绑定列

当前冻结 ledger 以匿名卡片完整值的 fingerprint 定位稳定 part。即使只改功能说明，旧 fingerprint 也不再匹配；不能通过修改标题/数组 index 生成新的 Runtime 身份。

新增 `digital_textbook_nodes.authoring_grammar_identities`，只保存已有 `{id, fingerprint}` 覆盖：

- `grammar-identities.server.ts` → `publicationIdentities()` 只接受既有 ledger 中属于该 node / `content.grammarCards` 的 ID。
- 不创建新 ID；不修改 base ledger；拒绝重复、跨节点、未授权 collection 或歧义 fingerprint。
- 内容与 override 在同一事务比较、更新；两个旧表单同时保存只能一个成功。
- publisher 编译与 artifact dependencyPins 使用同一个合成 ledger；override 由原 capture 读取并进入私有依赖、摘要、seal、fence。
- 公开 Manifest 不增加 schema 字段；既有 target 地址、Step/Block/part、Activity 身份不变；语义编辑导致新的 snapshot/digest 是正常结果。

新增列默认空数组不改变旧冻结语义。`semantic_capture()` 只归一化“空 override 等于没有该列”，**非空 override 仍受语义 fence 保护**；保留原精确 `updated_at` 审计豁免，不扩大为整列 metadata/status 豁免。隔离测试先发布，再安装 migration，再读旧快照并触发原 fence，验证没有因空列误失效。

### 4.2 媒体发布准入没有降标

发现原 policy 认证整个语法节点摘要，文字编辑会触发媒体重新审计。没有跳过校验：新增 `grammar-media-proof.server.ts` → `unchangedGrammarMedia()`，仅覆盖经过证据复核的第一章语法节点和原认证摘要。

依据：`src/features/smart-textbook-runtime/server/learning-tools.server.ts` 的例句播放取 `examples[].audioId`，校验 `metadata.script === examples[].ko`，TTS 使用该例句文本；不使用卡片 `form/function/caution/source` 四字段。

新的闭合比较排除且仅排除这四个文字字段。rules、comparison、全部例句文本、音频 ID/status、顺序和其他节点内容仍计入投影摘要；媒体资源自身状态/摘要校验也保留。node、原证明摘要、投影摘要必须全部匹配。

`media-policy.server.ts` 在 Publisher 和 Loader 共用该证明。测试验证修改 rules / 例句 / audioId / audioStatus / 顺序 / lead / node / proof 均不获豁免。没有把 pending 改 ready、制造资源、删除引用或覆盖媒体对象。

## 5. 章节引用与权限

`chapterPracticeSnapshot()` 保留当前卡原字段，旧格式也原样保留；不是只摘取 form/title 的有损转换。

`review_chapter_practice_binding()`：

- 仍由当前认证用户调用、SQL 内再次检查 `private.is_platform_owner()`；不让 browser 指定管理身份。
- 在原 source hierarchy/版本/状态检查、share row locks、revision CAS 之前复用发布 authoring lock，保持锁序。
- DB 闭合检查当前卡，逐字段完整重建并比较提交快照；不能只用前置 SELECT 代替锁内验证。
- 已确认快照保持原样，后续教材修改不会自动覆盖；复核时过期请求拒绝，并发同 revision 只能一个确认成功。
- 真实隔离 RPC 验证第一章 12 个词汇 + 3 张语法卡 = 15 个引用材料；**语法卡 3 张与语法活动 3 题不是同一个计数**。
- 现有学生 `read_chapter_practice_snapshots` 保留，`ReferencedGrammarMaterials` 增加闭合卡片显示；阅读不产生 Activity attempt 或成绩。

应用端同步：`chapter-practice-actions.ts` 的 owner-only guard、toolbox listing 的 binding 管理开关使用教材权限，不沿用更宽的独立题库权限。

教材 Actions 与管理 Reader 的写权限也限定平台负责人。没有修改 `current_user_can_manage_standard_question_bank()`、机构课程运营或独立资源库 CRUD 权限。

独立 `growth_toolbox_grammar` 的 3 条历史内容全部保留。`textbook-practice-resources.ts` 的独立库复制仍是旧结构，本轮**不增加把当前卡有损复制成独立库条目的入口**。独立语法库是面向学生直接使用还是仅管理改编资源，仍需产品决定。

## 6. 数据库候选和安全反查

仅新增两份 migration，不修改历史 migration；真实执行只发生在无外网的 disposable PostgreSQL 测试容器：

1. `202609130001_textbook_grammar_authoring.sql`：一列、一个 service-role-only edit RPC、最小 semantic_capture 默认值归一化。依赖原发布 foundation/fence/single-version authoring 和恢复后的 publisher wrapper；不适用于仅有早期教材表的裸库。
2. `202609130002_textbook_grammar_practice_binding.sql`：严格卡片 helper 与原 review RPC 的兼容替换。依赖 chapter practice bindings/grants、`private.is_platform_owner()` 和上述 authoring lock。

SHA 见 patch manifest。没有加入远端迁移 ledger，没有修改首次启用 migration runner 清单。

反查结果：

- 新编辑 RPC 使用 `SECURITY DEFINER SET search_path=''`，对象全限定，无动态 SQL；public/anon/authenticated 无 EXECUTE，仅 service_role 可执行，函数内仍有 owner_guard。
- review RPC 仍 authenticated 可调用，但 owner 检查收紧；private validator 不直接授权客户端。
- 新 SQL 没有 seed、删除、媒体迁移或学习数据回填；默认空映射不是重新编号。
- 锁顺序沿用 authoring 全局锁 → 教材层级/节点锁；保存比较 node.content 与 identity overrides，不丢并发改动。
- 尚未执行真实远端 schema/ledger/grants preflight。若未来部署，必须针对目标重新核对；不能将隔离通过当作已经可直接运行生产 DDL。

## 7. 验证结果

最终完整回归：**1219 项，1215 通过、0 失败、4 跳过**，约 459 秒。4 项为旧测试可选的 PGlite 验证（章节引用、编辑策略、教学操作、来源复核）；当前隔离依赖未安装该模块，不能把它们称为通过。本轮章节引用已有额外的真实 disposable PostgreSQL 测试，未跳过；另外三项不属于本轮新增能力。

命令与结果：

| 命令 / 用途 | 结果 |
| --- | --- |
| `node --experimental-strip-types --test --test-concurrency=2 tests/*.test.mjs` | 1215 pass / 0 fail / 4 skip；包含本轮测试、原 Runtime/SQL/Recording/legacy 和 Chromium |
| `tests/textbook-grammar-consistency.test.mjs` | 8 项（含嵌套 SQL 断言）通过；63 卡、保存发布和引用真实 SQL |
| `tests/digital-textbook-workbench.test.mjs` | 5 项通过；实际 Chromium 表单与真实隔离数据库发布 |
| `tests/textbook-navigation.test.mjs` + course catalog UI tests | 5 项通过；入口、权限、读取错误不显示零数量 |
| `npm run typecheck` | 通过；先生成必要 Next 路由类型 |
| 隔离占位配置下直接 `next build --webpack` | 最后一次构建退出 0；不是生产可部署构建 |
| 补丁 `git apply --check --whitespace=error-all` | 对精确 R 文件基线通过 |
| 主工作区 `git diff --check` | 通过；未将业务补丁写入主目录 |

最终摘要归档于证据目录 `validation-summary.json`；保留原始执行日志 SHA256，不把可能包含调试数据的全部日志直接复制进报告。

已验证的功能断言：

| 检查 | 结果/证据边界 |
| --- | --- |
| 63 张卡、第一章 3 张、0 章为空、第一章 8 模块 | 真实种子 → 管理 Reader；DB transport 隔离 |
| 旧格式和 optional comparison | 完整保留；未知/损坏卡拒绝 |
| Query error 不冒充零 | 真正 listing Chromium 告警且没有制作区/编辑按钮 |
| owner、未知字段、未进入编辑 | 应用与真实 SQL 拒绝 |
| 并发保存、过期表单 | 真实 PostgreSQL，只允许一位成功 |
| 修改 → 发布 → Loader | 真正 owner service / compiler / publisher / store / loader，非直接写快照替代 |
| 学生内容 | 新快照通过原 `projectLearningContent()` 显示修订功能说明；不是重新读取实时旧 JSON |
| 第 2 次修订 | 仍是原 card/target 身份，不按标题/index 分配 |
| v23 / 8 Step / 19 Activity / orientation 3 题 | 保存、重新发布后保持；媒体引用/教学节点不变 |
| 原快照与 fence | 新列空默认不误伤；发布后非空身份绑定篡改拒绝 |
| 引用 review/read/CAS | 实际 SQL 15 个完整材料；过期/并发/非 owner 拒绝 |
| Chromium 工作台 | 编辑 → 保存 → 刷新 → 校验 → 发布；1440/375 宽度无横向溢出 |
| 浏览器私有字段 | workbench 公共数据不含 answer_key、object_key、service_role、私有身份 override |
| Runtime/判题/录音 | 使用现有完整回归；本轮没有改这些领域实现 |

此处 Chromium 使用隔离认证和数据库传输，**不是正常负责人真实账号 E2E，也不是线上学生验收**。新文本的学生断言覆盖真实 Loader 到 Runtime capsule projection，工作台浏览器覆盖真实编辑发布；不冒称本轮重新进行全章真实账号交互。

完整回归初跑暴露两条 R 本身已过时的 UI 静态断言，另有一个隔离复制缺 `.env.example` 和按钮名称变化导致的测试定位失败。已单独在 R 重现两条旧表格断言失败；只将测试改为当前真实 Studio 的内容/发布/设置责任和权限检查，没有为绿灯改业务。复制的是公开 `.env.example`，不是任何真实配置。

测试进程未读取 `.env.local`。构建使用隔离占位 Supabase URL/key，直接 `next build --webpack`，不启动服务；该产物不能部署。没有为本轮建第二套判题、录音、Loader 或 Runtime。

## 8. 尚未完成和下一步

1. 本轮不是完整语法编辑器：规则、例句、对比、音频文本/资源状态修改及卡片增删重排，需分别打通身份和媒体有效性后才能开放。
2. 其余 15 章读数已正确；没有假装已有通用第一章之外的 Runtime Publisher 或作者编辑器。
3. 四板块入口整合、脚本章节上下文、独立语法库用途仍是后续任务。本轮不移动 Agent、不合并发布事务、不删除页面/数据。
4. M 与 R 有已有分叉，应用补丁前先整理部署源码与主开发分支关系；本轮只归档，不 reset 或覆盖。
5. 两个 migration 和候选源码未部署；因此用户当前线上仍看到旧语法读取行为。后续需要单独授权目标核验、数据库迁移与代码部署，不能只部署前端让作者服务调用不存在的 RPC。

### 数据操作

本轮无需用户批准删除/重置任何数据。没有清空教材、独立库、素材、attempt、progress、evidence、snapshot 或旧会话记录。未来“进入编辑”仍按既有流程暂停本教材测试 admission、让旧会话失效后重新发布，不自动清理遗留请求。

### UI 技能使用

采用 `ui-styling` 与 `ui-ux-pro-max` 的现有组件、表单可访问标签及错误恢复规则；继续复用 `CardTitleWithHint` / Button，没有另做一套视觉设计，也没有添加装饰英文标签。
