import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CareLoop — AI care companion for GLP-1 therapy",
  description:
    "Full-stack AI demo: grounded patient coaching, longitudinal memory, safety triage, clinician portal, tracing, and evals.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-500 sm:px-6">
          Portfolio demo with fictional patients. Not medical advice. Knowledge-base content is illustrative and has not been
          clinically reviewed.
        </footer>
      </body>
    </html>
  );
}
