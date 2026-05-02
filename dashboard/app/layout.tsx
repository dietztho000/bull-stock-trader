import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ChatLauncher } from "@/components/ai/ChatLauncher";
import { TopToolbar } from "@/components/ui/TopToolbar";

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
          <div className="flex-1 min-w-0 flex flex-col">
            <TopToolbar />
            <main className="flex-1 min-w-0 px-6 pb-10 pt-2 max-w-[1600px]">
              {children}
            </main>
          </div>
        </div>
        <ChatLauncher />
      </body>
    </html>
  );
}
