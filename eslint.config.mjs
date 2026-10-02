import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 学科模块边界，规则来源与说明见 docs/shared-platform-subject-modules-architecture.md §5：
//   app -> features（平台 / subjects） -> shared（src/lib、src/components）
// 一个学科对应一个学习应用（student_app_id），slug 即学科目录名。
const SUBJECT_SLUGS = ["korean", "math", "english", "university"];

/** 引用某个学科目录自身（入口）或其内部文件的写法，覆盖别名和相对路径。 */
const subjectPaths = (slug) => [
  `@/features/subjects/${slug}`,
  `@/features/subjects/${slug}/**`,
  `**/features/subjects/${slug}`,
  `**/features/subjects/${slug}/**`,
];

const importBan = (patterns) => ["error", { patterns }];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // 共享层（src/lib、src/components）不得反向依赖任何学科代码。
  {
    files: ["src/lib/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": importBan([
        {
          group: [
            "@/features/subjects",
            "@/features/subjects/**",
            "**/features/subjects",
            "**/features/subjects/**",
          ],
          message: "共享层不得引用学科模块；需要学科差异时，在学科清单里声明，由平台读取。",
        },
      ]),
    },
  },
  // 平台功能与 app 路由只能通过 `@/features/subjects`（registry）和根目录的公共契约调用学科能力，
  // 不得直接引用某个学科的入口或内部文件。
  {
    files: ["src/features/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    ignores: ["src/features/subjects/**"],
    rules: {
      "no-restricted-imports": importBan([
        {
          group: SUBJECT_SLUGS.flatMap(subjectPaths),
          message: "平台代码只通过 `@/features/subjects` 的 registry / 公共契约调用学科能力，不得直接引用学科内部文件。",
        },
      ]),
    },
  },
  // 学科自己的应用路由（src/app/*/apps/<slug>/**）可以引用本学科模块，但不能引用其他学科。
  ...SUBJECT_SLUGS.map((slug) => ({
    files: [`src/app/*/apps/${slug}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": importBan([
        {
          group: SUBJECT_SLUGS.filter((other) => other !== slug).flatMap(subjectPaths),
          message: "一个学科不得引用另一个学科的文件。",
        },
      ]),
    },
  })),
  // 学科模块：不得引用其他学科，也不得引用 app 层（路由、页面）。
  ...SUBJECT_SLUGS.map((slug) => ({
    files: [`src/features/subjects/${slug}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": importBan([
        {
          group: SUBJECT_SLUGS.filter((other) => other !== slug).flatMap((other) => [
            ...subjectPaths(other),
            `**/${other}`,
            `**/${other}/**`,
          ]),
          message: "一个学科不得深链引用另一个学科的内部文件；跨学科能力放到平台层。",
        },
        {
          group: ["@/app", "@/app/**"],
          message: "学科模块不得反向依赖 app 层。",
        },
      ]),
    },
  })),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-*/**",
    ".open-next/**",
    ".vercel/**",
    ".wrangler/**",
    ".agents/**",
    ".ai/**",
    "archive/**",
    "jiaoyu/**",
    "supabase/functions/**",
    "tmp/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
