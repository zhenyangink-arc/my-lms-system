# 学生端旧版视觉归档（v1）

此目录保存 2026-08-15 软件化改造前的学生端布局入口快照。

仍原样保留、但新学生端不再挂载的旧组件：

- `../GrowthHomeView.tsx`：旧成长首页
- `../DashboardSidebar.tsx`：旧窄侧栏
- `../StudentUtilityDrawer.tsx`：旧右侧工具栏
- `../ThemeSwitcher.tsx`：阳光青提、极光紫、蜜桃珊瑚、曜石黑、云瓷白五套主题
- `../BackgroundBrightnessControl.tsx`：旧背景亮度与卡片外观控制

本目录中的 `.snapshot` 文件是改造前入口的原文快照，不参与 TypeScript 编译，也不会被当前页面导入。

旧主题 CSS 仍完整保留在 `src/app/globals.css` 的原主题区段中；新的学生软件主题使用独立的 `[data-student-shell="system"]` 作用域接管，因此不会删除或覆盖旧主题定义。浏览器中已有的 `app-dashboard-theme` 本地存储值也不会被清除。

恢复旧版时，将 `StudentDashboardLayout.tsx.snapshot` 与 `StudentTopbar.tsx.snapshot` 的内容恢复到原路径，并让 `DashboardHomePage.tsx` 继续挂载 `GrowthHomeView` 即可。
