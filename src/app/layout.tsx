import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "./cart-provider";
import { Header } from "./header";

// IBM Plex per the `frontend-design` skill: Sans for interface text, Mono for
// prices in secondary position, counts and identifiers.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Declutter",
  description:
    "Escrow-mediated marketplace for used goods. Payments are held until handover.",
};

// Typed explicitly rather than with Next's generated `LayoutProps`, which only
// exists once a build has written .next/types and so breaks a cold typecheck.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white">
        {/* One provider for the whole app: the header badge and the cart page
            read the same state, so they can never disagree. */}
        <CartProvider>
          <Header />
          <div className="flex-1">{children}</div>
        </CartProvider>
      </body>
    </html>
  );
}
