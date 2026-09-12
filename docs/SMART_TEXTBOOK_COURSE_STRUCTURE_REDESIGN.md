# 课程结构工作区整理

日期：2026-09-13。状态：经用户批准已部署，负责人浏览器操作待确认。

## 基线与交付

- 基线：`/home/yangzhen/releases/uply-first-enable-20260910/source`，已部署 Workbench redesign，Build ID `a2ctCRbeT7qu6LDfI2WSU`。
- 实现：`/tmp/uply-content-studio.lWpEv1`，无 `.env`、无生产凭据。
- 持久增量补丁：`docs/SMART_TEXTBOOK_COURSE_STRUCTURE_REDESIGN.patch`。
- SHA256：`4f311b18872b1a7838d25091042220aab566607e758a8a8b82ca9a40d3d55843`。
- 补丁仅基于上述已部署 source；不是针对主开发目录。前轮改动已在基线中，不重复叠加旧补丁。
- 主目录业务代码未覆盖；未提交工作保留。未操作数据库、媒体、发布指针、开关或运行进程。

## 改动

1. `course-catalog-listing.tsx`：将大统计面板收成页头数字；左侧目录、右侧当前下级内容与资料；保留面包屑、原新建/编辑弹窗及原节点资料组件。
2. 新增 `course-structure-directory.tsx`：搜索分类/课程、当前课程高亮；紧凑下级列表、名称搜索、开放状态筛选、查看资料和编辑。小屏标题和操作分行，避免挤成竖排。
3. `CourseWorkflowNavigation.tsx`：content 页使用自己的目录，不再叠加教材章节下拉。保留四个工作模块导航，其他页面不受影响。
4. 新增 `course-structure-studio.test.mjs`：真实 Listing 和新组件 Chromium 测试。

保留实际分类→课程→课时→章节关系，不重构数据模型。目录切换使用 Next Link 和 URL，刷新可以恢复；来自教材的 chapter 仅负责初次定位，后续结构导航清除该上下文，避免“返回全部分类”又被自动定位回原课时。面包屑增加循环保护。

不再默认显示素材完整度百分比、技术 slug、重复的统计卡或网格/宽表切换。这些不是新增发布准入标准。排序和开放规则继续通过原编辑弹窗维护。目录读取失败时不提供新建/编辑；无效目录显示提示、不在错误位置新建。

遵循 UI/UX 技能的分层导航与渐进展示规则；权限仍由原管理 Reader/Action 决定，未扩权。

## 验证

- TypeScript：`next typegen` + `tsc --noEmit --incremental false` 通过。
- 3 个改动应用文件 ESLint 通过。
- 18/18 针对性测试通过：新目录浏览器、工作流上下文、教材工作区浏览器、课程内容工作流、课程开放规则。
- 附加旧 `course-catalog-management-ui.test.mjs`：2 通过、2 失败；在未修改的部署基线上重复运行，同样 2 失败。旧断言仍要求 Listing 含“返回课程结构”及旧列标题“发布状态”，与此前已部署 TextbookStudio 不符。本轮没有删除或弱化这些测试，不宣称完整回归全绿。
- 补丁在部署基线 `git apply --check --whitespace=error` 通过。
- Chromium 覆盖：进入课程/课时/章节、查看/收起资料、名称搜索、状态筛选、刷新恢复、只读、非法目录、1440/375 宽无横向溢出；保存亮/暗色截图。
- 截图：`docs/evidence/course-structure-redesign-20260913/{1440,375,dark}.png`。

浏览器测试使用合成目录数据，真实 Listing/目录组件。编辑/新建弹窗仅用参数探针替代，节点详情用展示探针替代；不把该测试称为真实保存、负责人账号 E2E 或生产验收。实际原弹窗、Action、节点资料未改。截图中的测试按钮不代表实际弹窗样式。

## 下一步

用户已批准部署。正式负责人仍需验收真实目录与原编辑弹窗。

## 部署记录

- 部署目录：`/home/yangzhen/releases/uply-first-enable-20260910/course-structure-redesign-2026-09-12T15-56-49-198Z`。
- Build ID：`lqaS_KnoXuTZMTHHM6Gbz`。
- 补丁 SHA、基线应用、受限配置及进程核对通过；独立候选执行 `next build --webpack` 成功，绕过 npm prebuild，不在真实配置下运行测试。
- 激活前再次核验 source inventory/config digest；部署后 4 个补丁文件 SHA 与候选一致。
- 仅停止并重启 `uply-first-enable`；其他 PM2 服务 PID/状态未变。主开发目录业务代码未覆盖。
- 本地健康检查及 Tailscale HTTPS 8443 content 入口均 HTTP 200；抽查 4 项 CSS/JS 静态资源均 HTTP 200。此为未登录健康检查，不代表负责人真实账号功能 E2E。
- `previous-next` 与原文件备份保留在部署目录，支持恢复本次应用版本；未修改数据库、教材内容、素材、发布指针、运行开关或代理。
