// Refine (PBR texture) một preview đã chọn rồi tải GLB về public/models/background.glb
//   MESHY_KEY=xxx PREVIEW_ID=<preview_task_id> node scripts/meshy_finalize.mjs
// Tuỳ chọn: MESHY_REFINE=0 để tải thẳng preview GLB (không refine).

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const KEY = process.env.MESHY_KEY;
const PREVIEW_ID = process.env.PREVIEW_ID;
if (!KEY || !PREVIEW_ID) {
  console.error("Cần MESHY_KEY và PREVIEW_ID");
  process.exit(1);
}
const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";
const OUT = process.env.MESHY_OUT || "public/models/background.glb";
const DO_REFINE = process.env.MESHY_REFINE !== "0";
const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function get(id) {
  const r = await fetch(`${BASE}/${id}`, { headers });
  const t = await r.text();
  if (!r.ok) throw new Error(`GET ${r.status}: ${t}`);
  return JSON.parse(t);
}
async function poll(id, label) {
  let last = -1;
  for (;;) {
    const t = await get(id);
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

let task = await get(PREVIEW_ID);
if (DO_REFINE) {
  const r = await fetch(BASE, {
    method: "POST",
    headers,
    body: JSON.stringify({ mode: "refine", preview_task_id: PREVIEW_ID, enable_pbr: true }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`refine POST ${r.status}: ${txt}`);
  const refineId = JSON.parse(txt).result;
  console.log("refine task:", refineId);
  task = await poll(refineId, "refine");
  if (task.thumbnail_url) {
    const png = Buffer.from(await (await fetch(task.thumbnail_url)).arrayBuffer());
    await writeFile("/tmp/meshy/refined.png", png);
    console.log("thumbnail → /tmp/meshy/refined.png");
  }
}

const glb = task.model_urls?.glb;
if (!glb) throw new Error("Không có glb");
const bin = Buffer.from(await (await fetch(glb)).arrayBuffer());
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, bin);
console.log(`✅ ${OUT} (${(bin.length / 1024 / 1024).toFixed(1)} MB)`);
