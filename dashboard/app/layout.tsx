import { Suspense } from "react";
import "./globals.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "@/components/layout/grid-layout.css";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ChatLauncher } from "@/components/ai/ChatLauncher";
import { TopToolbar } from "@/components/ui/TopToolbar";
import { TradingAccountProvider } from "@/lib/tradingAccountContext";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { ThemeApplier } from "@/components/providers/ThemeApplier";
import { readBotMode } from "@/lib/mode";
import { loadSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Bull Stock Trader — Dashboard",
  description: "Local dashboard for the bull-stock-trader bot",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [initialAccountFromBot, settings] = await Promise.all([
    readBotMode(),
    loadSettings(),
  ]);
  const initialAccount =
    settings.defaults.defaultAccountMode === "paper" ? "paper" : initialAccountFromBot;
  const initialTheme = settings.display.theme === "auto" ? "dark" : settings.display.theme;
  return (
    <html lang="en" data-theme={initialTheme}>
      <body className="min-h-screen" suppressHydrationWarning>
        <Suspense fallback={null}>
          <SettingsProvider>
            <ThemeApplier />
            <TradingAccountProvider initialAccount={initialAccount}>
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
            </TradingAccountProvider>
          </SettingsProvider>
        </Suspense>
      </body>
    </html>
  );
}
