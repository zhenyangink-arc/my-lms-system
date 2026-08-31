import assert from "node:assert/strict";
import test from "node:test";

import {
  bufferLineForRequest,
  bufferSpeechAssetForRequest,
} from "../src/lib/learning-agent-buffer-state.ts";

test("继续当前小节使用预取过渡台词，空台词使用对应语言默认值", () => {
  assert.equal(bufferLineForRequest(undefined, "先看一下这个结构。", "zh-CN"), "先看一下这个结构。");
  assert.equal(bufferLineForRequest(undefined, "", "ko-KR"), "잠시만요, 이 부분을 한번 볼게요…");
  assert.equal(bufferLineForRequest(undefined, null, "zh-CN"), null);
});

test("重新开始可覆盖恢复会话的台词和语音资产", () => {
  assert.equal(bufferLineForRequest("从第一小节重新开始。", "继续当前小节。", "zh-CN"), "从第一小节重新开始。");
  assert.equal(bufferSpeechAssetForRequest(null, "current-node-r2-asset"), null);
  assert.equal(bufferSpeechAssetForRequest(undefined, "next-node-r2-asset"), "next-node-r2-asset");
});
