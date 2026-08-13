#!/usr/bin/env bash
set -euo pipefail

WORKTREE_PATH="${1:-}"

if [ -z "$WORKTREE_PATH" ]; then
  echo "Usage: $0 <cezar-worktree-path>"
  exit 1
fi

if [ ! -d "$WORKTREE_PATH" ]; then
  echo "ERROR: Worktree not found:"
  echo "$WORKTREE_PATH"
  exit 1
fi

cd "$WORKTREE_PATH"

BRANCH="$(git branch --show-current)"

if [ "$BRANCH" = "main" ]; then
  echo "ERROR: refusing to run Codex Worker directly on main."
  exit 1
fi

TEAM_DIR="$WORKTREE_PATH/.ai/team"

NEXT_TASK_FILE="$TEAM_DIR/NEXT_TASK.md"
CONTEXT_FILE="$TEAM_DIR/CONTEXT.md"
STATE_FILE="$TEAM_DIR/STATE.json"
GOAL_FILE="$TEAM_DIR/GOAL.md"
WORKER_FILE="$TEAM_DIR/WORKER.md"
WORKER_REPORT_FILE="$TEAM_DIR/WORKER_REPORT.md"
PROGRESS_FILE="$TEAM_DIR/PROGRESS.md"

for f in \
  "$NEXT_TASK_FILE" \
  "$CONTEXT_FILE" \
  "$STATE_FILE" \
  "$GOAL_FILE" \
  "$WORKER_FILE" \
  "$WORKER_REPORT_FILE" \
  "$PROGRESS_FILE"
do
  if [ ! -f "$f" ]; then
    echo "ERROR: missing workflow file:"
    echo "$f"
    exit 1
  fi
done

echo "=== External Codex Worker ==="
echo "Worktree: $WORKTREE_PATH"
echo "Branch: $BRANCH"
echo

timeout 20m codex exec --sandbox workspace-write "
你是这个项目的 Codex Worker。

你当前唯一允许使用的项目工作区是：

$WORKTREE_PATH

禁止切换到其他 worktree。
禁止直接修改 main。

本轮默认只先读取以下最小上下文：

1. 当前任务：
$NEXT_TASK_FILE

2. 跨轮技术上下文：
$CONTEXT_FILE

3. 当前状态：
$STATE_FILE

不要默认读取完整 GOAL.md。
不要默认读取完整 WORKER.md。

只有以下情况才按需读取：

GOAL:
$GOAL_FILE

- NEXT_TASK 无法说明当前任务与整体目标的关系
- CONTEXT 信息不足
- 当前任务需要确认整体业务边界
- Manager 明确要求读取

WORKER:
$WORKER_FILE

- 允许修改范围不清楚
- 权限或高风险边界不清楚
- 验证规则不清楚
- WORKER_REPORT 格式不清楚
- CONTEXT 更新规则不清楚
- 出现异常或阻塞

如果需要 WORKER.md：

只读取相关章节，不要默认读取整个文件。

--------------------------------------------------

核心执行规则：

- 当前轮次只执行 NEXT_TASK 中明确要求的一个子任务
- 不改变整体 GOAL
- 不自行扩大任务范围
- 不自行增加新业务目标
- 优先复用 CONTEXT 中已经确认的路由、文件、函数、API 和技术事实
- CONTEXT 已提供可靠信息时，不要为了再次确认进行全仓库搜索
- 只有 CONTEXT 缺失、过期或冲突时才做针对性搜索
- 优先最小可靠修改
- 不做无关重构
- 不顺手修复超范围问题
- 不为了寻找优化而扫描无关代码

--------------------------------------------------

项目内普通开发权限：

无需人工批准即可执行：

- 读取当前项目文件
- 修改 NEXT_TASK 明确允许的文件
- 创建允许的新文件
- 搜索当前任务相关代码
- git status
- git diff
- git diff --check
- targeted lint
- targeted test
- 必要的 typecheck
- 普通本地开发命令

禁止：

- git merge
- git push
- 直接修改 main
- 未经授权 commit
- 生产部署

真正高风险操作才使用：

HUMAN_APPROVAL_REQUIRED

例如：

- 真实数据库破坏性操作
- 执行或新增会改变真实数据库结构的 migration
- 修改实际 RLS / 权限策略
- 修改认证安全模型
- 修改用户权限模型
- 处理真实密钥 / 凭据
- 生产环境修改
- 不可逆生产数据修改
- 大规模删除
- 数据迁移
- 重大依赖升级

读取和分析这些代码本身不属于高风险执行。

--------------------------------------------------

验证规则：

只做与当前任务匹配的最小必要验证。

优先：

- targeted lint
- targeted test
- 修改文件直接相关检查
- git diff --check

如果 CONTEXT 已明确记录全量 typecheck 存在与当前任务无关的历史错误：

不要每轮重复运行并输出同一批长错误。

只有当前任务确实可能影响全局类型关系时，才重新运行完整 typecheck。

不要默认运行完整 build。

--------------------------------------------------

命令输出控制：

- 避免大范围无关输出
- 优先限定文件 / 目录
- 优先针对性 rg / grep
- 必要时使用 head / tail
- 如果命令产生大量历史错误，只保留与当前任务判断有关的摘要
- 不重复读取同一大段输出

--------------------------------------------------

完成后必须：

1. 检查当前任务相关 git status / diff
2. 确认业务修改没有超出 NEXT_TASK
3. 执行最小必要验证
4. 如实更新：
$WORKER_REPORT_FILE
5. 追加简短进度：
$PROGRESS_FILE
6. 如果本轮产生了后续任务仍会复用的新技术事实，更新：
$CONTEXT_FILE

CONTEXT 只保存跨轮长期有用事实。

不要写：

- 完整代码
- 长篇分析
- 调试日志
- 完整命令输出
- 一次性错误
- 完整 WORKER_REPORT

如果没有新的跨轮事实：

不要为了填内容而修改 CONTEXT。

--------------------------------------------------

WORKER_REPORT 必须如实包含：

- 本轮任务
- 执行状态
- 实际修改内容
- 修改文件
- 关键执行命令
- 验证结果
- 发现的问题
- 优化建议
- 优化建议是否阻塞当前任务
- 已知问题
- 未完成事项
- 是否需要人工确认

发现的问题和优化建议：

有真实发现才写。
没有就写“无”。

禁止编造问题。
禁止编造优化建议。
禁止为了寻找问题或优化扩大扫描范围。

使用中文。
"

EXIT_CODE=$?

echo
echo "=== Codex Worker finished ==="
echo "Exit code: $EXIT_CODE"
echo

git status --short

exit "$EXIT_CODE"
