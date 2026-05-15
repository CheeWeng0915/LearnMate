import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LearnMate — your goal, your pace, real progress",
  description:
    "Tell us what you want to learn. We'll build a day-by-day plan with hand-picked videos so you actually finish.",
  icons: {
    icon: [{ url: "/robot-icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/robot-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/robot-icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-canvas text-charcoal">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
