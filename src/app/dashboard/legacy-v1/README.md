# 学生端旧版视觉归档（v1）

此目录保存 2026-08-15 软件化改造前的学生端布局入口快照。

仍保留、但新学生端不再挂载的旧组件：

- `../GrowthHomeView.tsx`：旧成长首页
- `../DashboardSidebar.tsx`：旧窄侧栏
- `../StudentUtilityDrawer.tsx`：旧右侧工具栏

本目录中的 `.snapshot` 文件是改造前入口的原文快照，不参与 TypeScript 编译，也不会被当前页面导入。

2026-08-17 经用户明确确认，旧五主题的现行运行代码、切换器、亮度控制、`data-app-theme` 选择器与 `app-dashboard-theme` 初始化已删除。原“云瓷白”的中性数值迁移为无主题名称的固定全局基线；新学生软件主题继续由 `[data-student-shell="system"]` 独立承载。

本目录中的布局快照继续保留；旧主题运行代码不属于可恢复快照，不能根据更早的说明重新加入现行产品。

恢复旧版时，将 `StudentDashboardLayout.tsx.snapshot` 与 `StudentTopbar.tsx.snapshot` 的内容恢复到原路径，并让 `DashboardHomePage.tsx` 继续挂载 `GrowthHomeView` 即可。
