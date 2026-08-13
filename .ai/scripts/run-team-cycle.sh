#!/usr/bin/env bash
set -euo pipefail

WORKTREE_PATH="${1:-}"
MODE="${2:-normal}"

if [ -z "$WORKTREE_PATH" ]; then
  echo "Usage: $0 <cezar-worktree-path> [--resume-review]"
  exit 1
fi

if [ ! -d "$WORKTREE_PATH" ]; then
  echo "ERROR: Worktree not found:"
  echo "$WORKTREE_PATH"
  exit 1
fi

WORKTREE_PATH="$(cd "$WORKTREE_PATH" && pwd)"

cd "$WORKTREE_PATH"

BRANCH="$(git branch --show-current)"

if [ "$BRANCH" = "main" ]; then
  echo "ERROR: refusing to run AI team cycle directly on main."
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

# ============================================================
# Absolute workflow paths
# ============================================================

TEAM_DIR="$WORKTREE_PATH/.ai/team"

MANAGER_FILE="$TEAM_DIR/MANAGER.md"
WORKER_FILE="$TEAM_DIR/WORKER.md"
REVIEWER_FILE="$TEAM_DIR/REVIEWER.md"

GOAL_FILE="$TEAM_DIR/GOAL.md"
STATE_FILE="$TEAM_DIR/STATE.json"
NEXT_TASK_FILE="$TEAM_DIR/NEXT_TASK.md"
WORKER_REPORT_FILE="$TEAM_DIR/WORKER_REPORT.md"
REVIEW_FILE="$TEAM_DIR/REVIEW.md"
PROGRESS_FILE="$TEAM_DIR/PROGRESS.md"
CONTEXT_FILE="$TEAM_DIR/CONTEXT.md"

CODEX_WORKER="$WORKTREE_PATH/.ai/scripts/run-codex-worker.sh"
DELIVERY_SCRIPT="$WORKTREE_PATH/.ai/scripts/merge-done-task-to-main.sh"

for f in \
  "$MANAGER_FILE" \
  "$WORKER_FILE" \
  "$REVIEWER_FILE" \
  "$GOAL_FILE" \
  "$STATE_FILE" \
  "$NEXT_TASK_FILE" \
  "$WORKER_REPORT_FILE" \
  "$REVIEW_FILE" \
  "$PROGRESS_FILE" \
  "$CONTEXT_FILE"
do
  if [ ! -f "$f" ]; then
    echo "ERROR: missing workflow file:"
    echo "$f"
    exit 1
  fi
done

if [ ! -x "$CODEX_WORKER" ]; then
  echo "ERROR: Codex Worker script missing or not executable:"
  echo "$CODEX_WORKER"
  exit 1
fi

if [ ! -x "$DELIVERY_SCRIPT" ]; then
  echo "ERROR: Delivery script missing or not executable:"
  echo "$DELIVERY_SCRIPT"
  exit 1
fi

echo "========================================"
echo "AI TEAM CYCLE"
echo "========================================"
echo "Worktree: $WORKTREE_PATH"
echo "Branch:   $BRANCH"
echo

MAX_REVIEW_ATTEMPTS="$(
python - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as f:
    state = json.load(f)

print(state.get("max_review_attempts", 3))
PY
)"

CYCLE=1

while true; do

  echo
  echo "========================================"
  echo "Cycle: $CYCLE"
  echo "========================================"

  # ==========================================================
  # STEP 1 — CODEX WORKER
  # ==========================================================

  if [ "$MODE" = "--resume-review" ] && [ "$CYCLE" -eq 1 ]; then
    echo
    echo "=== Step 1: Codex Worker ==="
    echo "Resume mode: 跳过本轮 Worker，直接使用现有 WORKER_REPORT.md。"
    echo

    if [ ! -s "$WORKER_REPORT_FILE" ]; then
      echo "ERROR: --resume-review 需要已有且非空的 WORKER_REPORT.md"
      exit 5
    fi
  else
    echo
    echo "=== Step 1: Codex Worker ==="

    "$CODEX_WORKER" "$WORKTREE_PATH"

    echo
    echo "=== Codex Worker finished ==="
    echo
  fi

  # ==========================================================
  # STEP 2 — CLAUDE LIGHTWEIGHT REVIEWER
  # ==========================================================

  echo "=== Step 2: Claude Lightweight Reviewer ==="
  echo

  cat > "$REVIEW_FILE" <<'EOF'
# REVIEW

尚未进行审核。
EOF

  claude -p "你是项目的 Claude Lightweight Technical Reviewer。

你当前唯一允许使用的项目工作区是：

$WORKTREE_PATH

禁止切换到其他 worktree。
禁止读取或修改主项目目录中的同名 .ai/team 文件。

