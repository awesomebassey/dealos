import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sources=[
  "apps/api/src/kyc/kyc.service.ts",
  "apps/api/src/listing-verification/listing-verification.service.ts",
  "apps/api/src/data-room/data-room.service.ts",
  "apps/api/src/escrow/escrow.service.ts",
  "apps/api/src/wallet/wallet.service.ts",
];

test("synthetic identity uploads, private documents and simulated money require explicit opt-in",()=>{
  for(const path of sources){
    const source=readFileSync(path,"utf8");
    const references=[...source.matchAll(/process\.env\.(DEALOS_DEMO_[A-Z_]+)/g)];
    assert.ok(references.length>0,path+" needs a simulation feature flag");
    const allowed=[...source.matchAll(/process\.env\.DEALOS_DEMO_[A-Z_]+\s*!==\s*"true"/g)];
    assert.equal(references.length,allowed.length,
      path+" must reject missing or non-true demo feature flags");
    assert.doesNotMatch(source,/process\.env\.DEALOS_DEMO_[A-Z_]+\s*===\s*"false"/);
  }
});
