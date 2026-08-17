import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return files.flat();
}

test("旧 app 主题变量已从运行时源码移除", async () => {
  const sourceFiles = (await listFiles(join(root, "src"))).filter((path) =>
    /\.(?:css|tsx?|jsx?)$/.test(path),
  );
  const violations = [];

  for (const path of sourceFiles) {
    const source = await readFile(path, "utf8");
    if (/--app-[a-z0-9-]+/.test(source)) {
      violations.push(relative(root, path));
    }
  }

  assert.deepEqual(violations, []);
});

test("旧五主题运行时标记不会重新进入源码", async () => {
  const sourceFiles = (await listFiles(join(root, "src"))).filter((path) =>
    /\.(?:css|tsx?|jsx?)$/.test(path),
  );
  const violations = [];

  for (const path of sourceFiles) {
    const source = await readFile(path, "utf8");
    if (/data-app-theme|app-dashboard-theme/.test(source)) {
      violations.push(relative(root, path));
    }
  }

  assert.deepEqual(violations, []);
});

test("管理端不再通过全局选择器重写 Tailwind 字重与圆角", async () => {
  const sources = await Promise.all([
    readFile(join(root, "src/app/globals.css"), "utf8"),
    readFile(join(root, "src/app/dashboard/management-apple.css"), "utf8"),
  ]);
  const source = sources.join("\n");

  assert.doesNotMatch(source, /\[data-dashboard-ui="management"\][^{]*\.font-(?:black|bold)/);
  assert.doesNotMatch(source, /\[data-dashboard-ui="management"\][^{]*\.rounded-(?:3xl|2xl|xl|lg)/);
});

test("工作台页面显式使用受控字重而不是 font-black", async () => {
  const dashboardFiles = (
    await listFiles(join(root, "src/app/dashboard"))
  ).filter((path) => /\.(?:tsx?|jsx?)$/.test(path));
  const violations = [];

  for (const path of dashboardFiles) {
    const source = await readFile(path, "utf8");
    if (/\bfont-black\b/.test(source)) {
      violations.push(relative(root, path));
    }
  }

  assert.deepEqual(violations, []);
});

test("共享数据表在 th 上暴露排序状态", async () => {
  const tableSource = await readFile(join(root, "src/components/ui/table.tsx"), "utf8");
  const featureFiles = (await listFiles(join(root, "src/features"))).filter((path) =>
    path.endsWith(".tsx"),
  );
  const violations = [];

  for (const path of featureFiles) {
    const source = await readFile(path, "utf8");
    if (
      /<TableHead key=\{header\.id\}/.test(source) &&
      !/sortDirection=\{header\.column\.getCanSort\(\)/.test(source)
    ) {
      violations.push(relative(root, path));
    }
  }

  assert.match(tableSource, /aria-sort=\{ariaSort\}/);
  assert.deepEqual(violations, []);
});

function hexToLuminance(hex) {
  const normalized = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = hexToLuminance(foreground);
  const backgroundLuminance = hexToLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

test("关键操作与状态令牌满足正常文字 4.5:1 对比度", async () => {
  const source = await readFile(join(root, "src/app/design-tokens.css"), "utf8");
  const readHexToken = (name) => {
    const match = source.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i"));
    assert.ok(match, `未找到原始颜色令牌 --${name}`);
    return match[1];
  };
  const pairs = [
    ["color-neutral-0", "color-blue-700"],
    ["color-neutral-0", "color-blue-800"],
    ["color-neutral-0", "color-success-700"],
    ["color-neutral-0", "color-status-inactive-700"],
    ["color-neutral-0", "color-status-suspended-700"],
    ["color-neutral-0", "color-steel-700"],
    ["color-green-950", "color-success-400"],
    ["color-zinc-950", "color-zinc-300"],
  ];

  for (const [foregroundToken, backgroundToken] of pairs) {
    const ratio = contrastRatio(
      readHexToken(foregroundToken),
      readHexToken(backgroundToken),
    );
    assert.ok(
      ratio >= 4.5,
      `${foregroundToken}/${backgroundToken} 对比度仅 ${ratio.toFixed(2)}:1`,
    );
  }
});

test("组件令牌只引用语义或原始令牌", async () => {
  const source = await readFile(join(root, "src/app/design-tokens.css"), "utf8");
  const componentSection = source
    .split("/* === Component tokens")[1]
    .split("/* === Student semantic profile")[0];

  assert.doesNotMatch(componentSection, /#[0-9a-f]{3,8}|rgba?\(|oklch\(/i);
  assert.match(source, /--font-size-base:/);
  assert.match(source, /--radius-base:/);
  assert.match(source, /--shadow-low:/);
});

test("首批桌面页面规范已建立", async () => {
  const pages = [
    "student-dashboard.md",
    "student-assessment.md",
    "management-collection.md",
    "management-detail-form.md",
  ];

  for (const page of pages) {
    const source = await readFile(
      join(root, "design-system/yuanzhi-lms/pages", page),
      "utf8",
    );
    assert.match(source, /- Route:/);
    assert.match(source, /- Audience:/);
    assert.match(source, /- Acceptance criteria:/);
  }
});
