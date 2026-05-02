import { chromium } from "playwright";

const URL = process.env.URL ?? "http://localhost:3001/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(800); // let framer-motion entrance settle

const info = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Open chat with the bot"]');
  if (!btn) return { found: false };
  const cs = getComputedStyle(btn);
  const rect = btn.getBoundingClientRect();
  return {
    found: true,
    computed: {
      position: cs.position,
      bottom: cs.bottom,
      right: cs.right,
      left: cs.left,
      opacity: cs.opacity,
      zIndex: cs.zIndex,
    },
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height), right: Math.round(rect.right), bottom: Math.round(rect.bottom) },
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
});
console.log(JSON.stringify(info, null, 2));

const status =
  info.found &&
  info.computed.position === "fixed" &&
  info.rect.right > info.viewport.w - 80 &&
  info.rect.bottom > info.viewport.h - 80 &&
  Number(info.computed.opacity) > 0.9
    ? "PASS"
    : "FAIL";
console.log(`STATUS: ${status}`);

await browser.close();
process.exit(status === "PASS" ? 0 : 1);
