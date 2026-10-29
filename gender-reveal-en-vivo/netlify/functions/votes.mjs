// Votación compartida del gender reveal.
// GET  /api/votes  -> marcador público { nina: [nombres], nino: [nombres], closed, closeAt }
// POST /api/votes  -> { id, name, team } registra o actualiza el voto de ese teléfono
import { getStore } from "@netlify/blobs";

const CLOSE_AT = process.env.CLOSE_AT || "2026-11-15T14:00:00-06:00"; // cierre de la votación (hora CDMX)
const TEAMS = new Set(["nina", "nino"]);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const isClosed = () => Date.now() >= Date.parse(CLOSE_AT);

export async function readAll(store) {
  const { blobs } = await store.list({ prefix: "v/" });
  const rows = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return rows.filter(Boolean).sort((a, b) => a.ts - b.ts);
}

const tally = (rows) => ({
  nina: rows.filter((r) => r.team === "nina").map((r) => r.name),
  nino: rows.filter((r) => r.team === "nino").map((r) => r.name),
  closed: isClosed(),
  closeAt: CLOSE_AT,
});

export default async (req) => {
  const store = getStore({ name: "votos", consistency: "strong" });

  if (req.method === "GET") return json(tally(await readAll(store)));

  if (req.method === "POST") {
    if (isClosed()) return json({ error: "closed", ...tally(await readAll(store)) }, 403);
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    const id = String(body.id || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
    const name = String(body.name || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
    const team = String(body.team || "");
    if (id.length < 8 || !name || !TEAMS.has(team)) return json({ error: "invalid" }, 400);
    const key = "v/" + id;
    const prev = await store.get(key, { type: "json" });
    await store.setJSON(key, { id, name, team, ts: prev ? prev.ts : Date.now(), updated: Date.now() });
    return json(tally(await readAll(store)));
  }

  return json({ error: "method" }, 405);
};

export const config = { path: "/api/votes" };
