#!/usr/bin/env bash
# 在隔离验证库里演练 D9：记录共用表策略与函数指纹 → 执行 → 跑测试 → 回滚 → 核对回到原样。
# 只允许对名字含 "verify" 的容器运行。需要验证库当前未应用 D9。
# 用法：docs/db-drafts/tools/rehearse-d9.sh          （容器默认 supabase_db_lms-verify）
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${CONTAINER:-supabase_db_lms-verify}"
case "$CONTAINER" in *verify*) ;; *) echo "拒绝运行：容器名 '$CONTAINER' 不含 verify" >&2; exit 2;; esac
psqlc() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
FAIL=0
fingerprint() {
  psqlc -At -c "select md5(coalesce((select string_agg(tablename || policyname || coalesce(qual,'') || coalesce(with_check,''), '|' order by tablename, policyname) from pg_policies where schemaname='public'),'')) || ' ' || md5(coalesce((select string_agg(p.oid::regprocedure::text || pg_get_functiondef(p.oid), '|' order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname not in ('university_category_scope','set_university_category_access','set_student_major_enrollment','university_app_id','university_second_level_category','university_category_mode','check_university_category_access','clear_links_when_not_shared','check_university_major_link','check_student_major_enrollment')),''))"
}

echo "== 前置检查"
if [ -n "$(psqlc -Atc "select to_regclass('public.student_major_enrollments')")" ]; then
  echo "验证库里已有 D9 的对象，请先执行 D9 down 脚本" >&2; exit 2
fi
before="$(fingerprint)"; echo "执行前指纹: $before"

echo "== 执行 D9"
psqlc < "$HERE/D9-university-major-access.up.sql" > /dev/null || { echo "失败：D9 up"; exit 1; }
mid="$(fingerprint)"; echo "执行后指纹: $mid"
[ "$before" = "$mid" ] && echo "既有策略与函数指纹不变：PASS" || { echo "既有策略或函数被改动：FAIL"; FAIL=1; }

echo "== D9 测试"
out="$(psqlc -At < "$HERE/D9-university-major-access.test.sql" 2>&1)"
pass=$(printf '%s\n' "$out" | grep -c '~PASS$'); fail=$(printf '%s\n' "$out" | grep -c '~FAIL$')
echo "PASS=$pass FAIL=$fail"
printf '%s\n' "$out" | grep -E '~FAIL$|ERROR' && FAIL=1

echo "== 回滚 D9"
psqlc < "$HERE/D9-university-major-access.down.sql" > /dev/null || { echo "失败：D9 down"; FAIL=1; }
after="$(fingerprint)"
[ "$before" = "$after" ] && echo "回滚后指纹与执行前一致：PASS" || { echo "回滚后不一致：FAIL"; FAIL=1; }
[ -z "$(psqlc -Atc "select to_regclass('public.student_major_enrollments')")" ] && echo "D9 对象已全部移除：PASS" || { echo "D9 表仍在：FAIL"; FAIL=1; }

[ "$FAIL" = "0" ] && echo "== D9 演练通过" || { echo "== D9 演练有失败项"; exit 1; }
