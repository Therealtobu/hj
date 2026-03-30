"use client";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>EXE Guard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Bricolage+Grotesque:wght@600;700;800&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" toastOptions={{
          style: {
            background: "rgba(20,20,30,0.9)",
            backdropFilter: "blur(20px)",
            color: "#f5f5f7",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          },
          success: { iconTheme: { primary: "#22c55e", secondary: "#08080f" } },
          error:   { iconTheme: { primary: "#ef4444", secondary: "#08080f" } },
        }} />
      </body>
    </html>
  );
}
