import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The flat card (M74): the ink-900 surface with a hairline border, rounded-xl.
 * `CardSection` stacks blocks inside one card with a divider between them,
 * the thirdweb form layout. Pass padding at the call site (`p-5`) or use
 * sections; the card itself has none.
 */
export const cardClasses = "rounded-xl border border-ink-700/60 bg-ink-900";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardClasses, className)} {...props} />;
}

export function CardSection({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-ink-700/40 p-5 first:border-t-0", className)} {...props} />;
}
