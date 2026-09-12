# 第一章内容与发布工作台

日期：2026-09-12。实施范围：平台负责人后台首版工作台，隔离开发和验证；随后经用户明确授权部署。

## 已实现与边界

本轮将既有第一章制作与发布能力连接成一个操作页，不重新实现 Runtime、判题或 Publisher。

| 能力 | 当前结果 |
| --- | --- |
| 第一章入口 | 教材列表增加工作台入口；仅平台负责人可见、可访问、可操作 |
| 八个 Step | 按既有模块顺序展示，标题复用 Adapter 的冻结 Runtime 标题；不修改 ID |
| 19 个活动 | 全部列出；orientation 三题保留 |
| 单选题编辑 | 对具有合法 index 答案的 single_choice，编辑中韩题干、选择正确答案；使用现有原子 RPC 一并保存 |
| 词汇、语法 | 保留并链接原管理入口；没有重做该编辑器 |
| 教学脚本 | 当前关联的已发布脚本台词只读展示，链接原脚本管理；不修改 v23 |
| 编辑窗口 | 显式确认停止该教材测试运行，区分 draining/editing，不强制清理请求 |
| 预览 | 链接已有负责人 Runtime 审计预览，读取已保存内容；不预览未保存表单、不创造第二套 Renderer |
| 校验与发布 | 正式 capture → compiler → 完整发布准入检查 → digest 检查 → 原数据库 Publisher/CAS |
| 刷新与失败 | 从服务器重读内容；保留失败提示与未保存表单，不把请求失败假报成功 |
| 未实现 | 通用 Step/Block 编辑器、选项增删、复杂活动配置编辑、模板/Region 编辑器、教师视频模式、其他章节工作台 |

这不是“所有章节内容都已可视化编辑完成”。首版完成的是现有安全接口能够承载的管理闭环；复杂内容明确只读，没有假保存按钮。现有词汇/语法/脚本入口的字段变化仍受冻结身份、依赖校验和发布准入约束，链接存在不代表任意结构修改均可发布。

尤其是当前 Legacy Adapter 仍要求 published v23。打开原脚本管理入口不等于已经支持将新脚本版本发布到 Runtime；新版本/新增内容身份的适配不在本轮完成范围。工作台不会绕过这一限制。

## 路由与源码

隔离源码：`/tmp/uply-student-ui-integration.bUmZfS`。

正式应用路径定义：`/[space]/dashboard/admin/apps/korean/textbooks/workbench`。当前平台工作区入口为 `/platform/dashboard/admin/apps/korean/textbooks/workbench`。

- `src/app/[space]/dashboard/admin/apps/[appSlug]/textbooks/page.tsx`：负责人入口。
- `src/app/[space]/dashboard/admin/apps/[appSlug]/textbooks/workbench/page.tsx`：负责人及应用访问校验、工作台初始读取。
- `src/features/digital-textbook/workbench/chapter-workbench.tsx`：步骤导航、编辑表单、状态、确认、校验与发布操作。
- `src/features/digital-textbook/workbench/contracts.ts`：闭合管理 DTO。
- `src/features/digital-textbook/workbench/actions.ts`：Next Server Action；不信任浏览器权限。
- `src/features/digital-textbook/workbench/service.server.ts`：每次重新鉴权、严格输入、既有服务组合、最小返回投影。
- `src/lib/smart-textbook-publishing/publisher.server.ts`：新增可选的已校验 digest 前置条件；旧调用不传该参数时保留原语义，数据库依赖校验不减弱。
- `src/lib/smart-textbook-publishing/capture.server.ts`：通过发布 DAL 提供既有冻结步骤标题投影；管理功能不直接引用 Adapter 内部文件，原架构边界测试不放宽。
- `tests/digital-textbook-workbench.test.mjs`：真实隔离 PostgreSQL + 应用 DAL/Publisher/Loader + Chromium 工作台。

## 真实操作链

