import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePlanStartsAt } from "../src/features/curriculum-plans/time.ts";

test("开课时间：采用浏览器按电脑时区换算好的时间点，规范成 UTC", () => {
  assert.equal(parsePlanStartsAt("2026-10-05T01:00:00.000Z"), "2026-10-05T01:00:00.000Z");
  // 纽约的 10/4 21:00（UTC-4）就是 UTC 10/5 01:00，不会被当成首尔时间再减 9 小时
  assert.equal(parsePlanStartsAt("2026-10-04T21:00:00-04:00"), "2026-10-05T01:00:00.000Z");
  assert.equal(parsePlanStartsAt(" 2026-10-05T10:00:00+09:00 "), "2026-10-05T01:00:00.000Z");
});

test("开课时间：空值与无法解析的值报错", () => {
  assert.throws(() => parsePlanStartsAt(""), /请选择有效的开课日期和时间/);
  assert.throws(() => parsePlanStartsAt("   "), /请选择有效的开课日期和时间/);
  assert.throws(() => parsePlanStartsAt("明天上午"), /请选择有效的开课日期和时间/);
});
