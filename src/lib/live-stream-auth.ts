import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function createStreamSecret() {
  const secret = randomBytes(32).toString("base64url");
  const salt = randomBytes(16);
  const derived = scryptSync(secret, salt, 64);
  return { secret, hash: `${salt.toString("hex")}:${derived.toString("hex")}` };
}

export function verifyStreamSecret(secret: string, stored: string) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex || !/^[a-f0-9]{32}$/.test(saltHex) || !/^[a-f0-9]{128}$/.test(hashHex)) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(secret, Buffer.from(saltHex, "hex"), 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}
