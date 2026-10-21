// End-to-end payload encryption (AES-256-GCM) with a pre-shared key.
//
// Envelope format (also produced/consumed by the app's BeaconCrypto):
//   { "v": 1, "n": "<base64 12-byte nonce>",
//     "c": "<base64 ciphertext>", "m": "<base64 16-byte tag>" }
//
// The nonce and tag are carried separately so the Dart `cryptography` package
// (which exposes SecretBox.nonce/cipherText/mac) and Node's crypto interoperate.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { KEY, HAS_KEY } from "../config.mjs";

export { HAS_KEY };

export function isEnvelope(x) {
  return (
    x && typeof x === "object" && x.v === 1 && x.n && x.c && x.m
  );
}

export function encrypt(obj) {
  if (!HAS_KEY) return obj;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(obj), "utf8")),
    cipher.final(),
  ]);
  return {
    v: 1,
    n: iv.toString("base64"),
    c: ct.toString("base64"),
    m: cipher.getAuthTag().toString("base64"),
  };
}

export function decrypt(env) {
  if (!HAS_KEY) return env;
  if (!isEnvelope(env)) throw new Error("not an encrypted envelope");
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(env.n, "base64"));
  decipher.setAuthTag(Buffer.from(env.m, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(env.c, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(pt.toString("utf8"));
}
