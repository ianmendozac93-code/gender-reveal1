// Panel privado: requiere la clave ADMIN_KEY (variable de entorno en Netlify).
// GET    /api/admin          -> lista completa de votos
// DELETE /api/admin?id=...   -> borra un voto
import { getStore } from "@netlify/blobs";
import { readAll } from "./votes.mjs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default async (req) => {
  const ADMIN_KEY = process.env.ADMIN_KEY;
  if (!ADMIN_KEY) return json({ error: "no_admin_key" }, 503);
  if (req.headers.get("x-admin-key") !== ADMIN_KEY) return json({ error: "unauthorized" }, 401);

  const store = getStore({ name: "votos", consistency: "strong" });
  if (req.method === "GET") return json({ votes: await readAll(store) });
  if (req.method === "DELETE") {
    const id = (new URL(req.url).searchParams.get("id") || "").replace(/[^a-zA-Z0-9-]/g, "");
    if (!id) return json({ error: "invalid" }, 400);
    await store.delete("v/" + id);
    return json({ ok: true, votes: await readAll(store) });
  }
  return json({ error: "method" }, 405);
};

export const config = { path: "/api/admin" };
