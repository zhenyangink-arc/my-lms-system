# Round5 / Packet14 最终验收报告

日期：2026-08-20（Asia/Seoul）

## 结论

本 Packet 的代码质量门禁与生产构建通过；第 26 节 28 项中 26 项 PASS、2 项 BLOCKED、0 项 FAIL。

两个第 26 节 BLOCKED 项以及本 Packet 的迁移专项 BLOCKED 共享同一前置原因：标准空库重放在本方案迁移之前的既有迁移 `202608190007_seed_korean_chapter_one_pilot_papers.sql` 失败。空库尚无有效平台负责人，而 `supabase/seed.sql` 要到全部迁移结束后才执行，因此本方案 `202608200001`—`202608200008` 未进入标准重放、账本没有登记，本轮也无法在重建后的数据库上完成 768px 全页面和跨角色真实事务复测。没有用临时账号、手工 SQL 或 migration repair 绕过该阻断。

## 第 26 节逐项结果

### 期中与期末

| Checklist | 状态 | 证据 |
|---|---|---|
| 存在期中和期末标准母卷草稿 | PASS | `korean-midterm-paper.test.mjs`、`korean-final-paper.test.mjs` 在生产构建 prebuild 中通过 |
| 两套试卷均覆盖六项能力 | PASS | 同上；期中 35 题、期末 41 题的冻结合同测试通过 |
| 总分、题量、解析、量规和音频状态完整 | PASS | 期中/期末完整性、主观量规、客观选项与音频状态断言通过 |
| 平台负责人可以质检和发布 | PASS | 发布权限、质量门禁、已发布只改状态的测试通过 |
| 老师可以布置并设置补考 | PASS | 补考配置、投递卷快照与服务端重新鉴权测试通过；Packet12b 浏览器证据仍在 `artifacts/round5-packet12b/` |
| 学生可以提交并查看已发布成绩 | PASS | 作答、待批改、成绩发布及同卷/换卷补考浏览器证据通过 |

### 结课资格

| Checklist | 状态 | 证据 |
|---|---|---|
| 结课政策可版本化 | PASS | 迁移 003 的版本、生命周期和发布锁定测试通过 |
| 资格只使用权威且已发布数据 | PASS | 只读取 `grade_released`、正式母卷 ID 与发布成绩的测试通过 |
| 待批改和未达标得到正确区分 | PASS | evaluator、首页 mapper、学生结课页测试通过 |
| 每个缺口有明确原因 | PASS | 结构化 gap 的自然语言 reason 与路由族测试通过 |
| 资格计算可重复、可审计、幂等 | PASS | evidence fingerprint、唯一索引、advisory lock、superseded 历史测试通过 |

### 证书

| Checklist | 状态 | 证据 |
|---|---|---|
| 不符合资格不能颁发 | PASS | 颁发/重颁 RPC 对 eligible 行的服务端校验测试通过 |
| 证书编号全局唯一且不可预测 | PASS | 128-bit `gen_random_bytes` 与全局唯一约束测试通过 |
| 证书保存政策和成绩快照 | PASS | policy/evidence/overall-score/identity 快照测试通过 |
| 撤销不删除历史 | PASS | 禁止删除、撤销状态机与 append-only 事件测试通过 |
| 重新颁发生成新编号并关联旧证书 | PASS | `reissued_from_id`、唯一约束和浏览器流程的既有证据通过 |
| 学生能够查看自己的证书 | PASS | 学生 RLS、学生结课页及打印证据通过 |

### 权限与数据

