已完成 PERF-007，并完成 PERF-006 的低风险 scope-loader 部分。课程详情级联查询未合并；未改权限、解锁、RLS、数据或 backlog，也未 commit/push。

### 改动文件

- [src/lib/student-app-data.ts](/home/yangzhen/projects/my-lms-system/src/lib/student-app-data.ts:43)
  - 用 React `cache()` 包裹 `getStudentAppCourseScope`。
  - 保留原函数签名、返回结构、三层查询、发布状态过滤及错误行为。
  - cache key 为 Supabase 客户端对象引用 + `appSlug`：
    - 同一 render 的认证上下文复用同一客户端引用。
    - 不同 app 由 `appSlug` 区分。
    - React request memoization 不跨请求；不同用户/租户请求不会共享结果。

### 验收结果

| # | 状态 | 证据 |
|---|---|---|
| 1 | PASS | `typecheck` exit 0；`lint` exit 0；`test:navigation` 35/35 通过。 |
| 2 | PASS | `npm run build` exit 0；Next 16.2.10 编译、TypeScript、18/18 静态页生成全部成功。该版本构建输出不再列 First Load JS 数字；本次只改服务端 helper，未改变任何 Client Component 或客户端依赖图。 |
| 3 | PASS | 同一 Server Component render：首次 Korean scope 3 RTT；重复调用后仍为 3 RTT，新增 0，且 `sameReference=true`。Study Abroad 独立执行后总计 6 RTT，app ID 和数据集合均与 Korean 不同。第二个独立 HTTP 请求重新执行相同 3+3 RTT，证明没有跨请求/用户缓存。 |
| 4 | BLOCKED | 未进行课程级联查询合并。现有 route identity 每层分别约束父 ID、slug、`is_published`，后续解锁/进度又依赖精确集合；仓库没有可证明字段、RLS、租户及发布过滤完全等价的 RPC，故按要求不冒险修改。 |
| 5 | PASS | 临时学生挂靠已有 `yuanzhi`，真实访问 assignments、grades、records 均返回 200，且没有页面读取错误提示。 |
| 6 | PASS | 本 packet 只新增 [student-app-data.ts](/home/yangzhen/projects/my-lms-system/src/lib/student-app-data.ts:43) 的差异；backlog 未修改。完整工作树中的其他文件为共享树已有改动，本次未触碰。`git diff --check` 通过。 |

### 往返次数

| 场景 | 改前 | 改后 |
|---|---:|---:|
| 同一 render、同 app 调用两次 | 6 RTT | 3 RTT |
| 第二次相同调用 | 3 RTT | 0 RTT |
| 同一 render、两个不同 app | 各自 3 RTT | 各自 3 RTT，不串数据 |

真实 scope 数据：

- Korean：4 categories、5 courses、15 lessons。
- Study Abroad：5 categories、8 courses、18 lessons。

### 临时账号清理

临时学生 UUID：`7a0ec626-c90e-45bc-b961-c062edaea865`。

清理后：

- Auth lookup：not found
- `profiles=0`
- `tenant_memberships=0`
- `student_app_enrollments=0`
- `tenant_provisioned_accounts=0`
- `staff_profiles=0`
- `tenant_membership_audit_logs=0`
- `application_access_audit_logs=0`

临时 cache-proof 路由及测试脚本均已删除。