# 课程结构：主从工作区改版

2026-09-13，经用户批准已部署；负责人真实操作待确认。

## 本次方向

由常驻分类侧栏 + 宽列表 + 底部详情，改为收起式课程切换 + 紧凑内容列表 + 右侧选中项资料。

- 顶部原生 details 课程切换，支持搜索、分类、课程、键盘操作；默认不占据一整列。
- 列表标题直接选择内容，当前项高亮。每行不再重复放查看/编辑按钮。
- 选中项的编辑、管理课时/章节在资料面板集中出现。仍用原 URL 及服务 Reader，刷新恢复选中项，不改数据库规则。
- 原 `CourseCatalogNodeView` / `CourseLessonView` 增加可选 compact 展示。其他调用默认不变；无封面时不制造大块空白，紧凑模式不重复标题和教材制作入口。
- 手机列表限制高度，标题区操作允许换行；大屏主从并列。亮/暗主题已截图检查。
- 未选择或非法选择有明确提示，原只读与新建权限继续保留。

UI/UX 技能的层级导航、渐进展示与可访问状态规则用于本轮设计。没有改变新建、编辑、资料上传、教材发布、课程开放或鉴权领域逻辑。

## 交付基线

- 基线：`/home/yangzhen/releases/uply-first-enable-20260910/source`，Build `lqaS_KnoXuTZMTHHM6Gbz`，已包含上一版课程结构整理。
- 隔离目录：`/tmp/uply-course-workspace.olxIFM`。
- 增量 patch：`docs/SMART_TEXTBOOK_COURSE_WORKSPACE_REDESIGN.patch`。
- SHA256：`119ed4e704e09b226787ad3238ed7c0716e4c2b5ca81d31ca4fe25018135e95b`。
- 5 个文件：Listing、Directory、NodeView、LessonView、浏览器测试。不是累计 patch，不再次叠加上一版 patch。
- 主开发目录业务代码、线上 source、数据库、运行进程均未修改。本次只在主目录保存文档、补丁和图片证据。

## 验证

- TypeScript typegen/tsc 通过，改动应用文件 ESLint 通过。
- 18/18 针对性测试通过：目录 Chromium、课程工作流、开放规则、上下文、教材工作区回归。
- 最后样式调整后单独重跑目录 Chromium 通过。
- 实测：切换课程、列表搜索和状态筛选、选择/高亮、编辑参数与所选 node 一致、刷新恢复、进入下级、收起详情、只读、非法 node/folder。
- 1440/375 宽度无横向溢出；暗色截图关闭过渡动画，避免把主题过渡中间帧误当最终效果。
- `git apply --check --whitespace=error` 在部署基线通过。
- 前轮记录的两条旧静态文案测试失败未在本轮更改；不宣称整个仓库测试全绿。

浏览器使用合成课程数据，但运行真实 Listing、Directory、NodeView、LessonView。新建/编辑与资料操作使用隔离传参探针，资料列表使用空状态探针；不执行真实修改。不是负责人生产账号 E2E，未验证真实上传/保存。本轮未运行生产构建或部署。

预览：`docs/evidence/course-workspace-20260913/1440.png`、`375.png`、`dark.png`。示例数据和部分按钮探针仅用于隔离验收。

## 部署记录

- 用户批准本次部署，补丁 SHA 与线上基线核验通过。
- 发布目录：`/home/yangzhen/releases/uply-first-enable-20260910/course-workspace-redesign-2026-09-12T16-22-48-773Z`。
- Build ID：`qX34cUVT8awF_Ub2SwWQv`。
- 独立候选执行纯 `next build --webpack` 成功，不触发 npm prebuild，不在真实凭据下执行隔离测试。
- 激活前再次核验源码 inventory、配置摘要和候选文件 SHA；部署后 5 个文件与候选一致。
- 仅短暂停启 `uply-first-enable`；其他 PM2 服务 PID/状态均未变化。上一版构建与文件备份保留在发布目录。
- 本地健康检查正常；8443 content 入口 HTTP 200，抽查 4 个 CSS/JS 资源均 HTTP 200。
- 未修改数据库、教材内容、素材、运行开关、发布指针或代理；主开发目录业务代码未回写。
- 上述为构建及未登录健康检查，不代表负责人正常登录后的编辑/保存验收。
