import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const migrationDirectory = path.resolve("supabase/migrations");
const requestedChapters = process.argv.slice(2).map(Number).filter(Number.isInteger);
const chapters = requestedChapters.length > 0
  ? requestedChapters
  : Array.from({ length: 12 }, (_, index) => index + 5);
const migrationFiles = await readdir(migrationDirectory);

for (const chapterNumber of chapters) {
  const chapterWord = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  ][chapterNumber];
  const fileName = migrationFiles.find((name) =>
    name.includes(`chapter_${chapterWord}_golden_smart_textbook.sql`),
  );
  if (!fileName) throw new Error(`Missing golden migration for Chapter ${chapterNumber}`);

  const sql = await readFile(path.join(migrationDirectory, fileName), "utf8");
  const modulesMatch = sql.match(/\$modules\$\s*(\[[\s\S]*?\])\s*\$modules\$::jsonb/);
  const chapterSeedMatch = sql.match(/\$chapter_seed\$\s*(\{[\s\S]*?\})\s*\$chapter_seed\$::jsonb/);
  const chapterSeed = chapterSeedMatch ? JSON.parse(chapterSeedMatch[1]) : null;
  const modules = modulesMatch
    ? JSON.parse(modulesMatch[1])
    : (chapterSeed?.modules.map((module) => {
        const node = chapterSeed.nodes?.find((item) => item.module_code === module.module_code);
        return {
          ...module,
          code: module.module_code,
          nodeCode: node?.node_code,
          nodeTitle: node?.title,
          content: node?.content,
        };
      }) ?? null);
  if (!modules) throw new Error(`Missing module seed in ${fileName}`);
  const summary = modules.map((module) => ({
    code: module.code,
    nodeCode: module.nodeCode,
    title: module.title?.["zh-CN"],
    nodeTitle: module.nodeTitle?.["zh-CN"],
    description: module.description?.["zh-CN"],
    vocabulary: module.content?.vocabulary?.map((item) => item.ko),
    grammar: module.content?.grammarCards?.map((item) => item.form),
    dialogueScenes: module.content?.dialogueScenes?.map((item) => ({
      title: item.title,
      context: item.context?.["zh-CN"],
    })),
    listenFor: module.content?.listenFor,
    reading: module.content?.reading,
    writingFrame: module.content?.writingFrame,
    checklist: module.content?.checklist?.map((item) => item.zh),
  }));

  console.log(JSON.stringify({ chapterNumber, fileName, modules: summary }, null, 2));
}
