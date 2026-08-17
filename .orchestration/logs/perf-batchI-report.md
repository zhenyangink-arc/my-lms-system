PERF-014 已完成，首屏 JS gzip 下降 52,853 B（14.85%），未盲加任何包优化配置。

### 改动

- [HomeTreeViewTabs.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/home-tree/HomeTreeViewTabs.tsx:11)：仅在对话框打开且树非空时动态加载图形。
- [HomeTreeGraphPreview.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/home-tree/HomeTreeGraphPreview.tsx:1)：隔离 React Flow、布局计算和样式。
- [perf-audit-backlog.md](/home/yangzhen/projects/my-lms-system/.orchestration/perf-audit-backlog.md:204)：PERF-014 标记 DONE。
- [完整交付报告](/home/yangzhen/projects/my-lms-system/.orchestration/logs/perf-batchI-report.md:1)。

### 验收结果

| 验收项 | 状态 | 证据 |
|---|---|---|
| typecheck / lint / navigation | PASS | 全部 exit 0；navigation 39/39 |
| production build | PASS | Next 16.2.10 webpack build 成功 |
| home-tree 包体下降 | PASS | 355,893 → 303,040 B gzip，下降 52,853 B / 14.85% |
| 管理员浏览器实测 | BLOCKED | 本地 Supabase 容器不存在；最终 home-tree 路由也是既有 redirect |
| 包优化评估 | PASS | TanStack 三条路由 A/B 均为 0 B 差异，证据不支持配置 |
| 临时账号清理 | PASS / N/A | 未创建账号、未修改数据 |
| 改动范围 | PASS | packet 增量仅上述四个文件；临时 route/config 已恢复 |

`@tanstack/react-table` 的 permissions、accounts、app content 三条路由开启配置前后分别保持 316,215、324,338、326,757 B gzip，故没有修改 `next.config.ts`。`lucide-react` 也未重复配置。

完整 `git status` 仍包含任务开始前已有的其他 batch 共享改动；本次没有回退、提交或推送它们。