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
const FOLLOWS_STORE_PATH = path.join(__dirname, "data", "follows.json");
const CLERK_API_BASE = "https://api.clerk.com/v1";

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

function readFollowsStore() {
  try {
    if (!fs.existsSync(FOLLOWS_STORE_PATH)) return [];
    const raw = fs.readFileSync(FOLLOWS_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("[follows-store] read error:", e.message);
    return [];
  }
}

async function fetchClerkUserById(clerkId) {
  const secretRaw =
    process.env.CLERK_SECRET_KEY ||
    process.env.CLERK_API_KEY ||
    process.env.EXPO_CLERK_SECRET_KEY ||
    "";
  const secret = String(secretRaw).trim();
  if (!secret) {
    console.warn("[fetchClerkUserById] No Clerk API key configured");
    return null;
  }
  if (!clerkId) {
    console.warn("[fetchClerkUserById] No clerkId provided");
    return null;
  }
  try {
    const url = `${CLERK_API_BASE}/users/${encodeURIComponent(String(clerkId))}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!resp.ok) {
      console.warn(`[fetchClerkUserById] Clerk API returned ${resp.status} for user ${clerkId}`);
      return null;
    }
    const data = await resp.json();
    return data;
  } catch (err) {
    console.error(`[fetchClerkUserById] Error fetching user ${clerkId}:`, err.message);
    return null;
  }
}

function normalizeClerkUser(clerkUser) {
  if (!clerkUser || typeof clerkUser !== "object") return null;
  
  const firstName = clerkUser.first_name || "";
  const lastName = clerkUser.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim() || null;
  
  // Generate username from first/last name if not set
  let username = clerkUser.username || null;
  if (!username && (firstName || lastName)) {
    // Create username like "bhaviths.shetty" or just "bhaviths"
    username = firstName.toLowerCase();
    if (lastName) {
      username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    }
  }
  
  // Fallback: use email prefix if no name
  let email = null;
  if (clerkUser.email_addresses && Array.isArray(clerkUser.email_addresses) && clerkUser.email_addresses.length > 0) {
    email = clerkUser.email_addresses[0].email_address || clerkUser.email_addresses[0];
  } else if (clerkUser.primary_email_address?.email_address) {
    email = clerkUser.primary_email_address.email_address;
  }
  
  if (!username && email) {
    username = email.split("@")[0];
  }
  
  const profileImage = clerkUser.image_url || clerkUser.profile_image_url || null;
  
  const normalized = {
    clerk_id: clerkUser.id ? String(clerkUser.id) : null,
    username: username ? String(username) : null,
    full_name: fullName ? String(fullName) : null,
    profile_image_url: profileImage ? String(profileImage) : null,
    role: null,
    bio: null,
  };
  
  console.log(`[normalizeClerkUser] Normalized profile:`, normalized);
  return normalized;
}

function writeFollowsStore(rows) {
  try {
    const dir = path.dirname(FOLLOWS_STORE_PATH);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FOLLOWS_STORE_PATH, JSON.stringify(rows, null, 2), "utf8");
  } catch (e) {
    console.warn("[follows-store] write error:", e.message);
  }
}

function addFollowFallback(followerId, followingId) {
  const rows = readFollowsStore();
  const exists = rows.some(
    (r) =>
      String(r.follower_clerk_id) === String(followerId) &&
      String(r.following_clerk_id) === String(followingId),
  );
  if (!exists) {
    rows.push({
      follower_clerk_id: String(followerId),
      following_clerk_id: String(followingId),
      created_at: new Date().toISOString(),
    });
    writeFollowsStore(rows);
  }
}

function removeFollowFallback(followerId, followingId) {
  const rows = readFollowsStore();
  const filtered = rows.filter(
    (r) =>
      !(
        String(r.follower_clerk_id) === String(followerId) &&
        String(r.following_clerk_id) === String(followingId)
      ),
  );
  writeFollowsStore(filtered);
}

function isFollowingFallback(followerId, followingId) {
  const rows = readFollowsStore();
  return rows.some(
    (r) =>
      String(r.follower_clerk_id) === String(followerId) &&
      String(r.following_clerk_id) === String(followingId),
  );
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

    // Build form with only fields Python API expects
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname || "image.jpg",
      contentType: req.file.mimetype || "image/jpeg",
    });
    form.append("user_id", userId);
    // Note: do NOT include "use_imagen" - Python API doesn't use it

    const headers = form.getHeaders();
    const body = await formDataToBuffer(form);
    headers["Content-Length"] = String(body.length);

    const response = await fetchWithRetry(`${OUTFIT_API_URL}/upload-outfit`, {
      method: "POST",
      body,
      headers,
    }, 6, 1500);
    
    const result = await response.json();
    
    if (!response.ok) return res.status(response.status).json(result);
    res.json(result);
  } catch (err) {
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

// ---------------------------------------------------------------------------
// Profile Social + Search Endpoints
// ---------------------------------------------------------------------------

function getViewerUserId(req) {
  return (
    req.header("X-User-Id") ||
    req.header("x-user-id") ||
    req.query?.viewer_user_id ||
    null
  );
}

function normalizeProfileRow(row) {
  if (!row || typeof row !== "object") return null;

  const clerk_id =
    row.clerk_id ||
    row.clerkId ||
    row.user_clerk_id ||
    row.userId ||
    row.id ||
    null;

  const username =
    row.username ||
    row.user_name ||
    row.handle ||
    (typeof row.primary_handle === "string" ? row.primary_handle : null) ||
    null;

  const full_name =
    row.full_name ||
    row.fullName ||
    row.name ||
    row.display_name ||
    (typeof row.first_name === "string" || typeof row.last_name === "string"
      ? `${row.first_name || ""} ${row.last_name || ""}`.trim()
      : null) ||
    null;

  const profile_image_url =
    row.profile_image_url ||
    row.profileImageUrl ||
    row.avatar_url ||
    row.avatarUrl ||
    row.image_url ||
    row.imageUrl ||
    row.profileImage ||
    null;

  return {
    clerk_id: clerk_id ? String(clerk_id) : null,
    username: username ? String(username) : null,
    full_name: full_name ? String(full_name) : null,
    profile_image_url: profile_image_url ? String(profile_image_url) : null,
    role: row.role ? String(row.role) : null,
    bio: row.bio ? String(row.bio) : null,
  };
}

router.get("/public", async (req, res) => {
  try {
    const userId = req.query.user_id;
    console.log(`[profile/public] Fetching profile for user: ${userId}`);
    if (!userId) return res.status(400).json({ error: "missing user_id" });

    // Prefer querying Supabase profiles table (if present).
    try {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("clerk_id", userId)
        .maybeSingle();

      if (error) {
        console.warn(`[profile/public] Supabase query error: ${error.message}`);
        throw error;
      }
      
      if (data) {
        console.log(`[profile/public] Found profile in Supabase:`, data);
        const normalized = normalizeProfileRow(data);
        if (normalized?.clerk_id) return res.json(normalized);
      } else {
        console.warn(`[profile/public] No profile found in Supabase for user ${userId}`);
      }
    } catch (e) {
      console.warn("[profile/public] profiles table lookup failed:", e.message);
    }

    // Fallback to Clerk API for profile basics.
    console.log(`[profile/public] Attempting Clerk API lookup for user: ${userId}`);
    const clerkUser = await fetchClerkUserById(userId);
    if (clerkUser) {
      console.log(`[profile/public] Found user in Clerk:`, {
        id: clerkUser.id,
        user: clerkUser.user,
        first_name: clerkUser.first_name,
        last_name: clerkUser.last_name,
      });
      const clerkProfile = normalizeClerkUser(clerkUser);
      if (clerkProfile?.clerk_id) return res.json(clerkProfile);
    } else {
      console.warn(`[profile/public] User not found in Clerk: ${userId}`);
    }

    // Fallback if profiles table doesn't exist or doesn't have row yet.
    console.warn(`[profile/public] Returning minimal profile for user: ${userId}`);
    return res.json({
      clerk_id: String(userId),
      username: null,
      full_name: null,
      profile_image_url: null,
      role: null,
      bio: null,
    });
  } catch (err) {
    console.error("[profile/public] error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /api/profile/upsert
// Save or update user profile in Supabase
// ---------------------------------------------------------------------------
router.post("/upsert", async (req, res) => {
  try {
    const userId = getViewerUserId(req);
    if (!userId) return res.status(401).json({ error: "missing viewer user id" });

    const {
      clerk_id,
      username,
      full_name,
      profile_image_url,
      role,
      bio,
    } = req.body;

    if (!clerk_id) {
      return res.status(400).json({ error: "missing clerk_id" });
    }

    console.log(`[profile/upsert] Upserting profile for user: ${clerk_id}`);

    // Generate fallback username if not provided
    let finalUsername = username;
    if (!finalUsername) {
      if (full_name) {
        // Generate from full_name: lowercase, replace spaces with underscores
        finalUsername = full_name
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, "")
          .substring(0, 30);
      } else {
        // Fallback: use clerk_id prefix
        finalUsername = `user_${String(clerk_id).substring(0, 10)}`;
      }
    }

    // Use Supabase upsert to insert or update
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          clerk_id: String(clerk_id),
          username: String(finalUsername),
          full_name: full_name ? String(full_name) : null,
          profile_image_url: profile_image_url ? String(profile_image_url) : null,
          role: role ? String(role) : null,
          bio: bio ? String(bio) : null,
        },
        { onConflict: "clerk_id" }
      );

    if (error) {
      console.error(`[profile/upsert] Supabase error:`, error);
      throw error;
    }

    console.log(`[profile/upsert] Successfully upserted profile for ${clerk_id}`, {
      username: finalUsername,
      full_name: full_name || null,
    });
    res.json({ ok: true, profile: data });
  } catch (err) {
    console.error("[profile/upsert] error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: "missing user_id" });

    let followerIdsPrimary = [];
    let followingIdsPrimary = [];

    // Expected schema:
    // - follows table with columns: follower_clerk_id, following_clerk_id
    try {
      const { data, error } = await supabaseAdmin
        .from("follows")
        .select("follower_clerk_id")
        .eq("following_clerk_id", userId);
      if (error) throw error;
      followerIdsPrimary = (data || []).map((r) => r.follower_clerk_id).filter(Boolean);
    } catch (e) {
      console.warn("[profile/stats] followers count failed:", e.message);
    }

    try {
      const { data, error } = await supabaseAdmin
        .from("follows")
        .select("following_clerk_id")
        .eq("follower_clerk_id", userId);
      if (error) throw error;
      followingIdsPrimary = (data || []).map((r) => r.following_clerk_id).filter(Boolean);
    } catch (e) {
      console.warn("[profile/stats] following count failed:", e.message);
    }

    const rows = readFollowsStore();
    const followerIdsFallback = rows
      .filter((r) => String(r.following_clerk_id) === String(userId))
      .map((r) => r.follower_clerk_id)
      .filter(Boolean);
    const followingIdsFallback = rows
      .filter((r) => String(r.follower_clerk_id) === String(userId))
      .map((r) => r.following_clerk_id)
      .filter(Boolean);

    const followers = new Set(
      [...followerIdsPrimary, ...followerIdsFallback].map((x) => String(x)),
    ).size;
    const following = new Set(
      [...followingIdsPrimary, ...followingIdsFallback].map((x) => String(x)),
    ).size;

    // style_score can be computed later; currently null.
    res.json({ followers, following, style_score: null });
  } catch (err) {
    console.error("[profile/stats] error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.get("/follow-status", async (req, res) => {
  try {
    const viewerId = getViewerUserId(req);
    const targetUserId = req.query.target_user_id;
    if (!viewerId) return res.status(401).json({ error: "missing viewer" });
    if (!targetUserId)
      return res.status(400).json({ error: "missing target_user_id" });

    if (String(viewerId) === String(targetUserId)) {
      return res.json({ following: false, self: true });
    }

    let primaryFollowing = false;
    try {
      const { data, error } = await supabaseAdmin
        .from("follows")
        .select("*")
        .eq("follower_clerk_id", viewerId)
        .eq("following_clerk_id", targetUserId)
        .maybeSingle();

      if (error) throw error;
      primaryFollowing = !!data;
    } catch (e) {
      console.warn("[profile/follow-status] lookup failed:", e.message);
    }

    const fallbackFollowing = isFollowingFallback(viewerId, targetUserId);
    return res.json({
      following: primaryFollowing || fallbackFollowing,
      self: false,
    });
  } catch (err) {
    console.error("[profile/follow-status] error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.post("/follow", async (req, res) => {
  try {
    const viewerId = getViewerUserId(req);
    const targetUserId = req.body?.target_user_id;
    if (!viewerId) return res.status(401).json({ error: "missing viewer" });
    if (!targetUserId)
      return res.status(400).json({ error: "missing target_user_id" });

    if (String(viewerId) === String(targetUserId)) {
      return res.json({ ok: true, following: false, self: true });
    }

    let wroteToPrimary = false;
    try {
      const { error } = await supabaseAdmin.from("follows").insert([
        { follower_clerk_id: viewerId, following_clerk_id: targetUserId },
      ]);
      if (error) throw error;
      wroteToPrimary = true;
    } catch (e) {
      console.warn("[profile/follow] primary insert failed:", e.message);
    }

    // Keep fallback store in sync regardless of primary outcome.
    addFollowFallback(viewerId, targetUserId);

    if (!wroteToPrimary) {
      return res.json({ ok: true, following: true, self: false, fallback: true });
    }
    res.json({ ok: true, following: true, self: false });
  } catch (err) {
    console.error("[profile/follow] error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.post("/unfollow", async (req, res) => {
  try {
    const viewerId = getViewerUserId(req);
    const targetUserId = req.body?.target_user_id;
    if (!viewerId) return res.status(401).json({ error: "missing viewer" });
    if (!targetUserId)
      return res.status(400).json({ error: "missing target_user_id" });

    if (String(viewerId) === String(targetUserId)) {
      return res.json({ ok: true, following: false, self: true });
    }

    let wroteToPrimary = false;
    try {
      const { error } = await supabaseAdmin
        .from("follows")
        .delete()
        .eq("follower_clerk_id", viewerId)
        .eq("following_clerk_id", targetUserId);
      if (error) throw error;
      wroteToPrimary = true;
    } catch (e) {
      console.warn("[profile/unfollow] primary delete failed:", e.message);
    }

    // Keep fallback store in sync regardless of primary outcome.
    removeFollowFallback(viewerId, targetUserId);

    if (!wroteToPrimary) {
      return res.json({ ok: true, following: false, self: false, fallback: true });
    }

    res.json({ ok: true, following: false, self: false });
  } catch (err) {
    console.error("[profile/unfollow] error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

async function fetchProfilesByIds(ids) {
  if (!ids || ids.length === 0) return [];

  const byId = new Map();

  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .in("clerk_id", ids);
    if (error) throw error;
    (data || [])
      .map(normalizeProfileRow)
      .filter(Boolean)
      .forEach((p) => byId.set(String(p.clerk_id), p));
  } catch (e) {
    console.warn("[profile] profiles table not available:", e.message);
  }

  const missingIds = ids
    .map((id) => String(id))
    .filter((id) => !byId.has(id));

  if (missingIds.length > 0) {
    await Promise.all(
      missingIds.map(async (id) => {
        const clerkUser = await fetchClerkUserById(id);
        const normalized = normalizeClerkUser(clerkUser);
        if (normalized?.clerk_id) byId.set(id, normalized);
      }),
    );
  }

  return ids.map((id) => byId.get(String(id)) || {
    clerk_id: String(id),
    username: null,
    full_name: null,
    profile_image_url: null,
    role: null,
    bio: null,
  });
}

router.get("/followers", async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: "missing user_id" });
    const limit = Math.min(parseInt(req.query.limit || "25", 10), 100);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    let followerIdsPrimary = [];
    try {
      const { data, error } = await supabaseAdmin
        .from("follows")
        .select("follower_clerk_id")
        .eq("following_clerk_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)
        .offset(offset);
      if (error) throw error;
      followerIdsPrimary = (data || []).map((r) => r.follower_clerk_id).filter(Boolean);
    } catch (e) {
      console.warn("[profile/followers] query failed:", e.message);
    }

    const followerIdsFallback = readFollowsStore()
      .filter((r) => String(r.following_clerk_id) === String(userId))
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
      .map((r) => r.follower_clerk_id)
      .filter(Boolean);

    const followerIds = Array.from(
      new Set(
        [...followerIdsPrimary, ...followerIdsFallback].map((x) => String(x)),
      ),
    ).slice(offset, offset + limit);

    const profiles = await fetchProfilesByIds(followerIds);

    // Preserve order from followerIds.
    const profileMap = new Map(
      profiles.map((p) => [String(p.clerk_id), p]),
    );
    const ordered = followerIds
      .map((id) => profileMap.get(String(id)))
      .filter(Boolean);

    res.json({ users: ordered });
  } catch (err) {
    console.error("[profile/followers] error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.get("/following", async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: "missing user_id" });
    const limit = Math.min(parseInt(req.query.limit || "25", 10), 100);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    let followingIdsPrimary = [];
    try {
      const { data, error } = await supabaseAdmin
        .from("follows")
        .select("following_clerk_id")
        .eq("follower_clerk_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)
        .offset(offset);
      if (error) throw error;
      followingIdsPrimary = (data || []).map((r) => r.following_clerk_id).filter(Boolean);
    } catch (e) {
      console.warn("[profile/following] query failed:", e.message);
    }

    const followingIdsFallback = readFollowsStore()
      .filter((r) => String(r.follower_clerk_id) === String(userId))
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
      .map((r) => r.following_clerk_id)
      .filter(Boolean);

    const followingIds = Array.from(
      new Set(
        [...followingIdsPrimary, ...followingIdsFallback].map((x) => String(x)),
      ),
    ).slice(offset, offset + limit);

    const profiles = await fetchProfilesByIds(followingIds);
    const profileMap = new Map(
      profiles.map((p) => [String(p.clerk_id), p]),
    );
    const ordered = followingIds
      .map((id) => profileMap.get(String(id)))
      .filter(Boolean);

    res.json({ users: ordered });
  } catch (err) {
    console.error("[profile/following] error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.query || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);
    if (!q) return res.json({ users: [] });

    const users = [];
    const userIdSet = new Set();

    // Try Supabase profiles table first
    try {
      const like = `%${q}%`;
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .or(
          `username.ilike.${like},full_name.ilike.${like}`,
        )
        .limit(limit);
      if (error) throw error;
      (data || []).forEach(row => {
        const normalized = normalizeProfileRow(row);
        if (normalized && normalized.clerk_id) {
          users.push(normalized);
          userIdSet.add(normalized.clerk_id);
        }
      });
    } catch (e) {
      console.warn("[profile/search] profiles query failed:", e.message);
    }

    // If we need more results or got none, search Clerk API
    if (users.length < Math.min(limit, 5)) {
      try {
        const secretRaw = process.env.CLERK_SECRET_KEY || process.env.CLERK_API_KEY || process.env.EXPO_CLERK_SECRET_KEY || "";
        const secret = String(secretRaw).trim();
        if (!secret) {
          console.warn("[profile/search] No Clerk API key configured for fallback search");
        } else {
          // Clerk API doesn't support general query parameter. Fetch all users and filter client-side
          let clerkUrl = `${CLERK_API_BASE}/users?limit=100&offset=0`;
          const clerkRes = await fetch(clerkUrl, {
            headers: { Authorization: `Bearer ${secret}` },
          });
          if (clerkRes.ok) {
            const clerkDataRaw = await clerkRes.json();
            // Clerk API returns array directly, not { data: [...] }
            const clerkUsers = Array.isArray(clerkDataRaw) ? clerkDataRaw : (clerkDataRaw.data || []);
            const qLower = q.toLowerCase();
            // Filter users by first_name, last_name, username, or email
            const filtered = clerkUsers
              .filter(cu => {
                const fname = (cu.first_name || "").toLowerCase();
                const lname = (cu.last_name || "").toLowerCase();
                const uname = (cu.username || "").toLowerCase();
                // Get email from email_addresses array if available
                let email = "";
                if (cu.email_addresses && Array.isArray(cu.email_addresses) && cu.email_addresses.length > 0) {
                  email = cu.email_addresses[0].email_address || "";
                } else if (cu.primary_email_address?.email_address) {
                  email = cu.primary_email_address.email_address;
                }
                return fname.includes(qLower) || lname.includes(qLower) || uname.includes(qLower) || email.includes(qLower);
              })
              .slice(0, limit - users.length);
            
            filtered.forEach(clerkUser => {
              if (!userIdSet.has(clerkUser.id)) {
                const normalized = normalizeClerkUser(clerkUser);
                if (normalized) {
                  users.push(normalized);
                  userIdSet.add(clerkUser.id);
                }
              }
            });
          } else {
            console.warn(`[profile/search] Clerk API error: ${clerkRes.status} ${await clerkRes.text()}`);
          }
        }
      } catch (e) {
        console.warn("[profile/search] Clerk fallback search failed:", e.message);
      }
    }

    res.json({ users: users.slice(0, limit) });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ---------------------------------------------------------------------------
// PREFERENCES — Style onboarding data (shown only once, stored in Supabase)
//
// Required Supabase table (run once in your Supabase SQL editor):
//
// create table if not exists user_preferences (
//   clerk_id          text primary key,
//   gender            text,
//   styles            text[],
//   favorite_colors   text[],
//   disliked_colors   text[],
//   fit               text,
//   body_type         text,
//   skin_tone         text,
//   height            text,
//   budget            text,
//   avoid_items       text[],
//   occasions         text[],
//   goals             text[],
//   created_at        timestamptz default now(),
//   updated_at        timestamptz default now()
// );
// ---------------------------------------------------------------------------

// GET /api/profile/preferences/:clerkId
// Returns { onboarding_complete: true/false } — the single source of truth.
// true  → redirect to home (user already did onboarding)
// false → redirect to pref page
router.get("/preferences/:clerkId", async (req, res) => {
  try {
    const { clerkId } = req.params;
    if (!clerkId) return res.status(400).json({ error: "missing clerkId" });

    const { data, error } = await supabaseAdmin
      .from("user_preferences")
      .select("clerk_id, onboarding_complete")
      .eq("clerk_id", clerkId)
      .maybeSingle();

    if (error) {
      console.warn("[preferences/get] Supabase error:", error.message);
      return res.json({ onboarding_complete: false });
    }

    const done = !!data && data.onboarding_complete === true;
    console.log(`[preferences/get] ${clerkId} onboarding_complete=${done}`);
    return res.json({ onboarding_complete: done });
  } catch (err) {
    console.error("[preferences/get] error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// POST /api/profile/preferences
// Upserts the full style profile for a user. Called when onboarding completes.
router.post("/preferences", async (req, res) => {
  try {
    const viewerUserId = getViewerUserId(req);
    const {
      clerk_id,
      gender,
      styles,
      favoriteColors,
      dislikedColors,
      fit,
      bodyType,
      skinTone,
      height,
      budget,
      avoidItems,
      occasions,
      goals,
    } = req.body;

    const targetId = clerk_id || viewerUserId;
    if (!targetId) return res.status(400).json({ error: "missing clerk_id" });

    const payload = {
      clerk_id: String(targetId),
      onboarding_complete: true,          // <- the single source of truth flag
      gender: gender || null,
      styles: Array.isArray(styles) ? styles : [],
      favorite_colors: Array.isArray(favoriteColors) ? favoriteColors : [],
      disliked_colors: Array.isArray(dislikedColors) ? dislikedColors : [],
      fit: fit || null,
      body_type: bodyType || null,
      skin_tone: skinTone || null,
      height: height || null,
      budget: budget || null,
      avoid_items: Array.isArray(avoidItems) ? avoidItems : [],
      occasions: Array.isArray(occasions) ? occasions : [],
      goals: Array.isArray(goals) ? goals : [],
      updated_at: new Date().toISOString(),
    };

    console.log(`[preferences/post] Upserting preferences for ${targetId}`);
    console.log(`[preferences/post] Payload:`, JSON.stringify(payload, null, 2).substring(0, 500));

    // First, check if table exists and get current data
    let { data: existing, error: checkErr } = await supabaseAdmin
      .from("user_preferences")
      .select("clerk_id")
      .eq("clerk_id", targetId)
      .maybeSingle();

    if (checkErr) {
      console.warn("[preferences/post] Table check error (table may not exist):", checkErr.message);
      existing = null;
    }
    console.log(`[preferences/post] Existing record found:`, !!existing);

    // Use upsert (insert or update)
    const { data, error } = await supabaseAdmin
      .from("user_preferences")
      .upsert(payload, { onConflict: "clerk_id" })
      .select()
      .single();

    if (error) {
      console.error("[preferences/post] Supabase upsert error:", error);
      // Try manual upsert if onConflict fails
      if (existing) {
        console.log("[preferences/post] Falling back to UPDATE query");
        const { data: updateData, error: updateError } = await supabaseAdmin
          .from("user_preferences")
          .update(payload)
          .eq("clerk_id", targetId)
          .select()
          .single();
        if (updateError) {
          console.error("[preferences/post] UPDATE also failed:", updateError);
          return res.status(500).json({ error: updateError.message || String(updateError) });
        }
        console.log(`[preferences/post] Updated preferences for ${targetId}`);
        return res.json({ ok: true, preferences: updateData });
      }
      return res.status(500).json({ error: error.message || String(error) });
    }

    console.log(`[preferences/post] Saved preferences for ${targetId}`);
    res.json({ ok: true, preferences: data });
  } catch (err) {
    console.error("[preferences/post] error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

module.exports = router;
