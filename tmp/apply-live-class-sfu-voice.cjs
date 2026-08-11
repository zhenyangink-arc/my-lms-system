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

function runQuery(query) {
  const bodyPath = path.join(
    os.tmpdir(),
    `apply_live_class_sfu_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
  );
  fs.writeFileSync(bodyPath, JSON.stringify({ query }), "utf8");
  try {
    const result = spawnSync(
      "curl.exe",
      [
        "-sS",
        "-X",
        "POST",
        "https://api.supabase.com/v1/projects/jubdbsjsalpecfvseskz/database/query",
        "-H",
        `Authorization: Bearer ${token}`,
        "-H",
        "Content-Type: application/json",
        "--data-binary",
        `@${bodyPath}`,
      ],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    if (result.status !== 0) throw new Error(String(result.stderr).trim());
    const output = String(result.stdout).trim();
    if (output.startsWith("{") && output.includes('"message"')) throw new Error(output);
    return output;
  } finally {
    try {
      fs.unlinkSync(bodyPath);
    } catch {
      // Ignore temp cleanup failures.
    }
  }
}

runQuery(fs.readFileSync("supabase/migrations/202608080011_live_class_sfu_voice.sql", "utf8"));
runQuery(`
  insert into supabase_migrations.schema_migrations (version, name, statements)
  values ('202608080011', 'live_class_sfu_voice', '{}')
  on conflict (version) do nothing;
`);
console.log("APPLIED 202608080011_live_class_sfu_voice");
