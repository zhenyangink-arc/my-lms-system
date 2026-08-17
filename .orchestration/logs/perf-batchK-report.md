## 结论

已安全完成 PERF-002 的部分修复，保留所有 `force-dynamic`：

- 缓存租户内已发布帮助文章。
- 缓存“平台已发布 + 当前租户已发布”公告。
- 缓存键和 tag 均包含租户 UUID。
- 公告、帮助文章的创建、编辑、发布、下架均使用 Next 16 `updateTag` 即时失效。
- 缓存读取失败时回退到原来的会话/RLS 查询，不改变错误恢复行为或权限边界。

核心实现在 [published-tenant-content.ts](/home/yangzhen/projects/my-lms-system/src/lib/published-tenant-content.ts:1)，调用和失效位于：

- [announcements/page-content.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/announcements/page-content.tsx:46)
- [announcements/actions.ts](/home/yangzhen/projects/my-lms-system/src/app/dashboard/announcements/actions.ts:62)
- [help/page-content.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/help/page-content.tsx:16)
- [help/actions.ts](/home/yangzhen/projects/my-lms-system/src/app/dashboard/help/actions.ts:41)

## 验收结果

1. **PASS** — `typecheck && lint && test:navigation`

   - TypeScript：通过
   - ESLint：通过
   - Navigation：39/39 通过
   - 仅有既存的 `MODULE_TYPELESS_PACKAGE_JSON` 警告

2. **PASS** — `npm run build`

   - Next.js 16.2.10
   - 编译、TypeScript、页面数据收集和 18 个静态页面生成全部成功
   - 最终退出码：`0`

3. **PASS** — 生产模式缓存、隔离与失效实测

   使用临时学生、租户管理员账号，测试 `yuanzhi` 和已有第二租户 `yuanyuan`：

   - 同一租户学生重复访问并切换管理员访问：公告、帮助文章各只查询一次。
   - 第二租户访问：各产生独立缓存查询。
   - 两租户使用唯一测试标题互查，均只能看到本租户记录。
   - 管理员通过真实 Server Action 发布公告、帮助文章后，学生下一次读取立即看到新内容。
   - 查询轨迹：每类数据首次为 `yuanzhi ×1`、`yuanyuan ×1`；写后仅 `yuanzhi ×1` 重新查询，随后的重复读取再次命中缓存。

4. **PASS** — 未整体 BLOCKED，但保守拒绝了以下候选

   - 课程目录/课程树：最新 RLS 调用 `current_user_can_read_student_app`，结果依赖学生 enrollment、有效期、租户应用状态、员工 assignment 和角色，不能按租户共享。
   - 课程详情：混合进度、章节考试、阅读进度和前置条件结果。
   - 公告后台：包含草稿、管理范围、阅读人数和受众数据。
   - 帮助后台：包含草稿和个人工单。
   - 大学目录：公开目录本身为全平台数据、没有租户归属，同时页面混合个人目标/对比状态；本轮未扩大修改范围。

5. **PASS** — 临时账号及数据完全清理

   最终反查：

   ```text
   announcements=0
   helpArticles=0
   profiles=0
   memberships=0
   authUsers=0
   ```

6. **PASS** — 差异与动态声明核验

   - `git diff --check`：通过
   - `git diff | grep -n 'dynamic ='`：无输出
   - 没有修改或移除任何 `force-dynamic`
   - 本轮新增/修改仅上述 5 个文件
   - 工作树其他大量改动均为本轮开始前已存在，未触碰
   - 未 commit、未 push、未修改 RLS 或真实业务数据。