import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * AES-256-GCM for lockbox codes. Rule 5 in CLAUDE.md: encrypted at rest,
 * never logged, never in list endpoints, every reveal audited.
 *
 * Ciphertext format: "v1.<iv>.<ciphertext>.<tag>", each part base64url.
 * The version prefix lets a future key rotation script tell old from new.
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const VERSION = "v1";

function loadKey(raw: string | undefined = process.env.LOCKBOX_ENC_KEY): Buffer {
  if (!raw) throw new Error("LOCKBOX_ENC_KEY is not set. Generate one with: openssl rand -base64 32");
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) {
    throw new Error(`LOCKBOX_ENC_KEY must decode to 32 bytes, got ${key.length}.`);
  }
  return key;
}

export function encryptSecret(plaintext: string, rawKey?: string): string {
  const key = loadKey(rawKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), ct.toString("base64url"), tag.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, rawKey?: string): string {
  const key = loadKey(rawKey);
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Unrecognised ciphertext format.");
  }
  const [, ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== 16) {
    throw new Error("Corrupt ciphertext.");
  }
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  // Throws on a wrong key or tampered data; callers should treat any error as "cannot decrypt".
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

/** True when `payload` was produced by encryptSecret (cheap structural check, no key needed). */
export function looksEncrypted(payload: string): boolean {
  const parts = payload.split(".");
  return parts.length === 4 && parts[0] === VERSION;
}

/** Constant-time string compare, for comparing codes a cleaner types back. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
