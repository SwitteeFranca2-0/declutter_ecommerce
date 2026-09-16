/**
 * Money.
 *
 * Every figure a buyer sees is derived here, from the stored listed price, on
 * the server. No price, deposit or balance is ever read from a request body.
 * PRD §10.4.
 *
 * Amounts arrive from Prisma as Decimal and are handled as strings to the last
 * possible moment, because a float cannot represent ₦215,000.33 exactly.
 */

import { Prisma } from "@prisma/client";
import { DEPOSIT_RATE } from "@/lib/item-state";

export type Money = Prisma.Decimal;

/** Coerce anything Prisma or a fixture hands us into a Decimal. */
export function toMoney(value: Prisma.Decimal | string | number): Money {
  return new Prisma.Decimal(value);
}

/**
 * The deposit that reserves an item: 10% of the listed price.
 *
 * Rounded to whole Naira, half up, so the buyer is never charged a fraction of
 * the smallest unit in circulation.
 */
export function depositFor(listedPrice: Prisma.Decimal | string | number): Money {
  return toMoney(listedPrice)
    .mul(DEPOSIT_RATE)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * What remains after the deposit, payable on collection.
 *
 * Derived by subtraction rather than by a second percentage, so deposit plus
 * balance always equals the listed price exactly, whatever the rounding did.
 */
export function balanceFor(listedPrice: Prisma.Decimal | string | number): Money {
  const price = toMoney(listedPrice);
  return price.minus(depositFor(price));
}

const NAIRA = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

/** Display form. Never use the result for arithmetic. */
export function formatNaira(amount: Prisma.Decimal | string | number): string {
  return NAIRA.format(toMoney(amount).toNumber());
}
