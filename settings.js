export default {
  async fetch(request, env) {

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    try {

      /* ==========================
         SETTINGS CUSTOM GET
      ========================== */
      if (path === "/api/settings/custom" && method === "GET") {
        const row = await env.BMT_DB.prepare(`
          SELECT value, meta_user, meta_time
          FROM settings
          WHERE key='custom_message' LIMIT 1
        `).first();

        return json({
          message: row?.value || "",
          user: row?.meta_user || "",
          time: row?.meta_time || ""
        });
      }

      /* ==========================
         SETTINGS CUSTOM POST
      ========================== */
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

      /* ==========================
         SETTINGS STICKY GET
      ========================== */
      if (path === "/api/settings/sticky" && method === "GET") {
        const row = await env.BMT_DB.prepare(`
          SELECT value, meta_user, meta_time
          FROM settings
          WHERE key='sticky_message' LIMIT 1
        `).first();

        return json({
          message: row?.value || "",
          user: row?.meta_user || "",
          time: row?.meta_time || ""
        });
      }

      /* ==========================
         SETTINGS STICKY POST
      ========================== */
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

      /* ==========================
         BONUS: STOK KELUAR LIST
      ========================== */
      if (path === "/api/bonus/stok_keluar" && method === "GET") {
        const rows = await env.BMT_DB.prepare(`
          SELECT * FROM stok_keluar ORDER BY created_at DESC
        `).all();

        return json({ items: rows.results || [] });
      }

      /* ==========================
         BONUS FILTER
      ========================== */
      if (path === "/api/bonus/stok_keluar/filter" && method === "GET") {
        const user  = url.searchParams.get("user")  || "";
        const start = url.searchParams.get("start") || "";
        const end   = url.searchParams.get("end")   || "";

        let sql = `SELECT * FROM stok_keluar WHERE 1=1`;
        const params = [];

        if (user) { sql += ` AND dibuat_oleh=?`; params.push(user); }
        if (start){ sql += ` AND DATE(created_at)>=DATE(?)`; params.push(start); }
        if (end)  { sql += ` AND DATE(created_at)<=DATE(?)`; params.push(end); }

        sql += ` ORDER BY created_at DESC`;

        const rows = await env.BMT_DB.prepare(sql).bind(...params).all();
        return json({ items: rows.results || [] });
      }

      /* ==========================
         BONUS RIWAYAT
      ========================== */
      if (path === "/api/bonus/riwayat" && method === "GET") {
        const user = url.searchParams.get("user") || "";

        const rows = await env.BMT_DB.prepare(`
          SELECT * FROM bonus_riwayat
          WHERE username=?
          ORDER BY id DESC
        `).bind(user).all();

        return json({ items: rows.results || [] });
      }

      /* ==========================
         BONUS ACHIEVED POST
      ========================== */
      if (path === "/api/bonus/achieved" && method === "POST") {
        const b = await request.json();
        if (!b.username || !b.tanggal || !b.nilai)
          return json({ error:"username, tanggal, nilai required" }, 400);

        await env.BMT_DB.prepare(`
          INSERT INTO bonus_riwayat(username,tanggal,nilai,status,created_at)
          VALUES(?,?,?,?,datetime('now'))
        `).bind(
          b.username,
          b.tanggal,
          Number(b.nilai||0),
          b.status || "belum"
        ).run();

        return json({ ok:true });
      }

      /* ==========================
         BONUS UPDATE STATUS
      ========================== */
      if (path === "/api/bonus/status" && method === "POST") {
        const b = await request.json();
        if (!b.id || !b.status)
          return json({ error:"id & status required" }, 400);

        await env.BMT_DB.prepare(`
          UPDATE bonus_riwayat SET status=? WHERE id=?
        `).bind(b.status, b.id).run();

        return json({ ok:true });
      }

      /* ==========================
         KATALOG: UPDATE NAMA
      ========================== */
      if (path.startsWith("/api/katalog_name/") && method === "PUT") {
        const id = path.split("/").pop();
        const b = await request.json();

        if (!b.nama_katalog)
          return json({ error:"nama_katalog required" }, 400);

        await env.BMT_DB.prepare(`
          UPDATE katalog SET nama_katalog=? WHERE id_katalog=?
        `).bind(b.nama_katalog, id).run();

        return json({ ok:true });
      }

      /* ==========================
         KATALOG CREATE (WITH nama_katalog)
      ========================== */
      if (path === "/api/katalog" && method === "POST") {
        const b = await request.json();
        if (!b || !Array.isArray(b.items))
          return json({ error:"items[] required" }, 400);

        const namaK = b.nama_katalog || "Katalog Baru";

        // Counter
        let counterRow = await env.BMT_DB
          .prepare(`SELECT value FROM settings WHERE key='katalog_counter' LIMIT 1`)
          .first();

        let counter = counterRow ? Number(counterRow.value) : 0;
        counter++;

        await env.BMT_DB.prepare(`
          INSERT OR REPLACE INTO settings(key,value)
          VALUES('katalog_counter',?)
        `).bind(counter).run();

        const id = "Katalog-" + counter;

        await env.BMT_DB.prepare(`
          INSERT INTO katalog(id_katalog, items, nama_katalog, created_at)
          VALUES(?,?,?,datetime('now'))
        `).bind(
          id,
          JSON.stringify(b.items),
          namaK
        ).run();

        return json({ ok:true, id_katalog:id });
      }

      /* ==========================
         KATALOG GET BY ID
      ========================== */
      if (path.startsWith("/api/katalog/") && method === "GET") {
        const id = path.split("/").pop();

        const row = await env.BMT_DB.prepare(`
          SELECT * FROM katalog WHERE id_katalog=? LIMIT 1
        `).bind(id).first();

        if (!row) return json({ error:"not found" }, 404);

        let items=[];
        try{ items = JSON.parse(row.items); } catch{}

        return json({
          id_katalog:id,
          nama_katalog: row.nama_katalog || "",
          items
        });
      }

      /* ==========================
         KATALOG LIST (with nama)
      ========================== */
      if (path === "/api/katalog_list" && method === "GET") {
        const rows = await env.BMT_DB.prepare(`
          SELECT id_katalog, nama_katalog, created_at
          FROM katalog
          ORDER BY created_at DESC
        `).all();

        return json({ items: rows.results || [] });
      }

      /* ==========================
         KATALOG DELETE
      ========================== */
      if (path.startsWith("/api/katalog/") && method === "DELETE") {
        const id = path.split("/").pop();

        await env.BMT_DB.prepare(`
          DELETE FROM katalog WHERE id_katalog=?
        `).bind(id).run();

        return json({ ok:true });
      }

/* ==========================
   BONUS PROGRESS GET
========================== */
if (path.startsWith("/api/bonus/progress/") && method === "GET") {
  const username = path.split("/").pop();

  const row = await env.BMT_DB.prepare(`
    SELECT progress FROM bonus_progress
    WHERE username=? LIMIT 1
  `).bind(username).first();

  return json({ progress: Number(row?.progress || 0) });
}
/* ==========================
   BONUS PROGRESS UPDATE
========================== */
if (path === "/api/bonus/progress" && method === "POST") {
  const b = await request.json();

  if (!b.username)
    return json({ error:"username required" }, 400);

  const prog = Number(b.progress || 0);

  await env.BMT_DB.prepare(`
    INSERT INTO bonus_progress(username, progress, updated_at)
    VALUES(?,?,datetime('now'))
    ON CONFLICT(username)
    DO UPDATE SET progress=excluded.progress, updated_at=datetime('now')
  `).bind(b.username, prog).run();

  return json({ ok:true });
}
/* ==========================
   LAPORAN HARIAN — LIST
   GET /api/laporan_harian/list
========================== */
if (path === "/api/laporan_harian/list" && method === "GET") {

  const rows = await env.BMT_DB.prepare(`
    SELECT *
    FROM laporan_harian
    ORDER BY tanggal DESC
  `).all();

  return json({ items: rows.results || [] });
}

// ============================================================
//  SAVE LAPORAN HARIAN
// ============================================================
if (path === "/api/laporan/harian" && method === "POST") {
  return laporanHarianSave(env, request);
}

async function laporanHarianSave(env, request) {
  try {
    const body = await request.json();

    const {
      tanggal,
      penjualan_cash,
      penjualan_transfer,
      pengeluaran,
      uang_angin,
      charge_servis
    } = body;

    // wajib untuk NOT NULL
    const created_at = new Date().toISOString();

    // PATCH: INSERT ATAU UPDATE JIKA TANGGAL SUDAH ADA
    await env.BMT_DB.prepare(`
      INSERT INTO laporan_harian
      (tanggal, penjualan_cash, penjualan_transfer, pengeluaran, uang_angin, charge_servis, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tanggal)
      DO UPDATE SET
        penjualan_cash     = excluded.penjualan_cash,
        penjualan_transfer = excluded.penjualan_transfer,
        pengeluaran        = excluded.pengeluaran,
        uang_angin         = excluded.uang_angin,
        charge_servis      = excluded.charge_servis,
        created_at         = excluded.created_at
    `).bind(
      tanggal,
      penjualan_cash,
      penjualan_transfer,
      pengeluaran,
      uang_angin,
      charge_servis,
      created_at
    ).run();

    return json({ ok: true });

  } catch (err) {
    return json({ error: err.toString() }, 500);
  }
}

/* ==========================
   INVOICE — CREATE
   POST /api/invoice/create
========================== */
if (path === "/api/invoice/create" && method === "POST") {
  const b = await request.json();

  // Validation minimal
  if (!b.tanggal_invoice || !b.nilai_invoice || !b.keterangan || !b.tanggal_jatuh_tempo) {
    return json({ error: "Semua field wajib diisi" }, 400);
  }

  await env.BMT_DB.prepare(`
    INSERT INTO invoice (tanggal_invoice, nilai_invoice, keterangan, tanggal_jatuh_tempo, status)
    VALUES (?, ?, ?, ?, 'unpaid')
  `)
  .bind(
    b.tanggal_invoice,
    Number(b.nilai_invoice || 0),
    b.keterangan,
    b.tanggal_jatuh_tempo
  )
  .run();

  return json({ ok: true });
}


/* ==========================
   INVOICE — LIST
   GET /api/invoice/list
========================== */
if (path === "/api/invoice/list" && method === "GET") {

  const rows = await env.BMT_DB.prepare(`
    SELECT id, tanggal_invoice, nilai_invoice, keterangan, tanggal_jatuh_tempo, status
    FROM invoice
    ORDER BY id DESC
  `).all();

  return json({ items: rows.results || [] });
}


/* ==========================
   INVOICE — UPDATE STATUS
   POST /api/invoice/update-status/:id
========================== */
if (path.startsWith("/api/invoice/update-status/") && method === "POST") {
  const id = path.split("/").pop();

  const result = await env.BMT_DB.prepare(`
    UPDATE invoice
    SET status='paid'
    WHERE id=? AND status='unpaid'
  `)
  .bind(id)
  .run();

  // Tidak boleh toggle 2x
  if (result.changed === 0) {
    return json({ error: "Tidak dapat mengubah status (mungkin sudah paid)" }, 400);
  }

  return json({ ok: true });
}
/* ==========================
   AUTH — UPDATE LAST LOGIN
   POST /api/users/last-login
========================== */
if (path === "/api/users/last-login" && method === "POST") {
  const b = await request.json();
  if (!b.username)
    return json({ error:"username required" }, 400);

  await env.BMT_DB.prepare(`
    UPDATE users
    SET last_login = datetime('now')
    WHERE username = ?
  `).bind(b.username).run();

  return json({ ok:true });
}
/* ==========================
   USERS — GET LAST LOGIN
   GET /api/users/last-login/:username
========================== */
if (path.startsWith("/api/users/last-login/") && method === "GET") {
  const username = path.split("/").pop();

  const row = await env.BMT_DB.prepare(`
    SELECT last_login
    FROM users
    WHERE username=?
    LIMIT 1
  `).bind(username).first();

  return json({
    last_login: row?.last_login || null
  });
}

/* ==========================
   RIWAYAT PREVIEW (FINAL)
   GET /api/riwayat_preview
========================== */
if (path === "/api/riwayat_preview" && method === "GET") {
  const limit  = Number(url.searchParams.get("limit") || 10);
  const offset = Number(url.searchParams.get("offset") || 0);

  // 1. Ambil transaksi unik (1 kartu = 1 transaksi_id)
  const heads = await env.BMT_DB.prepare(`
    SELECT transaksi_id, MIN(created_at) AS waktu
    FROM riwayat
    GROUP BY transaksi_id
    ORDER BY waktu DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  const items = [];

  for (const h of (heads.results || [])) {
    const tid = h.transaksi_id;

    // 2. Ambil semua baris riwayat untuk transaksi ini
    const rows = await env.BMT_DB.prepare(`
      SELECT *
      FROM riwayat
      WHERE transaksi_id=?
      ORDER BY created_at ASC
    `).bind(tid).all();

    const list = rows.results || [];

    if (!list.length) continue;

    // pembuat (ambil pertama yang ada)
    const dibuat_oleh =
      list.find(x => x.dibuat_oleh)?.dibuat_oleh || "Admin";

    // tipe kartu (berdasarkan prefix ID, SAMA seperti frontend lama)
    let tipe = "penjualan";
    if (tid.startsWith("SRV-")) tipe = "servis";
    else if (tid.startsWith("AUD-")) tipe = "audit";
    else if (tid.startsWith("MSK-")) tipe = "masuk";

    let total = 0;
    const preview = [];

    // === SERVIS ===
    const servisRows = list.filter(x => x.tipe === "servis");
    const totalServis = servisRows.reduce(
      (a,b)=>a+Number(b.harga||0), 0
    );
    if (totalServis > 0) {
      preview.push(`Servis ${totalServis}`);
      total += totalServis;
    }

    // === CHARGE ===
    const chargeRows = list.filter(x => x.tipe === "charge");
    const totalCharge = chargeRows.reduce(
      (a,b)=>a+Number(b.harga||0), 0
    );
    if (totalCharge > 0) {
      preview.push(`Charge ${totalCharge}`);
      total += totalCharge;
    }

    // === BARANG / PENJUALAN ===
    const barangRows = list.filter(x => x.tipe === "keluar");
    const totalBarang = barangRows.reduce(
      (a,b)=>a + (Number(b.jumlah||0) * Number(b.harga||0)), 0
    );
    if (totalBarang > 0) {
      preview.push(`Barang ${totalBarang}`);
      total += totalBarang;
    }

    // === AUDIT (KHUSUS) ===
    if (tipe === "audit") {
      preview.length = 0;
      for (const r of list) {
        preview.push(
          `${r.barang_nama}: ${r.stok_lama} → ${r.stok_baru}`
        );
      }
    }

    items.push({
      transaksi_id: tid,
      waktu: h.waktu,
      tipe,
      dibuat_oleh,
      total,
      preview: preview.slice(0,3)
    });
  }

  return json({ items });
}

      /* ==========================
         FALLBACK
      ========================== */
      return json({ error: "Not Found" }, 404);

    } catch (err) {
      return json({ error:String(err) }, 500);
    }
  }
};

function cors(){
  return {
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type",
    "Content-Type":"application/json;charset=UTF-8"
  };
}

function json(data, status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:cors()
  });
}
