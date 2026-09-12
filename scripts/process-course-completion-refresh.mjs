import { createClient } from "@supabase/supabase-js";
import { setTimeout } from "node:timers/promises";

// Run once for a scheduler, or --watch under a process supervisor.
// Uses a server worker credential; never generates a user's auth session.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Completion worker requires Supabase URL and service-role configuration.");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const watch = process.argv.includes("--watch");
const abort = new AbortController();
process.on("SIGTERM", () => abort.abort());
process.on("SIGINT", () => abort.abort());
do {
  try {
    const { data, error } = await supabase.rpc("process_course_completion_refresh_tasks", { p_limit: 10 }).abortSignal(AbortSignal.timeout(120_000));
    if (error) throw error;
    const failed = (data ?? []).reduce((sum, row) => sum + Number(row.failed_count), 0);
    if (data?.length) console.log(JSON.stringify({ at: new Date().toISOString(), tasks: data.length, failed }));
    if (failed && !watch) process.exitCode = 1;
  } catch {
    // Database error bodies can contain student information. Keep operational logs aggregate-only.
    console.error(JSON.stringify({ at: new Date().toISOString(), error: "Completion refresh batch failed; inspect authorized database logs." }));
    if (!watch) process.exitCode = 1;
  }
  if (watch && !abort.signal.aborted) await setTimeout(30_000, undefined, { signal: abort.signal }).catch(() => {});
} while (watch && !abort.signal.aborted);
