const path = require("path");
const fs = require("fs");
const express = require("express");
const FormData = require("form-data");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

// Supabase admin client (server-side only; requires service role key).
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const OUTFIT_PORT = parseInt(process.env.OUTFIT_PORT || "8000", 10);
const OUTFIT_API_URL = `http://127.0.0.1:${OUTFIT_PORT}`;
const OUTFIT_MODEL_DIR = path.join(__dirname, "outfit_model");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url,
  options = {},
  retries = 6,
  baseDelayMs = 1500,
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status >= 500 && attempt < retries) {
        const delay = baseDelayMs * Math.pow(1.5, attempt);
        console.warn(
          `[retry] ${url} returned ${res.status}, retrying in ${Math.round(delay)}ms... (${attempt + 1}/${retries})`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err) {
      const isConnRefused =
        err?.cause?.code === "ECONNREFUSED" || err?.code === "ECONNREFUSED";
      if (isConnRefused && attempt < retries) {
        const delay = baseDelayMs * Math.pow(1.5, attempt);
        console.warn(
          `[retry] Python API not ready (ECONNREFUSED), retrying in ${Math.round(delay)}ms... (${attempt + 1}/${retries})`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

function rewriteImageUrls(obj, nodeBaseUrl) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    obj.forEach((item) => rewriteImageUrls(item, nodeBaseUrl));
    return obj;
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (
      typeof val === "string" &&
      (key === "image" || key === "image_url" || key.endsWith("_url"))
    ) {
      // 1. If it's a localhost/127.0.0.1 Python static URL, rewrite it to use the current Node base URL
      const pyStaticMatch = val.match(
        /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+(\/static\/.+)$/,
      );
      if (pyStaticMatch) {
        obj[key] = `${nodeBaseUrl}${pyStaticMatch[1]}`;
        continue;
      }

      // 2. If it's an absolute path on disk, convert it to a /static/ URL
      if (val.startsWith("/") || (val.length > 2 && val[1] === ":")) {
        const normalized = val.replace(/\\/g, "/");
        const idx = normalized.indexOf("/outfit_model/");
        if (idx !== -1) {
          obj[key] =
            `${nodeBaseUrl}/static/${normalized.substring(idx + "/outfit_model/".length)}`;
          continue;
        }
      }
    } else if (typeof val === "object") {
      rewriteImageUrls(val, nodeBaseUrl);
    }
  }
  return obj;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function formDataToBuffer(form) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    form.on("data", (chunk) =>
      chunks.push(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "binary"),
      ),
    );
    form.on("error", reject);
    form.on("end", () => resolve(Buffer.concat(chunks)));
    form.resume();
  });
}

const bucketFor = (cat) => {
  const c = String(cat || "").toLowerCase();
  if (
    [
      "tshirt",
      "shirt",
      "top",
      "dress",
      "sweater",
      "jacket",
      "coat",
      "hoodie",
      "blouse",
    ].includes(c)
  )
    return "tshirts";
  if (["pants", "jeans", "trouser", "trousers", "shorts", "skirt"].includes(c))
    return "jeans";
  if (["shoes", "shoe", "sneaker", "sneakers", "boot", "boots"].includes(c))
    return "shoes";
  if (c === "watch") return "watches";
  if (["cap", "hat"].includes(c)) return "caps";
  if (c === "bag") return "bags";
  if (c === "belt") return "caps";
  return "tshirts";
};

