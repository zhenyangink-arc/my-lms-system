# 练习工具工作区整理

日期：2026-09-13。实现已验证，并在用户另行授权后部署（见下方记录）。

## 信息结构

- 默认「章节练习」：沿用顶部章节选择，显示来源状态、前后内容对照、确认关联和停用。未选章节明确提示，不自动选择其他章节。
- 「独立练习库」：词汇/语法切换，保留创建、编辑、搜索及筛选。教材复制收进「从教材添加」，仍按所选章节筛选来源；独立库不随章节筛选，范围说明置于标题提示。
- 「工具设置」：保留启停、排序、课程关联与编辑。标识、路径、图标默认隐藏，仍可通过显示列查看；移除课程 UUID 尾码。
- 删除重复的六项概况统计，不删除任何资源或功能。

复用 CardTitleWithHint。工作区标签支持方向键/Home/End；非当前面板隐藏但保持挂载，避免切换时丢失输入。教材复制、关联确认、保存和权限仍使用原服务，未新增数据库操作。

## 修改范围

- `src/features/growth-toolbox/components/growth-toolbox-workspace.tsx`：工作区与库类型切换。
- `src/features/growth-toolbox/components/growth-toolbox-listing.tsx`：服务端组合与职责分区。
- `src/features/growth-toolbox/components/toolbox-items-table/index.tsx`：默认列可见性及表格宽度。
- `src/features/growth-toolbox/components/toolbox-items-table/columns.tsx`：去除课程 ID 装饰信息。
- `scripts/verify-toolbox-workspace.mjs`：真实 Listing、表格、关联组件的 Chromium 隔离检查。

## 验证

- TypeScript：通过。
- 修改的四个 TSX 文件 ESLint：通过。
- textbook-practice-resources、chapter-practice-binding、chapter-practice-detail、chapter-practice-publish-sync、course-content-workflow：29/29 通过。
- Chromium：五组场景通过，浏览器错误 0。覆盖确认门禁与提交范围、区域切换保留状态、教材来源展开、词汇/语法切换、工具搜索、技术列默认隐藏、键盘导航、手机页面、未选章节和只读状态。
- `git diff --check`：通过。

截图及结构化结果：`docs/evidence/toolbox-workspace-20260913/`。

浏览器使用合成数据和显式模拟服务/Action，仅证明界面行为及请求结构，不代表真实账号、真实保存或生产 E2E。未重复运行完整数据库验收或生产构建。前轮教学脚本未提交修改均保留；本轮未部署、未提交 Git、未写数据库或更改生产学生页面。

## 后续授权部署

- 发布记录目录：`/home/yangzhen/releases/uply-first-enable-20260910/toolbox-workspace-2026-09-13T01-13-30-292Z`。
- 补丁：`docs/TOOLBOX_WORKSPACE_REORGANIZATION.patch`，SHA256 `fcc5f4e33d23dcde98c7a4f764022572db540897de79ad19f52add4cb6d3b416`。
- 基线 Build ID：`tzDuUQsyt9UoOEYH-3enB`；新 Build ID：`l9HmPxSMluZWoirjL544P`。
- 基于线上源码建立独立候选，仅应用四个 toolbox TSX 文件。使用受限真实配置执行纯 Next 生产构建，无 prebuild 测试串入。
- 构建通过、切换前源码/配置摘要复核通过；仅停止/重启 `uply-first-enable`。其他服务进程状态与 PID 未变。
- 四个部署文件与开发工作区 SHA 一致；原构建保存在发布记录目录的 `previous-next`，原修改文件在 `before`，用于核验后的恢复。
- 本机首页 HTTP 200；既有 Tailscale HTTPS 8443 toolbox 地址 HTTP 200，未认证请求保留登录边界，无页面服务端异常标记。
- 未做负责人登录后的真实保存验收。未改数据库、未操作媒体、未改变学生 Runtime 开放范围、未提交 Git。
