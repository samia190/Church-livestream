import { describe, expect, it } from "vitest";
import { createPaypalOrder, initiateMpesa, newIdempotencyKey } from "./_core/payments";

describe("payment provider safety", () => {
  it("generates UUID idempotency keys", () => {
    const first = newIdempotencyKey();
    const second = newIdempotencyKey();
    expect(first).toMatch(/^[0-9a-f-]{36}$/i);
    expect(second).not.toBe(first);
  });

  it("rejects M-Pesa without a Kenyan phone number before making a provider call", async () => {
    await expect(initiateMpesa({
      amount: 100,
      currency: "KES",
      donorName: "Test Donor",
      email: "test@example.com",
      callbackBaseUrl: "http://localhost:3000",
      reference: newIdempotencyKey(),
    })).rejects.toThrow("Kenyan M-Pesa phone number");
  });

  it("fails closed when PayPal credentials are not configured", async () => {
    const previousId = process.env.PAYPAL_CLIENT_ID;
    const previousSecret = process.env.PAYPAL_CLIENT_SECRET;
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    await expect(createPaypalOrder({
      amount: 10,
      currency: "USD",
      donorName: "Test Donor",
      email: "test@example.com",
      callbackBaseUrl: "http://localhost:3000",
      reference: newIdempotencyKey(),
    })).rejects.toThrow("PAYPAL_CLIENT_ID is not configured");
    if (previousId) process.env.PAYPAL_CLIENT_ID = previousId;
    if (previousSecret) process.env.PAYPAL_CLIENT_SECRET = previousSecret;
  });
});
