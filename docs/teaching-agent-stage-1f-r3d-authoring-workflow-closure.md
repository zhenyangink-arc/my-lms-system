# UPLY Teaching Agent — Stage 1F-R3D Authoring Workflow Closure

## 1. Executive Summary

**Overall: GO（仅 R3D 工程闭环）。From-Zero Authoring: PASS。Stage 1G: NOT READY。**

已有 catalog lesson 现在可在正式“教材制作”页面由平台负责人创建第一套草稿骨架，进入既有 Script Studio 编写、复核、校验和发布。一个全新 disposable Full Supabase 中，目标课时起初没有任何教材父子对象；其教材链由实际管理 UI 创建，正文由实际表单填写。发布后真实 A1 在正式 Hangul route 完成 Explain → Tool → Evidence → Output。

补齐三处真实缺口：父骨架缺创建入口；空脚本无法添加第一条小节；韩语台词被隐藏导致占位句无法正常审核替换。没有重写 Studio、Student Policy、Agent Prompt、Tools、Skills、Transport 或 Hangul slot。

Authoring Writes = EXPECTED；Agent Teaching Domain Writes = 0。Production ledger449、Agent tables0、Candidate0，flagOFF/三名单EMPTY。没有生产迁移、部署、内容创建、课程/解锁变更、Tailscale变更或Live Provider请求。Content Owner Package = READY FOR CONTENT OWNER，指工程工作流与交接准备完成，**不表示生产已经安装本轮代码/迁移，也不是生产执行授权**。

## 2. Inputs & Baseline

完整阅读 R3D任务、R3B、R3C；按要求先读源码/schema与创建/发布/权限链，再实施。当前源码优先于旧报告。参考材料不作为当前实现事实。

任务开始保留3062个已有文件的SHA快照和git status；工作区原本有大量历史改动，没有提交或清理。Baseline SQL和449 ledger文件保持字节不变，旧迁移均未修改。读取本地Next 16.2.10 Server Functions指南，按实际POST认证约束实现；UI按现有组件和ui-ux-pro-max交互指南处理标签、pending、错误反馈及可访问性。

## 3. Files Changed

| 文件 | 本轮职责 |
|---|---|
| [202609140007_teaching_content_skeleton.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140007_teaching_content_skeleton.sql) | 唯一新增增量迁移：原子创建RPC，复用现有约束/authoring lock；没有新RLS policy |
| [baseline-manifest.json](/home/yangzhen/projects/my-lms-system/supabase/bootstrap/baseline-manifest.json) | 仅追加007文件版本、名称、SHA；baseline SQL不变 |
| [create-teaching-content.ts](/home/yangzhen/projects/my-lms-system/src/features/digital-textbook/api/create-teaching-content.ts) | 正式Server Action、输入校验、安全错误映射、缓存刷新 |
| [create-teaching-content-entry.tsx](/home/yangzhen/projects/my-lms-system/src/features/digital-textbook/components/create-teaching-content-entry.tsx) | PO鉴权后读取Korean app的catalog lessons，排除已有教材；只读、不自动创建 |
| [create-teaching-content-form.tsx](/home/yangzhen/projects/my-lms-system/src/features/digital-textbook/components/create-teaching-content-form.tsx) | 显式提交创建草稿、章节名、可选作者学习目标、成功跳转 |
| [digital-textbook-listing.tsx](/home/yangzhen/projects/my-lms-system/src/features/digital-textbook/components/digital-textbook-listing.tsx) | 在现有教材制作页挂载创建入口 |
| [TeachingScriptStudio.tsx](/home/yangzhen/projects/my-lms-system/src/features/learning-agent-script-studio/TeachingScriptStudio.tsx) | 将现有新增小节表单移到工具栏，空脚本也能调用原Action |
| [TeachingScriptNodeForm.tsx](/home/yangzhen/projects/my-lms-system/src/features/learning-agent-script-studio/TeachingScriptNodeForm.tsx) | 显示既有script_ko字段供作者审核编辑；沿用原保存合同，已发布版本仍只读 |
| [learning-agent-script-studio.test.mjs](/home/yangzhen/projects/my-lms-system/tests/learning-agent-script-studio.test.mjs) | 更新此前要求隐藏script_ko的旧断言，保留原字段/只读状态约束 |
| scripts/teaching-agent-r3d/ | disposable catalog/actors、真实RPC/浏览器、Pins、候选构建与迁移验证工具；不是产品入口 |
| docs/evidence/teaching-agent-stage-1f-r3d/ | 脱敏结果和合成截图，无凭证/生产正文 |
| [teaching-agent-hangul-content-owner-checklist.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-hangul-content-owner-checklist.md) | 更新正式内容负责人操作清单及尚未完成的生产前置项 |

