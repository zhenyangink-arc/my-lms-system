# 页面 Review 检查清单（7 条）

用于给 `my-lms-system` 里任意一个学生端/管理端页面做设计、正确性、安全性审查。审查一个页面时按顺序过一遍这 7 条，问题和方案分开列出。

适用范围：多租户 Next.js + Supabase LMS，学生端 App（如 `korean`）路由形如 `/{space}/apps/korean/...`。

---

## 1. 权限 / 会员档位校验

- 路由有没有做角色判断（学生 / 老师 / 管理员）？
- 学生角色有没有调用 `canUseStudentFeature(role, membershipTier, featureKey)`（来自 `@/lib/student-permissions`）做会员档位校验？
- 前端隐藏入口不算数，服务端组件必须自己拦一遍。
- 对照兄弟页面：`grades/page-content.tsx`、`records/page-content.tsx` 都正确做了这层校验。
- **已发现真实漏洞**：`toolbox/page-content.tsx`（专项训练页）完全没做这层校验。

## 2. Admin / service-role client 是否绕过 RLS

- 凡是出现 `createAdminClient()` / `admin.from(...)` 的地方，RLS **不会**保护这次查询。
- 必须手动确认 `.eq("student_id", ...)`、`.eq("tenant_id", ...)` 等过滤条件是否完整、字段是否写对。
- 这是全项目里跨用户数据泄露风险最高的位置，优先级仅次于第 1 条。

## 3. 数据展示是否自洽

- 筛选器 / 分类卡上显示的计数，是否和下方实际展示的内容用同一套过滤条件算出来？
- **已发现真实 bug**：学习记录页（`records`）选中日历某一天后，上方分类计数（`categoryCounts`）没有跟着联动，只按时间范围算，不看 `selectedDate`，导致计数和实际列表条数对不上。

## 4. 错误处理是否统一

- Supabase 查询失败时，页面是显示"部分数据暂时无法读取"这类横幅提示，还是静默渲染成空状态、让用户误以为"真的没有数据"？
- 检查每一处查询的 `error` 分支是否都接入了和兄弟页面一致的 `dataError` 提示模式。

## 5. 视觉设计缺陷（三个全项目高频问题）

- **同一数字重复展示**：同一个统计值在页面里出现 2-4 次（学习记录、成绩、首页、专项训练页都有这个问题）。
- **颜色语义不统一**：同一个 CSS 变量（如 `var(--app-warm)`）在不同区块承载完全不同的含义。
- **卡片圆角层层嵌套**：`rounded-[2rem]` 套 `rounded-3xl` 套 `rounded-2xl`/`rounded-xl`，视觉碎片化。

## 6. 死代码 / 遗留逻辑

- 记录（不强制立即修）没有任何地方引用的导出组件（例：`grades/page-content.tsx` 里的 `GradeResultSection`，全项目无引用）。
- 记录不生效的兜底参数（例：`withStudentAppSchemaFallback` 的 legacy-query 参数，按当前实现永远不会被执行）。
- 这类问题不影响用户，但会误导以后读代码的人。

## 7. UI/UX 优化建议（非缺陷类，桌面/响应式 Web 端标准）

- 这一条是"页面没毛病但能更好"的建议，不算 bug，做不做由你决定。
- **产品形态确认**：这是 Next.js **网页应用**，不是原生 iOS/Android App。不要套用移动 App 专属规范（安全区域、原生手势、底部 Tab Bar 数量限制、触感反馈等）。
- **评判依据**：
  1. 项目自带的设计规范库 `.agents/skills/ui-ux-pro-max/`（未注册进对话工具列表，需要直接跑脚本：`python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<关键词>" --domain ux`，或加 `--stack nextjs`），取其中平台无关/Web 端适用的部分（可访问性、性能、响应式布局、排版配色、图表、表单反馈、导航模式）。
  2. 项目自己的设计系统文档 `design-system/yuanzhi-lms/MASTER.md`——macOS 风格方向，包含固定中性基线、Student OS 与 Management Apple 的层级关系，以及配色 token、圆角/阴影规范、字体栈、组件规范和反模式清单。**新建议优先对照这份文档判断，而不是凭感觉。**
- 已发现的建议类问题示例：课程目录页缺"我的进度"个人化数据、缺搜索筛选、缺顺序/进度提示；首页专项训练入口曝光不均、指标含义不清晰（如"本周目标 80%"没有说明）。

---

## 明确不用每次都查的低优先级项

除非你特别要求，否则不主动检查：`tenant_id` 隔离深度、Asia/Seoul 时区/日期边界计算在多个文件里重复实现、表单防重复提交、Server Component 查询是否可以并行化（waterfall）、移动端专项细节、测试覆盖率。

---

## 相关文件

- `design-system/yuanzhi-lms/MASTER.md` —— 第 7 条对照的全局设计系统规范
- `.agents/skills/ui-ux-pro-max/` —— 第 7 条检索用的本地设计规范库
- `src/app/globals.css`、`src/app/dashboard/StudentSystemTopbar.tsx`、`src/app/dashboard/management-apple.css` —— 固定中性基线、Student OS 分时背景与 Management Apple 的现行实现

## 已完成 Review 的页面

- `/apps/korean/records`（学习记录）
- `/apps/korean/grades`（我的成绩）
- `/apps/korean`（首页）
- `/apps/korean/courses`（课程目录）
- `/apps/korean/practice/skills`（专项训练）

## 待 Review 的页面（korean app 下）

`practice/skills/vocabulary`、`practice/course`、`practice/review`、`assignments`、`library`、`announcements`、`help`、`conversation-practice`、`training`
