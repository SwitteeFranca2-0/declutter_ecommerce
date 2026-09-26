/**
 * A list of orders, shared by the buyer's and the seller's pages.
 *
 * It renders what its caller passes, and the callers are the scoped queries in
 * `orders.ts`. Nothing here decides who may see what: a row for the seller
 * simply arrives without the seller block filled in, and vice versa.
 */

import Link from "next/link";

import type { OrderView } from "@/lib/orders";
import { formatNaira } from "@/lib/pricing";

const STATUS_LABELS: Record<string, string> = {
  deposit_paid: "Deposit paid, arranging handover",
  balance_paid: "Paid in full, awaiting handover",
  completed: "Handed over",
  expired: "Hold expired",
  cancelled: "Cancelled",
};

export function OrderList({
  orders,
  emptyMessage,
  emptyAction,
}: {
  orders: OrderView[];
  emptyMessage: string;
  emptyAction?: { href: string; label: string };
}) {
  if (orders.length === 0) {
    return (
      <div className="mt-6 rounded border border-dashed border-[#B4B4B4] p-8 text-center">
        <p className="text-[13px] text-[#6B6B6B]">{emptyMessage}</p>
        {emptyAction && (
          <Link
            href={emptyAction.href}
            className="mt-3 inline-block text-[13px] text-[#1E5F4B] underline"
          >
            {emptyAction.label}
          </Link>
        )}
      </div>
    );
  }

  return (
    <ul className="mt-6 flex flex-col gap-3">
      {orders.map((order) => (
        <li key={order.id}>
          <Link
            href={`/orders/${order.id}`}
            className="flex items-start gap-3.5 rounded border border-[#B4B4B4] p-3.5 hover:border-[#6B6B6B]"
          >
            <div className="h-[56px] w-[56px] flex-none overflow-hidden rounded-[3px] bg-[#E8E8E8]">
              {order.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={order.thumbnail}
                  alt={order.itemTitle}
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-[#1F1F1F]">{order.itemTitle}</span>
                <span className="font-mono text-[11px] text-[#6B6B6B]">{order.reference}</span>
              </div>

              <span className="text-[13px] text-[#6B6B6B]">
                {STATUS_LABELS[order.status] ?? order.status}
              </span>

              <span className="text-[13px] text-[#1F1F1F]">
                {formatNaira(order.balanceAmount)} outstanding
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