相对任务开始快照的最终文件列表见 [workspace-scope.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/workspace-scope.json)；git整体diff包含历史改动，不能把全部归于本轮。

## 4. Existing Authoring Architecture

真实关系为 `lessons → digital_textbooks → digital_textbook_versions → digital_textbook_chapters → digital_textbook_modules → learning_agent_lessons → learning_agent_script_versions → learning_agent_script_nodes`。Profile通过textbook/teaching lesson外键关联，不是链上独立Runtime。

[service.ts](/home/yangzhen/projects/my-lms-system/src/features/digital-textbook/api/service.ts) 先从已存在教材构建树，因此原来不会显示零教材课时。[service.ts](/home/yangzhen/projects/my-lms-system/src/features/learning-agent-script-studio/service.ts) 的 `getTeachingScriptStudioData` 依赖已有教材/章节/module/teaching lesson；使用现有版本选择逻辑，无已发布版本时可进入初始草稿。

原 `ensureGrammarNode` 只补已有章节的grammar module/content node；不是通用根对象创建器。脚本Actions位于 [actions.ts](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/teaching-scripts/actions.ts)；教材发布位于 [actions.ts](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/digital-textbook/actions.ts)。

## 5. Missing Workflow Analysis

原缺口是root/version/chapter/初始module/teaching lesson/profile关联没有完整产品创建事务。只补RPC仍不够：浏览器实测揭示原“新增小节”按钮被selectedNode条件包住，空草稿无入口；随后Pins实测揭示隐藏韩语台词保留了新节点占位句。两项都已用现有Action/字段闭环。

发布失败时保留了真实校验：缺少“教材与脚本复核”的请求被拒绝。随后通过原复核UI读取、对照、勾选确认，再校验发布；没有绕过检查或直接UPDATE status。测试脚本的选择器、details展开状态和过期JWT问题分别修正/重新认证，不当成产品漏洞或通过证据。

## 6. Authoring Object Model

Creation Matrix（原有能力与本轮补齐分开说明）：

| 对象 | 原create action/service/UI | 本轮创建/权限 | 草稿与事务 | 约束、重复及失败/删除 |
|---|---|---|---|---|
| Textbook | 没有完整零起点入口；有状态编辑UI | createTeachingContentAction → RPC；PO | schema默认draft，骨架同事务 | lesson_id UNIQUE、slug UNIQUE；任何已有root冲突，失败回滚 |
| Version | 读取/已有教材编辑窗口；非首个root创建 | RPC创建version_number=1 | 默认draft，同事务 | UNIQUE(textbook_id,version_number)；FK向root，父删除CASCADE |
| Chapter | 读取/章节发布已有；首章创建缺失 | RPC创建作者命名的预备章0 | 默认draft，同事务 | UNIQUE(version_id,slug/number)，FK CASCADE；不代建测试题 |
| Module | grammar专用ensureGrammarNode已有；没有通用父骨架创建 | RPC首次orientation、order1、jade | 无独立status，同事务 | code/order CHECK，chapter内code/order UNIQUE，FK CASCADE |
| Teaching Lesson | Studio只读取已有lesson | RPC关联module/profile | 默认draft，revision1，同事务 | UNIQUE(agent_profile_id,module_id)，必填profile外键；失败回滚 |
| Profile association | 既有published profile；导航配置不是profile创建器 | 服务端查uply-korean-teacher后写两个外键 | 不创建/发布profile | agent_code UNIQUE；缺失/非published/学科不符拒绝 |
| Script Version | createTeachingScriptDraftAction/RPC/Studio已有 | 原PO路径 | draft；RPC锁teaching lesson事务，返回已有draft | 既有版本约束、created_by和create_draft日志；非骨架事务的一部分 |
| Script Node | add/save actions已有；零节点按钮隐藏 | 移动原按钮，显示原韩语字段；原PO路径 | draft编辑；保存走atomic CAS RPC | version+node_key等既有约束；保留原删除/排序、活动/答案校验 |

