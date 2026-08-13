#!/usr/bin/env bash
set -euo pipefail

INPUT_WORKTREE="${1:-}"

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$ROOT_DIR" ]; then
  echo "ERROR: 当前目录不在 Git 仓库中。"
  exit 1
fi

cd "$ROOT_DIR"

if [ -n "$INPUT_WORKTREE" ]; then
  WORKTREE_PATH="$INPUT_WORKTREE"
else
  LATEST_WORKTREE="$(
    git worktree list --porcelain |
    awk '
      /^worktree / { path=$2 }
      /^branch refs\/heads\/cez\// { print path }
    ' |
    while read -r wt; do
      if [ -d "$wt" ]; then
        printf "%s\t%s\n" "$(stat -c %Y "$wt")" "$wt"
      fi
    done |
    sort -nr |
    head -n 1 |
    cut -f2-
  )"

  if [ -z "$LATEST_WORKTREE" ]; then
    echo "ERROR: 没有找到 Cezar worktree。"
    exit 1
  fi

  WORKTREE_PATH="$LATEST_WORKTREE"
fi

if [ ! -d "$WORKTREE_PATH" ]; then
  echo "ERROR: 指定的 worktree 不存在："
  echo "$WORKTREE_PATH"
  exit 1
fi

WORKTREE_PATH="$(cd "$WORKTREE_PATH" && pwd)"

PLAN_FILE="$WORKTREE_PATH/.ai/team/PLAN.md"
GOAL_FILE="$WORKTREE_PATH/.ai/team/GOAL.md"
STATE_FILE="$WORKTREE_PATH/.ai/team/STATE.json"
NEXT_TASK_FILE="$WORKTREE_PATH/.ai/team/NEXT_TASK.md"
PROGRESS_FILE="$WORKTREE_PATH/.ai/team/PROGRESS.md"
MANAGER_FILE="$WORKTREE_PATH/.ai/team/MANAGER.md"
CONTEXT_FILE="$WORKTREE_PATH/.ai/team/CONTEXT.md"
REVIEW_FILE="$WORKTREE_PATH/.ai/team/REVIEW.md"
WORKER_REPORT_FILE="$WORKTREE_PATH/.ai/team/WORKER_REPORT.md"
TEAM_CYCLE="$WORKTREE_PATH/.ai/scripts/run-team-cycle.sh"

echo "========================================"
echo "FULL TASK"
echo "========================================"
echo "Worktree:"
echo "$WORKTREE_PATH"
echo

for f in \
  "$PLAN_FILE" \
  "$GOAL_FILE" \
  "$STATE_FILE" \
  "$NEXT_TASK_FILE" \
  "$PROGRESS_FILE" \
  "$MANAGER_FILE" \
  "$CONTEXT_FILE" \
  "$REVIEW_FILE" \
  "$WORKER_REPORT_FILE"
do
  if [ ! -f "$f" ]; then
    echo "ERROR: 缺少文件：$f"
    exit 1
  fi
done

if [ ! -x "$TEAM_CYCLE" ]; then
  echo "ERROR: run-team-cycle.sh 不存在或不可执行："
  echo "$TEAM_CYCLE"
  exit 1
fi

PLAN_STATUS="$(
python - "$PLAN_FILE" <<'PY'
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text(encoding="utf-8")
lines = text.splitlines()

status = None

for i, line in enumerate(lines):
    if line.strip() == "## 状态":
        for nxt in lines[i + 1:]:
            value = nxt.strip()
            if value:
                status = value
                break
        break

print(status or "UNKNOWN")
PY
)"

echo "=== PLAN Status ==="
echo "$PLAN_STATUS"
echo

if [ "$PLAN_STATUS" != "CONFIRMED" ]; then
  echo "PLAN 尚未确认。"
  echo "请先回到 Codex Advisor 会话继续讨论。"
  exit 2
fi

cd "$WORKTREE_PATH"

BRANCH="$(git branch --show-current)"

if [ -z "$BRANCH" ]; then
  echo "ERROR: 无法识别当前 worktree 分支。"
  exit 1
fi

if [ "$BRANCH" = "main" ]; then
  echo "ERROR: refusing to run full task directly on main."
  exit 1
fi