1. 负责人正常认证 → 读取一致性 source capture → 投影工作台 DTO。
2. 确认进入编辑 → `beginChapterOneEditing()` → `begin_runtime_textbook_edit_v1`。
3. draining 时等待实际请求结束，不允许保存；editing 时允许现有编辑 RPC。
4. `editChapterOneActivity()` → `edit_runtime_chapter_activity_v1`，锁内校验 scope、类型和答案范围，原子保存题干及答案。
5. 校验使用 `compileChapterOnePublication()`、`validatePublication()`、`assertPublishableSnapshot()`；私有 binding 与媒体准入照旧。
6. 发布重新编译，检查与负责人刚校验的 digest 一致，原数据库事务检查 capture 与 CAS pointer。并发编辑不靠一个预先 SELECT 放行。
7. 原 `publish_runtime_snapshot_v2` 发布；Loader 读取新内容。旧测试会话不自动切换版本，重新进入课程建立会话。

进入编辑会影响整本教材的当前测试运行，不只是一个表单。UI 在操作前提示：即使没有修改，进入编辑后也要重新校验发布才能恢复测试；不会删除 attempt/progress/evidence/snapshot。

最近发布记录与客户端编辑状态分开显示。刷新不会凭本地 Boolean 宣称服务器已经开放编辑，必须再次向服务器确认。校验结果不是离线通行证，发布时仍可因并发修改或依赖不满足而拒绝。

## 权限与数据安全

- 页面复用 `requirePlatformOwner` 和应用访问规则；操作服务每次要求 `profile.global_role === platform_owner`，原 Publisher/RPC 再次验证负责人。
- 浏览器不提供 actor/tenant/student；额外未知输入被拒绝。
- 正确选项是负责人编辑所必需的管理数据，只经该 owner-only DTO 返回，学生 Runtime 不引用此服务。不会把完整 answer_key、私有 capture、对象路径、proof 或 profile secret 序列化到客户端。
- 不新增 DB schema/RPC/migration，不修改角色或权限，不写远端数据库或对象存储。
- Next Server Action 使用现有框架 POST/Origin 保护，客户端通过 transition 调用；没有新增宽泛 allowedOrigins。
- 使用 UI/UX 技能检查表单反馈与标签，复用现有 Button、CardTitleWithHint 和主题令牌，不新增装饰性英文标签。

## 验证记录

最终全量回归：**1208/1208 通过，0 fail / cancelled / skipped**。包括本轮工作台 4 项测试及现有 Runtime、Teacher、Recording、发布/会话和 legacy 回归。Adapter 边界专项另验证 50/50 通过，未修改或放宽原测试规则。

隔离 `next build --webpack` 成功，内含 TypeScript 检查通过，输出包含动态工作台路由。构建从白名单环境启动，仅使用 localhost:9 占位配置，不执行 npm prebuild，不注入真实 Supabase/R2 配置；该产物不得作为真实配置部署产物。新增/修改实现文件 ESLint 通过，`git diff --check` 及基线副本的 `git apply --check --whitespace=error` 通过。

实际验收：Chromium 切换全部八个 Step、进入编辑、修改 orientation 题干与答案、保存、校验、发布，正式 Loader 读取新题干与新答案；完整刷新后由服务重读并显示已保存中文。校验后并发改动被拒绝，同一 CAS 两次发布仅一次成功。19 个活动、三道 orientation、稳定 target ID 及 v23 teachingNodes 保持不变。桌面 1440 与手机 375 宽度无横向溢出。

构建产物扫描定位到真实工作台客户端 chunk，未混入 capture RPC、编辑 RPC、service role 配置名或 proof keyring 代码。负责人 DTO 仅有必要的答案索引，不含完整 secret row/对象路径。

