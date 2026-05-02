import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Warm up: load each route once so dev compiles them.
const routes = ["/", "/trades", "/analytics", "/journal"];
console.log("Warming up (compiling)…");
for (const r of routes) {
  await page.goto(BASE + r, { waitUntil: "domcontentloaded" });
}

// Now measure soft-nav timing between pages.
console.log("\nMeasuring soft-nav latency (post-compile):");
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });

async function clickNav(label, expectedPath) {
  const before = Date.now();
  await Promise.all([
    page.waitForURL((u) => u.pathname === expectedPath, { timeout: 10000 }),
    page.locator(`nav a:has-text("${label}")`).click(),
  ]);
  // Wait for either an h1 or the PnlHero "Today" label (Overview's signature)
  await page.waitForFunction(
    () => {
      const main = document.querySelector("main");
      return main && main.textContent && main.textContent.length > 50;
    },
    null,
    { timeout: 10000 }
  );
  return Date.now() - before;
}

// Sequence: Overview -> Trades -> Analytics -> Journal -> Overview again
const t1 = await clickNav("Trades", "/trades");
console.log(`  Overview → Trades:    ${t1}ms`);
const t2 = await clickNav("Analytics", "/analytics");
console.log(`  Trades → Analytics:   ${t2}ms`);
const t3 = await clickNav("Journal", "/journal");
console.log(`  Analytics → Journal:  ${t3}ms`);
const t4 = await clickNav("Overview", "/");
console.log(`  Journal → Overview:   ${t4}ms`);

// Round-trip back to Trades to confirm not just first-cache
const t5 = await clickNav("Trades", "/trades");
console.log(`  Overview → Trades #2: ${t5}ms`);

await browser.close();

const all = [t1, t2, t3, t4, t5];
const max = Math.max(...all);
const avg = all.reduce((a, b) => a + b, 0) / all.length;
console.log(`\nMax: ${max}ms · Avg: ${avg.toFixed(0)}ms`);
process.exit(max < 3000 ? 0 : 1);
