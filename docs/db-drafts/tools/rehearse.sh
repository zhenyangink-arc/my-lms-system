#!/usr/bin/env bash
# 在隔离验证库里完整演练 D5 → D7 → D8：执行、跑测试与韩语回归、回滚、核对被替换的 5 个函数与原定义一致。
# 只允许对名字含 "verify" 的数据库容器运行（防止误跑到 Codex 或真实库）。结束时验证库回到未应用状态。
# 用法：docs/db-drafts/tools/rehearse.sh            （容器默认 supabase_db_lms-verify）
#       CONTAINER=supabase_db_xxx-verify docs/db-drafts/tools/rehearse.sh
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${CONTAINER:-supabase_db_lms-verify}"
case "$CONTAINER" in *verify*) ;; *) echo "拒绝运行：容器名 '$CONTAINER' 不含 verify" >&2; exit 2;; esac
psqlc() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
FAIL=0
step() { echo; echo "== $*"; }
need() { if [ "$1" != "0" ]; then echo "失败：$2"; FAIL=1; fi; }

step "前置检查：验证库必须处于未应用状态"
if [ -n "$(psqlc -Atc "select to_regclass('public.math_question_specs')")" ]; then
  echo "验证库里已有 D5 的对象，请先回滚（D8 → D7 → D5 的 down 脚本）" >&2; exit 2
fi
for f in release_issues_with_temporary_notice validate_assessment_paper_release create_learning_assignment_from_paper configure_learning_assignment_retake duplicate_assessment_paper; do :; done

step "执行 D5、D7、D8"
for n in D5-math-grading-storage D7-math-paper-layer D8-replace-math-paper-draft; do
  psqlc < "$HERE/$n.up.sql" > /dev/null; need $? "$n up"
done

step "数学测试（D7、D8 带 PASS/FAIL；D5 输出结果表，需人工核对预期）"
for n in D7-math-paper-layer D8-replace-math-paper-draft; do
  out="$(psqlc -At -F '~' < "$HERE/$n.test.sql" 2>&1)"
  pass=$(printf '%s\n' "$out" | grep -c '~PASS$'); fail=$(printf '%s\n' "$out" | grep -c '~FAIL$')
  echo "$n: PASS=$pass FAIL=$fail"; [ "$fail" != "0" ] && { FAIL=1; printf '%s\n' "$out" | grep '~FAIL$'; }
done
d5="$(psqlc -At -F '~' < "$HERE/D5-math-grading-storage.test.sql" 2>&1)"
d5rows=$(printf '%s\n' "$d5" | grep -c '^[0-9]*~')
echo "D5: 共 $d5rows 行结果（D5 测试没有 PASS/FAIL 标记，这里只检查执行不报错且行数为 43；各行预期见 D5 测试脚本内的“应为”说明，修改测试后请同步更新这个数字）"
[ "$d5rows" = "43" ] || { echo "D5 结果行数不是 43"; FAIL=1; }
printf '%s\n' "$d5" | grep -E '^(ERROR|psql:.*ERROR)' && FAIL=1

step "韩语回归探针（与 D7-korean-regression.baseline.txt 逐行比较）"
psqlc < "$HERE/D7-korean-regression.probe.sql" 2>&1 | sed -n '/^ *name/,/^(.*rows)/p' | diff - "$HERE/D7-korean-regression.baseline.txt" && echo "一致" ; need ${PIPESTATUS[1]:-0} "韩语回归不一致"

step "回滚 D8 → D7 → D5"
for n in D8-replace-math-paper-draft D7-math-paper-layer D5-math-grading-storage; do
  psqlc < "$HERE/$n.down.sql" > /dev/null; need $? "$n down"
done

step "核对被替换的 5 个函数与原定义一致"
check() { psqlc -Atc "select pg_get_functiondef($1)" | diff -q "$HERE/tools/original-functions/$2.sql" - > /dev/null && echo "一致：$2" || { echo "不一致：$2"; FAIL=1; }; }
check "'private.assessment_paper_release_issues_with_temporary_notice'::regproc" release_issues_with_temporary_notice
check "'private.validate_assessment_paper_release'::regproc" validate_assessment_paper_release
check "'public.create_learning_assignment_from_paper(uuid,uuid,text,uuid[],timestamp with time zone,timestamp with time zone,text)'::regprocedure" create_learning_assignment_from_paper
check "'public.configure_learning_assignment_retake'::regproc" configure_learning_assignment_retake
check "'public.duplicate_assessment_paper'::regproc" duplicate_assessment_paper

step "收尾检查：验证库已回到未应用状态"
left="$(psqlc -Atc "select concat_ws(',', to_regclass('public.math_question_specs'), to_regclass('public.math_paper_question_specs'), to_regclass('public.learning_submission_machine_grades'))")"
[ -z "$left" ] && echo "已清理" || { echo "残留对象：$left"; FAIL=1; }

echo; [ "$FAIL" = "0" ] && echo "演练通过" || echo "演练有失败项"
exit $FAIL
