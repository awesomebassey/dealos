import { hashPassword, hashToken, randomToken, verifyPassword } from "./password";

describe("first-party authentication crypto", () => {
  it("hashes and verifies passwords without storing the original password", async () => {
    const password = "A-strong-demo-password-2026";
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("generates opaque tokens and hashes them deterministically", () => {
    const first = randomToken();
    const second = randomToken();
    expect(first).not.toEqual(second);
    expect(first.length).toBeGreaterThan(20);
    expect(hashToken(first)).toEqual(hashToken(first));
    expect(hashToken(first)).not.toEqual(hashToken(second));
  });
});
