export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    try {

      // ==========================
      // GET CUSTOM
      // ==========================
      if (path === "/api/settings/custom" && method === "GET") {
        const row = await env.BMT_DB
          .prepare(`SELECT value, meta_user, meta_time
                    FROM settings
                    WHERE key='custom_message' LIMIT 1`)
          .first();

        return json({
          message: row?.value || "",
          user: row?.meta_user || "",
          time: row?.meta_time || ""
        });
      }

      // ==========================
      // POST CUSTOM
      // ==========================
      if (path === "/api/settings/custom" && method === "POST") {
        const b = await request.json();

        await env.BMT_DB.prepare(`
          INSERT OR REPLACE INTO settings
          (key, value, meta_user, meta_time)
          VALUES ('custom_message', ?, ?, ?)
        `).bind(
          b.message || "",
          b.user || "",
          b.time || ""
        ).run();

        return json({ ok: true });
      }

      // ==========================
      // GET STICKY
      // ==========================
      if (path === "/api/settings/sticky" && method === "GET") {
        const row = await env.BMT_DB
          .prepare(`SELECT value, meta_user, meta_time
                    FROM settings
                    WHERE key='sticky_message' LIMIT 1`)
          .first();

        return json({
          message: row?.value || "",
          user: row?.meta_user || "",
          time: row?.meta_time || ""
        });
      }

      // ==========================
      // POST STICKY
      // ==========================
      if (path === "/api/settings/sticky" && method === "POST") {
        const b = await request.json();

        await env.BMT_DB.prepare(`
          INSERT OR REPLACE INTO settings
          (key, value, meta_user, meta_time)
          VALUES ('sticky_message', ?, ?, ?)
        `).bind(
          b.message || "",
          b.user || "",
          b.time || ""
        ).run();

        return json({ ok: true });
      }

      return json({ error: "Not Found" }, 404);

    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json;charset=UTF-8"
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: cors()
  });
}
