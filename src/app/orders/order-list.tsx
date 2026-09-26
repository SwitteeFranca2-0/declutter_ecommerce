/**
 * A list of orders, shared by the orders page and the confirmation page.
 *
 * It renders what its caller passes, and the caller is a scoped query in
 * `orders.ts`. Nothing here decides who may see what.
 */

import Link from "next/link";

import type { BuyerOrder } from "@/lib/orders";
import { formatNaira } from "@/lib/pricing";

export const STATUS_LABELS: Record<string, string> = {
  deposit_paid: "Deposit paid, held for you",
  balance_paid: "Paid in full, awaiting handover",
  completed: "Handed over",
  expired: "Hold expired",
  cancelled: "Cancelled",
};

export function OrderList({ orders }: { orders: BuyerOrder[] }) {
  if (orders.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-[#DDDEE9] p-10 text-center">
        <p className="text-sm font-medium text-[#12142B]">No orders yet</p>
        <p className="mt-1.5 text-[13px] text-[#6B6E84]">
          When you pay a deposit, the item is held for you and appears here.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-[13px] font-medium text-[#2A2D64] underline"
        >
          Browse the marketplace
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 flex flex-col gap-3">
      {orders.map((order) => {
        const lapsed = order.status === "expired";

        return (
          <li key={order.id}>
            <Link
              href={`/orders/${order.id}`}
              className="flex items-start gap-4 rounded-lg border border-[#DDDEE9] bg-white p-4 transition-colors hover:border-[#2A2D64]"
            >
              <div className="h-[64px] w-[64px] flex-none overflow-hidden rounded-md bg-[#EDEEF6]">
                {order.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={order.thumbnail}
                    alt={order.itemTitle}
                    className={`h-full w-full object-cover ${lapsed ? "opacity-50" : ""}`}
                  />
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-[15px] font-semibold text-[#12142B]">
                    {order.itemTitle}
                  </span>
                  <span className="font-mono text-[11px] text-[#6B6E84]">
                    {order.reference}
                  </span>
                </div>

                <span
                  className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    lapsed
                      ? "bg-[#F4F4F8] text-[#6B6E84]"
                      : "bg-[#EDEEF6] text-[#2A2D64]"
                  }`}
                >
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>

                <span className="text-[13px] text-[#6B6E84]">
                  {formatNaira(order.depositAmount)} paid,{" "}
                  <span className="text-[#12142B]">
                    {formatNaira(order.balanceAmount)} on collection
                  </span>
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
