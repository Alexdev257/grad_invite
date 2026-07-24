// QA screenshots của kịch bản thiệp, dùng Chrome hệ thống qua puppeteer-core.
// Chụp nhiều mốc thời gian để xem từng pha: wave -> diploma -> celebrate -> final.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL =
  process.env.SHOT_URL ||
  "http://localhost:3000/?name=" + encodeURIComponent("Nguyễn Văn An");
const OUT = process.env.SHOT_OUT || "/tmp/grad_shots";
const W = Number(process.env.SHOT_W || 1440);
const H = Number(process.env.SHOT_H || 900);
const TAG = process.env.SHOT_TAG || "d";
// Mốc chụp (giây) kể từ khi vào trang
const MARKS = (process.env.SHOT_MARKS || "3,7,10,13,16,20,24")
  .split(",")
  .map((s) => Number(s.trim()));

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--hide-scrollbars",
    `--window-size=${W},${H}`,
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

page.on("console", (m) => {
  const t = m.type();
  const txt = m.text();
  if (t === "error" || t === "warning" || txt.includes("[grad]"))
    console.log(`[console.${t}]`, txt);
});
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

const t0 = Date.now();
try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  for (const mark of MARKS) {
    const wait = mark * 1000 - (Date.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const p = `${OUT}/${TAG}-${String(mark).padStart(2, "0")}s.png`;
    await page.screenshot({ path: p });
    console.log("shot", p);
  }
} catch (e) {
  console.log("[shot error]", e.message);
} finally {
  await browser.close();
}
console.log("done");
