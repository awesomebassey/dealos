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
  assert.doesNotMatch(source, /·/u);
  assert.doesNotMatch(source, /eyebrow/i);
  assert.doesNotMatch(source, /developer note/i);
  assert.doesNotMatch(source, /founder note/i);
  assert.doesNotMatch(source, /<select\b/i);
  assert.doesNotMatch(source, /type\s*=\s*["']checkbox["']/i);
  assert.doesNotMatch(source, /\bwindow\.(alert|confirm|prompt|open)\b/i);
  assert.doesNotMatch(source, /\bx-demo-actor\b/i);
  assert.doesNotMatch(source, /\?role=/i);
  assert.doesNotMatch(source, /\broleFrom\s*\(/i);
});

test("Nigeria-first UI has no country or currency controls", () => {
  const pages = files("apps/web/app").map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(pages, />\s*Country\s*</i);
  assert.doesNotMatch(pages, />\s*Currency\s*</i);
});
