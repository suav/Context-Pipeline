import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Context Pipeline",
  description: "Universal context import system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