Schema依据：[app-schema-baseline.sql](/home/yangzhen/projects/my-lms-system/supabase/bootstrap/app-schema-baseline.sql) 的对应CREATE TABLE、FK/unique/trigger；新增行为只在007。骨架没有新增删除入口，不自动修复legacy；后续删除仍是既有管理功能及外键规则，不声称统一软删除。

## 7. Permission Model

现有完整Script Studio author = **Platform Owner**。`requirePlatformOwner`检查活动用户、平台角色、排除tenant-provisioned account；数据库RPC再次用auth.uid/private.is_platform_owner校验活动role/global_role并排除tenant-provisioned。来源：[admin.ts](/home/yangzhen/projects/my-lms-system/src/lib/admin.ts)、baseline的private.is_platform_owner。

`manageContent`是机构应用能力，[tenant-app-capabilities.ts](/home/yangzhen/projects/my-lms-system/src/lib/tenant-app-capabilities.ts) 允许对应页面访问；它本身不授予现有Script Studio发布权。新建入口没有扩大它。合成MA具有真实tenant A manageContent，仍拒绝本机构和tenant B创建；UT、TA、student、TB operator拒绝。PO/PO2是两个真实合法author。**不声称机构教师现在能独立完成脚本发布**。

## 8. Skeleton Creation Design

正式Action接收lesson locator、该lesson的updated_at、作者章节名称和可选学习目标；不接收tenant/course/profile override。Action用用户Supabase client调用RPC，不使用admin client执行创建。

RPC先鉴权，获取现有全局authoring事务锁，再锁定真实lesson/course，检查revision、content_scope和tenant一致性，从course解析student_app_id，再解析Korean app与正确published Profile。所有五个父子对象insert处于同一SQL事务；不生成script、node、正文、问答、Tool或Agent definition。

标题来自作者与catalog lesson；level来自course，空值用未指定元数据；初始module标识/颜色/顺序来自既有schema/模块合同。目标为空时objectives={}，可选目标仅使用作者实际输入；没有合成韩文默认正文。

## 9. Textbook / Version / Chapter

Root一课时一个，slug由lesson UUID确定，title来自实际catalog。Version初始1/draft。初章明确为**预备章0**，slug preparation、title由用户填写，scenario/goal留schema空对象。该范围匹配Hangul预备课，不冒充完整一般章节CMS。

原 `publish_digital_textbook_chapter` 会发布root、version、chapter；第0章无需chapter test，第1章及之后保留关联测试/题目校验。本轮没有创建第二套publisher，也没有自动将draft公开。

## 10. Module / Teaching Lesson

初始只有课前导航orientation模块；不强制补满八步，不伪造词汇/语法/活动。Module没有status；Teaching Lesson独立draft，revision1，guardrails空对象，关联正确Profile。其他已存在的grammar/node编写能力保持原样。

真实创建结果由 [r3d-author-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/r3d-author-result.json) 与 [r3d-rpc-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/r3d-rpc-result.json) 验证；脚本尚未创建时确认其count0。

