"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ContactModal } from "@/components/home/ContactModal";

export function ContactCta({
  label = "Pro Services",
  variant = "primary",
  size = "md",
  className,
  sourcePage,
}: {
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Lead attribution, stored as `source_page` on the lead row. */
  sourcePage: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ContactModal open={open} onClose={() => setOpen(false)} sourcePage={sourcePage} />
    </>
  );
}
