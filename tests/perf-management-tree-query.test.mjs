import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("PERF-019 management trees use confirmed nested relationships", async () => {
  const [courses, textbooks, toolbox] = await Promise.all([
    source("src/features/courses/api/service.ts"),
    source("src/features/digital-textbook/api/service.ts"),
    source("src/features/growth-toolbox/api/service.ts"),
  ]);

  assert.match(courses, /course_chapters!course_chapters_lesson_id_fkey/);
  assert.doesNotMatch(courses, /\.from\("course_chapters"\)/);

  for (const service of [textbooks, toolbox]) {
    assert.match(service, /digital_textbooks_lesson_id_fkey/);
    assert.match(service, /digital_textbook_versions_textbook_id_fkey/);
    assert.match(service, /digital_textbook_chapters_version_id_fkey/);
    assert.match(service, /digital_textbook_modules_chapter_id_fkey/);
    assert.match(service, /digital_textbook_nodes_module_id_fkey/);
    assert.doesNotMatch(service, /\.from\("digital_textbook_versions"\)/);
    assert.doesNotMatch(service, /\.from\("digital_textbook_chapters"\)/);
    assert.doesNotMatch(service, /\.from\("digital_textbook_modules"\)/);
    assert.doesNotMatch(service, /\.from\("digital_textbook_nodes"\)/);
  }
});

test("PERF-020 management load batches each requirement table once", async () => {
  const universities = await source(
    "src/features/universities/api/service.ts",
  );
  const managementLoader = universities.slice(
    universities.indexOf("export async function getUniversityManagementData"),
  );

  assert.match(
    universities,
    /\.in\("admission_stage", \[\.\.\.admissionStages\]\)/,
  );
  assert.match(universities, /\.in\("visa_type", \[\.\.\.visaTypes\]\)/);
  assert.doesNotMatch(
    managementLoader,
    /UNIVERSITY_ADMISSION_STAGES\.map\([\s\S]*loadUniversityDocumentRequirementsForStage/,
  );
  assert.doesNotMatch(
    managementLoader,
    /UNIVERSITY_VISA_TYPES\.map\([\s\S]*loadUniversityVisaRequirementsForType/,
  );
});
