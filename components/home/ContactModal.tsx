"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ArrowUpRight, CalendarDays, Check, X } from "lucide-react";
import { track } from "@vercel/analytics";

import { Button } from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { SolutionsDropdown } from "@/components/home/SolutionsDropdown";
import { useModalBehavior } from "@/components/ui/useModalBehavior";
import { CONTACT_COPY, type SolutionKey } from "@/content/studio-pro";
import { cn } from "@/lib/utils";

type LeadType = "individual" | "team";
type Status = "idle" | "submitting" | "success" | "error";

/** Toggle pills, compact on a phone so nine of them fit in a few lines. */
const pillClasses =
  "rounded-full border px-3 py-1 text-xs font-medium leading-5 transition-colors sm:px-3.5";

export function ContactModal({
  open,
  onClose,
  sourcePage,
}: {
  open: boolean;
  onClose: () => void;
  /** Lead attribution, stored as `source_page` on the lead row. */
  sourcePage: string;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [leadType, setLeadType] = useState<LeadType>("team");
  const [solutions, setSolutions] = useState<SolutionKey[]>([]);
  const [comments, setComments] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — humans never see it
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Fresh form every time the modal opens.
    setFullName("");
    setEmail("");
    setLeadType("team");
    setSolutions([]);
    setComments("");
    setWebsite("");
    setStatus("idle");
    setErrorMessage(null);
  }, [open]);

  useModalBehavior({ onClose, containerRef, active: open });

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "contact",
          fullName,
          email,
          leadType,
          solutions,
          comments,
          sourcePage,
          website,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Request failed.");
      }
      track("lead_submitted", { kind: "contact", sourcePage, solutions: solutions.length });
      setStatus("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  // Portal to <body>: trigger containers may carry a transform (animate-fade-in-up
  // keeps one via fill forwards), which would otherwise trap position: fixed.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Contact CanHav Research"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={containerRef}
        tabIndex={-1}
        className="glass relative z-10 max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-ink-700/70 animate-fade-in-up"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-lg border border-ink-700 bg-ink-900/60 p-1.5 text-ink-300 transition-colors hover:text-ink-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="grid md:grid-cols-[1fr_240px]">
          <div className="min-w-0 p-6 md:p-7">
            {status === "success" ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-300">
                  <Check className="h-7 w-7" />
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight text-ink-50">
                  Message sent
                </h3>
                <p className="max-w-xs text-sm leading-relaxed text-ink-300">
                  Thanks for reaching out. We&apos;ll get back to you shortly.
                </p>
                <Button variant="secondary" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-electric-400">
                  {CONTACT_COPY.kicker}
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink-50">
                  Explore solutions with us
                </h3>

                <form onSubmit={handleSubmit} className="mt-4 space-y-3.5" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-ink-200">
                        Name <span className="text-rose-400">*</span>
                      </span>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ada Lovelace"
                        className={inputClasses}
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-ink-200">
                        Email <span className="text-rose-400">*</span>
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@email.com"
                        className={inputClasses}
                      />
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-ink-200">
                      Are you an individual or a team?
                    </span>
                    <div className="flex gap-2">
                      {(["individual", "team"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setLeadType(value)}
                          aria-pressed={leadType === value}
                          className={cn(
                            pillClasses,
                            leadType === value
                              ? "border-electric-500/60 bg-electric-500/15 text-electric-300"
                              : "border-ink-700/70 bg-ink-900/40 text-ink-300 hover:text-ink-100",
                          )}
                        >
                          {value === "individual" ? "Individual" : "Team"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-ink-200">
                      {CONTACT_COPY.solutionsLabel}{" "}
                      <span className="text-ink-500">{CONTACT_COPY.optional}</span>
                    </span>
                    <SolutionsDropdown value={solutions} onChange={setSolutions} />
                  </div>

                  {/* Discovery call, booked on Google Calendar in a new tab. One row in the input styling. */}
                  <a
                    href={CONTACT_COPY.bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      inputClasses,
                      "group flex items-center justify-between gap-3 transition-colors hover:border-electric-500/60",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-electric-400" />
                      <span className="truncate font-medium">{CONTACT_COPY.bookingCta}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-ink-400">
                      <span className="hidden sm:inline">{CONTACT_COPY.bookingLabel}</span>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="h-4 w-4 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-50"
                      />
                    </span>
                  </a>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-ink-200">
                      {CONTACT_COPY.commentsLabel}{" "}
                      <span className="text-ink-500">{CONTACT_COPY.optional}</span>
                    </span>
                    <textarea
                      rows={2}
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder={CONTACT_COPY.commentsPlaceholder}
                      className={cn(inputClasses, "resize-y leading-relaxed")}
                    />
                  </label>

                  {/* Honeypot: hidden from humans, tempting to bots. */}
                  <input
                    type="text"
                    name="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  />

                  {status === "error" && (
                    <StatusChip tone="error" variant="block" role="alert">
                      {errorMessage} Your details are still here. Try again.
                    </StatusChip>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button type="submit" disabled={status === "submitting"}>
                      {status === "submitting" ? "Sending…" : "Send message"}
                    </Button>
                    <p className="text-xs text-ink-500">
                      No spam. We only use this to reach out.
                    </p>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Mascot pane (decorative) */}
          <div
            aria-hidden="true"
            className="relative hidden overflow-hidden rounded-r-2xl border-l border-ink-800/60 md:block"
            style={{
              background:
                "radial-gradient(circle at 30% 20%, rgba(92,146,255,0.18), transparent 60%), rgba(10,13,20,0.6)",
            }}
          >
            <Image
              src="/mascot-research.png"
              alt=""
              fill
              sizes="240px"
              className="object-cover object-top"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
