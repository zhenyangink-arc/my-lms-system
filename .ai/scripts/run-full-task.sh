#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$ROOT_DIR" ]; then
  echo "ERROR: 当前目录不在 Git 仓库中。"
  exit 1
fi

cd "$ROOT_DIR"

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

PLAN_FILE="$WORKTREE_PATH/.ai/team/PLAN.md"
GOAL_FILE="$WORKTREE_PATH/.ai/team/GOAL.md"
STATE_FILE="$WORKTREE_PATH/.ai/team/STATE.json"
NEXT_TASK_FILE="$WORKTREE_PATH/.ai/team/NEXT_TASK.md"
PROGRESS_FILE="$WORKTREE_PATH/.ai/team/PROGRESS.md"
MANAGER_FILE="$WORKTREE_PATH/.ai/team/MANAGER.md"
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
  "$MANAGER_FILE"
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

if [ "$BRANCH" = "main" ]; then
  echo "ERROR: refusing to run full task directly on main."
  exit 1
fi

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

PROGRESS:
$PROGRESS_FILE

请先读取以上文件。

PLAN.md 已经由用户明确确认，状态应为 CONFIRMED。

你不需要重新调查业务代码。
你不需要重新讨论需求。
你不需要重新设计方案。

PLAN.md 是本次正式实施的最终依据。

请按照 MANAGER.md 执行初始化：

1. 从已确认 PLAN 中提炼整体 GOAL
2. 如果 GOAL 仍是等待状态，将整体目标写入 GOAL
3. 只生成第一个明确 NEXT_TASK
4. NEXT_TASK 必须直接服务于 PLAN
5. 不扩大 PLAN
6. 不增加用户未确认的新功能
7. 更新 STATE
8. 更新 PROGRESS
9. 不修改任何业务代码

初始化完成后必须满足：

status = IN_PROGRESS
next_action = WAIT_FOR_WORKER
current_task = 当前生成的 NEXT_TASK 对应任务

如果 PLAN 内容确实不足以生成可执行任务：

status = BLOCKED
next_action = WAIT_FOR_HUMAN
输出 HUMAN_APPROVAL_REQUIRED

只能修改：

$GOAL_FILE
$STATE_FILE
$NEXT_TASK_FILE
$PROGRESS_FILE

不得修改其他文件。

最后输出：
OVERALL_STATUS: NOT_DONE

使用中文。" \
  --model claude-sonnet-5 \
  --effort low \
  --allowedTools "Read" "Write" "Edit"

echo
echo "========================================"
echo "Step 1 Verification"
echo "========================================"

echo
echo "=== PLAN Status After Manager ==="
PLAN_STATUS_AFTER="$(
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
echo "$PLAN_STATUS_AFTER"

if [ "$PLAN_STATUS_AFTER" != "CONFIRMED" ]; then
  echo "ERROR: PLAN 状态被异常改变。停止执行。"
  exit 4
fi

echo
echo "=== STATE ==="
cat "$STATE_FILE"
echo

STATUS="$(
python - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as f:
    state = json.load(f)

print(state.get("status", "UNKNOWN"))
PY
)"

NEXT_ACTION="$(
python - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as f:
    state = json.load(f)

print(state.get("next_action", "UNKNOWN"))
PY
)"

CURRENT_TASK="$(
python - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as f:
    state = json.load(f)

task = state.get("current_task")
print("" if task is None else task)
PY
)"

echo "Status: $STATUS"
echo "Next action: $NEXT_ACTION"
echo "Current task: $CURRENT_TASK"
echo

if [ "$STATUS" = "BLOCKED" ]; then
  echo "=== HUMAN APPROVAL REQUIRED ==="
  exit 3
fi

if [ "$STATUS" != "IN_PROGRESS" ]; then
  echo "ERROR: Manager 初始化后 status 不是 IN_PROGRESS。"
  exit 4
fi

if [ "$NEXT_ACTION" != "WAIT_FOR_WORKER" ]; then
  echo "ERROR: Manager 初始化后 next_action 不是 WAIT_FOR_WORKER。"
  exit 4
fi

if [ -z "$CURRENT_TASK" ]; then
  echo "ERROR: Manager 初始化后没有 current_task。"
  exit 4
fi

if ! grep -q '[^[:space:]]' "$NEXT_TASK_FILE"; then
  echo "ERROR: NEXT_TASK.md 为空。"
  exit 4
fi

echo "Manager 初始化验证通过。"
echo

echo "========================================"
echo "Step 2: AI Team Execution"
echo "========================================"
echo

exec "$TEAM_CYCLE" "$WORKTREE_PATH"
