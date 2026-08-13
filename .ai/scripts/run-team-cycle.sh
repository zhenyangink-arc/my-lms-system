#!/usr/bin/env bash
set -euo pipefail

WORKTREE_PATH="${1:-}"
MODE="${2:-normal}"

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
  echo "ERROR: refusing to run AI team cycle directly on main."
  exit 1
fi

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

CODEX_WORKER="$WORKTREE_PATH/.ai/scripts/run-codex-worker.sh"

for f in \
  "$MANAGER_FILE" \
  "$WORKER_FILE" \
  "$REVIEWER_FILE" \
  "$GOAL_FILE" \
  "$STATE_FILE" \
  "$NEXT_TASK_FILE" \
  "$WORKER_REPORT_FILE" \
  "$REVIEW_FILE" \
  "$PROGRESS_FILE"
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

  # 清空上一轮机器审核结果，防止 Claude 写失败时误读旧 PASS
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

REVIEW 输出文件:
$REVIEW_FILE

请严格按照 REVIEWER.md 执行。

你的主要任务是比较：

NEXT_TASK
↔
WORKER_REPORT

不要重新执行 Codex Worker 的工作。

禁止：

- 扫描整个仓库
- 默认读取业务代码
- 执行 git status
- 执行 git diff
- 重新运行 test
- 重新运行 lint
- 重新运行 typecheck
- 重新运行 build
- 修改业务代码

你需要判断以下三种结果之一：

RESULT: PASS

RESULT: REPAIR

RESULT: OPTIMIZE

判断优先级：

1. 当前任务是否完整完成
2. 是否存在 bug
3. 是否存在验证失败
4. 是否存在影响当前任务的已知问题
5. 是否存在未完成事项
6. 是否存在 HUMAN_APPROVAL_REQUIRED
7. 当前任务完成后，是否存在 Reviewer 认可的、与当前任务直接相关的小范围低风险优化
8. 以上均无阻塞时 PASS

如果 WORKER_REPORT 信息不足以支持判断：

不要自行扫描仓库补证据。

应返回：

RESULT: REPAIR

并要求 Worker 补充必要信息或验证。

你被授权且只能修改：

$REVIEW_FILE
$PROGRESS_FILE

必须把完整审核结果写入：

$REVIEW_FILE

REVIEW 文件最后一行必须严格是以下三者之一：

RESULT: PASS

或

RESULT: REPAIR

或

RESULT: OPTIMIZE

如果存在真正需要人工确认的高风险操作，
请在正文中明确写：

HUMAN_APPROVAL_REQUIRED

使用中文。" \
    --model claude-sonnet-5 \
    --effort low \
    --allowedTools "Read" "Write" "Edit"

  echo
  echo "=== Review Result ==="
  cat "$REVIEW_FILE"
  echo

  REVIEW_RESULT="UNKNOWN"

  if grep -Eq '^[[:space:]]*RESULT:[[:space:]]*PASS[[:space:]]*$' "$REVIEW_FILE"; then
    REVIEW_RESULT="PASS"

  elif grep -Eq '^[[:space:]]*RESULT:[[:space:]]*REPAIR[[:space:]]*$' "$REVIEW_FILE"; then
    REVIEW_RESULT="REPAIR"

  elif grep -Eq '^[[:space:]]*RESULT:[[:space:]]*OPTIMIZE[[:space:]]*$' "$REVIEW_FILE"; then
    REVIEW_RESULT="OPTIMIZE"

  else
    echo "ERROR: REVIEW.md does not contain a valid machine-readable result."
    echo
    echo "Expected one of:"
    echo "RESULT: PASS"
    echo "RESULT: REPAIR"
    echo "RESULT: OPTIMIZE"
    echo
    echo "Actual REVIEW file:"
    echo "$REVIEW_FILE"
    echo
    echo "Stopping safely."
    exit 2
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

禁止切换到其他 worktree。
禁止读取或修改其他目录中的同名 .ai/team 文件。

必须使用以下绝对路径：

MANAGER:
$MANAGER_FILE

GOAL:
$GOAL_FILE

STATE:
$STATE_FILE

NEXT_TASK:
$NEXT_TASK_FILE

WORKER_REPORT:
$WORKER_REPORT_FILE

REVIEW:
$REVIEW_FILE

