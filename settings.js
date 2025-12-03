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
      // SETTINGS CUSTOM GET
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
      // SETTINGS CUSTOM POST
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
      // SETTINGS STICKY GET
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
      // SETTINGS STICKY POST
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

      // ==========================
      // BONUS: STOK KELUAR
      // ==========================
      if (path === "/api/bonus/stok_keluar" && method === "GET") {
        const rows = await env.BMT_DB
          .prepare(`SELECT * FROM stok_keluar ORDER BY created_at DESC`)
          .all();

        return json({ items: rows.results || [] });
      }

      if (path === "/api/bonus/stok_keluar/filter" && method === "GET") {
        const user  = url.searchParams.get("user")  || "";
        const start = url.searchParams.get("start") || "";
        const end   = url.searchParams.get("end")   || "";

        let sql = `SELECT * FROM stok_keluar WHERE 1=1`;
        const params = [];

        if (user) {
          sql += ` AND dibuat_oleh = ?`;
          params.push(user);
        }

        if (start) {
          sql += ` AND DATE(created_at) >= DATE(?)`;
          params.push(start);
        }

        if (end) {
          sql += ` AND DATE(created_at) <= DATE(?)`;
          params.push(end);
        }

        sql += ` ORDER BY created_at DESC`;

        const rows = await env.BMT_DB.prepare(sql).bind(...params).all();

        return json({ items: rows.results || [] });
      }

      if (path === "/api/bonus/riwayat" && method === "GET") {
        const user = url.searchParams.get("user") || "";

        const rows = await env.BMT_DB.prepare(`
          SELECT * FROM bonus_riwayat
          WHERE username = ?
          ORDER BY id DESC
        `).bind(user).all();

        return json({ items: rows.results || [] });
      }

      if (path === "/api/bonus/achieved" && method === "POST") {
        const b = await request.json();

        if (!b.username || !b.tanggal || !b.nilai) {
          return json({ error: "username, tanggal, nilai required" }, 400);
        }

        await env.BMT_DB.prepare(`
          INSERT INTO bonus_riwayat(username, tanggal, nilai, status, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).bind(
          b.username,
          b.tanggal,
          Number(b.nilai || 0),
          b.status || "belum"
        ).run();

        return json({ ok: true });
      }

      if (path === "/api/bonus/status" && method === "POST") {
        const b = await request.json();

        if (!b.id || !b.status) {
          return json({ error: "id & status required" }, 400);
        }

        await env.BMT_DB.prepare(`
          UPDATE bonus_riwayat
          SET status = ?
          WHERE id = ?
        `).bind(b.status, b.id).run();

        return json({ ok: true });
      }

      // ==================================
      //  KATALOG – CREATE (POST)
      // ==================================
      if (path === "/api/katalog" && method === "POST") {
        const b = await request.json();
        if (!b || !Array.isArray(b.items))
          return json({ error:"items[] required" }, 400);

        // Ambil counter ID Katalog
        let counterRow = await env.BMT_DB
          .prepare(`SELECT value FROM settings WHERE key='katalog_counter' LIMIT 1`)
          .first();

        let counter = counterRow ? Number(counterRow.value) : 0;
        counter++;

        // Simpan counter kembali
        await env.BMT_DB.prepare(`
          INSERT OR REPLACE INTO settings(key, value)
          VALUES ('katalog_counter', ?)
        `).bind(counter).run();

        // ID katalog baru
        const id = "Katalog-" + counter;

        // Simpan katalog
        await env.BMT_DB.prepare(`
          INSERT INTO katalog(id_katalog, items, created_at)
          VALUES(?,?,datetime('now'))
        `).bind(id, JSON.stringify(b.items)).run();

        return json({ ok:true, id_katalog:id });
      }

      // ==================================
      //  KATALOG – GET BY ID
      // ==================================
      if (path.startsWith("/api/katalog/") && method === "GET") {
        const id = path.split("/").pop();

        const row = await env.BMT_DB.prepare(`
          SELECT * FROM katalog WHERE id_katalog=? LIMIT 1
        `).bind(id).first();

        if (!row) return json({ error:"not found" }, 404);

        let items = [];
        try { items = JSON.parse(row.items); } catch {}

        return json({ id_katalog:id, items });
      }

      // ==================================
      //  KATALOG – LIST SEMUA
      // ==================================
      if (path === "/api/katalog_list" && method === "GET") {
        const rows = await env.BMT_DB
          .prepare(`SELECT id_katalog, items, created_at 
                    FROM katalog 
                    ORDER BY created_at DESC`)
          .all();

        return json({ items: rows.results || [] });
      }

      // ==================================
      //  KATALOG – DELETE
      // ==================================
      if (path.startsWith("/api/katalog/") && method === "DELETE") {
        const id = path.split("/").pop();

        await env.BMT_DB
          .prepare(`DELETE FROM katalog WHERE id_katalog = ?`)
          .bind(id)
          .run();

        return json({ ok: true });
      }

      // ==========================
      // FALLBACK
      // ==========================
      return json({ error: "Not Found" }, 404);

    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
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