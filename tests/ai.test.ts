import test from "node:test";
import assert from "node:assert/strict";
import { modelExtract } from "../lib/ai";
import { draftSchema } from "../lib/ai-parser";
test("unconfigured model is explicitly fallback, not canned live output", async () => {
  const oldKey = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;
  const r = await modelExtract(draftSchema, "مک‌بوک", "test");
  assert.equal(r.outcome, "unconfigured");
  assert.equal(r.value, undefined);
  if (oldKey) process.env.AI_API_KEY = oldKey;
});
test("structured provider handles malformed JSON, schema violations and timeout", async () => {
  const oldKey = process.env.AI_API_KEY,
    oldModel = process.env.AI_MODEL;
  process.env.AI_API_KEY = "test-placeholder";
  process.env.AI_MODEL = "test-model";
  try {
    const fake = (content: string) => async () =>
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: "stop", message: { content } }],
          usage: { prompt_tokens: 5, completion_tokens: 10 },
        }),
      );
    const malformed = await modelExtract(draftSchema, "x", "test", {
      fetcher: fake("bad JSON") as typeof fetch,
    });
    assert.equal(malformed.outcome, "invalid");
    const wrong = await modelExtract(draftSchema, "x", "test", {
      fetcher: fake(JSON.stringify({ ram: 999 })) as typeof fetch,
    });
    assert.equal(wrong.outcome, "invalid");
    const valid = {
      model: "MacBook Pro",
      chip: "M2",
      ram: null,
      storage: null,
      accessories: [],
      missing: ["رم"],
    };
    const ok = await modelExtract(draftSchema, "x", "test", {
      fetcher: fake(JSON.stringify(valid)) as typeof fetch,
    });
    assert.equal(ok.value?.ram, null);
    assert.equal(ok.inputTokens, 5);
    const timeout = await modelExtract(draftSchema, "x", "test", {
      fetcher: (async () => {
        throw new DOMException("timeout", "TimeoutError");
      }) as typeof fetch,
    });
    assert.equal(timeout.outcome, "timeout");
  } finally {
    if (oldKey) process.env.AI_API_KEY = oldKey;
    else delete process.env.AI_API_KEY;
    if (oldModel) process.env.AI_MODEL = oldModel;
    else delete process.env.AI_MODEL;
  }
});
