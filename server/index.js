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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });


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
  const python = process.env.PYTHON_PATH || "python3";
  const depsPath = path.join(REPO_OUTFIT, "deps");
  const pyPath = [depsPath, REPO_OUTFIT].join(path.delimiter);
  const env = { ...process.env, PYTHONPATH: pyPath };
 outfitProcess = spawn(
  "py",
  [
    "-3.11",
    "-m",
    "uvicorn",
    "api:app",
    "--host",
    "127.0.0.1",
    "--port",
    String(OUTFIT_PORT)
  ],
 
    { cwd: REPO_OUTFIT, env, stdio: ["ignore", "pipe", "pipe"] }
  );
  outfitProcess.stdout.on("data", (d) => process.stdout.write("[outfit] " + d.toString()));
  outfitProcess.stderr.on("data", (d) => process.stderr.write("[outfit] " + d.toString()));
  outfitProcess.on("error", (err) => console.warn("[outfit] process error:", err.message));
  outfitProcess.on("exit", (code) => {
    outfitProcess = null;
    if (code !== 0 && code !== null) console.warn("[outfit] exited with code", code);

  });
  console.log("[outfit] Model API starting on port", OUTFIT_PORT);
}

function waitForOutfit(timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      fetch(`${OUTFIT_API_URL}/health`).then(

        (r) => { if (r.ok) return resolve(true); setTimeout(check, 500); },
        () => { if (Date.now() - start < timeoutMs) setTimeout(check, 500); else resolve(false); }

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

      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "binary"));

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

    const response = await fetch(
      `${OUTFIT_API_URL}/analyze?save_result=true`,
      { method: "POST", body, headers }
    );
    if (!response.ok) {
      const errText = await response.text();
      console.error("outfit-api error", response.status, errText);
      return res.status(response.status).json({ error: errText || "outfit analysis failed" });

    }
    const result = await response.json();
    const resultsDir = path.join(SERVER_DIR, "results");
    try {
      fs.mkdirSync(resultsDir, { recursive: true });
      fs.writeFileSync(
        path.join(resultsDir, "result.json"),

        JSON.stringify(result, null, 2)

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

const PORT = process.env.PORT;
// Start outfit model then listen
startOutfitModel();
waitForOutfit().then((ready) => {
  if (ready) console.log("[outfit] Model API ready");

  else console.warn("[outfit] Model API may not be ready yet (check Python/uvicorn)");

});
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on http://0.0.0.0:${PORT}`),
);
