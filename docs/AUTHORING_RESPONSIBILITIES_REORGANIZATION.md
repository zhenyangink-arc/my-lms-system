# 四个制作板块：职责与重复入口整理

日期：2026-09-13。范围：导航、入口与发布文案；不改变领域服务、权限、数据库或学生 Runtime。

## 1. 交付与基线

- 运行源码基线：`/home/yangzhen/releases/uply-first-enable-20260910/source`（语法一致性修复部署后）。
- 隔离工作副本：`/tmp/uply-authoring-navigation.XhmNlk`；没有真实 `.env.local`，没有运行服务连接该目录。
- 持久候选（本轮变更文件）：`docs/evidence/authoring-responsibilities-20260913/candidate/`。
- 对应部署基线文件：同目录 `baseline/`；每个文件的新旧 SHA 及主目录差异记录在 `patch-manifest.json`。
- Patch：`docs/AUTHORING_RESPONSIBILITIES.patch`，仅相对于上述部署基线的增量，不包含之前的语法 migration，不重复叠加前轮 patch。
- 主目录 HEAD：`b1672390ae96357a2143358235cc10edeff8d488`。主目录不等于部署基线；本轮不覆盖其业务文件，不提交或清理用户修改。
- 两个既有浏览器验证脚本来自主目录未提交文件，在隔离副本中更新当前文案与教材管理权限测试输入；原件保留。相对于部署目录它们是新增文件，不能重复覆盖主目录同名文件。

## 2. 四板块职责

| 板块 | 保留的主要职责 | 与其他板块的边界 |
|---|---|---|
| 课程结构 | 分类、课程、课时、顺序、开放规则、教材关联 | 不重复做教材正文；普通课时自身内容功能保留 |
| 教材制作 | 章节词汇、语法、互动内容；第一章工作台编辑、校验、教材发布 | 教材快照发布与旧章节/关联测试发布分别展示，不混为一个结果 |
| 教学脚本 | 讲解、任务、理解检查、反馈、教学编排及脚本版本发布 | 脚本发布不自动更新教材快照；不能把教师理解检查当教材 Activity 判题 |
| 练习工具 | 章节材料引用、独立资源副本、学生工具入口设置 | 引用不生成专项题；副本不自动同步教材；独立语法库不承诺尚未证实的学生消费链 |

证据：`src/lib/course-content-workflow.ts`、`src/app/dashboard/admin/apps/CourseWorkflowNavigation.tsx`，以及以下实际 UI 调用点。此前只读审计中的语法缺陷已经由上一轮修复并由用户验收，本报告不把旧问题当成当前状态。

## 3. 逐项入口处理

| 对象 | 原表现 | 本轮处理 | 保留的真实行为 |
|---|---|---|---|
| 四板块导航 | 只有板块名，职责靠猜 | 集中声明职责；当前板块显示简短职责，详细边界放统一 `CardTitleWithHint` | 原导航权限过滤不变；不把 UI 过滤当服务端鉴权 |
| 教材目录→跨板块 | 切章用 `history.replaceState`，顶部链接可能仍读旧服务端 chapter prop | `CourseWorkflowLinks` 从 `useSearchParams` 读取当前 URL，并调用原 `workflowHref` | 稳定 chapter ID、URL 编码、各目标页面授权不变 |
| 课程结构全局“进入教材制作” | 与顶部教材制作导航重复 | 移除重复全局按钮 | 课时详情中的带上下文入口和教材关联保留 |
| 教材工作台 | 页头与发布分区两个 Link 指向同一工作台 | 只保留页头入口；发布页签下文案变为“前往工作台校验与发布” | 第一章真实工作台、其他章节不冒充支持；维护窗口提醒保留 |
| “发布学习步骤” | 容易误解为教材 Step 发布 | 改为“发布当前步骤脚本”；确认按钮“校验并发布脚本” | 原 `publishTeachingScriptAction`、版本字段、未保存导航确认均不变 |
| 教学脚本发布检查 | “章节发布条件检查”容易当成教材发布入口 | “教学依赖检查（不发布）” | 原只读检查服务及学生访问条件检查保留 |
| 工具“章节练习” | 易被理解为题目制作 | 改为“章节材料引用” | 原 snapshot 核对、确认关联和 revision 规则保留 |
| “从教材添加” | 不易区分复制和引用 | 改为“从教材复制到独立库” | 原复制功能、独立库编辑、工具启停均保留 |

精简的是重复入口，不是删除功能或数据。旧章节与关联测试发布、脚本发布、教材快照发布仍是三种不同操作，本轮不合并其后台事务。

## 4. 实现与保护范围

9 个 UI/导航源文件、3 个测试文件、3 个浏览器脚本；完整清单见 patch manifest。

- 新增一个小型导航 Client Component；目录读取仍在原 Server Component，未新增数据库查询。
- 移动端四入口为两列网格，桌面保持同一行；保留当前页状态和键盘焦点。
- UI/UX 技能用于单一入口、导航一致性和信息渐进展示；复用现有颜色、组件与提示，不新建视觉系统。
- 未修改 Action、Route、SQL、RPC、fence、Adapter、Publisher、Loader、学生页、权限判断或媒体内容。
- 原 8 Step / 19 Activity / 三道 orientation / v23 和语法内容未改。
- 非 owner 管理能力的既有权限边界没有通过 UI 整理扩大，也没有在此任务顺便重构。历史独立库数据及未确认消费者不删除。

