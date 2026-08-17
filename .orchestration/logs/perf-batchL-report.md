PERF-011 已完成，并在 backlog 标为 DONE。未 commit/push，未修改权限判定、RLS、租户或真实业务数据。

## 改动文件

- [StudentPageHeader.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/StudentPageHeader.tsx:1)：移除独立 client root、router hook 和无效的 GuideAgent 分支，改为纯 pathname→标题/icon 展示组件。
- [DashboardPermissionGate.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/DashboardPermissionGate.tsx:59)：复用 gate 已有的规范化 pathname 渲染 header；header 不再产生独立 client entry。
- [StudentDashboardLayout.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/layouts/StudentDashboardLayout.tsx:31)：通过 ReactNode slots 保持 sidebar、Server Topbar、页面内容边界；移除包裹整个 shell 的 GuideAgentProvider。
- [LazyGuideAgentChat.tsx](/home/yangzhen/projects/my-lms-system/src/components/guide-agent/LazyGuideAgentChat.tsx:1)：新增轻量即时触发器，首次点击后才加载聊天实现；加载期间保留等尺寸、可访问的 busy 状态。
- [StudentSystemTopbar.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/StudentSystemTopbar.tsx:7)：接入延迟 GuideAgent。
- [PortalTopbar.tsx](/home/yangzhen/projects/my-lms-system/src/app/[space]/PortalTopbar.tsx:4)：登录落地门户也使用延迟 GuideAgent，避免提前预热聊天 chunk。
- [perf-audit-backlog.md](/home/yangzhen/projects/my-lms-system/.orchestration/perf-audit-backlog.md:177)：PERF-011 标记 DONE，补充量化与实测结论。

## 验收结果

| 验收项 | 结果 | 证据 |
|---|---|---|
| typecheck、lint、navigation | **PASS** | 串行命令 exit 0；navigation 39/39，lint 0 error |
| production build | **PASS** | Next 16.2.10 webpack 编译、TypeScript、18/18 静态页全部成功 |
| 体积与 hydration | **PASS** | 代表学生路由同步首载减少约 27.0 KiB raw / 9.0 KiB gzip；`StudentPageHeader` client entry 从 manifest 消失 |
| 功能实测 | **PASS** | 临时普通学生验证侧栏开合、Fullscreen API、权限拦截、标题导航更新、GuideAgent 按点击加载并正常打开 |
| 临时账号清理 | **PASS** | 三次夹具账号均删除；最终 Auth not found，相关表计数全部为 0 |
| 改动范围 | **PASS（本条增量）** | PERF-011 增量仅上述 7 个文件；`git diff --check` 通过。完整共享工作树仍包含进入任务前的其他 PERF 改动 |
| commit/push | **PASS** | 未执行 |

## First Load JS 对比

口径沿用 Batch G：`build-manifest.json` 公共入口加对应 page client-reference manifest，gzip 去重汇总；`react-loadable-manifest.json` 明确标识的 GuideAgent 异步文件不计入同步首载。

| 路由 | 改前 gzip | 改后同步 gzip | 下降 |
|---|---:|---:|---:|
| Korean 首页 | 285.1 KiB | 276.1 KiB | 9.0 KiB / 3.2% |
| Korean 课程页 | 293.5 KiB | 284.4 KiB | 9.0 KiB / 3.1% |
| Korean 进度页 | 285.1 KiB | 276.1 KiB | 9.0 KiB / 3.2% |
| Korean lesson | 330.3 KiB | 321.2 KiB | 9.0 KiB / 2.7% |
| 留学服务首页 | 283.2 KiB | 274.2 KiB | 9.0 KiB / 3.2% |
| 大学目标页 | 284.3 KiB | 275.3 KiB | 9.0 KiB / 3.2% |
| legacy scoped dashboard | 286.0 KiB | 276.9 KiB | 9.0 KiB / 3.2% |

GuideAgent 点击后 chunk：16.9 KiB raw / 6.0 KiB gzip。浏览器 Performance Resource 实测点击前不存在该请求，点击后才加载。

## 浏览器实测与清理

挂靠现有租户 `yuanzhi`，未创建租户：

- GuideAgent：点击前 chunk 未请求；点击后请求成功、对话框打开。
- 移动侧栏：全部功能 Sheet 成功打开并通过 Escape 关闭。
- 全屏：`fullscreenEnabled=true`，进入后 `fullscreenElement=true`、`data-student-fullscreen=true`，退出调用成功。
- 权限：普通学生访问 Korean courses 仍显示“当前操作暂无权限”。
- Header：导航到帮助页后正确更新为“帮助中心”。
- PWA：相关组件和挂载条件未修改；其 `beforeinstallprompt` 监听必须首屏及时注册，因此未延迟。

临时用户：

- `7b553337-1be6-4441-ab1e-b5b45d64dd79`
- `a23e29ca-40b8-4d9c-a57b-6e4e81a56e05`
- `671c0ee7-f322-41e4-a8f1-a055d7105aa6`

最终清理结果：`profiles`、`tenant_memberships`、`student_app_enrollments`、`tenant_provisioned_accounts`、`staff_profiles`、两类 audit logs 均为 0；三个 Auth 用户均不可再查到。

Proof：

```text
npm run typecheck                 PASS
npm run lint                      PASS
npm run test:navigation           PASS（39/39）
npm run build                     PASS
真实 Playwright 学生流程           PASS
git diff --check                  PASS
```

未遗留 PERF-011 待办；PERF-001 至 PERF-022 现均已有结论。