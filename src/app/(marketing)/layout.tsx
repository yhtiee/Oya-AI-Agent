import type { Metadata } from "next";
import { Caveat } from "next/font/google";

// The one handwritten accent is a marketing-page flourish, so the app never downloads it (SPEC §14.6).
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: "700",
  display: "swap",
});

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return <div className={caveat.variable}>{children}</div>;
}
