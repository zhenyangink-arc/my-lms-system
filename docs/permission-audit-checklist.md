# 前端学生端 / 后端管理端 权限与数据库匹配审查清单

用于系统性检查"学生端能看/能写的数据"和"管理端应该允许的范围"是否匹配——既包括代码里权限声明是否完整，也包括数据库 RLS 是否真的兜底，最后用真实账号交叉实测确认。

适用范围：多租户 Next.js + Supabase LMS。规模参考（写这份清单时）：`supabase/` 下约 237 个迁移文件，其中 91 个涉及 RLS policy；管理端 `dashboard/admin` 下约 25 个功能模块。量级较大，不能只靠人工逐页翻，尽量用下面的命令批量筛出可疑点，再针对性复查。

---

## 一、静态代码审查（前后端权限声明是否对得上）

### 1. 建一张"资源 × 角色"对照表
对每个核心资源（作业、成绩、课程、专项练习记录……），列出：学生端能看/写什么字段，管理端能看/写什么字段。目的是发现两类问题：学生端偷偷读到了管理端才该有的字段；或者管理端功能被学生端摸到了入口。

### 2. 批量核对学生路由的权限声明
```bash
grep -rL "canUseStudentFeature\|requireActiveUser\|role ===" src/app/\[space\]/apps/korean --include=page.tsx
grep -rL "canUseStudentFeature\|requireActiveUser\|role ===" src/app/dashboard --include=page-content.tsx
```
把"完全没出现权限检查关键字"的文件挑出来逐个确认是否遗漏。（用这个方法发现过 `toolbox/page-content.tsx` 漏了会员档位校验。）

### 3. 核对 Server Action 的权限，不只是页面
页面渲染做了权限检查，不代表它调用的 Server Action（`actions.ts`）也做了。提交作业、申请复核、收藏课程这类写操作容易被漏检：
```bash
grep -rL "requireActiveUser\|role ===\|canManage" src/app/dashboard/*/actions.ts
```
逐个确认每个 mutation 是否重新校验了身份和数据归属（例如"这条复核申请真的是当前学生自己的吗"，不能只信任前端传来的 ID）。

### 4. 核对 admin client 的使用范围
```bash
grep -rn "createAdminClient" src/app --include=*.tsx --include=*.ts
```
每一处都要问：是不是本该用普通 client（让 RLS 兜底），却图省事换成了 admin client？admin client 用得越多，就越依赖"代码写对"而不是"数据库兜底"，风险越集中，要重点复查这些位置的过滤条件。

### 5. 核对会员档位（membership tier）覆盖的功能是否完整
```bash
grep -rn "StudentFeature\b" src/lib/student-permissions.ts
```
列出所有 `StudentFeature` 枚举值，再反查每个值实际被哪些页面/action 引用。如果某个档位限制的功能，代码里只有 1-2 处引用，很可能有遗漏的入口没接上校验。

---

## 二、数据库 RLS 审查

### 6. 确认学生会碰到的表都启用了 RLS，且四种操作都有策略
```bash
grep -rln "ENABLE ROW LEVEL SECURITY" supabase/migrations
grep -rln "CREATE POLICY" supabase/migrations
```
重点关注：只写了 SELECT 策略、没写 INSERT/UPDATE/DELETE 策略的表——意味着理论上任何登录用户都能写入/篡改这张表，只是前端目前没提供入口而已。

### 7. 核对策略里的过滤条件是否真的做到位
每条 policy 的 `USING` / `WITH CHECK` 子句，确认同时具备：
- `student_id = auth.uid()`（或等价的归属判断）
- `tenant_id = ...`（多租户隔离）

只满足其中一个条件的策略单独拎出来复查，可能存在跨用户或跨租户读写风险。

### 8. 视图（View）单独确认 `security_invoker`
```bash
grep -rn "CREATE.*VIEW" supabase/migrations
grep -rn "security_invoker" supabase/migrations
```
凡是给学生端用的视图，必须是 `security_invoker = true`（继承调用者的 RLS），不能是 `security_definer`（会用创建者权限执行，绕过调用者本身的行级权限）。

### 9. 管理端专用表也要确认开了 RLS，不能因为"只有管理员用"就裸奔
只要表存在，任何拿到 anon/authenticated key 的客户端理论上都能直接查询（除非 RLS 挡住），不能假设"反正前端已经拦了，这张表不用管"。

---

## 三、动态实测验证（光看代码不够）

### 10. 用三种身份交叉测试同一批 URL
- 免费档位学生
- 付费档位（vip2/vip3）学生
- 教师/管理员账号

每种身份分别访问：（a）自己该有权限的页面——能不能正常使用；（b）不该有权限的页面（比如免费学生访问 VIP 专属功能的 URL）——是否被正确拦截，而不是"页面空白但数据其实已经加载了"。

### 11. 直接改 URL / 参数，不只点导航栏
前端导航栏可能隐藏了某些入口，但路由本身未必有保护。手动拼 URL 直接访问（换 `space` 到别的租户、换资源 ID 到别人的），确认服务端是否老实拒绝。

### 12. 用浏览器开发者工具核对接口返回的原始数据
即使页面 UI 没展示某字段，也要检查 Server Component / API 返回的原始 payload 里有没有夹带不该给这个身份看的数据（比如老师的内部备注、其他学生的分数）。

---

## 建议的执行顺序

1. 先跑第 2、3、4、5 条的 grep 命令，把"看起来可疑"的文件列成清单。
2. 针对清单里的每一项，做第 6-9 条的 RLS 复查。
3. 挑几个高风险资源（成绩、作业、会员专属功能）做第 10-12 条的真实账号实测，验证代码审查的结论。

## 相关文件

- `docs/page-review-checklist.md` —— 单页面 review 清单（第 1、2 条和本清单的第 2-5 条方法一致，可以配合使用）
- `src/lib/student-permissions.ts` —— `canUseStudentFeature` 和 `StudentFeature` 定义
- `src/lib/supabase/admin.ts`（或等价路径）—— `createAdminClient` 定义
- `supabase/migrations/` —— 所有 RLS policy 和视图定义