## 5. 验证

- 针对性单元回归：52/52 通过（职责、原导航、上下文、脚本工作台及补齐测试资料后的既有考试/Agent 检查）。
- 导航/教材 Studio Chromium：4 组通过，实际组件+隔离 Next 导航传输；验证四个链接、切章后上下文、工作台单入口、职责提示键盘/Escape、375/768/1440 无横向溢出及深色渲染。
- 教学脚本 Chromium：8 组通过；真实表单、未保存保护、角色字段、编排预演、版本只读、原发布 Action 合约不变。
- 练习工具 Chromium：5 组通过；引用确认门禁、切换状态保留、独立复制展开、搜索、键盘导航、只读及未选章状态。
- 原教材导航 Chromium 回归：通过；17 个目录记录、原词汇/语法编辑器传参、旧章节发布确认框、教材设置、只读和读取错误保护均保留。
- 上述均为隔离组件验收，不是登录真实负责人账号的线上 E2E。没有调用生产写入服务。
- TypeScript：通过（先运行 `next typegen` 生成隔离路由类型）。
- Patch 对保留的部署基线 `git apply --check`：通过；主目录 `git diff --check`：通过。
- 最终完整回归：**1226 项，1222 通过，0 失败，4 项既有可选 PGlite 测试跳过**，483.4 秒。跳过项为章节引用 SQL、策略版本、教学运营隔离、来源复核，要求额外 `LMS_PGLITE_MODULE` 配置；不把跳过计为通过。本轮已有其他真实隔离 SQL/Runtime 联合测试通过。日志：`docs/evidence/authoring-responsibilities-20260913/regression.log`。
- 最终隔离构建：`next build --webpack` 退出 0，使用 `isolated.invalid` 和占位 public key；没有真实 Supabase/R2 配置，不是可直接上线的真实配置构建。不运行 npm prebuild。构建日志与 TypeScript 日志在同一证据目录。
- 最终 patch SHA256：`a1f107a8dd16a6b5253d53afa9e01edeb39708e8f3d255c81862ea8371119b72`；15 个文件；保留基线 apply-check 与 whitespace 检查通过。

首次隔离回归漏带考试冻结文档、`.env.example` 和历史 target JSON，产生文件缺失失败。已从原部署源码补齐测试资料；没有修改断言标准、教材或生产配置。另一个原导航测试的 `next/navigation` 替身没有 `useSearchParams` 导出，导致打包失败；补齐测试替身后该原测试单独通过，不修改生产实现绕过测试。全量最终结果以最后一次运行日志为准。

## 6. 部署状态与剩余事项

初次开发交付未部署。后经用户明确批准，于 2026-09-13 完成部署，见下节。未执行 migration、未写生产数据库、未发布教材。

这轮交付是职责与入口整理，不是完整教材编辑器，也不解决其他章节新增制作能力、Teacher Video 或独立语法库消费链建设。

后续如批准部署，应先逐文件核对部署基线 SHA 与主目录 drift，只提升本轮 UI 候选；不要将整份旧主目录覆盖运行源码。上线后仍需负责人实际点击四板块、切换章节并核对显示。没有需要用户批准的数据删除或重置操作。

## 7. 已批准部署结果（2026-09-13）

- 用户授权：“部署吧”。15 文件基线及候选 SHA、patch SHA、受限运行配置和进程入口核对通过。
- 发布目录：`/home/yangzhen/releases/uply-first-enable-20260910/authoring-navigation-2026-09-13T05-17-02-323Z`。
- 使用原真实受限配置执行纯 `next build --webpack` 成功；没有执行 prebuild 或在真实凭据下运行测试，没有更改配置/gate/cohort。
- 旧 Build ID：`5Fa4thXL2m4EcFA5-Qx5R`；新 Build ID：`z3R-kXi6vrpDHJLLoR9GM`。
- 仅停止并重启 `uply-first-enable`；其它 PM2 服务 PID/状态未变化。没有修改 Tailscale 代理；8443 仍转发 localhost:3000。
- 旧构建保留在发布目录 `previous-next/`，原修改文件保留在 `before/`；受限 `manifest.json` 记录构建、基线和部署状态。
- 本地与 Tailscale HTTPS 8443：首页 200；content、textbooks、teaching-scripts、toolbox 四路由未登录请求均显示登录门禁，无 5xx。核验运行 Build ID 与新候选相符。
- 正常负责人浏览器 UI 验收：待用户执行。未冒用身份、复制 Cookie 或将未登录健康检查称作负责人 E2E。
- 主开发目录业务修改保留未覆盖；没有执行数据库 migration、数据删除、教材发布或学生 Runtime 开关变更。
- `patch-manifest.json` 的 `deployed:false` 是初次开发候选的历史状态，保持原验收证据不覆盖；实际部署状态以上述发布目录 manifest 和本节为准。
