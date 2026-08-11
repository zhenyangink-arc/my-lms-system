// 阶段二静态审计：读取线上 RLS、函数签名和授权，不修改数据。
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const env = fs.readFileSync(".env.local", "utf8");
const token = env
  .split(/\r?\n/)
  .find((line) => line.startsWith("SUPABASE_ACCESS_TOKEN="))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim();
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN_MISSING");

const bodyPath = path.join(os.tmpdir(), `audit_live_class_rls_${Date.now()}.json`);
const query = `
  select json_build_object(
    'rls', (
      select json_agg(json_build_object(
        'schema', schemaname,
        'table', tablename,
        'policy', policyname,
        'command', cmd,
        'using', qual,
        'check', with_check
      ) order by schemaname, tablename, policyname)
      from pg_policies
      where (schemaname = 'public' and tablename in ('live_class_sessions', 'live_class_members', 'live_class_events'))
         or (schemaname = 'realtime' and tablename = 'messages' and policyname like 'live class%')
    ),
    'helpers', (
      select json_agg(json_build_object(
        'name', p.proname,
        'arguments', pg_get_function_identity_arguments(p.oid),
        'security_definer', p.prosecdef,
        'acl', p.proacl
      ) order by p.proname, pg_get_function_identity_arguments(p.oid))
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('is_live_class_participant', 'is_live_class_teacher')
    ),
    'table_grants', (
      select json_agg(json_build_object(
        'table', table_name,
        'grantee', grantee,
        'privilege', privilege_type
      ) order by table_name, grantee, privilege_type)
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in ('live_class_sessions', 'live_class_members', 'live_class_events')
        and grantee in ('anon', 'authenticated')
    )
  ) as result;
`;

fs.writeFileSync(bodyPath, JSON.stringify({ query }), "utf8");
try {
  const result = spawnSync(
    "curl.exe",
    [
      "-sS", "-X", "POST",
      "https://api.supabase.com/v1/projects/jubdbsjsalpecfvseskz/database/query",
      "-H", `Authorization: Bearer ${token}`,
      "-H", "Content-Type: application/json",
      "--data-binary", `@${bodyPath}`,
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
  );
  if (result.status !== 0) throw new Error(String(result.stderr).trim());
  console.log(JSON.stringify(JSON.parse(result.stdout), null, 2));
} finally {
  try { fs.unlinkSync(bodyPath); } catch { /* ignore */ }
}