## 11. Profile Association

`learning_agent_profiles.agent_code=uply-korean-teacher`、subject=korean、access_feature=korean_course、status=published，在服务端按唯一agent_code查询；UUID没有写死。两个外键均指向该Profile。缺少合法Profile则fail closed，不代为初始化。

`student-ai-teacher@1.0.0`是Agent Core definition，由原Agent验证工具按原manifest发布到隔离库，与内容Profile分离。本轮不改definition、Prompt、Tools或Skills。

## 12. Product Authoring UI

入口：`/platform/dashboard/admin/apps/korean/textbooks`（当前章节选择“全部章节”），课程已存在但没有教材时可选择课时，填写预备章名、可选学习目标，明确点击“创建教学内容草稿”。打开页面不写入。

成功显示“进入教学脚本”，定位实际创建chapter；pending禁用重复提交，保留输入；错误使用无权限/已有内容/状态变化/失败等安全文案，不暴露SQL/stack/constraint。标题说明复用CardTitleWithHint。截图：[author-before-create.png](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/author-before-create.png)。

## 13. Atomicity / Idempotency

采用同事务五次insert、现有authoring_lock及lesson唯一约束。重复/双击不变更已有内容，返回AUTHORING_CONTENT_EXISTS安全映射，而非盲目upsert。

隔离测试安装仅作用于另一个failureLesson的最后一步触发器，真实请求得到精确SYNTHETIC_LATE_FAILURE，确认root0及FK后代0。该故障fixture不作用于产品目标，不是产品create实现。证据：[r3d-closing-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/r3d-closing-result.json)。

## 14. Concurrency

两名独立真实Auth用户PO/PO2、两个独立HTTP客户端Promise.all调用同一raceLesson：一个成功、一个冲突，canonical root1/version1/chapter1。没有把前端disabled当并发保障。现有global authoring lock保证与现有publisher一致锁顺序；本轮没有引入第二种发布锁协议。

## 15. Existing Content Protection

已存在完整、已发布、归档或partial root都不被新建RPC覆盖。独立partialLesson只有root没有version时拒绝并保持version0。既有发布动作先发布race课时后，再次创建仍冲突，原root逐字段相同。stale lesson revision拒绝。

复杂legacy修复不在本轮；UI给出核查已有教材的提示。详见RPC和closing证据。

## 16. Script Studio Continuation

创建后实际进入原Studio，调用createTeachingScriptDraftAction、addTeachingScriptNodeAction、saveTeachingScriptNodeAction。新增小节表单移到工具栏，零节点草稿可添加第一条；原排序、保存CAS、草稿约束不变。

原script_ko只以hidden input回传，导致作者看不到韩语占位句；现在可在原编辑器填写/清空，仍由原save atomic RPC保存，已发布版本disabled。E2E通过正式“编辑已发布版本”创建新草稿、编辑两种locale、重新复核发布；旧版本按原流程归档。没有直接修改已发布脚本。

现有完整视频预览仍只支持第1章；本轮第0章验证是编辑/发布及正式Hangul Agent，不冒称已扩展完整视频预览。

## 17. Validation / Publication

真实顺序：作者保存两节点和学习目标 → 读取教材复核内容 → 确认复核 → `publishTeachingScriptAction`获取snapshot、检查媒体/分段、调用checked publisher → `publishTextbookChapterAction`发布chapter/root/version。

缺复核的尝试实际被拒绝；补齐正式复核后通过。节点一按顺序继续、节点二为唯一终点；两种locale均由作者输入 `저는 학생입니다.`；使用现有文字呈现模式，未伪造视频/音频资产。所有目标status变化通过正式publish Action/RPC，没有直接UPDATE status。

真实created_by、published_by、reviewed_by及publish log actor均验证为登录PO，见 [r3d-closing-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/r3d-closing-result.json)。骨架表没有actor列，未虚构其存在。