此前测试失败曾揭示：隔离 HTML 未指定 UTF-8，导致内联初始中文数据被错误解码；已修正测试 HTTP Content-Type 与 meta charset，并保留刷新后中文内容断言。另修正表单显式标签关联和双语必填规则。全量测试还发现步骤标题直接引用 Adapter 内部文件的问题，已改为发布 DAL 投影，并在最终完整回归中通过，未降低测试标准。

证据：`docs/evidence/chapter-workbench-20260912/validation.json` 保存最终日志摘要与 SHA256；同目录 `1440.png`、`375.png` 为隔离组件截图。临时完整日志位于 `/tmp/uply-workbench-tests.log` 和 `/tmp/uply-workbench-build.log`。

测试使用冻结第一章公开内容及合成答案、授权身份传输、独立临时 PostgreSQL；没有普通学生记录或真实对象存储。浏览器通过隔离传输调用真实工作台服务，不冒充已登录负责人线上 E2E。既有 Runtime 预览入口本轮复用，完整真实账号预览/发布验收仍需后续授权部署及正常登录。

## 补丁与交付

- `docs/SMART_TEXTBOOK_CHAPTER_WORKBENCH.patch`：本轮增量补丁。
- 最终补丁含 9 个文件，SHA256：`1729f3a79d34d263cb325c30f48996fdacb62e922c51d66bfb0e584fde9c5b33`。
- `docs/evidence/chapter-workbench-20260912/patch-manifest.json`：逐文件基线/结果 SHA256 与补丁摘要。
- 基线为 `/home/yangzhen/releases/uply-first-enable-20260910/source` 的已部署学生 UI 候选；前轮 UI 累计补丁已经包含在该基线，不能再次叠加。
- 主开发目录有其他未提交工作；本轮不将业务改动回写该目录，不覆盖运行候选。主仓库只保存报告、增量补丁和隔离证据。
- 本轮没有执行 Git 提交、gate 修改、Runtime 扩围或教材真实发布。

## 授权后的部署结果

用户明确回复“批准部署负责人工作台”后，于 2026-09-12 执行部署：

- 部署前重新验证9个文件基线及补丁 SHA256，无漂移；未把业务补丁写入正在热加载的主开发目录。
- 发布候选原文件与旧 `.next` 备份到 `/home/yangzhen/releases/uply-first-enable-20260910/workbench-deploy-2026-09-12T14-47-58-256Z`，目录权限700，清单及构建日志600。
- 工作台增量补丁应用于 `/home/yangzhen/releases/uply-first-enable-20260910/source`，逐文件结果 SHA256 与交付清单一致。
- 使用权限600的候选外真实运行配置直接执行 `next build --webpack`，未运行 npm prebuild。构建成功，build ID `Hrr15bYbHOaaQQeB0fdvf`，路由 manifest 包含工作台页面。
- 部署时发现3000临时由主开发目录的 `uply-dev` 提供；停止该 UPLY 进程并启动候选 `uply-first-enable`。自动检查确认3000为200，其他 PM2 服务 PID/status 未变化。`uply-dev` 条目保留为 stopped，可作为已知恢复入口。
- Tailscale 8443 代理未调整，继续指向 `127.0.0.1:3000`；443、4000及其他服务未改。8443首页和抽查三份静态资源均为200；新进程0次重启、无新启动错误。
- 未执行数据库 migration/写入、教材发布、对象存储操作、配置修改、proof key修改、Runtime cohort扩大或学生路由切换。
- 命令行无负责人浏览器会话，因此只完成服务与鉴权入口健康检查。真正的负责人页面显示和操作仍需用户在正常登录会话中确认，不能把200响应当作负责人E2E完成。
- 未执行 `pm2 save`，避免将本机其他服务的环境配置写入PM2 dump；如需改变整机重启后的自启动清单，应单独审查并授权。

## 后续边界

首版工作台验证完成后，下一步是负责人确认可编辑范围和操作体验，再单独授权部署。复杂活动制作、完整模板编辑和学生视觉验收是独立未完成项；不以本轮测试通过宣称这些工作已完成。
