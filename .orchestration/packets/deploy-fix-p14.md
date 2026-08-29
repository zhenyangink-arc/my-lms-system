目标：诊断并修复导致 `supabase db push` 在远程数据库上失败的问题，使部署队列里剩余的迁移
（202608190014、015、016、017）能够成功推送到远程 Supabase 项目。这是一个部署阻塞修复任务，
不属于韩语巩固中心路线图范围，但当前必须先解决它才能把路线图三轮的成果（015/016/017）部署上线。

已知事实（不需要重新排查，直接作为已确认信息使用）：
- 远程数据库当前已成功应用到 `202608190013`（用 `npx supabase migration list` 确认，输出里
  010—013 的 remote 字段已填充，014 及之后为空）。
- 执行 `npx supabase db push` 时，在应用 `202608190014_seed_korean_level_one_stage_exam_drafts.sql`
  阶段报错：
  ```
  ERROR: column "audio_status" of relation "assessment_paper_questions" does not exist (SQLSTATE 42703)
  ```
- 该列本应由更早的迁移 `202608190008_seed_korean_chapters_two_to_sixteen_paper_drafts.sql`
  （文件开头就是 `alter table public.assessment_paper_questions add column if not exists
  audio_status text not null default 'not_applicable';`）添加，且该迁移在远程的 migration list
  中已显示为已应用（remote 字段等于 local 字段）。
- 因此矛盾点在于：远程 migration 历史表认为 008 已成功应用，但目标列在远程实际表结构里可能并不
  存在，或者 014 里访问该列的语句由于某种原因（schema、事务、命名、大小写、目标表不是
  `public.assessment_paper_questions`等）没有命中真实的表。需要你直接连接远程数据库核实真相，
  不要臆测。

已冻结的决策：
- 只做诊断和最小化修复，不做无关重构。
- 禁止使用 `supabase migration repair` 之类的命令直接篡改远程 migration 历史表来"假装"已应用，
  除非你确认了这是唯一正确且安全的修复方式，并在报告中详细解释原因、执行前用只读方式确认了
  远程真实表结构现状。
- 不允许删除或修改已经成功应用到远程的迁移 010—013（文件内容和远程状态都不能动）。
- 不允许为了让迁移跑通而弱化 `audio_status` 的 check 约束或删除 014 里"4套阶段考试草稿必须
  完整生成"的断言检查，那是有意的数据完整性保护。
- 如果根因是 014 文件本身有 bug（比如写错了表名、字段引用方式、执行顺序、事务边界），直接修正
  014 这个文件本身（它在远程还没成功应用过，修改它是安全的，不会破坏已应用的历史）。
- 如果根因是远程数据库当前状态和本地/预期不一致（比如远程 008 实际执行时因为某种历史原因走了
  不同分支导致列没加上），要先用只读查询在远程核实真实表结构（例如查询
  `information_schema.columns`），拿到证据后再决定怎么修，不要在没证实前就动手改。
- 确认修复方案后，必须实际针对远程数据库验证 014、015、016、017 能够连续成功推送
  （`npx supabase db push`，这是真实操作，会实际修改远程数据库，你可以执行，因为这就是本任务
  目标）。

不要做的事（non-goals）：
- 不要修改 015、016、017 三个迁移文件的内容（除非确认问题出在它们身上，目前没有证据表明如此，
  优先假设问题只在014之前的衔接上）。
- 不要修改任何前端代码。
- 不要在未核实前臆测根因就动手改远程数据。

验收标准：
- 用只读查询证明你找到的根因（把查询和结果写进报告）。
- 修复后，`npx supabase db push` 能够把 014、015、016、017 全部成功推送到远程，用真实执行
  的完整输出证明（不能只做本地模拟）。
- 用 `npx supabase migration list` 确认远程状态最终显示 014—017 的 remote 字段与 local 一致。
- 不影响已应用的 010—013。

请按结构化报告格式回复：根因、变更文件列表、每条验收标准 PASS/FAIL/BLOCKED、实际执行的诊断
和修复命令与输出、任何假设或风险。
