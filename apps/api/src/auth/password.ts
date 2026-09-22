import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const N = 32768;
const R = 8;
const P = 1;

function derive(password: string, salt: Buffer, keyLength: number, options: { N:number; r:number; p:number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, {
      N: options.N,
      r: options.r,
      p: options.p,
      maxmem: 64 * 1024 * 1024,
    }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, n, r, p, saltEncoded, keyEncoded] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltEncoded || !keyEncoded) return false;

  const expected = Buffer.from(keyEncoded, "base64url");
  const actual = await derive(password, Buffer.from(saltEncoded, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function randomToken() {
  return randomBytes(32).toString("base64url");
}