PROGRESS:
$PROGRESS_FILE

Reviewer 已正式给出：

RESULT: PASS

请严格按照 MANAGER.md 执行。

不要重新扫描业务代码。
不要执行 git diff。
不要重新运行测试或验证。

你的职责只是判断：

当前已经 PASS 的正式业务子任务是否已经完成整体 GOAL。

你被授权且只能修改：

$STATE_FILE
$NEXT_TASK_FILE
$PROGRESS_FILE

如果整体 GOAL 已完成：

- status = DONE
- last_review = PASS
- next_action = WAIT_FOR_HUMAN
- 将当前正式业务任务加入 completed_tasks
- 避免重复加入
- current_task = null
- 不生成新业务任务

输出：

OVERALL_STATUS: DONE

如果当前子任务 PASS，但整体 GOAL 尚未完成：

- 将当前正式业务任务加入 completed_tasks
- 避免重复加入
- last_review = PASS
- iteration + 1
- 只生成一个新的 NEXT_TASK
- 新任务必须直接服务于原始 GOAL / 已确认 PLAN
- status = IN_PROGRESS
- next_action = WAIT_FOR_WORKER

输出：

OVERALL_STATUS: NOT_DONE

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
      echo "AI TEAM CYCLE DONE"
      echo "========================================"
      exit 0
    fi

    if [ "$STATUS" = "BLOCKED" ]; then
      echo "========================================"
      echo "HUMAN APPROVAL REQUIRED"
      echo "========================================"
      exit 3
    fi

    if [ "$NEXT_ACTION" != "WAIT_FOR_WORKER" ]; then
      echo "ERROR: PASS 后 Manager 没有进入 DONE 或 WAIT_FOR_WORKER。"
      exit 4
    fi

    echo "Overall GOAL still has remaining work."
    echo "Starting next Worker task..."

    CYCLE=$((CYCLE + 1))
    continue
  fi

  # ==========================================================
  # REPAIR
  # ==========================================================

  if [ "$REVIEW_RESULT" = "REPAIR" ]; then

    echo "========================================"
    echo "Reviewer requested REPAIR"
    echo "========================================"
    echo

    claude -p "你是项目 Manager。

你当前唯一允许使用的项目工作区是：

$WORKTREE_PATH

禁止切换到其他 worktree。
禁止读取或修改其他目录中的同名 .ai/team 文件。

必须使用以下绝对路径：

MANAGER:
$MANAGER_FILE

GOAL:
$GOAL_FILE

STATE:
$STATE_FILE

NEXT_TASK:
$NEXT_TASK_FILE

WORKER_REPORT:
$WORKER_REPORT_FILE

REVIEW:
$REVIEW_FILE

PROGRESS:
$PROGRESS_FILE

Reviewer 已正式给出：

RESULT: REPAIR

请严格按照 MANAGER.md 的 REPAIR 规则执行。

只根据 REVIEW 中明确指出的问题，
生成一个最小修复任务。

要求：

- 不扩大整体 GOAL
- 不重新设计已经正确的部分
- 不重做已经正确的部分
- Bug、验证失败、未完成事项优先
- 只修当前任务的问题

NEXT_TASK 必须明确：

- 当前失败原因
- 哪个问题需要修
- 已经正确的部分
- 禁止重做的部分
- 允许修改范围
- 禁止修改范围
- 修复后的验收标准

同时：

- review_attempt + 1
- last_review = REPAIR

如果 REVIEW 正文包含：

HUMAN_APPROVAL_REQUIRED

则：

- status = BLOCKED
- next_action = WAIT_FOR_HUMAN
- 不生成可继续自动执行的高风险任务
- 输出 HUMAN_APPROVAL_REQUIRED

如果 review_attempt 达到或超过 max_review_attempts：

- status = BLOCKED
- next_action = WAIT_FOR_HUMAN
- 输出 HUMAN_APPROVAL_REQUIRED

否则：

- status = IN_PROGRESS
- next_action = WAIT_FOR_WORKER
- 输出 OVERALL_STATUS: NOT_DONE

你被授权且只能修改：

$NEXT_TASK_FILE
$STATE_FILE
$PROGRESS_FILE

不得修改任何业务文件。

