import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Patrick_Hand_SC, Patrick_Hand } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";

const display = Patrick_Hand_SC({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const hand = Patrick_Hand({ weight: "400", subsets: ["latin"], variable: "--font-hand" });

export const metadata: Metadata = { title: "Humor Project" };

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className={`${display.variable} ${hand.variable}`}>
        <body>
        <Header />
        <main className="page">{children}</main>
        </body>
        </html>
    );
}

