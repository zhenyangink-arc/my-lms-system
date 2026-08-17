## 交付结果

PERF-012、PERF-013 均已完成局部拆包。未改业务逻辑、权限、RLS 或真实数据，未 commit/push。

### First Load JS 对比

Next 16 构建不再输出旧式 First Load JS 表，因此使用同一套 `.next/build-manifest.json`、client-reference manifest 和静态 chunk gzip 汇总口径进行前后比较。

| 路由 | 改前 gzip | 改后 gzip | 下降 |
|---|---:|---:|---:|
| 学生课时 `/apps/.../[lessonSlug]` | 374.1 KiB | 330.3 KiB | **43.8 KiB / 11.7%** |
| 学生课时 `/dashboard/.../[lessonSlug]` | 375.0 KiB | 331.1 KiB | **43.9 KiB / 11.7%** |
| 韩语练习详情 | 305.4 KiB | 291.2 KiB | **14.2 KiB / 4.7%** |
| 学生进度页 | 302.2 KiB | 288.0 KiB | **14.2 KiB / 4.7%** |
| 管理端教材页 | 314.4 KiB | 309.7 KiB | **4.7 KiB / 1.5%** |
| 管理端成长工具箱 | 316.2 KiB | 310.5 KiB | **5.7 KiB / 1.8%** |

主要延迟 chunk：

- 韩语书本章节：单章节约 5.6–14.0 KiB gzip，按当前章节加载。
- 知识研究工作台：约 15.8 KiB gzip，进入对应模式后加载。
- 教材编辑弹窗：点击后新增 1 个 JS 请求。
- 成长工具箱弹窗：点击后新增 1 个 JS 请求。

## 改动文件

- [HangulInteractiveBook.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/HangulInteractiveBook.tsx)：四种书本内容改为按当前章节动态加载。
- [LazyKnowledgeResearchWorkbench.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/progress/LazyKnowledgeResearchWorkbench.tsx)、[progress/page-content.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/progress/page-content.tsx)：研究工作台延迟加载。
- [cell-action.tsx](/home/yangzhen/projects/my-lms-system/src/features/digital-textbook/components/digital-textbook-table/cell-action.tsx)：教材内容编辑器仅在打开时加载。
- [lazy-growth-toolbox-action-dialogs.tsx](/home/yangzhen/projects/my-lms-system/src/features/growth-toolbox/components/lazy-growth-toolbox-action-dialogs.tsx)：新增轻量弹窗触发边界。
- [growth-toolbox-action-dialogs.tsx](/home/yangzhen/projects/my-lms-system/src/features/growth-toolbox/components/growth-toolbox-action-dialogs.tsx)：支持动态加载后自动打开及关闭回调。
- 成长工具箱调用点：
  [growth-toolbox-listing.tsx](/home/yangzhen/projects/my-lms-system/src/features/growth-toolbox/components/growth-toolbox-listing.tsx)、
  [grammar-table/columns.tsx](/home/yangzhen/projects/my-lms-system/src/features/growth-toolbox/components/grammar-table/columns.tsx)、
  [vocabulary-table/columns.tsx](/home/yangzhen/projects/my-lms-system/src/features/growth-toolbox/components/vocabulary-table/columns.tsx)、
  [toolbox-items-table/columns.tsx](/home/yangzhen/projects/my-lms-system/src/features/growth-toolbox/components/toolbox-items-table/columns.tsx)、
  [toolbox-items-table/index.tsx](/home/yangzhen/projects/my-lms-system/src/features/growth-toolbox/components/toolbox-items-table/index.tsx)。

动态占位均预留稳定高度，并保留 `role="status"`、`aria-live`、键盘关闭及原有焦点行为。`ui-ux-pro-max` 指引用于占位尺寸和可访问性处理。

## 验收结果

| 验收项 | 状态 | 证据 |
|---|---|---|
| typecheck、lint、navigation | **PASS** | 三条命令退出码均为 0；navigation 39/39。lint 仅有 10 条既存 API service 警告，无 error |
| build 与体积下降 | **PASS** | Next 16.2.10 production build 成功；覆盖路由均有可量化下降 |
| 学生及管理员实测 | **PASS** | 课时、章节折叠/展开、练习工作台、AI 工作台、章节测试、教材编辑弹窗、工具箱新增弹窗均成功，无白屏或应用错误 |
| 临时账号清理 | **PASS** | 两个认证用户删除后均为 `authNotFound=true`，所有检查表计数为 0 |
| 改动范围 | **PASS** | 本任务增量仅包含上列 PERF-012/013 文件；`git diff --check` 通过 |

Proof 命令：

```text
npm run typecheck                 PASS
npm run lint                      PASS（0 errors）
npm run test:navigation           PASS（39/39）
npm run build                     PASS
git diff --check                  PASS
```

实测账号：

- 租户：`yuanzhi`，ID `ead4e9d6-8b5f-4769-978b-f5a43083c491`
- 临时学生：`c982ab9f-bb1e-4f6e-ba10-d7a38de49b9e`
- 临时管理员：`616a1717-40cd-4d96-b85a-f6529cababd6`
- 清理检查：`profiles`、`tenant_memberships`、enrollments、progress、test attempts、staff profiles、审计表全部为 0。

AI 工作台界面正常进入并显示“快速开始”；测试环境中其外部 `trycloudflare.com` WebSocket 域名无法解析，记录为外部服务告警，不影响本次拆包页面加载和交互验证。跨多页面测试的累计 CLS 观察值为 0.1078；这是整段导航累计值，并非单路由 Web Vitals，过程中未观察到占位塌陷或明显跳动。

## 未拆部分

- `KoreanChapterTestRunner` 曾做候选动态拆分，但实测构建没有下降，反而出现约 0.5 KiB gzip 构建波动，因此已完整撤回。
- `KoreanLevelOneSmartTextbook` 内部状态耦合较深；继续拆分需要较大状态架构重写，超出本次低风险范围。
- backlog 所述两个旧巨型 manager 已不在当前实际路由依赖图中；实际路由使用 feature listing/action-dialog，因此本次拆的是当前真实首载路径，没有修改死代码。
- 完整 `git status` 仍包含进入任务前就存在的共享工作树改动和未跟踪文件；这些均未被本次工作改写。