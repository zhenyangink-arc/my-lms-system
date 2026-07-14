# PUFFY LMS 架构说明

## 页面边界

- `src/app/page.tsx`：公开首页与功能入口。
- `src/app/login`、`src/app/register`：Supabase Auth 登录注册。
- `src/app/dashboard`：登录且状态正常的用户区域。
- `src/app/dashboard/courses`：学生课程、课时、进度、资料与提问。
- `src/app/dashboard/admin`：管理员、CEO、老板使用的课程和账号管理。
- `src/app/api`：需要浏览器导航或文件跳转语义的 Route Handlers。

Dashboard 继续沿用现有 App Router 布局，没有引入新的状态管理框架或改变目录层级。

## 认证与授权

`src/lib/auth.ts` 是普通登录用户的统一服务端认证入口：

1. 使用 `supabase.auth.getUser()` 在服务端验证用户。
2. 读取 `profiles` 的姓名、角色和状态。
3. 未登录用户进入 `/login`。
4. `inactive` 或 `suspended` 用户进入 `/account-disabled`。

`src/lib/admin.ts` 在此基础上继续检查 `admin`、`ceo`、`super_admin` 角色。页面保护只用于导航体验，真正会修改数据的 Server Action 和 Route Handler 仍需在自身入口重新验证权限。

## 课程数据流

课程结构保持为：

```text
course_categories
  -> courses
    -> lessons
      -> lesson_progress
      -> lesson_resources
      -> lesson_questions
```

页面查询使用带当前用户 cookie 的 Supabase server client。学生侧可见范围、教师回答范围和管理员写入范围都应由 RLS 再次约束。

## 文件安全

R2 bucket 按私有存储设计：

1. 数据库只保存对象 key 与原始文件名等元数据。
2. 用户请求下载时，Route Handler 先认证账号并通过 Supabase/RLS 读取资源。
3. 仅资源对当前用户可见时，服务端生成短时签名下载 URL。
4. R2 密钥只能存在于服务端环境变量。

## 错误恢复

- 根级 `error.tsx`：处理普通页面渲染错误。
- `global-error.tsx`：处理根布局级错误。
- Dashboard `error.tsx`：在保留侧边栏和顶部条的情况下恢复内容区。
- `not-found.tsx`：统一未知地址体验。
- `loading.tsx`：为根页面与 Dashboard 提供流式加载占位。

项目使用本地安装的 Next.js 16 文档作为实现依据。升级 Next.js 前，应先阅读 `node_modules/next/dist/docs/` 中对应版本的升级与 API 文档。
