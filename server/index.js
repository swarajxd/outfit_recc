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
    allowedHeaders: ["Content-Type", "Authorization", "X-User-Id"],
  }),
);

app.use(bodyParser.json({ limit: "10mb" }));

// Serve outfit_model files as static assets (wardrobe images, uploads, etc.)
app.use("/static", express.static(path.join(REPO_OUTFIT)));

// Mount profile routes
app.use("/api/profile", profileRouter);

// ---- endpoint: list posts for profile (Supabase) ----
app.get("/api/profile/posts", async (req, res) => {
  try {
    const userId = req.header("x-user-id") || req.query.user_id;
    if (!userId) {
      return res.status(400).json({ error: "missing user id" });
    }

    const { data, error } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("owner_clerk_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetch profile posts error", error);
      return res.status(500).json({ error: error.message || error });
    }

    res.json({ posts: data });
  } catch (err) {
    console.error("profile posts endpoint error", err);
    res.status(500).json({ error: String(err) });
  }
});

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
let outfitStarting = false;
let outfitRestartTimer = null;

async function isPortInUse(port) {
  return new Promise((resolve) => {
    const net = require("net");
    const server = net.createServer();
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") resolve(true);
      else resolve(false);
    });
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port, "127.0.0.1");
  });
}

async function startOutfitModel() {
  if (outfitProcess) {
    console.log(
      "[outfit] Model API already running (pid=" + outfitProcess.pid + ")",
    );
    return;
  }
  if (outfitStarting) return;
  outfitStarting = true;

  // Check if port is already in use
  const inUse = await isPortInUse(OUTFIT_PORT);
  if (inUse) {
    console.log(
      `[outfit] Port ${OUTFIT_PORT} already in use. Assuming Model API is already running.`,
    );
    outfitStarting = false;
    return;
  }

  const venvPython = path.join(__dirname, "outfit_model/venv/bin/python");
  const python = fs.existsSync(venvPython) ? venvPython : "python3";
  if (!fs.existsSync(venvPython)) {
    console.warn(
      "[outfit] venv python not found at",
      venvPython,
      "- falling back to python3 on PATH",
    );
  }
  const depsPath = path.join(REPO_OUTFIT, "deps");
  const pyPath = [depsPath, REPO_OUTFIT].join(path.delimiter);
  const env = { ...process.env, PYTHONPATH: REPO_OUTFIT };
  outfitProcess = spawn(
    python,

    [
      "-m",
      "uvicorn",
      "api:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(OUTFIT_PORT),
    ],
    { cwd: REPO_OUTFIT, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  outfitStarting = false;
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
    const oldPid = outfitProcess?.pid;
    outfitProcess = null;
    if (code !== 0 && code !== null) {
      console.warn("[outfit] exited with code", code, "(pid=" + oldPid + ")");
    } else {
      console.log("[outfit] exited (pid=" + oldPid + ")");
    }

    // Auto-restart if Node is still running (common with uvicorn import errors)
    if (!outfitRestartTimer) {
      outfitRestartTimer = setTimeout(() => {
        outfitRestartTimer = null;
        console.log("[outfit] restarting Model API...");
        startOutfitModel();
      }, 1500);
    }
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

    res.json({ ok: true, post: data });
  } catch (err) {
    console.error("create-post error", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---- endpoint: for-you feed (basic fetch for now) ----
app.get("/api/for-you", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("fetch for-you error", error);
      return res.status(500).json({ error: error.message || error });
    }

    // Rewrite any local Python URLs to Node /static URLs
    const nodeBase = `${req.protocol}://${req.get("host")}`;
    const posts = (data || []).map((p) => {
      if (p.image_url && p.image_url.includes(":8000/static/")) {
        p.image_url = p.image_url.replace(/:\d+\/static\//, `:${PORT}/static/`);
      }
      return p;
    });

    res.json({ posts });
  } catch (err) {
    console.error("for-you error", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---- endpoint: like toggle ----
app.post("/api/like-toggle", async (req, res) => {
  try {
    const clerkUserId = await verifyClerkToken(req);
    if (!clerkUserId) return res.status(401).json({ error: "unauthenticated" });

    const { post_id } = req.body;
    if (!post_id) return res.status(400).json({ error: "missing post_id" });

    // Check if like exists
    const { data: existing } = await supabaseAdmin
      .from("likes")
      .select("*")
      .eq("post_id", post_id)
      .eq("user_clerk_id", clerkUserId)
      .maybeSingle();

    if (existing) {
      // unlike
      const { error } = await supabaseAdmin
        .from("likes")
        .delete()
        .eq("post_id", post_id)
        .eq("user_clerk_id", clerkUserId);
      if (error) throw error;
      res.json({ liked: false });
    } else {
      // like
      const { error } = await supabaseAdmin
        .from("likes")
        .insert([{ post_id, user_clerk_id: clerkUserId }]);
      if (error) throw error;
      res.json({ liked: true });
    }
  } catch (err) {
    console.error("like-toggle error", err);
    res.status(500).json({ error: String(err) });
  }
});

// ---- endpoint: health check ----
app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "Server is running" });
});

// ---- endpoint: recommend outfit (vector-based) ----
app.get("/api/recommend-outfit", async (req, res) => {
  try {
    const userId = req.header("x-user-id") || req.query.user_id;
    const query = req.query.query || "casual outfit";

    if (!userId) {
      return res.status(400).json({ error: "missing user id" });
    }

    const pyUrl = `${OUTFIT_API_URL}/recommend-outfit?user_id=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}`;
    const pyResponse = await fetch(pyUrl);

    if (!pyResponse.ok) {
      const errText = await pyResponse.text();
      return res.status(pyResponse.status).json({ error: errText });
    }

    const result = await pyResponse.json();

    // Rewrite image paths to Node /static URLs if they point to port 8000
    if (result.outfits && Array.isArray(result.outfits)) {
      result.outfits.forEach((o) => {
        const outfit = o.outfit || {};
        ["top", "bottom", "shoes"].forEach((key) => {
          const it = outfit[key];
          if (it && it.image && it.image.includes(":8000/static/")) {
            it.image = it.image.replace(/:\d+\/static\//, `:${PORT}/static/`);
          }
        });
      });
    }

    res.json(result);
  } catch (err) {
    console.error("recommend-outfit error", err);
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT;
// Start outfit model then listen
(async () => {
  await startOutfitModel();
  waitForOutfit().then((ready) => {
    if (ready) console.log("[outfit] Model API ready");
    else
      console.warn(
        "[outfit] Model API may not be ready yet (check Python/uvicorn)",
      );
  });
})();

app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on http://0.0.0.0:${PORT}`),
);

function stopOutfitModel(signal = "SIGTERM") {
  if (!outfitProcess) return;
  try {
    console.log("[outfit] stopping Model API (pid=" + outfitProcess.pid + ")");
    outfitProcess.kill(signal);
  } catch (e) {
    // ignore
  }
}

process.on("SIGINT", () => {
  stopOutfitModel("SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopOutfitModel("SIGTERM");
  process.exit(0);
});
