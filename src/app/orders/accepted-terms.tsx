/**
 * The refund terms as accepted at checkout, repeated after payment on the
 * confirmation and order pages. Read from the same source as checkout, so what
 * the buyer agreed to and what they are shown afterwards cannot differ.
 */

import { REFUND_TERMS } from "@/lib/refund-policy";

export function AcceptedTerms({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-col gap-1.5 ${className}`}>
      {REFUND_TERMS.map((term) => (
        <li key={term.event} className="text-[13px] leading-relaxed text-[#6B6E84]">
          {term.event}: {term.outcome.toLowerCase()}.
        </li>
      ))}
    </ul>
  );
}
