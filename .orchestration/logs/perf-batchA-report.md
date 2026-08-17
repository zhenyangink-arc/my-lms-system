已完成 PERF-001 与 PERF-003，未修改 RLS、租户隔离、legacy 兼容入口或其他 backlog 条目，也未 commit/push。

### 改动文件

- [src/lib/auth.ts](/home/yangzhen/projects/my-lms-system/src/lib/auth.ts:143)：将 membership 与 active tenant 通过 PostgREST FK 嵌套合并为一次 RLS 受控读取，保留排序、角色覆盖、inactive tenant 拒绝和旧 schema fallback。
- [src/app/login/redirect/page.tsx](/home/yangzhen/projects/my-lms-system/src/app/login/redirect/page.tsx:6)：管理员登录直接生成 `/yuanzhi/dashboard/admin`，不再经过 `/dashboard` 与 `/yuanzhi/dashboard`。
- [documents/page-content.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/documents/page-content.tsx:90)：4 个站内目标改用 `getStudentAppPath`/`scopeDashboardPath`。
- [schools/page-content.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/admin/schools/page-content.tsx:14)：2 个 legacy 学校链接改用 `getManagementAppPath`。
- [tests/management-routing.test.mjs](/home/yangzhen/projects/my-lms-system/tests/management-routing.test.mjs:55)：新增鉴权合并和 canonical URL 回归契约。

### 改前/改后

| 指标 | Phase 0 | 改后 | 变化 |
|---|---:|---:|---:|
| tenant 整页固定 Auth/DB RTT | 5：middleware 1 + RSC 4 | 4：middleware 1 + RSC 3 | -1，-20% |
| RSC tenant 解析 | `getUser→profile→membership→tenant` | `getUser→profile→membership(+tenant)` | 4→3 |
| 管理员登录中间页 | `/dashboard`、`/yuanzhi/dashboard` | 无 | 2→0 |
| 登录后 URL 状态迁移 | 3 | 1 | -66.7% |
| 管理员登录样本 | 2292ms | 1814ms | -20.9%，受网络波动影响 |
| 学生登录链 | `/login/redirect→/yuanzhi` | 相同 | 无语义变化 |
| 指定页面直接 legacy href | login 1、documents 4、schools 2 | 全部 0 | PASS |

改后 production refresh：

| 页面 | warm TTFB | warm total | Phase 0 warm total |
|---|---:|---:|---:|
| 学生 `/yuanzhi` | 12.5ms | 150.5ms | 157ms |
| 管理 `/yuanzhi/dashboard/admin` | 8ms | 239.5ms | 213.5ms |

管理页 total 有本机/远程 Supabase 波动，但结构性指标明确下降：固定鉴权 RTT -1，登录中间跳数 -2。

### 验收结果

| # | 状态 | 证据 |
|---|---|---|
| 1 | PASS | typecheck、lint、navigation 全通过；navigation 34/34 |
| 2 | PASS | build 成功；compile 12.8s，18/18 static pages；153 路由 JS 估算 missing=0 |
| 3 | PASS | tenant 鉴权 5→4 RTT；管理员中间跳 2→0 |
| 4 | PASS | 学生、管理员真实登录成功；其他租户路径均回到 `yuanzhi`；角色交叉访问未越界 |
| 5 | PASS | 两账号及所有关联/审计行已归零 |
| 6 | PASS | 本批仅修改上述 5 个相关文件；Phase 0 的 `.orchestration/*` 未跟踪文件为任务开始前已有，未改其他 backlog |

First Load JS 与基线完全一致：

- `/[space]/dashboard/admin`：288.8 KiB gzip
- `/[space]/apps/study-abroad/documents`：292.5 KiB
- `/login`：242.8 KiB
- 最大 lesson：374.8 KiB

### 临时账号与清理

| 角色 | UUID | 创建审计 | 清理审计 |
|---|---|---:|---:|
| student | `92845e8a-769c-4905-98a5-6ad388776f40` | 426 | 428 |
| admin | `84474d86-73f4-4ec2-a620-699153931165` | 427 | 429 |

最终核验：

```text
auth users: User not found / User not found
profiles=0
tenant_memberships=0
tenant_provisioned_accounts=0
staff_profiles=0
student_app_enrollments=0
tenant_membership_audit_logs=0
```

### 安全保留项

middleware `getClaims()` 与 RSC `getUser()` 没有合并。Next 16 的安全模型只建议 Proxy 做乐观检查；若让 RSC 信任 Proxy 转发身份，会削弱用户撤销/服务端验证边界。因此保留双层验证，只合并后续 RLS 受控的 membership/tenant 查询。legacy 外部入口也完整保留并实测仍可到达 canonical 页面。