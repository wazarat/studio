import { AnalyticsSection } from "@/components/home/AnalyticsSection";
import { BuiltForBuilders } from "@/components/home/BuiltForBuilders";
import { ContactCta } from "@/components/home/ContactCta";
import { HeroAuthCta } from "@/components/home/HeroAuthCta";
import { HeroVideo } from "@/components/home/HeroVideo";

export default function LandingPage() {
  return (
    <div>
      {/* Hero: full-bleed muted background video */}
      <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden bg-[#3c72ab]">
        <HeroVideo src="/hero-video.mp4" />

        {/* scrims: darken top (for nav edge) + left (for hero copy) + fade into page bg */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(180deg, rgba(6,14,26,0.80) 0%, rgba(6,14,26,0.32) 20%, rgba(6,14,26,0) 40%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(90deg, rgba(6,14,26,0.74) 0%, rgba(6,14,26,0.42) 34%, rgba(6,14,26,0) 62%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-[1] h-44"
          style={{
            background: "linear-gradient(180deg, rgb(var(--ink-950) / 0) 0%, rgb(var(--ink-950)) 100%)",
          }}
        />

        <div className="container relative z-[2] flex min-h-[calc(100svh-4rem)] items-center py-16">
          <div className="max-w-2xl space-y-7 animate-fade-in-up">
            <h1
              className="font-display text-[clamp(1.75rem,9.5vw,2.25rem)] font-semibold leading-[1.05] tracking-tight text-white md:text-6xl"
              style={{ textShadow: "0 2px 20px rgba(4,10,20,0.35)" }}
            >
              {/* Two fixed lines at every width. */}
              <span
                className="block bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(120deg,#7cb0ff 0%,#b79bff 50%,#4fe3f5 100%)",
                }}
              >
                Build better DeFi.
              </span>
              <span className="block">Launch with Proof.</span>
            </h1>
            <p
              className="max-w-xl text-pretty text-lg leading-relaxed text-white/90 md:text-xl"
              style={{ textShadow: "0 1px 12px rgba(4,10,20,0.4)" }}
            >
              Research your concept, develop your DeFi product, and show the users the evidence
              behind your claims, from early development to launch.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <HeroAuthCta />
              <ContactCta label="Contact us" variant="secondary" sourcePage="home-hero" />
            </div>
          </div>
        </div>
      </section>

      <div className="container space-y-16 py-14 md:py-20">
        {/* Protocol analytics for Robinhood Chain and Arbitrum, from Dune and DefiLlama */}
        <AnalyticsSection />

        <BuiltForBuilders />
      </div>
    </div>
  );
}