使用中文。" \
      --model claude-sonnet-5 \
      --effort low \
      --allowedTools "Read" "Write" "Edit"

    echo
    echo "=== Repair State ==="
    cat "$STATE_FILE"
    echo

    REVIEW_ATTEMPT="$(
    python - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as f:
    state = json.load(f)

print(state.get("review_attempt", 0))
PY
)"

    MAX_REVIEW_ATTEMPTS="$(
    python - "$STATE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as f:
    state = json.load(f)

print(state.get("max_review_attempts", 3))
PY
)"

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

    echo "Repair attempt: $REVIEW_ATTEMPT / $MAX_REVIEW_ATTEMPTS"
    echo "Status: $STATUS"
    echo "Next action: $NEXT_ACTION"
    echo

    if [ "$STATUS" = "BLOCKED" ]; then
      echo "=== HUMAN APPROVAL REQUIRED ==="
      exit 3
    fi

    if [ "$NEXT_ACTION" != "WAIT_FOR_WORKER" ]; then
      echo "ERROR: REPAIR 后没有进入 WAIT_FOR_WORKER。"
      exit 4
    fi

    echo "=== Repair Task ==="
    cat "$NEXT_TASK_FILE"
    echo

    CYCLE=$((CYCLE + 1))
    continue
  fi

  # ==========================================================
  # OPTIMIZE
  # ==========================================================

  if [ "$REVIEW_RESULT" = "OPTIMIZE" ]; then

    echo "========================================"
    echo "Reviewer requested OPTIMIZE"
    echo "========================================"
    echo

    claude -p "你是项目 Manager。

你当前唯一允许使用的项目工作区是：

$WORKTREE_PATH

禁止切换到其他 worktree。
禁止读取或修改其他目录中的同名 .ai/team 文件。

必须使用以下绝对路径：

MANAGER:
$MANAGER_FILE

GOAL:
$GOAL_FILE

STATE:
$STATE_FILE

NEXT_TASK:
$NEXT_TASK_FILE

WORKER_REPORT:
$WORKER_REPORT_FILE

REVIEW:
$REVIEW_FILE

PROGRESS:
$PROGRESS_FILE

Reviewer 已正式给出：

RESULT: OPTIMIZE

说明：

当前正式业务任务本身已经完成，
Reviewer 认可了 Codex 自然发现的一个与当前任务直接相关的小范围低风险优化。

请严格按照 MANAGER.md 的 OPTIMIZE 规则执行。

只使用 REVIEW 中已经明确认可的优化建议。

禁止：

- 主动寻找其他优化
- 扩大原始 GOAL
- 新增用户未确认的大功能
- 大规模重构
- 数据库结构修改
- migration
- RLS
- 认证安全模型修改
- 权限模型修改
- 环境变量或密钥修改
- 生产部署
- 大规模删除
- 重大依赖升级

优化 NEXT_TASK 必须明确：

- 原正式业务任务已经完成
- Reviewer 认可的具体优化
- 优化目标
- 允许修改范围
- 禁止修改范围
- 验收标准
- 明确禁止扩大任务范围

OPTIMIZE 不增加 review_attempt。
OPTIMIZE 不增加 iteration。

正常情况下：

- status = IN_PROGRESS
- next_action = WAIT_FOR_WORKER

输出：

OVERALL_STATUS: NOT_DONE

如果 REVIEW 中认可的所谓优化实际上涉及高风险操作：

- status = BLOCKED
- next_action = WAIT_FOR_HUMAN
- 输出 HUMAN_APPROVAL_REQUIRED

你被授权且只能修改：

$NEXT_TASK_FILE
$STATE_FILE
$PROGRESS_FILE

不得修改任何业务文件。

使用中文。" \
      --model claude-sonnet-5 \
      --effort low \
      --allowedTools "Read" "Write" "Edit"

    echo
    echo "=== Optimization State ==="
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

    if [ "$STATUS" = "BLOCKED" ]; then
      echo "=== HUMAN APPROVAL REQUIRED ==="
      exit 3
    fi

    if [ "$NEXT_ACTION" != "WAIT_FOR_WORKER" ]; then
      echo "ERROR: OPTIMIZE 后没有进入 WAIT_FOR_WORKER。"
      exit 4
    fi

    echo "=== Optimization Task ==="
    cat "$NEXT_TASK_FILE"
    echo

    CYCLE=$((CYCLE + 1))
    continue
  fi

done
