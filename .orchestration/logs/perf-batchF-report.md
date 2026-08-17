已完成 PERF-019 / PERF-020。未修改权限、RLS 或真实业务数据，未新增迁移，未 commit/push。

完整交接报告：[perf-batchF-report.md](/home/yangzhen/projects/my-lms-system/.orchestration/logs/perf-batchF-report.md)

### 改动文件

- [courses service](/home/yangzhen/projects/my-lms-system/src/features/courses/api/service.ts:71)：lesson→chapter 嵌套查询。
- [digital textbook service](/home/yangzhen/projects/my-lms-system/src/features/digital-textbook/api/service.ts:140)：textbook→version→chapter→module→node 合并。
- [growth toolbox service](/home/yangzhen/projects/my-lms-system/src/features/growth-toolbox/api/service.ts:108)：取得 course 范围后一次加载后续教材树。
- [universities service](/home/yangzhen/projects/my-lms-system/src/features/universities/api/service.ts:28)：枚举 fan-out 改为 `.in(...)` 稳定分页并内存分组。
- [回归测试](/home/yangzhen/projects/my-lms-system/tests/perf-management-tree-query.test.mjs:1)。

### 验收结果

| # | 结果 | 证据 |
|---|---|---|
| 1 | PASS | typecheck、lint exit 0；navigation 39/39。 |
| 2 | PASS | `npm run build` exit 0；编译、TypeScript、18/18 静态页和 trace 全部完成。 |
| 3 | PASS | `yuanzhi` 临时管理员真实访问 content、textbooks、toolbox、universities，均 HTTP 200、无读取警告，指标与旧查询一致。 |
| 4 | PASS / 部分 BLOCKED | content `4→3 RTT`；textbooks `9→4`；toolbox `10→5`；universities 当前数据 `10→9`，且不再随枚举数量线性增长。 |
| 5 | N/A | 未新增 RPC。 |
| 6 | PASS | 四次 smoke 账号均已删除；profiles、membership、enrollment、staff、provisioned、audit 全部为 0，Auth 均 not found。 |
| 7 | PASS | 本 packet 差集仅四个 service、相关测试和报告；开始前已有共享工作树改动未触碰。`git diff --check` 通过。 |

真实数据对照：

- content：15 lessons、33 chapters，ID 集合一致。
- textbooks：各层数量 `1/1/1/1/2/2`，ID 集合一致。
- toolbox：各层数量 `15/1/1/1/1/1`，ID 集合一致。
- universities：文书 `3551=3551`、签证 `3600=3600`，完整对象数组及原枚举顺序一致。

唯一安全阻塞：`courses→lessons` 是含 `tenant_id` 的复合 FK，平台数据两侧均为 `NULL`。PostgREST 嵌套实测会把 15 lessons 变成 0，因此保留这一层依赖查询。