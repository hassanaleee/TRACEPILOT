import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TracePilot — AI Agent & RAG Observability",
  description: "Developer-focused observability, execution tracing, token attribution, and evaluation for AI agents and RAG pipelines.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090D16] text-[#F8FAFC] antialiased">
        {children}
      </body>
    </html>
  );
}
