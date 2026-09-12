# 教材管理页功能整理

日期：2026-09-13。范围：`/[space]/dashboard/admin/apps/[appSlug]/textbooks` 的信息层级与入口整理。

## 结果

- 第一章工作台从页面外单独的链接改为列表内部的主要入口。只有服务器传入负责人入口、管理权限允许且当前筛选包含真实第一章时显示。
- 第一章表格行的“内容与发布”进入既有工作台；不以章节序号猜测其他教材是否支持工作台，使用已存在的第一章 ID 匹配。
- “编辑词汇”“编辑语法”从省略号菜单移为直接按钮，调用原编辑器，未重写保存服务。
- 第一章原章节发布功能保留在“章节测试发布选项”中，并解释它不更新 Runtime 快照。其他章节直接显示“发布章节与测试”，保留原确认及服务。
- 整本教材状态保留在“更多”中，明确操作影响整本教材，避免将其误认作当前章节快照发布。
- 摘要减少为教材、章节、词汇、语法四项；版本和模块信息仍在表格保留。状态列改名“教材与章节状态”，不冒充新 Runtime 的发布状态。
- 八类模块分别显示课前导航、词汇、语法、句型、对话、听说、读写、复习；未知模块显示“未识别模块”。
- 发布关联说明收纳为可展开区域。标题补充说明复用 `CardTitleWithHint`，依据 UI/UX 技能的信息层级与逐步展开原则整理。

## 基线与文件

隔离源码：`/tmp/uply-textbooks-organize.eoNxFA`。

基线为 `/home/yangzhen/releases/uply-first-enable-20260910/source` 的已部署负责人工作台版本（上轮记录 Build ID `Hrr15bYbHOaaQQeB0fdvf`）。本轮没有将业务代码写入主开发目录或部署目录；主目录的未提交修改保留。

增量补丁：`docs/SMART_TEXTBOOK_MANAGEMENT_ORGANIZATION.patch`，8个文件，SHA256：`72c7567788105a3016a2510d106196f1d5d9238eae2c1f9208d307a180160565`。

此补丁在已经包含 `SMART_TEXTBOOK_CHAPTER_WORKBENCH.patch` 的源码上应用，不能再次叠加上轮补丁。

修改范围：教材 route、page-content、listing、table 的 index/columns/cell-action；新增闭合章节入口 helper 与浏览器测试。无 Action、Service、RPC、Runtime 或权限规则修改。

## 验证

- 相关回归与新增 Chromium 测试：23/23 通过（textbook-navigation、course-content-workflow、management-routing）。
- Chromium 使用真实 listing/table/cell-action，隔离管理数据和 Next 路由传输；编辑弹窗在此测试中是参数探针，验证词汇/语法入口传参，不将其称为完整编辑保存验收。发布确认只打开与取消，未执行真实发布。
- 验证第一章链接、其他章节原发布确认、第一章次要发布入口展开、词汇语法入口、章节筛选、只读无管理按钮、无浏览器异常。
- 1440和375宽截图在 `docs/evidence/textbook-management-20260913/`；无整页横向溢出，手机表格沿用已有内部横向滚动。
- 修改后的应用文件 ESLint 通过；`next typegen` 后完整 TypeScript `tsc --noEmit --incremental false` 通过。首次直接类型检查缺少隔离副本的生成 RouteContext，生成后解决，未修改业务类型。
- `git apply --check --whitespace=error` 对部署基线通过。
- 主开发目录并非本补丁基线；对主目录试检时教材 route 不匹配，未应用或覆盖。必须使用上述已部署工作台基线审查与合入。主目录 `git diff --check` 通过。
- 未重复运行全量数据库/Runtime回归或生产构建；本轮仅涉及界面入口，部署前仍需按候选流程构建。

## 当前发布状态

整理完成后，用户明确回复“部署吧”，本轮已执行部署。未执行数据库迁移、教材编辑、快照发布或开启编辑窗口。

### 授权部署记录

- 部署目录：`/home/yangzhen/releases/uply-first-enable-20260910/textbooks-organize-2026-09-12T15-07-39-031Z`。目录700，私有构建日志和清单600；保留受影响原文件及完整 previous-next 恢复产物。
- SHA与8个文件补丁基线通过。构建前后核对 src/public/包清单/Next和TypeScript配置摘要，运行配置摘要一致，无并发漂移。
- 从当前部署源码创建独立候选，在候选外读取受限真实运行配置，直接执行 `next build --webpack`，未运行 npm prebuild 或测试。构建及内含TypeScript检查通过。
- 新 Build ID：`EzBxyAk2YmN4y_wRDAPch`。构建期间原服务继续运行；构建完成后短暂停止 uply-first-enable，应用补丁和交换构建产物，再启动同一服务。
- 切换健康检查通过，教材列表和workbench的8443响应均为200，其他PM2服务PID/status均未变化。未改Tailscale代理、gate、密钥或开机启动列表。
- 未将业务补丁写入主开发目录，保留用户未提交代码。此前隔离23项回归结果复用。
- HTTP200是入口健康结果，不代表已登录负责人完整验收；用户可在正常负责人会话中刷新教材列表检查新入口。
