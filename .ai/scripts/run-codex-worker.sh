#!/usr/bin/env bash
set -euo pipefail

WORKTREE_PATH="${1:-}"

if [ -z "$WORKTREE_PATH" ]; then
  echo "Usage: $0 <cezar-worktree-path>"
  exit 1
fi

if [ ! -d "$WORKTREE_PATH" ]; then
  echo "Worktree not found: $WORKTREE_PATH"
  exit 1
fi

cd "$WORKTREE_PATH"

echo "=== External Codex Worker ==="
echo "Worktree: $WORKTREE_PATH"
echo "Branch: $(git branch --show-current)"
echo

timeout 20m codex exec --sandbox workspace-write '
你是这个项目的 Codex Worker。

先读取：
- .ai/team/WORKER.md
- .ai/team/GOAL.md
- .ai/team/STATE.json
- .ai/team/NEXT_TASK.md

只执行 NEXT_TASK.md 中明确要求的当前子任务。

严格规则：
- 不擅自扩大任务范围
- 不修改明确禁止修改的文件或目录
- 不执行 git merge
- 不操作 main 分支
- 不 push
- 不生产部署
- 不修改 GOAL.md
- 不修改 NEXT_TASK.md
- 不修改整体任务目标
- 如果任务涉及数据库迁移、认证、权限、环境变量、生产部署、大规模删除或重大依赖升级，停止执行，并在 WORKER_REPORT.md 中说明需要人工确认

验证规则：
- 文档类修改：只检查内容和 git diff，不运行 npm build
- 小型代码修改：优先运行针对性的 lint/typecheck/相关测试
- 除非任务明确需要，否则不要运行完整 build
- 不做与当前子任务无关的测试

完成后必须：
1. 检查 git status --short
2. 检查 git diff
3. 执行必要且最小范围的验证
4. 更新 .ai/team/WORKER_REPORT.md

WORKER_REPORT.md 必须包含：
- 本轮任务
- 执行状态
- 实际修改内容
- 修改文件
- 执行过的命令
- 验证结果
- 已知问题
- 未完成事项
- 是否需要人工确认

使用中文。
'

EXIT_CODE=$?

echo
echo "=== Codex Worker finished ==="
echo "Exit code: $EXIT_CODE"
echo
git status --short

exit "$EXIT_CODE"
