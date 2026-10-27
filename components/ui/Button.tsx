import * as React from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

/**
 * Flat buttons (M74): one electric fill for the primary action, bordered
 * surfaces for the rest, rounded-lg like the inputs. No gradients, no glow.
 */
const variantClasses: Record<Variant, string> = {
  primary: "bg-electric-500 text-white hover:bg-electric-400",
  secondary: "border border-ink-700/60 bg-ink-900 text-ink-50 hover:bg-ink-800/60",
  ghost: "text-ink-200 hover:bg-ink-800/60 hover:text-ink-50",
  outline: "border border-ink-700/60 text-ink-50 hover:border-ink-500 hover:bg-ink-800/40",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 " +
  "disabled:pointer-events-none disabled:opacity-60";

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return cn(baseClasses, variantClasses[variant], sizeClasses[size], className);
}

interface ButtonOwnProps {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export type ButtonProps = ButtonOwnProps & React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Lightweight `asChild`: when true and children is a single element, clone it and
 * apply the button classes. Lets us style `<Link>` triggers without a Slot dep.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, children, ...props }, ref) => {
    const classes = buttonClasses({ variant, size, className });

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(classes, child.props.className),
      });
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