必须使用以下绝对路径：

REVIEWER:
$REVIEWER_FILE

NEXT_TASK:
$NEXT_TASK_FILE

WORKER_REPORT:
$WORKER_REPORT_FILE

STATE:
$STATE_FILE

PROGRESS:
$PROGRESS_FILE

CONTEXT:
$CONTEXT_FILE

REVIEW:
$REVIEW_FILE

先读取：

1. REVIEWER.md
2. NEXT_TASK.md
3. WORKER_REPORT.md
4. STATE.json
5. PROGRESS.md

必要时才读取 CONTEXT.md。

默认不要：

- 读取业务代码
- git diff
- git status
- test
- lint
- typecheck
- build
- 扫描项目
- 重新实现 Worker 的任务

Codex Worker 负责实际代码修改与验证。

你的主要职责是：

比较 NEXT_TASK 与 WORKER_REPORT。

判断：

1. Worker 报告的完成内容是否覆盖 NEXT_TASK
2. 报告中的修改范围是否符合 NEXT_TASK
3. 报告是否内部自洽
4. 验证结果是否足以支持当前任务完成
5. 是否存在未完成事项
6. 是否存在 HUMAN_APPROVAL_REQUIRED
7. 是否存在当前任务范围内值得立即处理的小优化

如果 WORKER_REPORT 信息不足，不要自行全面调查项目。
优先返回 REPAIR，要求 Worker 补充必要实现或验证证据。

只能修改：

$REVIEW_FILE

禁止修改业务代码。
禁止修改 NEXT_TASK。
禁止修改 STATE。

最终必须把 REVIEW.md 写成机器可读结果之一：

RESULT: PASS

或

RESULT: REPAIR

或

RESULT: OPTIMIZE

或

HUMAN_APPROVAL_REQUIRED

使用中文。" \
    --model claude-sonnet-5 \
    --effort low \
    --allowedTools "Read" "Write" "Edit"

  echo
  echo "=== Review Result File ==="
  cat "$REVIEW_FILE"
  echo

  # ==========================================================
  # STEP 3 — PARSE REVIEW RESULT
  # ==========================================================

  REVIEW_RESULT="UNKNOWN"

  if grep -Eq '^[[:space:]]*RESULT:[[:space:]]*PASS[[:space:]]*$' "$REVIEW_FILE"; then
    REVIEW_RESULT="PASS"
  elif grep -Eq '^[[:space:]]*RESULT:[[:space:]]*REPAIR[[:space:]]*$' "$REVIEW_FILE"; then
    REVIEW_RESULT="REPAIR"
  elif grep -Eq '^[[:space:]]*RESULT:[[:space:]]*OPTIMIZE[[:space:]]*$' "$REVIEW_FILE"; then
    REVIEW_RESULT="OPTIMIZE"
  elif grep -Eq '^[[:space:]]*HUMAN_APPROVAL_REQUIRED[[:space:]]*$' "$REVIEW_FILE"; then
    REVIEW_RESULT="HUMAN"
  fi

  if [ "$REVIEW_RESULT" = "UNKNOWN" ]; then
    echo "ERROR: Reviewer 没有输出可识别的机器结果。"
    echo
    echo "必须包含以下之一："
    echo "RESULT: PASS"
    echo "RESULT: REPAIR"
    echo "RESULT: OPTIMIZE"
    echo "HUMAN_APPROVAL_REQUIRED"
    exit 6
  fi

  echo "Detected review result: $REVIEW_RESULT"
  echo

  # ==========================================================
  # PASS
  # ==========================================================

  if [ "$REVIEW_RESULT" = "PASS" ]; then

    echo "========================================"
    echo "Step 3: Claude Manager Final Check"
    echo "========================================"
    echo

    claude -p "你是项目 Manager。

你当前唯一允许使用的项目工作区是：

$WORKTREE_PATH

禁止切换其他 worktree。
禁止修改业务代码。

必须使用以下绝对路径：

MANAGER:
$MANAGER_FILE

GOAL:
$GOAL_FILE

STATE:
$STATE_FILE

CONTEXT:
$CONTEXT_FILE

REVIEW:
$REVIEW_FILE

NEXT_TASK:
$NEXT_TASK_FILE

WORKER_REPORT:
$WORKER_REPORT_FILE

PROGRESS:
$PROGRESS_FILE

优先读取：

1. MANAGER.md
2. GOAL.md
3. STATE.json
4. CONTEXT.md
5. REVIEW.md
6. NEXT_TASK.md

只有确有必要时才读取完整 WORKER_REPORT.md。
正常不要重复扫描业务代码，不要重新跑 Worker 已做过的验证。

当前 Reviewer 结果为：

RESULT: PASS

你的职责是：

