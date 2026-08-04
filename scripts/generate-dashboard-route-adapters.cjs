const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const sharedRoot = path.join(projectRoot, "src", "app", "dashboard");
const mode = process.argv[2];

if (mode !== "platform" && mode !== "tenant") {
  throw new Error(
    "Usage: node scripts/generate-dashboard-route-adapters.cjs <platform|tenant>"
  );
}

function assertInside(target, root) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside ${root}: ${target}`);
  }
}

function writeGeneratedFile(target, content) {
  const routeRoot = path.join(projectRoot, "src", "app");
  assertInside(target, routeRoot);
  fs.mkdirSync(path.dirname(target), { recursive: true });

  if (fs.existsSync(target)) {
    const current = fs.readFileSync(target, "utf8");
    if (current === content) return;
    throw new Error(`Refusing to overwrite a non-matching file: ${target}`);
  }

  fs.writeFileSync(target, content, "utf8");
}

function walkDirectories(root) {
  const directories = [root];

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "[...rest]") continue;
    directories.push(...walkDirectories(path.join(root, entry.name)));
  }

  return directories;
}

function toImportSpecifier(relativeDirectory, filename) {
  const suffix = relativeDirectory
    ? `/${relativeDirectory.split(path.sep).join("/")}`
    : "";
  return `@/app/dashboard${suffix}/${filename.replace(/\.(tsx|ts)$/, "")}`;
}

function prepareSharedRouteFiles() {
  const pageDirectories = [];

  for (const directory of walkDirectories(sharedRoot)) {
    if (directory === sharedRoot) continue;

    const pageFile = path.join(directory, "page.tsx");
    const contentFile = path.join(directory, "page-content.tsx");

    if (fs.existsSync(pageFile) && fs.existsSync(contentFile)) {
      throw new Error(`Both page.tsx and page-content.tsx exist in ${directory}`);
    }

    if (fs.existsSync(pageFile)) fs.renameSync(pageFile, contentFile);
    if (fs.existsSync(contentFile)) {
      pageDirectories.push(path.relative(sharedRoot, directory));
    }
  }

  for (const relativeDirectory of ["admin", "courses"]) {
    const directory = path.join(sharedRoot, relativeDirectory);
    const layoutFile = path.join(directory, "layout.tsx");
    const contentFile = path.join(directory, "layout-content.tsx");

    if (fs.existsSync(layoutFile) && fs.existsSync(contentFile)) {
      throw new Error(`Both layout.tsx and layout-content.tsx exist in ${directory}`);
    }

    if (fs.existsSync(layoutFile)) fs.renameSync(layoutFile, contentFile);
    if (!fs.existsSync(contentFile)) {
      throw new Error(`Missing shared nested layout: ${contentFile}`);
    }
  }

  return pageDirectories.sort();
}

function platformLayoutSource() {
  return `import type { ReactNode } from "react";

import DashboardRouteLayout from "@/app/dashboard/DashboardRouteLayout";
import { requireDashboardAccess } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

export default async function PlatformDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireDashboardAccess("platform");
  return <DashboardRouteLayout>{children}</DashboardRouteLayout>;
}
`;
}

function tenantLayoutSource() {
  return `import type { ReactNode } from "react";

import DashboardRouteLayout from "@/app/dashboard/DashboardRouteLayout";
import { requireDashboardAccess } from "@/lib/dashboard-access";

export const dynamic = "force-dynamic";

export default async function TenantDashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await requireDashboardAccess("tenant", tenantSlug);
  return <DashboardRouteLayout>{children}</DashboardRouteLayout>;
}
`;
}

function generateRouteTree(pageDirectories) {
  const routeRoot =
    mode === "platform"
      ? path.join(projectRoot, "src", "app", "platform", "dashboard")
      : path.join(
          projectRoot,
          "src",
          "app",
          "t",
          "[tenantSlug]",
          "dashboard"
        );

  writeGeneratedFile(
    path.join(routeRoot, "layout.tsx"),
    mode === "platform" ? platformLayoutSource() : tenantLayoutSource()
  );
  writeGeneratedFile(
    path.join(routeRoot, "page.tsx"),
    `export { default } from "@/app/dashboard/DashboardHomePage";\n`
  );
  writeGeneratedFile(
    path.join(routeRoot, "loading.tsx"),
    `export { default } from "@/app/dashboard/loading";\n`
  );
  writeGeneratedFile(
    path.join(routeRoot, "error.tsx"),
    `"use client";\n\nexport { default } from "@/app/dashboard/error";\n`
  );

  for (const relativeDirectory of pageDirectories) {
    const adapterFile = path.join(routeRoot, relativeDirectory, "page.tsx");
    const source = toImportSpecifier(relativeDirectory, "page-content.tsx");
    writeGeneratedFile(adapterFile, `export { default } from "${source}";\n`);
  }

  for (const relativeDirectory of ["admin", "courses"]) {
    const adapterFile = path.join(routeRoot, relativeDirectory, "layout.tsx");
    const source = toImportSpecifier(relativeDirectory, "layout-content.tsx");
    writeGeneratedFile(adapterFile, `export { default } from "${source}";\n`);
  }

  return routeRoot;
}

const pageDirectories = prepareSharedRouteFiles();
const generatedRoot = generateRouteTree(pageDirectories);

process.stdout.write(
  JSON.stringify(
    {
      mode,
      sharedPageCount: pageDirectories.length + 1,
      generatedAdapterCount: pageDirectories.length + 1,
      generatedRoot: path.relative(projectRoot, generatedRoot),
    },
    null,
    2
  ) + "\n"
);
