const path = require("path");
const fs = require("fs");
const express = require("express");
const FormData = require("form-data");
const multer = require("multer");

const router = express.Router();

const OUTFIT_PORT = parseInt(process.env.OUTFIT_PORT || "8000", 10);
const OUTFIT_API_URL = `http://127.0.0.1:${OUTFIT_PORT}`;

// Base directory for the outfit_model — used to rewrite absolute paths to /static URLs
const OUTFIT_MODEL_DIR = path.join(__dirname, "outfit_model");

/**
 * Fetch with exponential backoff retry.
 * Retries on ECONNREFUSED (Python API still booting) and 5xx errors.
 */
async function fetchWithRetry(url, options = {}, retries = 6, baseDelayMs = 1500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Retry on server errors too (5xx), but not on 4xx
      if (res.status >= 500 && attempt < retries) {
        const delay = baseDelayMs * Math.pow(1.5, attempt);
        console.warn(`[retry] ${url} returned ${res.status}, retrying in ${Math.round(delay)}ms... (${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err) {
      const isConnRefused =
        err?.cause?.code === "ECONNREFUSED" || err?.code === "ECONNREFUSED";
      if (isConnRefused && attempt < retries) {
        const delay = baseDelayMs * Math.pow(1.5, attempt);
        console.warn(`[retry] Python API not ready (ECONNREFUSED), retrying in ${Math.round(delay)}ms... (${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Recursively walk a JSON object and rewrite image URLs that point to the
 * Python server (port 8000) so they point to the Node server instead.
 * Also converts any remaining absolute file-system paths into /static/... URLs.
 */
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
      // Case 1: Python-generated http URL — swap host:port to Node server
      const pyStaticMatch = val.match(/^https?:\/\/[^/]+:\d+(\/static\/.+)$/);
      if (pyStaticMatch) {
        obj[key] = `${nodeBaseUrl}${pyStaticMatch[1]}`;
        continue;
      }
      // Case 2: Absolute file-system path — convert to /static/... relative to OUTFIT_MODEL_DIR
      if (val.startsWith("/") || (val.length > 2 && val[1] === ":")) {
        const normalized = val.replace(/\\/g, "/");
        const idx = normalized.indexOf("/outfit_model/");
        if (idx !== -1) {
          const rel = normalized.substring(idx + "/outfit_model/".length);
          obj[key] = `${nodeBaseUrl}/static/${rel}`;
          continue;
        }
      }
    } else if (typeof val === "object") {
      rewriteImageUrls(val, nodeBaseUrl);
    }
  }
  return obj;
}

// Multer — memory storage so we can forward the buffer to the Python API
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Helper: pipe a FormData stream into a Buffer so Content-Length is exact
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

// ── POST /api/profile/upload-wardrobe ────────────────────────────────────
// Accepts an image + user_id, forwards to the Python pipeline, returns job_id
router.post("/upload-wardrobe", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "missing image file" });

    const userId = req.body.user_id || "default_user";

    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname || "image.jpg",
      contentType: req.file.mimetype || "image/jpeg",
    });
    form.append("user_id", userId);

    const headers = form.getHeaders();
    const body = await formDataToBuffer(form);
    headers["Content-Length"] = String(body.length);

    const response = await fetchWithRetry(`${OUTFIT_API_URL}/upload-outfit`, {
      method: "POST",
      body,
      headers,
    });

    const result = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error("upload-wardrobe error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ── GET /api/profile/job/:jobId ──────────────────────────────────────────
// Poll the processing status of an upload job
router.get("/job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const response = await fetchWithRetry(
      `${OUTFIT_API_URL}/job/${encodeURIComponent(jobId)}`,
    );
    const result = await response.json();

    // Rewrite any image URLs in the completed results
    const nodeBase = `${req.protocol}://${req.get("host")}`;
    rewriteImageUrls(result, nodeBase);

    res.status(response.status).json(result);
  } catch (err) {
    console.error("job-status error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ── GET /api/profile/wardrobe/:userId ────────────────────────────────────
// Fetch the full wardrobe for a user (segmented images, attributes, etc.)
router.get("/wardrobe/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const response = await fetchWithRetry(
      `${OUTFIT_API_URL}/wardrobe/${encodeURIComponent(userId)}`,
    );
    const result = await response.json();

    // Rewrite image URLs so they go through this Node server's /static route
    const nodeBase = `${req.protocol}://${req.get("host")}`;
    rewriteImageUrls(result, nodeBase);

    res.status(response.status).json(result);
  } catch (err) {
    console.error("wardrobe-fetch error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ── GET /api/profile/segmented/:userId ────────────────────────────────────
// Return all segmented images directly from uploads/<userId>_segmented/
router.get("/segmented/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    // Sanitise: only allow alphanumeric, underscore, hyphen
    if (!/^[\w-]+$/.test(userId)) {
      return res.status(400).json({ error: "invalid user id" });
    }
    const segDir = path.join(
      OUTFIT_MODEL_DIR,
      "uploads",
      `${userId}_segmented`,
    );
    if (!fs.existsSync(segDir)) {
      return res.json({ success: true, items: [] });
    }
    const files = fs
      .readdirSync(segDir)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
    const nodeBase = `${req.protocol}://${req.get("host")}`;
    const items = files.map((file) => {
      const name = path.parse(file).name; // e.g. "tshirt_0"
      const parts = name.match(/^(.+?)_(\d+)$/);
      const category = parts ? parts[1] : name;
      return {
        id: name,
        image: `${nodeBase}/static/uploads/${userId}_segmented/${file}`,
        category,
        filename: file,
      };
    });
    res.json({ success: true, items });
  } catch (err) {
    console.error("segmented-fetch error", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ── GET /api/profile/wardrobe/:userId/summary ────────────────────────────
// Quick stats: item counts per category
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