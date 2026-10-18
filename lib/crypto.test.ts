import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { decryptSecret, encryptSecret, looksEncrypted, safeEqual } = await import("./crypto");

const KEY_A = Buffer.alloc(32, 1).toString("base64");
const KEY_B = Buffer.alloc(32, 2).toString("base64");

describe("lockbox encryption", () => {
  it("round-trips", () => {
    const ct = encryptSecret("7530", KEY_A);
    expect(decryptSecret(ct, KEY_A)).toBe("7530");
  });

  it("keeps leading zeros and non-digits", () => {
    const ct = encryptSecret("0042#", KEY_A);
    expect(decryptSecret(ct, KEY_A)).toBe("0042#");
  });

  it("never stores the plaintext and uses a fresh IV each time", () => {
    const a = encryptSecret("1769", KEY_A);
    const b = encryptSecret("1769", KEY_A);
    expect(a).not.toContain("1769");
    expect(a).not.toBe(b);
    expect(looksEncrypted(a)).toBe(true);
    expect(looksEncrypted("1769")).toBe(false);
  });

  it("fails with the wrong key", () => {
    const ct = encryptSecret("9687", KEY_A);
    expect(() => decryptSecret(ct, KEY_B)).toThrow();
  });

  it("fails when the ciphertext is tampered with", () => {
    const ct = encryptSecret("9687", KEY_A);
    const parts = ct.split(".");
    const body = Buffer.from(parts[2], "base64url");
    body[0] ^= 0xff;
    parts[2] = body.toString("base64url");
    expect(() => decryptSecret(parts.join("."), KEY_A)).toThrow();
  });

  it("rejects a key of the wrong length", () => {
    expect(() => encryptSecret("1", Buffer.alloc(16).toString("base64"))).toThrow(/32 bytes/);
    expect(() => encryptSecret("1", undefined)).toThrow(/LOCKBOX_ENC_KEY/);
  });

  it("safeEqual", () => {
    expect(safeEqual("1234", "1234")).toBe(true);
    expect(safeEqual("1234", "1235")).toBe(false);
    expect(safeEqual("1234", "12345")).toBe(false);
  });
});
