import type { Metadata } from "next";
import "./globals.css";
import PasswordGate from "@/components/PasswordGate";

export const metadata: Metadata = {
  title: "Semangat ✦",
  description:
    "Extract mathematical equations from images with AI-powered recognition. Upload, edit, and export LaTeX equations seamlessly.",
  keywords: ["equation extractor", "LaTeX", "OCR", "math", "image to equation"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          crossOrigin="anonymous"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#020108" />
      </head>
      <body>
        {/* Deep space starfield layers */}
        <div className="starfield" />
        <div className="nebula-overlay" />

        {/* Shooting stars */}
        <div className="shooting-stars">
          <div className="shooting-star" />
          <div className="shooting-star" />
          <div className="shooting-star" />
          <div className="shooting-star" />
          <div className="shooting-star" />
          <div className="shooting-star" />
          <div className="shooting-star" />
          <div className="shooting-star" />
        </div>

        <PasswordGate>
          {children}
        </PasswordGate>
      </body>
    </html>
  );
}
