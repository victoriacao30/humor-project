import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Header from "./components/Header";

export const metadata: Metadata = { title: "Humor Project" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
      <html lang="en">
      <body>
      <Header />
      {children}
      </body>
      </html>
  );
}
