import { Background } from "@/components/layout/Background";
import { Footer } from "@/components/layout/Footer";
import { ForceDark } from "@/components/layout/ForceDark";
import { Nav } from "@/components/layout/Nav";

/** The signed-out frame: marketing header, glows, footer. Dark only. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ForceDark />
      <Background />
      <div className="relative flex min-h-screen flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </>
  );
}