判断当前正式业务任务 PASS 后，整体 GOAL 是否已经完成。

如果整体 GOAL 已完成：

- status = DONE
- last_review = PASS
- 将当前正式业务任务加入 completed_tasks
- 避免重复加入
- current_task = null
- next_action = WAIT_FOR_HUMAN
- 不生成新业务任务

输出：

OVERALL_STATUS: DONE

如果当前任务 PASS，但整体 GOAL 尚未完成：

- 将当前正式业务任务加入 completed_tasks
- 避免重复加入
- last_review = PASS
- iteration + 1
- 只生成一个新的 NEXT_TASK
- 新任务必须直接服务于原始 GOAL / 已确认 PLAN
- status = IN_PROGRESS
- next_action = WAIT_FOR_WORKER
- current_task = 新 NEXT_TASK 对应任务

输出：

OVERALL_STATUS: NOT_DONE

如果达到 max_iterations 且 GOAL 仍未完成：

- status = BLOCKED
- next_action = WAIT_FOR_HUMAN
- 输出 HUMAN_APPROVAL_REQUIRED

你被授权且只能修改：

$STATE_FILE
$NEXT_TASK_FILE
$PROGRESS_FILE
$CONTEXT_FILE

不得修改任何业务文件。

使用中文。" \
      --model claude-sonnet-5 \
      --effort low \
      --allowedTools "Read" "Write" "Edit"

    echo
    echo "=== Manager State ==="
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

    echo "Status: $STATUS"
    echo "Next action: $NEXT_ACTION"
    echo

    if [ "$STATUS" = "DONE" ]; then
      echo "========================================"
      echo "GOAL DONE — STARTING DELIVERY TO MAIN"
      echo "========================================"
      echo

      set +e
      DELIVERY_OUTPUT="$("$DELIVERY_SCRIPT" "$WORKTREE_PATH" 2>&1)"
      DELIVERY_EXIT=$?
      set -e

      printf '%s\n' "$DELIVERY_OUTPUT"
      echo

      if [ "$DELIVERY_EXIT" -ne 0 ]; then
        echo "========================================"
        echo "GOAL DONE, DELIVERY BLOCKED"
        echo "========================================"
        echo "业务目标已经完成，但自动合入本地 main 失败或被安全规则阻止。"
        echo "请根据上面的 MERGE_STATUS 人工处理。"
        exit "$DELIVERY_EXIT"
      fi

      if printf '%s\n' "$DELIVERY_OUTPUT" | grep -q '^MERGE_STATUS: MERGED$'; then
        echo "========================================"
        echo "AI TEAM CYCLE DONE"
        echo "DELIVERY TO LOCAL MAIN: SUCCESS"
        echo "========================================"
        exit 0
      fi

      if printf '%s\n' "$DELIVERY_OUTPUT" | grep -q '^MERGE_STATUS: NO_BUSINESS_CHANGES$'; then
        echo "========================================"
        echo "AI TEAM CYCLE DONE"
        echo "DELIVERY: NO BUSINESS CHANGES"
        echo "========================================"
        exit 0
      fi

      echo "ERROR: Delivery script returned success but no recognized MERGE_STATUS."
      exit 6
    fi

    if [ "$STATUS" = "BLOCKED" ]; then
      echo "========================================"
      echo "HUMAN APPROVAL REQUIRED"
      echo "========================================"
      exit 3
    fi

    if [ "$NEXT_ACTION" != "WAIT_FOR_WORKER" ]; then
      echo "ERROR: PASS 后 Manager 没有进入 DONE 或 WAIT_FOR_WORKER。"
      echo "status=$STATUS"
      echo "next_action=$NEXT_ACTION"
      exit 1
    fi

    echo "Starting next Worker task..."
    CYCLE=$((CYCLE + 1))
    MODE="normal"
    continue
  fi

  # ==========================================================
  # REPAIR
  # ==========================================================

  if [ "$REVIEW_RESULT" = "REPAIR" ]; then

    echo "========================================"
    echo "Step 3: Claude Manager Repair Planning"
    echo "========================================"
    echo

    claude -p "你是项目 Manager。

当前唯一允许使用的项目工作区：

$WORKTREE_PATH

必须使用：

MANAGER:
$MANAGER_FILE

GOAL:
$GOAL_FILE

STATE:
$STATE_FILE

CONTEXT:
$CONTEXT_FILE

REVIEW:
$REVIEW_FILE

NEXT_TASK:
$NEXT_TASK_FILE

WORKER_REPORT:
$WORKER_REPORT_FILE

PROGRESS:
$PROGRESS_FILE

当前 Reviewer 结果：

RESULT: REPAIR

你的职责：

