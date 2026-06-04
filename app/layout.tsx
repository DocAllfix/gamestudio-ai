import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game Studio AI",
  description: "AI-powered game development platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-[#0A0A0A] text-white antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