## 18. Full Supabase From-Zero E2E

全新唯一stack：`uply-agent-r2-c4fa58d6088a`，Auth/PostgREST/Postgres/Storage/Realtime等6个实际容器。baseline+449 ledger+8增量 =457。Bootstrap临时角色属性仅用于安装原baseline event-trigger，之后恢复NOSUPERUSER，学生请求不借该权限。

R2预置教学链只用于独立安全回归；R3D另建全新course/lesson，目标root/version/chapter/module/teaching lesson/script/node起始均0。Profile与catalog可由fixture准备，目标教学骨架由产品UI创建。证据：[r3d-catalog.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/r3d-catalog.json)、[r3d-author-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/r3d-author-result.json)。

过程中的缺口修正后在同一隔离内容链继续验证，每一步均为实际产品操作；不声称第一次自动化尝试即全部成功。最终复核和两语言内容、发布、学生E2E均通过。安全fixtures不计入“从零目标创建”的证明。

## 19. Student Pins / Classroom E2E

[r3d-pins-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/r3d-pins-result.json)：真实A1 JWT、当前StudentPolicy/Repository/Projector从正式发布内容生成4 Pins（2节点×2 locale），每条均是实际作者目标句；没有复用早期seed Pins。

正式路径 `/r2-a/apps/korean/courses/korean/korean-basic/korean-beginner/hangul-introduction`，Explain UI完成约1355ms，来源badge1，Tool/Evidence/Output pass。Replay相同run/conversation、额外Provider和新增run/conversation/message均0；有效不同segment/message冲突409；未登录401、角色/资源错误403；OFF按钮0、POST404。

取消75ms且持久cancelled；deadline从receivedAt约45073ms终止，随后2225ms新增Provider/Tool/教学读写均0。[browser-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/browser-result.json)。375px、横屏812px、Enter/Escape焦点返回、无横向溢出通过，见 [layout-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/layout-result.json)、[hangul-mobile.png](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/hangul-mobile.png)。

## 20. Teaching Domain Side Effects

**Authoring Writes = EXPECTED**：目标骨架、脚本、source review、publication logs及版本状态等由管理操作写入。

**Agent Runtime Teaching Domain Writes = 0**：authoring结束后捕获79表指纹，真实Agent完成请求后全部相同；正式课堂完整测试窗口也未变化。ALS归因1657次请求中含71次safe node读取、7次Tool事件、教学写入0。[domain-before.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/domain-before.json)、[domain-after.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/domain-after.json)、[browser-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/browser-result.json)。

原Hangul阅读heartbeat不是Agent Tool，未重写；零写结论限定本次实际Agent窗口，不宣称所有课堂或authoring活动不写数据。

## 21. Security / Tenant Isolation

Student/无权限Teacher拒绝；MA tenant A content manager不能创建A或B内容；TB operator不能创建A。PO权限是原本的平台级权限，不伪装成tenant权限。App/course/tenant/profile由数据库重新解析，不使用浏览器override。Anon/service-role直接执行新RPC也被拒绝。

Server Action使用真实caller client；privileged client仅用于PO鉴权后的管理选项读取或测试read observer。没有修改StudentTeachingPolicy、raw config RLS、安全视图、权限辅助函数或Agent域写边界。

## 22. RLS Regression

新stack先执行原138项真实JWT/RLS检查PASS；最终authoring后重新以原独立安全fixture复查138项PASS。长任务导致早期缓存JWT过期的一次PGRST303失败后，用真实password Auth重新认证12个合成账号，再完成复查；未伪造JWT、调整有效期或放宽RLS。

[security-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/security-result.json)。实际Student Pins和课堂Transport也独立走真实登录/JWT/RLS。8项常规环境skip不用于替代Full Supabase证据。

## 23. Drain Regression

