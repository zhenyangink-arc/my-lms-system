import { createClient } from "@supabase/supabase-js";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const chapterNumbers = process.argv.slice(2).map(Number).filter(Number.isInteger);
if (chapterNumbers.length === 0) {
  throw new Error("Usage: node scripts/list-smart-textbook-media.mjs <chapter> [...chapter]");
}

const supabase = createClient(
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);

for (const chapterNumber of chapterNumbers) {
  const prefix = `chapter-${String(chapterNumber).padStart(2, "0")}-image-`;
  const { data, error } = await supabase
    .from("digital_textbook_media_assets")
    .select("id,asset_key,object_key,production_status,metadata")
    .like("asset_key", `${prefix}%`)
    .order("asset_key");
  if (error) throw error;
  console.log(JSON.stringify({ chapterNumber, media: data }, null, 2));
}