| Checklist | 状态 | 证据 |
|---|---|---|
| 平台、机构、老师和学生权限边界清晰 | PASS | 210 项全集覆盖 policy/RPC/table grant；学生只读本人、老师只读教学关系、机构负责人按 tenant、平台负责人跨机构 |
| 机构之间完全隔离 | BLOCKED | 既有 Packet10/13 浏览器与数据库证据为 PASS；但本 Packet 要求的重建后真实事务复测被迁移 202608190007 阻断 |
| 未发布成绩和答案不泄露 | PASS | grade-release RLS、safe projections、母卷草稿不可见测试通过 |
| 已发布母卷和证书快照不可静默改写 | PASS | 发布锁、题目/答案快照锁、证书不可变触发器与撤销事件测试通过 |
| 聚合查询无明显瀑布 | PASS | 每视图一次 RPC；统计/批量刷新使用 materialized CTE、set query、LATERAL，无学生循环 |

### 体验

| Checklist | 状态 | 证据 |
|---|---|---|
| 今日学习可以显示真实期中、期末和补考任务 | PASS | assignment-exam mapper 与 Packet12b 真实补考浏览器证据通过 |
| 未达标学生知道下一步去哪 | PASS | gap reason、`下一步`、`去完成` 和五类真实深链证据通过 |
| 待批改不会被显示为提交失败 | PASS | `pending_grading` 与“已提交，无需重复提交”测试和既有截图通过 |
| 手机端无横向滚动 | BLOCKED | 学生页与审核页既有 375px 证据通过；三类页面 375/768/1280 的最终统一复跑因迁移阻断未完成。验收脚本已补齐三档检查 |
| 状态同时使用图标和文字 | PASS | 学生页、审核页、统计页的语义文字与图标合同测试通过 |
| 证书支持清晰打印 | PASS | 独立 A4 横向 print DOM/CSS 测试通过；既有 `05-certificate.pdf` 与打印预览证据已生成 |

## Packet14 专项验收

| 专项 | 状态 | 说明 |
|---|---|---|
| 375 / 768 / 桌面三类页面 | BLOCKED | 脚本已覆盖三档；本轮运行态复测受迁移前置缺陷阻断。既有 375px 学生/审核和桌面统计证据仍有效 |
| 键盘、焦点、对比度、打印 | BLOCKED（静态合同与既有证据通过） | 页签方向键、提示 Enter/Escape、弹层焦点陷阱/返回、滚动区焦点环、4.5:1 token 合同、A4 打印均有自动化；但新增的逐页运行态断言未能在重建库复跑，因此不将本专项判为完整 PASS |
| 跨角色端到端回归 | BLOCKED | 静态权限全集通过；重建后真实学生/老师/机构/平台事务复测受同一迁移阻断 |
| 001—008 标准重放及账本登记 | BLOCKED | reset 退出 1；账本止于 202608190006，001—008 查询为 0 行 |
| 类型、Lint、测试、构建 | PASS | typecheck 0；lint 0（1 个既有 warning）；prebuild 210/210；build 0 |
| 五类深链最终确认 | PASS | Packet12b JSON/截图逐项为 HTTP 200 且到达教材、作业、章节巩固、专项训练、错题复习真实路由；本次生产构建路由表再次包含对应最终页面 |

## 本 Packet 实际修复

没有修改业务逻辑、算法或 SQL。

- `src/components/ui/sheet.tsx`：侧栏关闭按钮命中区改为 44×44。
- `src/features/course-completion/CompletionReviewWorkspace.tsx`：长补考弹窗限制在可视高度并可纵向滚动；三个取消按钮改为至少 44px。
- `src/features/course-completion/CompletionStatisticsPanel.tsx`：图表和数据表键盘滚动区增加可见焦点环及可访问名称。
- `scripts/verify-student-course-completion-ui.mjs`：新增 375/768/1280、双向 44px、键盘提示与焦点返回检查。
- `scripts/verify-course-completion-review-ui.mjs`：新增三档视口、全控件触控区、页签键盘、侧栏/弹窗焦点管理检查。
- `scripts/verify-course-completion-statistics.mjs`：新增机构/平台统计三档视口、触控区、横向溢出和趋势表键盘聚焦检查。
- `tests/student-course-completion-page.test.mjs`
- `tests/course-completion-review-ui.test.mjs`
- `tests/course-completion-statistics.test.mjs`：锁定上述收尾验收合同。