case "$BRANCH" in
  cez/*)
    ;;
  *)
    echo "ERROR: 当前不是 Cezar worktree 分支："
    echo "$BRANCH"
    exit 1
    ;;
esac

echo "Branch:"
echo "$BRANCH"
echo

echo "PLAN 已确认，可以进入实施阶段。"
echo

echo "========================================"
echo "Step 1: Claude Manager Initialization"
echo "========================================"
echo

claude -p "你是项目 Manager。

你当前唯一允许使用的项目工作区是：

$WORKTREE_PATH

禁止读取或修改主项目目录中其他同名 .ai/team 文件。
禁止切换到其他 worktree。

必须使用以下绝对路径：

MANAGER:
$MANAGER_FILE

PLAN:
$PLAN_FILE

GOAL:
$GOAL_FILE

STATE:
$STATE_FILE

NEXT_TASK:
$NEXT_TASK_FILE

CONTEXT:
$CONTEXT_FILE

REVIEW:
$REVIEW_FILE

WORKER_REPORT:
$WORKER_REPORT_FILE

PROGRESS:
$PROGRESS_FILE

先读取：

1. MANAGER.md
2. PLAN.md
3. GOAL.md
4. STATE.json
5. CONTEXT.md
6. REVIEW.md
7. NEXT_TASK.md

只有确有必要时才读取完整 WORKER_REPORT.md 或 PROGRESS.md。

当前 PLAN 已由用户明确确认。

你的当前职责是：

- 根据 PLAN 初始化正式 GOAL
- 根据现有项目状态生成第一个明确 NEXT_TASK
- 不修改业务代码
- 不自行扩大 PLAN
- 不生成与 PLAN 无关的新业务目标
- 更新 GOAL.md
- 更新 STATE.json
- 更新 NEXT_TASK.md
- 必要时更新 CONTEXT.md
- 追加 PROGRESS.md

初始化要求：

- status = IN_PROGRESS
- iteration = 1
- current_task = 当前生成的 NEXT_TASK 对应任务名称
- completed_tasks = []
- last_review = null
- review_attempt = 0
- next_action = WAIT_FOR_WORKER
- blocked_reason 清空或不存在

如果 PLAN 内容不足以形成可靠实施任务：

- 不猜测
- status = BLOCKED
- next_action = WAIT_FOR_HUMAN
- 输出 HUMAN_APPROVAL_REQUIRED

最后必须输出以下二者之一：

OVERALL_STATUS: NOT_DONE

或

HUMAN_APPROVAL_REQUIRED

使用中文。" \
  --model claude-sonnet-5 \
  --effort low \
  --allowedTools "Read" "Write" "Edit"

echo
echo "========================================"
echo "Step 1 Complete"
echo "========================================"
echo

echo "=== PLAN Status After Manager ==="
python - "$PLAN_FILE" <<'PY'
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text(encoding="utf-8")
lines = text.splitlines()

status = None

for i, line in enumerate(lines):
    if line.strip() == "## 状态":
        for nxt in lines[i + 1:]:
            value = nxt.strip()
            if value:
                status = value
                break
        break

print(status or "UNKNOWN")
PY

echo

STATE_STATUS="$(
python - "$STATE_FILE" <<'PY'
import json
import sys
from pathlib import Path

try:
    state = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
except Exception:
    print("UNKNOWN")
else:
    print(state.get("status", "UNKNOWN"))
PY
)"

NEXT_ACTION="$(
python - "$STATE_FILE" <<'PY'
import json
import sys
from pathlib import Path

try:
    state = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
except Exception:
    print("UNKNOWN")
else:
    print(state.get("next_action", "UNKNOWN"))
PY
)"

CURRENT_TASK="$(
python - "$STATE_FILE" <<'PY'
import json
import sys
from pathlib import Path

try:
    state = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
except Exception:
    print("")
else:
    task = state.get("current_task")
    print("" if task is None else task)
PY
)"

echo "=== Manager State ==="
echo "Status: $STATE_STATUS"
echo "Next action: $NEXT_ACTION"
echo "Current task: $CURRENT_TASK"
echo

if [ "$STATE_STATUS" = "BLOCKED" ]; then
  echo "========================================"
  echo "HUMAN APPROVAL REQUIRED"
  echo "========================================"
  exit 3
fi

if [ "$STATE_STATUS" = "DONE" ]; then
  echo "========================================"
  echo "FULL TASK ALREADY DONE"
  echo "========================================"
  exit 0
fi

if [ "$NEXT_ACTION" != "WAIT_FOR_WORKER" ]; then
  echo "ERROR: Manager 初始化后 next_action 不是 WAIT_FOR_WORKER。"
  echo "当前：$NEXT_ACTION"
  exit 1
fi

if [ -z "$CURRENT_TASK" ]; then
  echo "ERROR: Manager 初始化后没有 current_task。"
  exit 1
fi

if [ ! -s "$NEXT_TASK_FILE" ]; then
  echo "ERROR: Manager 初始化后 NEXT_TASK.md 为空。"
  exit 1
fi

echo
echo "========================================"
echo "Step 2: Team Cycle"
echo "========================================"
echo

exec "$TEAM_CYCLE" "$WORKTREE_PATH"