R3A deadline-terminal-v1及006 migration保持不变。隔离实际数据库reconciler定向18 assertions PASS；Full Supabase所有12账号+anon相关RPC拒绝共39检查PASS。原45秒deadline、cancel、无late执行回归通过。

[reconcile-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/reconcile-result.json)、[reconcile-permissions-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/reconcile-permissions-result.json)。本轮未重复执行R3A完整强杀演练；沿用同合同既有证据并新增上述定向实测，不把它说成再次执行全部强杀场景。

## 24. Migration / Baseline

最高旧版本006扫描后新增 **202609140007_teaching_content_skeleton.sql**。仅新函数/execute grants，无schema表/RLS修改。manifest追加SHA，baseline SQL/449 ledger/全部旧migration未变。

真实Full Supabase bootstrap PASS（457）。另以授权schema-only快照在network-none disposable数据库执行baseline-fresh和target-upgrade各8步，逐步preflight/apply/verify/ledger确认；最终15类catalog等价，最后事务故障注入回滚且不登记007。[migration-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/migration-result.json)。Production migration NOT APPLIED。

## 25. Production Build

最终未注入fixture的全项目 `next build --webpack` PASS：96.28s、1377构建文件，build ID `6IhDHN8Dm1nCewiCEZnV5`，archive SHA256 `1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28`。[candidate-build-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/candidate-build-result.json)。

候选冻结于 `/tmp/uply-r3d-release-candidate/candidate-build.tar.gz`；仅公有构建配置与生产相符，无服务密钥入包，无运行/部署。**Engineering candidate；NOT Production Ready。** 测试另使用隔离env的production Next build/start；两者不是同一个环境配置artifact。

## 26. Production Safety

开始/结束READ ONLY metadata：ledger449→449、完整ledger一致、Agent tables0→0；课程/lesson/profile/unlock元数据（排除observedAt）一致，Candidate0。runtime配置SHA仍与R3C一致，flagOFF、三名单EMPTY。[production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/production-safety.json)、[production-inventory.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/production-inventory.json)。

本任务production writes0、deploy0、migration0、Agent enable0、Tailscale mutation0、Live Provider requests0。未读取真实学生progress/enrollment/聊天，不声称禁止其他使用者同期行为。

## 27. Tests

| 验证 | 最终结果 |
|---|---|
| Agent+现有classroom/script/video/sidebar/readiness回归 | 379项：371 PASS、8环境skip、0 FAIL |
| TypeScript / scoped ESLint / git diff --check | PASS |
| Baseline unittest | 10项：7 PASS、3依赖显式环境skip；另有真实迁移/Full Supabase验收 |
| Atomic/Race/duplicate/security | 26检查PASS + closing精确故障/发布保护/审计/权限检查PASS |
| Formal Admin authoring | PASS，真实UI操作与Auth、既有review/validation/publish |
| Full Supabase RLS | 138 PASS，authoring后复查 |
| Agent domain/ports | 原真实隔离security fixture检查，随后真实目标Pins与完整课堂Runtime验证 |
| Reconciler | 18定向DB断言、39真实JWT拒绝PASS |
| Hangul formal route / replay / cancel / deadline | PASS |
| Responsive / keyboard | PASS |
| Baseline fresh / upgrade / schema equivalence / fail stop | PASS |
| Final production build | PASS，无部署 |

可复现步骤：[README.md](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3d/README.md)。所有Live Provider测试保持skip/fixture，不能据此声称真实DeepSeek质量、网络或政策验收通过。

## 28. Gate Matrix

