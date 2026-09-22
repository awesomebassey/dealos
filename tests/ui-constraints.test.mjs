import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(root) {
  const out = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.(tsx|ts|css)$/.test(path)) out.push(path);
  }
  return out;
}

test("product UI avoids prohibited presentation markers", () => {
  const source = files("apps/web").map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(source, /—/u);
  assert.doesNotMatch(source, /eyebrow/i);
  assert.doesNotMatch(source, /developer note/i);
  assert.doesNotMatch(source, /founder note/i);
});
