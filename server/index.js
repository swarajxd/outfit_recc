const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");
const { spawn } = require("child_process");
const cloudinary = require("cloudinary").v2;
const { createClient } = require("@supabase/supabase-js");
const profileRouter = require("./profile");

const app = express();

// Outfit model: run from server's outfit_model directory
const SERVER_DIR = __dirname;
const REPO_OUTFIT = path.join(SERVER_DIR, "outfit_model");
const OUTFIT_PORT = parseInt(process.env.OUTFIT_PORT || "8000", 10);
const OUTFIT_API_URL = `http://127.0.0.1:${OUTFIT_PORT}`;

// Enable CORS with credentials support
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(bodyParser.json({ limit: "10mb" }));

// Serve outfit_model files as static assets (wardrobe images, uploads, etc.)
app.use("/static", express.static(path.join(REPO_OUTFIT)));

// Mount profile routes
app.use("/api/profile", profileRouter);

// Multer for outfit-analysis (store in memory to forward to Python)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// supabase admin client (service_role key) — must be stored server-side only
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ---- Start outfit model API (Python) from repo's outfit_model ----
let outfitProcess = null;
function startOutfitModel() {
  // Use the current environment's python (e.g. your activated .venv) to run the outfit API.
  const python = process.env.PYTHON_EXECUTABLE || "python";
  const depsPath = path.join(REPO_OUTFIT, "deps");
  const pyPath = [depsPath, REPO_OUTFIT].join(path.delimiter);
  const env = { ...process.env, PYTHONPATH: REPO_OUTFIT };
  outfitProcess = spawn(
    python,

    [
      "-m",
      "uvicorn",
      // Use the lightweight API that exposes /analyze (and our post vectors endpoint).
      "api_minimal:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(OUTFIT_PORT),
    ],
    { cwd: REPO_OUTFIT, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  outfitProcess.stdout.on("data", (d) =>
    process.stdout.write("[outfit] " + d.toString()),
  );
  outfitProcess.stderr.on("data", (d) =>
    process.stderr.write("[outfit] " + d.toString()),
  );
  outfitProcess.on("error", (err) =>
    console.warn("[outfit] process error:", err.message),
  );
  outfitProcess.on("exit", (code) => {
    outfitProcess = null;
    if (code !== 0 && code !== null)
      console.warn("[outfit] exited with code", code);
  });
  console.log("[outfit] Model API starting on port", OUTFIT_PORT);
}

function waitForOutfit(timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      fetch(`${OUTFIT_API_URL}/health`).then(
        (r) => {
          if (r.ok) return resolve(true);
          setTimeout(check, 500);
        },
        () => {
          if (Date.now() - start < timeoutMs) setTimeout(check, 500);
          else resolve(false);
        },
      );
    };
    check();
  });
}

// ---- Helper: verify clerk token (PLACEHOLDER) ----
async function verifyClerkToken(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const token = auth.split(" ")[1];
  if (!token) return null;
  if (token.startsWith("dev:")) {
    return token.split(":")[1];
  }
  return null;
}

// ---- endpoint: get Cloudinary signature for upload ----
app.post("/api/cloudinary-sign", async (req, res) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    // Accept folder from request body, default to "posts"
    const folder = req.body?.folder || "posts";
    const paramsToSign = { timestamp, folder };
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET,
    );
    res.json({
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
    });
  } catch (err) {
    console.error("cloudinary-sign error", err);
    res.status(500).json({ error: "signing failed" });
  }
});

// Collect form-data stream into a Buffer so Content-Length is exact (avoids mismatch with Python)
function formDataToBuffer(form) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    form.on("data", (chunk) => {
      chunks.push(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "binary"),
      );
    });
    form.on("error", reject);
    form.on("end", () => resolve(Buffer.concat(chunks)));
    form.resume();
  });
}

