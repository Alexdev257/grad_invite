// Tạo nhiều PREVIEW ứng viên background (song song), lưu thumbnail để chọn.
//   MESHY_KEY=xxx node scripts/meshy_explore.mjs
// Kết quả: /tmp/meshy/cand-<n>.png (thumbnail) + in ra preview_task_id để refine.

import { writeFile, mkdir } from "node:fs/promises";

const KEY = process.env.MESHY_KEY;
if (!KEY) {
  console.error("Thiếu MESHY_KEY");
  process.exit(1);
}
const BASE = "https://api.meshy.ai/openapi/v2/text-to-3d";
const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const NEG =
  "people, human, person, character, face, text, letters, words, watermark, " +
  "clutter, messy, floating disconnected parts, low quality, deformed";

const CANDS = [
  {
    id: 1,
    prompt:
      "A highly detailed ornate graduation ceremony stage backdrop wall, intricately carved " +
      "golden classical columns with fluting and acanthus capitals, richly draped royal blue " +
      "velvet curtains with gold tassels, embroidery and fringe, laurel garlands, a central " +
      "ornamental emblem with a graduation mortarboard cap, decorative moldings and reliefs, " +
      "prestigious grand and dignified, intricate ornamentation, symmetrical, front facing, tall.",
  },
  {
    id: 2,
    prompt:
      "An opulent graduation hall stage set, grand proscenium arch with gilded baroque ornaments " +
      "and reliefs, deep royal blue velvet drapery with golden fringe and tassels, ornate " +
      "Corinthian columns, flower garlands, ribbons and laurel wreaths, decorative balustrade, " +
      "warm ceremonial mood, extremely detailed, luxurious, symmetrical, front facing, tall backdrop.",
  },
  {
    id: 3,
    prompt:
      "A luxurious festive graduation backdrop, tall golden triumphal arch with intricate carved " +
      "reliefs and laurel wreaths, royal blue and gold banners with embroidery, garlands of " +
      "flowers, elegant decorative ornamentation everywhere, celebratory yet grand and dignified, " +
      "highly detailed, symmetrical, front facing, vertical backdrop wall.",
  },
];

async function post(body) {
  const r = await fetch(BASE, { method: "POST", headers, body: JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`POST ${r.status}: ${t}`);
  return JSON.parse(t).result;
}
async function get(id) {
  const r = await fetch(`${BASE}/${id}`, { headers });
  const t = await r.text();
  if (!r.ok) throw new Error(`GET ${r.status}: ${t}`);
  return JSON.parse(t);
}
async function poll(id) {
  for (;;) {
    const t = await get(id);
    if (t.status === "SUCCEEDED") return t;
    if (t.status === "FAILED" || t.status === "CANCELED")
      throw new Error(`${id} ${t.status}`);
    await new Promise((s) => setTimeout(s, 5000));
  }
}

await mkdir("/tmp/meshy", { recursive: true });

console.log("Submitting", CANDS.length, "preview candidates…");
const submitted = [];
for (const c of CANDS) {
  const taskId = await post({
    mode: "preview",
    prompt: c.prompt,
    negative_prompt: NEG,
    art_style: "realistic",
    ai_model: "meshy-5",
    should_remesh: true,
    topology: "triangle",
    target_polycount: 200000,
  });
  console.log(`  cand-${c.id} → ${taskId}`);
  submitted.push({ ...c, taskId });
}

console.log("Polling…");
const results = await Promise.all(
  submitted.map(async (s) => {
    try {
      const done = await poll(s.taskId);
      let saved = null;
      if (done.thumbnail_url) {
        const png = Buffer.from(await (await fetch(done.thumbnail_url)).arrayBuffer());
        saved = `/tmp/meshy/v2-${s.id}.png`;
        await writeFile(saved, png);
      }
      return { id: s.id, taskId: s.taskId, thumb: saved, glb: done.model_urls?.glb };
    } catch (e) {
      return { id: s.id, taskId: s.taskId, error: String(e) };
    }
  })
);

console.log("\n=== KẾT QUẢ ===");
for (const r of results) {
  console.log(JSON.stringify(r));
}
