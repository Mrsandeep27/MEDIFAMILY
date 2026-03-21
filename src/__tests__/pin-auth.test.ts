import { describe, it, expect } from "vitest";
import { hashPin, verifyPin } from "@/lib/auth/pin";

describe("PIN Authentication", () => {
  it("hashes a PIN deterministically", async () => {
    const hash1 = await hashPin("1234");
    const hash2 = await hashPin("1234");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different PINs", async () => {
    const hash1 = await hashPin("1234");
    const hash2 = await hashPin("5678");
    expect(hash1).not.toBe(hash2);
  });

  it("verifies correct PIN", async () => {
    const hash = await hashPin("1234");
    expect(await verifyPin("1234", hash)).toBe(true);
  });

  it("rejects incorrect PIN", async () => {
    const hash = await hashPin("1234");
    expect(await verifyPin("0000", hash)).toBe(false);
    expect(await verifyPin("1235", hash)).toBe(false);
    expect(await verifyPin("4321", hash)).toBe(false);
  });

  it("hash is a hex string", async () => {
    const hash = await hashPin("9999");
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});
