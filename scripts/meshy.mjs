// Sinh background 3D bằng Meshy Text-to-3D rồi tải GLB về public/models/background.glb
//
// Cách chạy:
//   MESHY_KEY=xxxxx node scripts/meshy.mjs
// Tuỳ chọn:
//   MESHY_PROMPT="..."        prompt tuỳ chỉnh
//   MESHY_REFINE=0            bỏ qua bước refine (nhanh hơn, không có PBR texture)
//   MESHY_ART=realistic       art style (realistic | sculpture)
//   MESHY_OUT=public/models/background.glb
//
// API: https://docs.meshy.ai  (Text to 3D v2)

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const KEY = process.env.MESHY_KEY;
if (!KEY) {
  console.error("❌ Thiếu MESHY_KEY. Chạy: MESHY_KEY=xxx node scripts/meshy.mjs");
  process.exit(1);
}

const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";
const OUT = process.env.MESHY_OUT || "public/models/background.glb";
const ART = process.env.MESHY_ART || "realistic";
const DO_REFINE = process.env.MESHY_REFINE !== "0";

const PROMPT =
  process.env.MESHY_PROMPT ||
  "A grand graduation ceremony stage backdrop: an elegant symmetrical golden arch " +
    "decorated with laurel wreaths and draped ceremonial banners, festive balloons and " +
    "flowers on both sides, a low decorated podium in the center, deep royal blue and " +
    "warm gold color scheme, celebratory yet dignified and prestigious, clean studio look, " +
    "single connected prop, front-facing.";

const NEG =
  "people, human, character, person, text, watermark, low quality, messy, cluttered, floating debris";

const headers = {
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function post(body) {
  const r = await fetch(BASE, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`POST ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

async function poll(id, label) {
  let last = -1;
  for (;;) {
    const r = await fetch(`${BASE}/${id}`, { headers });
    const txt = await r.text();
    if (!r.ok) throw new Error(`GET ${r.status}: ${txt}`);
    const t = JSON.parse(txt);
    if (t.progress !== last) {
      last = t.progress;
      console.log(`  [${label}] ${t.status} ${t.progress ?? 0}%`);
    }
    if (t.status === "SUCCEEDED") return t;
    if (t.status === "FAILED" || t.status === "CANCELED")
      throw new Error(`${label} ${t.status}: ${JSON.stringify(t.task_error || {})}`);
    await new Promise((s) => setTimeout(s, 5000));
  }
}

console.log("🎨 Meshy Text-to-3D — tạo background lễ tốt nghiệp");
console.log("prompt:", PROMPT.slice(0, 90) + "…");

// 1) preview
const preview = await post({
  mode: "preview",
  prompt: PROMPT,
  negative_prompt: NEG,
  art_style: ART,
  ai_model: "meshy-5",
  should_remesh: true,
  topology: "triangle",
  target_polycount: 60000,
});
const previewId = preview.result;
console.log("→ preview task:", previewId);
const previewDone = await poll(previewId, "preview");

// 2) refine (PBR textures) — tuỳ chọn
let finalTask = previewDone;
if (DO_REFINE) {
  const refine = await post({
    mode: "refine",
    preview_task_id: previewId,
    enable_pbr: true,
  });
  console.log("→ refine task:", refine.result);
  finalTask = await poll(refine.result, "refine");
}

const glb = finalTask.model_urls?.glb;
if (!glb) throw new Error("Không có model_urls.glb trong kết quả");
console.log("⬇  tải GLB:", glb);

const bin = Buffer.from(await (await fetch(glb)).arrayBuffer());
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, bin);
console.log(`✅ Đã lưu ${OUT} (${(bin.length / 1024 / 1024).toFixed(1)} MB)`);
if (finalTask.thumbnail_url) console.log("   thumbnail:", finalTask.thumbnail_url);
