import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DiffCast — Narrated demo videos from your PRs",
  description:
    "DiffCast reads your diff, drives the browser, narrates what changed, and delivers an MP4 — all from a single command.",
  openGraph: {
    title: "DiffCast — Narrated demo videos from your PRs",
    description:
      "Auto-generate narrated demo videos from pull requests. Diff-aware, local-first, GitHub-native.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
