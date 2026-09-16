/**
 * Money, tested directly.
 *
 * The invariant that matters: deposit plus balance equals the listed price
 * exactly, for every price, whatever the rounding did. A buyer must never be
 * able to pay both parts and still owe a Naira.
 */

import { describe, expect, it } from "vitest";
import { balanceFor, depositFor, formatNaira, toMoney } from "@/lib/pricing";

describe("deposit", () => {
  it("is 10% of the listed price", () => {
    expect(depositFor("215000.00").toString()).toBe("21500");
    expect(depositFor("9500.00").toString()).toBe("950");
  });

  it("rounds to whole Naira", () => {
    // 10% of 9,505 is 950.5, which is not payable.
    expect(depositFor("9505.00").toString()).toBe("951");
    expect(depositFor("9504.00").toString()).toBe("950");
  });

  it("handles a price with kobo without drifting", () => {
    expect(depositFor("215000.33").toString()).toBe("21500");
  });
});

describe("deposit plus balance", () => {
  const prices = [
    "215000.00", "95000.00", "9500.00", "9505.00", "16000.00",
    "118000.00", "24000.00", "1.00", "0.01", "215000.33", "33333.33",
  ];

  it.each(prices)("equals the listed price exactly for %s", (price) => {
    const sum = depositFor(price).plus(balanceFor(price));
    expect(sum.equals(toMoney(price))).toBe(true);
  });

  it("never leaves the buyer owing a stray Naira after rounding up", () => {
    // The deposit rounded up here, so the balance must absorb it.
    expect(depositFor("9505.00").toString()).toBe("951");
    expect(balanceFor("9505.00").toString()).toBe("8554");
    expect(depositFor("9505.00").plus(balanceFor("9505.00")).toString()).toBe("9505");
  });
});

describe("formatting", () => {
  it("renders Naira with no fractional part", () => {
    expect(formatNaira("215000.00")).toContain("215,000");
  });

  it("does not lose precision on the way in", () => {
    expect(toMoney("215000.33").toString()).toBe("215000.33");
  });
});