// ---------------------------------------------------------------------------
// POST /api/profile/upload-wardrobe
// ---------------------------------------------------------------------------
router.post("/upload-wardrobe", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "missing image file" });

    const userId = req.body.user_id || "default_user";
    const useImagen = req.body.use_imagen || "false";

    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname || "image.jpg",
      contentType: req.file.mimetype || "image/jpeg",
    });
    form.append("user_id", userId);
    form.append("use_imagen", useImagen);

    const headers = form.getHeaders();
    const body = await formDataToBuffer(form);
    headers["Content-Length"] = String(body.length);

    const response = await fetchWithRetry(`${OUTFIT_API_URL}/upload-outfit`, {
      method: "POST",
      body,
      headers,
    });
    console.log(`[wardrobe] Python API response status: ${response.status}`);
    const result = await response.json();
    console.log(`[wardrobe] Python API result:`, result);
    if (!response.ok) return res.status(response.status).json(result);
    res.json(result);
  } catch (err) {
    console.error("upload-wardrobe error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/profile/job/:jobId
// ---------------------------------------------------------------------------
router.get("/job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const response = await fetchWithRetry(
      `${OUTFIT_API_URL}/job/${encodeURIComponent(jobId)}`,
    );
    const result = await response.json();
    const nodeBase = `${req.protocol}://${req.get("host")}`;
    rewriteImageUrls(result, nodeBase);
    res.status(response.status).json(result);
  } catch (err) {
    console.error("job-status error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/profile/wardrobe/:userId
// ---------------------------------------------------------------------------
router.get("/wardrobe/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    let { data, error } = await supabaseAdmin
      .from("wardrobe_items")
      .select("item_id,category,image_url,attributes,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error)
      return res
        .status(500)
        .json({ success: false, error: error.message || String(error) });

    // If Supabase is empty, try to trigger a sync from local JSON (best effort)
    if (!data || data.length === 0) {
      try {
        const pySyncUrl = `${OUTFIT_API_URL}/sync-wardrobe?user_id=${encodeURIComponent(userId)}`;
        const pyRes = await fetch(pySyncUrl, { method: "POST" });
        if (pyRes.ok) {
          // Re-fetch from Supabase after sync
          const { data: newData, error: newError } = await supabaseAdmin
            .from("wardrobe_items")
            .select("item_id,category,image_url,attributes,created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
          if (!newError && newData) data = newData;
        }
      } catch (e) {
        console.warn(`[wardrobe] auto-sync failed for ${userId}:`, e.message);
      }
    }

    const items = Array.isArray(data) ? data : [];
    const wardrobe = {
      tshirts: [],
      jeans: [],
      shoes: [],
      watches: [],
      caps: [],
      bags: [],
    };

    for (const row of items) {
      const attrs =
        row.attributes && typeof row.attributes === "object"
          ? row.attributes
          : {};
      const imageUrl = (row.image_url || "").trim();
      const finalImage =
        imageUrl ||
        (typeof attrs.image_url === "string" ? attrs.image_url : "") ||
        (typeof attrs.image === "string" ? attrs.image : "") ||
        "";

      if (finalImage) {
        attrs.image = finalImage;
        attrs.image_url = imageUrl;
      }

      wardrobe[bucketFor(row.category)].push({
        id: row.item_id,
        category: row.category,
        image: finalImage,
        color: attrs.color || "unknown",
        pattern: attrs.pattern || "unknown",
        attributes: attrs,
        added_at: row.created_at,
      });
    }

    const nodeBase = `${req.protocol}://${req.get("host")}`;
    rewriteImageUrls({ wardrobe }, nodeBase);
    res.status(200).json({ success: true, wardrobe });
  } catch (err) {
    console.error("wardrobe-fetch error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/profile/wardrobe/:userId/item/:itemId
// Removes a single item from Supabase and cleans up the vector file.
// ---------------------------------------------------------------------------
router.delete("/wardrobe/:userId/item/:itemId", async (req, res) => {
  try {
    const { userId, itemId } = req.params;

    if (!userId || !itemId) {
      return res
        .status(400)
        .json({ success: false, error: "missing userId or itemId" });
    }

    // ── 1. Fetch the item so we know the image_url before deleting ─────────
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("wardrobe_items")
      .select("item_id, image_url, attributes")
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ success: false, error: "item not found" });
    }

    const imageUrl =
      existing.image_url ||
      (existing.attributes && existing.attributes.image) ||
      null;

    // ── 2. Delete from Supabase ────────────────────────────────────────────
    const { error: deleteErr } = await supabaseAdmin
      .from("wardrobe_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId);

    if (deleteErr) {
      console.error("supabase delete error", deleteErr);
      return res.status(500).json({
        success: false,
        error: deleteErr.message || String(deleteErr),
      });
    }

    // ── 3. Delete image file from disk (best-effort, local paths only) ─────
    // Cloudinary / external URLs are skipped — only local /static/... paths
    if (imageUrl && !imageUrl.startsWith("http")) {
      try {
        let absPath = imageUrl;
        // Convert /static/... URL to absolute path
        const staticMatch = imageUrl.match(/\/static\/(.+)$/);
        if (staticMatch) absPath = path.join(OUTFIT_MODEL_DIR, staticMatch[1]);
        if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
      } catch (e) {
        console.warn("could not delete image file (non-fatal):", e.message);
      }
    }

    // ── 4. Remove from vector file (best-effort) ───────────────────────────
    // This prevents the deleted item from ghost-matching future uploads.
    const vectorPath = path.join(
      OUTFIT_MODEL_DIR,
      "..",
      "wardrobe_vectors",
      `${userId}.json`,
    );
    if (fs.existsSync(vectorPath)) {
      try {
        const vectors = JSON.parse(fs.readFileSync(vectorPath, "utf8")) || [];
        const filename = imageUrl
          ? path.basename(imageUrl.replace(/\\/g, "/"))
          : null;
        const filtered = filename
          ? vectors.filter(
              (v) =>
                !String(v.image_path || "")
                  .replace(/\\/g, "/")
                  .endsWith(filename),
            )
          : vectors;
        fs.writeFileSync(vectorPath, JSON.stringify(filtered, null, 2), "utf8");
      } catch (e) {
        console.warn("could not update vector file (non-fatal):", e.message);
      }
    }

    console.log(`[wardrobe] deleted item ${itemId} for user ${userId}`);
    res.json({ success: true, deleted: itemId });
  } catch (err) {
    console.error("delete-item error", err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/profile/segmented/:userId
// ---------------------------------------------------------------------------
router.get("/segmented/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    if (!/^[\w-]+$/.test(userId))
      return res.status(400).json({ error: "invalid user id" });

    const segDir = path.join(
      OUTFIT_MODEL_DIR,
      "uploads",
      `${userId}_segmented`,
    );
    if (!fs.existsSync(segDir)) return res.json({ success: true, items: [] });

    const files = fs
      .readdirSync(segDir)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
    const nodeBase = `${req.protocol}://${req.get("host")}`;
    const items = files.map((file) => {
      const name = path.parse(file).name;
      const parts = name.match(/^(.+?)_(\d+)$/);
      return {
        id: name,
        image: `${nodeBase}/static/uploads/${userId}_segmented/${file}`,
        category: parts ? parts[1] : name,
        filename: file,
      };
    });
    res.json({ success: true, items });
  } catch (err) {
    console.error("segmented-fetch error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/profile/wardrobe/:userId/summary
// ---------------------------------------------------------------------------
router.get("/wardrobe/:userId/summary", async (req, res) => {
  try {
    const { userId } = req.params;
    const response = await fetchWithRetry(
      `${OUTFIT_API_URL}/wardrobe/${encodeURIComponent(userId)}/summary`,
    );
    const result = await response.json();
    res.status(response.status).json(result);
  } catch (err) {
    console.error("wardrobe-summary error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

module.exports = router;
