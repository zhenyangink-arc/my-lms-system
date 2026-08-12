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

if [ "$(git branch --show-current)" = "main" ]; then
  echo "ERROR: refusing to run on main branch."
  exit 1
fi

echo "=== AI Team Cycle ==="
echo "Worktree: $WORKTREE_PATH"
echo "Branch: $(git branch --show-current)"
echo

MAX_REVIEW_ATTEMPTS="$(python - <<'PY'
import json
with open(".ai/team/STATE.json", encoding="utf-8") as f:
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

  echo
  echo "=== Step 1: Codex Worker ==="

  "$WORKTREE_PATH/.ai/scripts/run-codex-worker.sh" "$WORKTREE_PATH"

  echo
  echo "=== Step 2: Claude Reviewer ==="

  claude -p "你是独立代码 Reviewer。

请读取：
- .ai/team/REVIEWER.md
- .ai/team/GOAL.md
- .ai/team/STATE.json
- .ai/team/NEXT_TASK.md
- .ai/team/WORKER_REPORT.md
- .ai/team/PROGRESS.md

并检查当前 git status 和 git diff。

按 REVIEWER.md 的规则正式审核。

你被授权且只能修改：
- .ai/team/REVIEW.md
- .ai/team/PROGRESS.md

要求：
1. 把完整审核结果写入 .ai/team/REVIEW.md
2. REVIEW.md 最后一行必须严格写成以下二选一：
   RESULT: PASS
   或
   RESULT: REJECT
3. 不允许使用 PASS。或 REJECT。代替机器状态行
4. 除 REVIEW.md 和 PROGRESS.md 外不得修改其他文件
5. 使用中文。" \
    --allowedTools "Read" "Write" "Edit" \
    "Bash(git status:*)" \
    "Bash(git diff:*)" \
    "Bash(git diff --check:*)"

  echo
  echo "=== Review Result ==="
  cat .ai/team/REVIEW.md
  echo

  REVIEW_RESULT="UNKNOWN"

  if grep -Eq '^[[:space:]]*RESULT:[[:space:]]*PASS[[:space:]]*$' .ai/team/REVIEW.md; then
    REVIEW_RESULT="PASS"

  elif grep -Eq '^[[:space:]]*RESULT:[[:space:]]*REJECT[[:space:]]*$' .ai/team/REVIEW.md; then
    REVIEW_RESULT="REJECT"

  else
    echo "ERROR: REVIEW.md does not contain a valid machine-readable result."
    echo
    echo "Expected:"
    echo "RESULT: PASS"
    echo
    echo "or:"
    echo "RESULT: REJECT"
    echo
    echo "Stopping safely."
    exit 2
  fi

  echo "Detected review result: $REVIEW_RESULT"

  if [ "$REVIEW_RESULT" = "PASS" ]; then

    echo
    echo "=== Step 3: Claude Manager Final Check ==="

    claude -p "你是项目 Manager。

请读取：
- .ai/team/MANAGER.md
- .ai/team/GOAL.md
- .ai/team/STATE.json
- .ai/team/NEXT_TASK.md
- .ai/team/WORKER_REPORT.md
- .ai/team/REVIEW.md
- .ai/team/PROGRESS.md

Reviewer 已正式给出 RESULT: PASS。

请按照 MANAGER.md 判断整个 GOAL 是否已经完成。

你被授权且只能修改：
- .ai/team/STATE.json
- .ai/team/NEXT_TASK.md
- .ai/team/PROGRESS.md

如果整体 GOAL 已完成：

1. status = DONE
2. last_review = PASS
3. next_action = WAIT_FOR_HUMAN
4. 将 current_task 加入 completed_tasks，避免重复
5. current_task 可以设为 null
6. 不生成新的业务任务
7. 输出 OVERALL_STATUS: DONE

如果当前子任务 PASS，但整体 GOAL 尚未完成：

1. 将当前任务加入 completed_tasks
2. last_review = PASS
3. iteration 加 1
4. 只生成一个新的 NEXT_TASK
5. status = IN_PROGRESS
6. next_action = WAIT_FOR_WORKER
7. 输出 OVERALL_STATUS: NOT_DONE

不得修改任何业务文件。
使用中文。" \
      --allowedTools "Read" "Write" "Edit"

    echo
    echo "=== Final State ==="
    cat .ai/team/STATE.json

    echo
    echo "=== Git Status ==="
    git status --short

    exit 0
  fi


  #
  # Reviewer REJECT
  #

  echo
  echo "=== Reviewer rejected ==="
  echo "Preparing targeted repair task..."

  claude -p "你是项目 Manager。

请读取：
- .ai/team/MANAGER.md
- .ai/team/GOAL.md
- .ai/team/STATE.json
- .ai/team/NEXT_TASK.md
- .ai/team/WORKER_REPORT.md
- .ai/team/REVIEW.md
- .ai/team/PROGRESS.md

Reviewer 已正式给出 RESULT: REJECT。

你被授权且只能修改：
- .ai/team/NEXT_TASK.md
- .ai/team/STATE.json
- .ai/team/PROGRESS.md

严格执行返工流程：

1. 阅读 REVIEW.md 中 Reviewer 给出的具体失败原因
2. 不扩大用户整体 GOAL
3. 不重新设计已经正确的部分
4. 只针对 Reviewer 指出的失败项生成修复版 NEXT_TASK
5. review_attempt 加 1
6. last_review = REJECT

修复版 NEXT_TASK 必须明确：
- 哪个验收标准失败
- 哪个文件或行为需要修
- 哪些已经正确的部分禁止重做
- 允许修改范围
- 禁止修改范围
- 修复后的验收标准

如果 review_attempt 达到或超过 max_review_attempts：

- status = BLOCKED
- next_action = WAIT_FOR_HUMAN
- 不再生成可继续自动执行的新任务
- 在 PROGRESS.md 写 BLOCKED
- 输出 HUMAN_APPROVAL_REQUIRED

如果仍未达到最大次数：

- status = IN_PROGRESS
- next_action = WAIT_FOR_WORKER
- 在 PROGRESS.md 写 WAITING，说明等待 Worker 返工
- 输出 OVERALL_STATUS: NOT_DONE

不得修改任何业务文件。
使用中文。" \
    --allowedTools "Read" "Write" "Edit"

  REVIEW_ATTEMPT="$(python - <<'PY'
import json
with open(".ai/team/STATE.json", encoding="utf-8") as f:
    state = json.load(f)
print(state.get("review_attempt", 0))
PY
)"

  STATUS="$(python - <<'PY'
import json
with open(".ai/team/STATE.json", encoding="utf-8") as f:
    state = json.load(f)
print(state.get("status", "UNKNOWN"))
PY
)"

  echo
  echo "Review attempt: $REVIEW_ATTEMPT / $MAX_REVIEW_ATTEMPTS"
  echo "State status: $STATUS"

  if [ "$STATUS" = "BLOCKED" ]; then
    echo
    echo "=== Human intervention required ==="
    cat .ai/team/STATE.json
    echo
    echo "Stopping automatic repair loop."
    exit 3
  fi

  if [ "$REVIEW_ATTEMPT" -ge "$MAX_REVIEW_ATTEMPTS" ]; then
    echo
    echo "Maximum review attempts reached."
    echo "Stopping automatic repair loop."
    exit 3
  fi

  echo
  echo "=== Repair task prepared ==="
  cat .ai/team/NEXT_TASK.md
  echo
  echo "Restarting Codex Worker for targeted repair..."

  CYCLE=$((CYCLE + 1))

done
