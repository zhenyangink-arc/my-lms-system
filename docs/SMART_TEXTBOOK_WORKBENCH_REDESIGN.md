# 第一章工作台界面整理

日期：2026-09-13。入口：`/platform/dashboard/admin/apps/korean/textbooks/workbench`。

## 已完成

顶部保留章节标题、步骤/活动数量、预览与进入编辑。主体分为活动内容、教学脚本、校验发布；查看活动时左侧按八步定位，脚本不再夹在题目之间，发布面板不再占据题目页上半屏。

题目展示中文与已有韩文题干，桌面选项双列、手机单列。可编辑与只读活动明确区分。技术snapshot/digest收进发布详情。发布区先校验再确认，展示实际发布记录与编辑暂停说明。返回链接直接回第一章教材制作。

保留原begin/read/check/save/publish服务调用、确认、busy互斥、未保存表单锁定、CAS与摘要保护。取消修改按钮显式type=button，避免表单内默认提交。无新增数据库、权限、Runtime或编辑字段。

## 验证

- 31/31相关测试通过：工作台、教材目录、管理路由、课程工作流和章节上下文。
- 工作台测试使用真实隔离PostgreSQL、真实工作台服务、Publisher/Loader和Chromium。浏览器编辑题干答案、保存、校验、发布，Loader读取新内容；刷新显示已保存题干。
- 8步骤、19活动、orientation三题、稳定target和v23教学数据保持。非owner拒绝、校验后编辑拒绝、CAS竞争单次成功、越界答案拒绝、取消不保存均通过。
- TypeScript（生成路由类型后）与组件ESLint通过；补丁对部署基线apply --check --whitespace=error通过。截图1440/375无整页横向溢出，包含后台主题容器；脚本和发布分别留图。
- 测试数据来自冻结章节内容及合成答案、隔离身份传输；无真实学生数据、远端数据库/对象存储访问。截图不是负责人真实登录E2E。

## 交付与基线

隔离源码：`/tmp/uply-workbench-redesign.UW496Y`。

补丁：`docs/SMART_TEXTBOOK_WORKBENCH_REDESIGN.patch`，3文件，SHA256 `a740e1a1f038f1a2eec12bc3fd8dce300fdd29c6a436ac9c699e9323fce65306`。

基线：`/home/yangzhen/releases/uply-first-enable-20260910/source`，Build ID `3t0mQTrqIxPszwH_29oxA`（已含教材Studio改造）。本补丁仅增量，不重复叠加前轮补丁。

截图：`docs/evidence/workbench-redesign-20260913/`。

主项目用户未提交代码保留，业务改动仅在隔离副本，未部署、未重启、未发布真实教材。部署前需正式构建。界面采用既有UI/UX技能的信息分区和渐进展示原则，复用CardTitleWithHint及主题样式。

## 授权部署完成

用户随后明确回复“部署”，完成以下操作；上节未部署为交付时状态。

- 三文件补丁SHA、源码基线和配置校验通过，切换前再次核对无漂移。
- 独立构建与备份目录：`/home/yangzhen/releases/uply-first-enable-20260910/workbench-redesign-2026-09-12T15-37-40-068Z`。目录700，清单及私有日志600；保存原文件和previous-next恢复产物。
- 使用候选外受限真实运行配置直接执行 `next build --webpack`，构建和TypeScript通过，未运行npm prebuild或测试。
- 新Build ID：`a2ctCRbeT7qu6LDfI2WSU`。构建后仅停止/重启uply-first-enable并切换产物；其他PM2服务PID/status未变化。
- 教材制作页、工作台8443入口均返回200，4个静态资源返回200，部署文件摘要匹配候选。入口健康不等于负责人真实登录操作验收。
- 无数据库迁移、教材编辑或快照发布；未修改gate、密钥、代理、开机列表，未回写主开发目录业务代码。
