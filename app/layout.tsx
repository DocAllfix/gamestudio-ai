import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono, Chakra_Petch } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { PostHogProvider } from "@/lib/analytics/posthog-provider";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "GameSmith — Forge real games",
  description:
    "A real game that runs and that you own. On 5 engines, browser and mobile. In 10 minutes.",
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
          <PwaRegister />
          <PostHogProvider>{children}</PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