## 验证命令与退出码

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `SUPABASE_TELEMETRY_DISABLED=1 npx supabase db reset --local` | 1 | 在既有迁移 202608190007 因无平台负责人失败 |
| `SUPABASE_TELEMETRY_DISABLED=1 npx supabase migration list --local` | 0 | 本地文件到 202608200008；账本只到 202608190006 |
| 账本 SQL：查询 202608200001—202608200008 | 0 | 0 行 |
| 三个更新后的浏览器脚本 `node --check` | 0 | 语法通过 |
| 三个结课 UI 定向测试 | 0 | 14/14 PASS |
| 定向 ESLint | 0 | 无问题 |
| `npm run typecheck` | 0 | PASS |
| `npm run lint` | 0 | 0 errors；1 个范围外既有 warning |
| `npm run build` | 0 | prebuild 210/210；Next.js 16.2.10 webpack 生产构建成功 |
| `git diff --check` | 0 | PASS |
| `git status --short` | 0 | 工作树包含前序 Packet 与既有变更；本 Packet 改动范围见上节 |

## 迁移账本结论

- 标准 reset 的最后成功版本：`202608190006_platform_assessment_release_governance`。
- 首个失败版本：`202608190007_seed_korean_chapter_one_pilot_papers`。
- 本方案版本 `202608200001`—`202608200008`：文件存在，账本均未登记。
- 特别注意：本方案的 `202608200007_completion_retake_connections.sql` 过去虽以 `psql` 验证过，但当前标准账本仍没有 200007；不能以那次手工执行替代部署登记。

## 已知风险

1. 空库迁移顺序缺陷：`supabase/seed.sql` 在 migrations 之后运行，无法满足 202608190007/008 等数据迁移对平台负责人的前置依赖。
2. 本方案 200007 的历史手工执行未登记；远端部署前必须核对 schema 与账本，禁止直接假定已应用。
3. 三档响应式和四角色真实事务的本 Packet 最终复跑未完成；增强后的脚本必须在迁移链修复后执行。
4. 退回重做流程对评语可见性的处理仍是此前记录的产品权衡：当前优先呈现可执行下一步，不自动扩大内部评语披露范围。
5. 全量测试有 Node `MODULE_TYPELESS_PACKAGE_JSON` 性能 warning；Lint 有一个范围外 `lessonNumber` 未使用 warning，均不影响退出码。
6. 工作树包含全部前序 Packet 及其他既有未提交变更；本 Packet 自身只触及上列 9 个代码/测试文件和本报告。部署前应按 Packet/迁移拆分提交并复核清单，不能直接把整个脏工作树作为单一发布单元。

## 部署建议

1. 先在干净 staging 修复或正式解决 202608190007/008 的平台负责人前置数据问题，再从空库执行完整 `supabase db reset --local`；不要注入一次性临时账号作为验收结论。
2. 迁移严格按 `202608200001` → `002` → `003` → `004` → `005` → `006` → `007` → `008` 登记。完成后查询 `supabase_migrations.schema_migrations`，必须正好出现八个版本。
3. 对曾手工执行的 200007，先比对远端对象与迁移文件；只有完全一致且经过审批时才考虑官方 migration repair，否则由标准迁移执行，禁止只补账本不核 schema。
4. 不建议在结构迁移中种一份默认结课政策。若业务尚未冻结默认门槛，应由平台负责人创建并发布版本化政策；发布后再运行资格回填/批量刷新，且不自动颁证。
5. 若业务已批准统一默认政策，将其作为独立、可审计的数据部署步骤；先 draft/复核，再 publish，避免与表/RPC结构变更耦合。
6. staging 完整重放后依次运行三个浏览器脚本、权限/证书/刷新/统计数据库脚本、五类深链脚本及 `npm run build`，再允许生产部署。
