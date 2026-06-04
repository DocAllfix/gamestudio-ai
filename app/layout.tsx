import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono, Chakra_Petch } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "GameSmith — Forgia giochi veri",
  description:
    "Un gioco vero, che giri e possiedi. Su 5 motori, browser e mobile. In 10 minuti.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="it"
        className={`${geist.variable} ${geistMono.variable} ${chakraPetch.variable}`}
      >
        <body className="bg-ink text-text antialiased font-sans">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
