import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { LiveRefresh } from "@/components/LiveRefresh";

export const metadata: Metadata = {
  title: "Bull Stock Trader — Dashboard",
  description: "Local dashboard for the bull-stock-trader bot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen" suppressHydrationWarning>
        <LiveRefresh />
        <div className="flex">
          <Nav />
          <main className="flex-1 min-w-0 px-6 py-6 max-w-[1600px]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
