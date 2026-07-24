// Chụp trên thiết bị mô phỏng (mobile emulation) tại nhiều mốc thời gian.
//   MW=390 MH=844 MARKS="3,8,13" node scripts/shot_mobile.mjs
import puppeteer from "puppeteer-core";
const CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const W = Number(process.env.MW || 390);
const H = Number(process.env.MH || 844);
const b = await puppeteer.launch({
  executablePath: CH,
  headless: "new",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const p = await b.newPage();
await p.emulate({
  viewport: { width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
});
await p.goto("http://localhost:3000/?name=Test&debug=1", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
for (let i = 0; i < 250; i++) {
  const hid = await p.evaluate(() =>
    document.querySelector(".loader")?.classList.contains("hidden")
  );
  if (hid) break;
  await new Promise((r) => setTimeout(r, 200));
}
const marks = (process.env.MARKS || "3,7,11").split(",").map(Number);
const t0 = Date.now();
for (const m of marks) {
  const w = m * 1000 - (Date.now() - t0);
  if (w > 0) await new Promise((r) => setTimeout(r, w));
  await p.screenshot({ path: `/tmp/grad_shots/mwave-${W}x${H}-${m}.png` });
  console.log("shot", m + "s");
}
await b.close();