| Gate | 名称 | 状态 | 证据/范围 |
|---|---|---|---|
| G-R3D-1 | Authoring Object Model Verified | PASS | §4–6真实schema |
| G-R3D-2 | Textbook Root Creation | PASS | author-result |
| G-R3D-3 | Initial Version Creation | PASS | author-result |
| G-R3D-4 | Initial Chapter / Module Creation | PASS | author-result；预备章0/orientation |
| G-R3D-5 | Teaching Lesson Creation | PASS | author-result |
| G-R3D-6 | Profile Association | PASS | server查询+两个真实外键 |
| G-R3D-7 | Product UI Entry | PASS | formal UI screenshot/action |
| G-R3D-8 | Authorization | PASS | PO合同；不扩机构角色 |
| G-R3D-9 | Tenant Isolation | PASS | RPC真实角色/tenant拒绝 |
| G-R3D-10 | Atomic Skeleton Creation | PASS | 精确late failure回滚 |
| G-R3D-11 | Duplicate Protection | PASS | 重复/双击冲突 |
| G-R3D-12 | Concurrency Protection | PASS | PO+PO2独立HTTP |
| G-R3D-13 | Existing Content Protection | PASS | partial与published保护 |
| G-R3D-14 | Existing Script Studio Continuation | PASS | 空节点按钮、两locale编辑 |
| G-R3D-15 | Validation / Publish Continuation | PASS | source review+checked publish |
| G-R3D-16 | From-Zero Full Supabase E2E | PASS | 零目标父子→UI authoring |
| G-R3D-17 | Published Content Produces Server Pins | PASS | 4实际Pins |
| G-R3D-18 | Hangul Formal Student Route | PASS | 正式Hangul route |
| G-R3D-19 | Agent Explain E2E | PASS | Tool/Evidence/Output |
| G-R3D-20 | Agent Teaching Domain Zero Writes | PASS | 79表+ALS归因 |
| G-R3D-21 | RLS Regression | PASS | 138真实JWT |
| G-R3D-22 | R3A Drain Regression | PASS | 18DB+39JWT+deadline |
| G-R3D-23 | Baseline / Migration Regression | PASS | 两路径8步schema等价 |
| G-R3D-24 | Production Build | PASS | 最终全量webpack候选 |
| G-R3D-25 | Production Ledger Unchanged | PASS | READ ONLY449一致 |
| G-R3D-26 | Production Writes Zero | PASS | 本任务0 |
| G-R3D-27 | Production Flag OFF | PASS | OFF/三名单EMPTY |
| G-R3D-28 | Live Provider Zero | PASS | fixture；实际请求0 |

28/28工程Gate PASS，仅在上述明确角色、预备章节与隔离验收范围内。不能由Gate PASS推导production内容存在或Stage1G获准。

## 29. Remaining External Blockers

生产代码/007及其他待上线增量仍未部署/应用，需要后续独立授权流程；教学负责人需通过正式UI创建、审核、发布真实生产内容并验证Pins。Production Candidate仍0。Tailscale实际测试APPROVAL REQUIRED；Provider Policy APPROVAL REQUIRED；Operator/备班人员未指定；生产Pilot tenant/course/user与最终内容范围证明未完成。

本轮不扩展一般章节CMS、机构教师Script Studio授权、复杂legacy修复、第0章完整视频预览或verified_current。预备章与实际Hangul Explain链已验证，这些范围限制不能隐藏。

## 30. Stage 1G Readiness

**NOT READY。** 即使R3D工程GO，也必须等待真实production content+Pins、授权的发布/迁移、Tailscale实测、Provider政策批准、值守人员及最终生产scope证明。本轮没有替任何责任人签字或发送审批消息。

## 31. Final Recommendation

接受R3D从零工作流闭环并交接内容负责人。内容负责人可在安装该版本的环境，通过已有课时→创建教学内容草稿→原Studio编辑两种台词→复核→校验发布→章节发布完成目标链，无需SQL或私有seed。生产环境目前仍未安装本轮变更，须等后续独立批准后才能执行。

停在R3D，不进入Stage1G，不部署、不改生产内容/迁移/Tailscale、不调用live Provider。隔离环境清理结果及最终工作区范围见 [cleanup-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/cleanup-result.json) 与 [workspace-scope.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3d/workspace-scope.json)。
