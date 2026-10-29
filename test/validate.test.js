const test = require("node:test");
const assert = require("node:assert");
const { validateNote, TITLE_MAX, BODY_MAX } = require("../src/validate");

test("accepts a normal note and trims it", () => {
  const r = validateNote({ title: "  Buy milk ", body: " 2 litres " });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.value, { title: "Buy milk", body: "2 litres" });
});

test("body is optional", () => {
  const r = validateNote({ title: "Only a title" });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.body, "");
});

test("rejects a missing or blank title", () => {
  assert.strictEqual(validateNote({}).ok, false);
  assert.strictEqual(validateNote({ title: "   " }).ok, false);
  assert.strictEqual(validateNote(undefined).ok, false);
});

test("rejects a title that is too long", () => {
  assert.strictEqual(validateNote({ title: "x".repeat(TITLE_MAX + 1) }).ok, false);
});

test("rejects a body that is too long", () => {
  assert.strictEqual(validateNote({ title: "ok", body: "x".repeat(BODY_MAX + 1) }).ok, false);
});

test("ignores non-string values", () => {
  assert.strictEqual(validateNote({ title: 123 }).ok, false);
});
