import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { localDateTimeToIso, toLocalDateTimeInputValue } from "../src/app/dashboard/admin/apps/local-datetime.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");

function withTimeZone(tz, fn) {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

test("datetime-local 的值按电脑当前时区换算成 UTC（中国、韩国、纽约、含夏令时）", () => {
  withTimeZone("Asia/Shanghai", () => assert.equal(localDateTimeToIso("2026-10-02T09:00"), "2026-10-02T01:00:00.000Z"));
  withTimeZone("Asia/Seoul", () => assert.equal(localDateTimeToIso("2026-10-02T09:00"), "2026-10-02T00:00:00.000Z"));
  withTimeZone("America/New_York", () => {
    assert.equal(localDateTimeToIso("2026-10-02T09:00"), "2026-10-02T13:00:00.000Z"); // 夏令时 UTC-4
    assert.equal(localDateTimeToIso("2026-12-02T09:00"), "2026-12-02T14:00:00.000Z"); // 冬令时 UTC-5
  });
  withTimeZone("UTC", () => assert.equal(localDateTimeToIso("2026-10-02T09:00:30"), "2026-10-02T09:00:30.000Z"));
});

test("同一个输入在不同时区得到不同时刻，且往返一致", () => {
  const instants = new Set();
  for (const tz of ["Asia/Shanghai", "Asia/Seoul", "America/New_York", "Europe/London"]) {
    withTimeZone(tz, () => {
      const iso = localDateTimeToIso("2026-10-02T09:00");
      instants.add(iso);
      assert.equal(toLocalDateTimeInputValue(new Date(iso)), "2026-10-02T09:00", tz);
    });
  }
  assert.equal(instants.size, 4);
});

test("无法解析的值返回空字符串（交给布置动作报错），不会抛异常", () => {
  for (const bad of ["", "abc", "2026-13-40T99:99", "2026-10-02", "2026-10-02T09", "2026-10-02 09:00", " 2026-10-02T09:00", "2026-10-02T09:00Z", "0x10"]) {
    assert.equal(localDateTimeToIso(bad), "", JSON.stringify(bad));
  }
});

test("布置面板提交的是换算后的 ISO 隐藏字段，可见的时间输入不带 name；布置动作对带时区的值原样采用", () => {
  const panel = read("src/app/dashboard/admin/apps/AppPaperAssignPanel.tsx");
  for (const name of ["starts_at", "due_at", "grade_release_at"]) {
    assert.equal((panel.match(new RegExp(`name="${name}"`, "g")) ?? []).length, 1, name);
    assert.match(panel, new RegExp(`<input type="hidden" name="${name}" value=\\{localDateTimeToIso\\(`), name);
  }
  assert.doesNotMatch(panel, /type="datetime-local"[^>]*name=/);
  assert.match(panel, /时间按你当前电脑的时区理解/);
  assert.doesNotMatch(panel, /韩国标准时间/);
  // 动作：不带时区的 datetime-local 才按 +09:00 解析，带时区的 ISO 原样交给 Date
  const action = read("src/app/dashboard/admin/assignments/paper-actions.ts");
  assert.match(action, /\? `\$\{value\}:00\+09:00`/);
  assert.match(action, /: value;\s*const date = new Date\(normalized\)/);
});