// ---- endpoint: outfit analysis (runs model on uploaded image, returns result + writes result.json) ----
app.post("/api/outfit-analysis", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "missing image file" });
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname || "image.jpg",
      contentType: req.file.mimetype || "image/jpeg",
    });
    const headers = form.getHeaders(); // before consuming stream
    const body = await formDataToBuffer(form);
    headers["Content-Length"] = String(body.length);

    const response = await fetch(`${OUTFIT_API_URL}/analyze?save_result=true`, {
      method: "POST",
      body,
      headers,
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error("outfit-api error", response.status, errText);
      return res
        .status(response.status)
        .json({ error: errText || "outfit analysis failed" });
    }
    const result = await response.json();
    const resultsDir = path.join(SERVER_DIR, "results");
    try {
      fs.mkdirSync(resultsDir, { recursive: true });
      fs.writeFileSync(
        path.join(resultsDir, "result.json"),

        JSON.stringify(result, null, 2),
      );
    } catch (e) {
      console.warn("Could not write result.json:", e.message);
    }
    res.json(result);
  } catch (err) {
    console.error("outfit-analysis error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ---- endpoint: create post record in supabase ----
app.post("/api/create-post", async (req, res) => {
  try {
    const clerkUserId = await verifyClerkToken(req);
    if (!clerkUserId)
      return res
        .status(401)
        .json({ error: "unauthenticated - implement Clerk verification" });

    const { image_url, image_public_id, caption = null, tags = [] } = req.body;
    if (!image_url) return res.status(400).json({ error: "missing image_url" });

    const insert = {
      owner_clerk_id: clerkUserId,
      image_url,
      image_public_id: image_public_id ?? null,
      caption,
      tags: Array.isArray(tags) ? tags : [],
    };

    const { data, error } = await supabaseAdmin
      .from("posts")
      .insert([insert])
      .select()
      .single();
    if (error) {
      console.error("supabase insert error", error);
      return res.status(500).json({ error: error.message || error });
    }

    // Generate vectors + Gemini attributes for this post image, then persist to posts.outfit_data.
    // If this fails, we still return the created post (outfit_data will be null).
    let outfit_data = null;
    try {
      const imgResp = await fetch(image_url);
      if (!imgResp.ok) throw new Error(`failed to download image: ${imgResp.status}`);
      const buf = Buffer.from(await imgResp.arrayBuffer());
      const contentType = imgResp.headers.get("content-type") || "image/jpeg";

      const form = new FormData();
      form.append("file", buf, { filename: "post.jpg", contentType });
      // Use post id as user_id so the pipeline's outputs are namespaced per post.
      form.append("user_id", `post_${data.id}`);

      const headers = form.getHeaders();
      const body = await formDataToBuffer(form);
      headers["Content-Length"] = String(body.length);

      const vectResp = await fetch(`${OUTFIT_API_URL}/analyze-post`, {
        method: "POST",
        body,
        headers,
      });
      if (!vectResp.ok) {
        const errText = await vectResp.text();
        throw new Error(errText || `outfit api failed: ${vectResp.status}`);
      }
      outfit_data = await vectResp.json();

      const { error: updErr } = await supabaseAdmin
        .from("posts")
        .update({ outfit_data })
        .eq("id", data.id);
      if (updErr) throw updErr;
    } catch (e) {
      console.warn("[create-post] outfit_data generation failed:", e?.message || e);
    }

    res.json({ ok: true, post: { ...data, outfit_data } });
  } catch (err) {
    console.error("create-post error", err);
    res.status(500).json({ error: String(err) });
  }
});

// -----------------------------------------------------------------------------
// Likes + For You feed (embedding-based ranking)
// -----------------------------------------------------------------------------

function l2Normalize(vec) {
  if (!Array.isArray(vec) || vec.length === 0) return null;
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    const v = Number(vec[i]);
    if (!Number.isFinite(v)) return null;
    sumSq += v * v;
  }
  const norm = Math.sqrt(sumSq);
  if (!Number.isFinite(norm) || norm <= 0) return null;
  return vec.map((x) => Number(x) / norm);
}

function dot(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return null;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Number(a[i]) * Number(b[i]);
  return s;
}

function extractItemEmbeddings(outfit_data) {
  if (!outfit_data || typeof outfit_data !== "object") return [];

  // Preferred schema (as per spec)
  const items = Array.isArray(outfit_data.items) ? outfit_data.items : null;
  if (items) {
    return items
      .map((it) => it?.combined_embedding)
      .filter((v) => Array.isArray(v) && v.length > 0);
  }

  // Our current pipeline schema: wardrobe_vectors is list of items with combined_embedding
  const vectors = Array.isArray(outfit_data.wardrobe_vectors)
    ? outfit_data.wardrobe_vectors
    : null;
  if (vectors) {
    return vectors
      .map((it) => it?.combined_embedding)
      .filter((v) => Array.isArray(v) && v.length > 0);
  }

  return [];
}

function buildUserVectorFromLikedPosts(likedPosts) {
  const all = [];
  for (const p of likedPosts || []) {
    const ods = p?.outfit_data;
    const embs = extractItemEmbeddings(ods);
    for (const e of embs) all.push(e);
  }
  if (all.length === 0) return null;
  const dim = all[0].length;
  if (!dim || all.some((v) => !Array.isArray(v) || v.length !== dim)) return null;

  const mean = new Array(dim).fill(0);
  for (const v of all) {
    for (let i = 0; i < dim; i++) mean[i] += Number(v[i]);
  }
  for (let i = 0; i < dim; i++) mean[i] /= all.length;
  return l2Normalize(mean);
}

app.post("/api/like-toggle", async (req, res) => {
  try {
    const clerkUserId = await verifyClerkToken(req);
    if (!clerkUserId) return res.status(401).json({ error: "unauthenticated" });

    const { post_id } = req.body || {};
    if (!post_id) return res.status(400).json({ error: "missing post_id" });
    console.log("[like-toggle]", { user_id: clerkUserId, post_id });

    const { data: existing, error: existErr } = await supabaseAdmin
      .from("likes")
      .select("id")
      .match({ user_id: clerkUserId, post_id })
      .maybeSingle();
    if (existErr) {
      // likes table doesn't exist yet
      if (existErr.code === "PGRST205") {
        return res.status(400).json({
          error:
            "likes table not found in Supabase. Create public.likes (see server/sql/likes.sql) then retry.",
        });
      }
      throw existErr;
    }

    if (existing?.id) {
      const { error: delErr } = await supabaseAdmin
        .from("likes")
        .delete()
        .match({ user_id: clerkUserId, post_id });
      if (delErr) throw delErr;
      return res.json({ liked: false });
    }

    const { error: insErr } = await supabaseAdmin
      .from("likes")
      .insert([{ user_id: clerkUserId, post_id }]);
    if (insErr) {
      const code = insErr?.code;
      const msg = (insErr?.message || "").toLowerCase();
      if (code !== "23505" && !msg.includes("duplicate")) throw insErr;
    }
    return res.json({ liked: true });
  } catch (err) {
    console.error("like-toggle error", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get("/api/for-you", async (req, res) => {
  try {
    const clerkUserId = await verifyClerkToken(req);
    if (!clerkUserId) return res.status(401).json({ error: "unauthenticated" });

    // 1) liked posts (need outfit_data)
    const { data: likedRows, error: likedErr } = await supabaseAdmin
      .from("likes")
      .select("post_id")
      .eq("user_id", clerkUserId);
    if (likedErr) {
      // If likes table doesn't exist yet, fall back to latest posts.
      if (likedErr.code === "PGRST205") {
        const { data, error } = await supabaseAdmin
          .from("posts")
          .select("id,image_url,caption,owner_clerk_id,tags,created_at")
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        return res.json({ ok: true, posts: data || [] });
      }
      throw likedErr;
    }
    const likedPostIds = (likedRows || []).map((r) => r.post_id).filter(Boolean);
    console.log("[for-you]", { user_id: clerkUserId, liked_count: likedPostIds.length });

    if (likedPostIds.length === 0) {
      const { data, error } = await supabaseAdmin
        .from("posts")
        .select("id,image_url,caption,owner_clerk_id,tags,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return res.json({ ok: true, posts: data || [] });
    }

    const { data: likedPosts, error: likedPostsErr } = await supabaseAdmin
      .from("posts")
      .select("id,outfit_data")
      .in("id", likedPostIds);
    if (likedPostsErr) throw likedPostsErr;

    const userVec = buildUserVectorFromLikedPosts(likedPosts || []);
    if (!userVec) {
      const { data, error } = await supabaseAdmin
        .from("posts")
        .select("id,image_url,caption,owner_clerk_id,tags,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return res.json({ ok: true, posts: data || [] });
    }

    // 2) candidate posts
    const { data: candidates, error: candErr } = await supabaseAdmin
      .from("posts")
      .select("id,image_url,caption,owner_clerk_id,tags,outfit_data,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (candErr) throw candErr;

    // 3) score each post by max item similarity
    const scored = [];
    for (const p of candidates || []) {
      const embs = extractItemEmbeddings(p.outfit_data);
      let best = -1;
      for (const e of embs) {
        const en = l2Normalize(e) || e; // tolerate already-normalized
        const s = dot(userVec, en);
        if (typeof s === "number" && Number.isFinite(s) && s > best) best = s;
      }
      if (best > -1) {
        scored.push({
          id: p.id,
          image_url: p.image_url,
          caption: p.caption,
          owner_clerk_id: p.owner_clerk_id,
          tags: p.tags,
          score: best,
          created_at: p.created_at,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    if (scored.length === 0) {
      const { data, error } = await supabaseAdmin
        .from("posts")
        .select("id,image_url,caption,owner_clerk_id,tags,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return res.json({ ok: true, posts: data || [] });
    }
    return res.json({ ok: true, posts: scored.slice(0, 20) });
  } catch (err) {
    console.error("for-you error", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
});

const PORT = parseInt(process.env.PORT || "4000", 10);
// Start outfit model then listen.
// If the outfit API is already running (e.g. from another terminal),
// don't try to spawn a second copy (Windows will error on port 8000).
waitForOutfit(1500).then((alreadyUp) => {
  if (alreadyUp) {
    console.log("[outfit] Model API already running");
    return true;
  }
  startOutfitModel();
  return waitForOutfit();
}).then((ready) => {
  if (ready) console.log("[outfit] Model API ready");
  else console.warn("[outfit] Model API may not be ready yet (check Python/uvicorn)");
});
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
server.on("error", (err) => {
  console.error("HTTP server error:", err);
});