- 根据 REVIEW.md 生成一个最小 REPAIR NEXT_TASK
- 只修复导致当前任务不正确、不完整或验证失败的问题
- 不扩大原始 GOAL
- 不创建新的正式业务任务
- REPAIR 不增加 iteration
- review_attempt + 1
- last_review = REPAIR

如果 review_attempt 达到 max_review_attempts：

- status = BLOCKED
- next_action = WAIT_FOR_HUMAN
- 输出 HUMAN_APPROVAL_REQUIRED

否则：

- status = IN_PROGRESS
- next_action = WAIT_FOR_WORKER
- current_task 保持当前正式业务任务语义
- 输出 OVERALL_STATUS: NOT_DONE

你被授权且只能修改：

$NEXT_TASK_FILE
$STATE_FILE
$PROGRESS_FILE
$CONTEXT_FILE

不得修改业务代码。

使用中文。" \
      --model claude-sonnet-5 \
      --effort low \
      --allowedTools "Read" "Write" "Edit"

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

    echo "Status: $STATUS"
    echo "Next action: $NEXT_ACTION"
    echo

    if [ "$STATUS" = "BLOCKED" ]; then
      echo "========================================"
      echo "HUMAN APPROVAL REQUIRED"
      echo "========================================"
      exit 3
    fi

    if [ "$NEXT_ACTION" != "WAIT_FOR_WORKER" ]; then
      echo "ERROR: REPAIR 后没有进入 WAIT_FOR_WORKER。"
      exit 1
    fi

    CYCLE=$((CYCLE + 1))
    MODE="normal"
    continue
  fi

  # ==========================================================
  # OPTIMIZE
  # ==========================================================

  if [ "$REVIEW_RESULT" = "OPTIMIZE" ]; then

    echo "========================================"
    echo "Step 3: Claude Manager Optimization Planning"
    echo "========================================"
    echo

    claude -p "你是项目 Manager。

当前唯一允许使用的项目工作区：

$WORKTREE_PATH

必须使用：

MANAGER:
$MANAGER_FILE

GOAL:
$GOAL_FILE

STATE:
$STATE_FILE

CONTEXT:
$CONTEXT_FILE

REVIEW:
$REVIEW_FILE

NEXT_TASK:
$NEXT_TASK_FILE

WORKER_REPORT:
$WORKER_REPORT_FILE

PROGRESS:
$PROGRESS_FILE

当前 Reviewer 结果：

RESULT: OPTIMIZE

你的职责：

- 判断 Reviewer 认可的优化是否属于当前正式业务任务和原始 GOAL
- 如果属于当前范围，只生成一个最小 OPTIMIZE NEXT_TASK
- 不扩大需求
- 不把普通代码美化升级成正式新需求
- OPTIMIZE 不增加 iteration
- OPTIMIZE 默认不增加 review_attempt
- last_review = OPTIMIZE

正常情况下：

- status = IN_PROGRESS
- next_action = WAIT_FOR_WORKER
- current_task 保持当前正式业务任务语义
- 输出 OVERALL_STATUS: NOT_DONE

如果所谓优化实际涉及高风险操作：

- status = BLOCKED
- next_action = WAIT_FOR_HUMAN
- 输出 HUMAN_APPROVAL_REQUIRED

你被授权且只能修改：

$NEXT_TASK_FILE
$STATE_FILE
$PROGRESS_FILE
$CONTEXT_FILE

不得修改业务代码。

使用中文。" \
      --model claude-sonnet-5 \
      --effort low \
      --allowedTools "Read" "Write" "Edit"

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

    echo "Status: $STATUS"
    echo "Next action: $NEXT_ACTION"
    echo

    if [ "$STATUS" = "BLOCKED" ]; then
      echo "========================================"
      echo "HUMAN APPROVAL REQUIRED"
      echo "========================================"
      exit 3
    fi

    if [ "$NEXT_ACTION" != "WAIT_FOR_WORKER" ]; then
      echo "ERROR: OPTIMIZE 后没有进入 WAIT_FOR_WORKER。"
      exit 1
    fi

    CYCLE=$((CYCLE + 1))
    MODE="normal"
    continue
  fi

  # ==========================================================
  # HUMAN APPROVAL
  # ==========================================================

  if [ "$REVIEW_RESULT" = "HUMAN" ]; then

    python - "$STATE_FILE" <<'PY'
import json
import sys
from pathlib import Path

p = Path(sys.argv[1])

state = json.loads(p.read_text(encoding="utf-8"))
state["status"] = "BLOCKED"
state["next_action"] = "WAIT_FOR_HUMAN"

p.write_text(
    json.dumps(state, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
PY

    echo "========================================"
    echo "HUMAN APPROVAL REQUIRED"
    echo "========================================"
    exit 3
  fi

done
