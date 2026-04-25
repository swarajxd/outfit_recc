const FormData = require("form-data");
const { createClient } = require("@supabase/supabase-js");

// ✅ NEW: Post Vector Pipeline
// This service orchestrates the process of calling the Python ML service
// to get outfit embeddings and then storing them in Supabase.

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Sanitises raw attributes from the ML service.
 * Removes "unknown"/"n/a" strings. Returns a clean object or null.
 */
function buildCleanAttributes(raw) {
  if (!raw || typeof raw !== "object") return null;

  const clean = {};

  // categories — must be a non-empty array of real strings
  if (Array.isArray(raw.categories)) {
    const cats = raw.categories.filter(
      (c) => c && c !== "unknown" && c !== "n/a",
    );
    if (cats.length > 0) clean.categories = cats;
  }

  // colors — same rule
  if (Array.isArray(raw.colors)) {
    const cols = raw.colors.filter((c) => c && c !== "unknown" && c !== "n/a");
    if (cols.length > 0) clean.colors = cols;
  }

  // style — only include if it's a real non-unknown string
  if (raw.style && raw.style !== "unknown" && raw.style !== "n/a") {
    clean.style = raw.style;
  }

  // item_count — only include if it's a positive number
  if (typeof raw.item_count === "number" && raw.item_count > 0) {
    clean.item_count = raw.item_count;
  }

  return Object.keys(clean).length > 0 ? clean : null;
}

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

/**
 * Main pipeline function for post creation
 * @param {string} imageUrl - URL of the post image
 * @param {string} userId - ID of the user creating the post
 * @param {string} postId - ID of the newly created post
 * @param {object} opts - Options including outfitApiUrl
 */
async function processPostVectorPipeline(imageUrl, userId, postId, opts = {}) {
  const { outfitApiUrl } = opts;
  if (!outfitApiUrl) {
    console.error(
      "[postVectorPipeline] ❌ CRITICAL: outfitApiUrl is missing from options",
    );
    // Ensure we mark as failed if we can
    try {
      await supabaseAdmin
        .from("posts")
        .update({ embedding_status: "failed" })
        .eq("id", postId);
    } catch (e) {}
    return null;
  }

  console.log(
    `[postVectorPipeline] 🚀 Pipeline STARTED | User: ${userId} | Post: ${postId} | API: ${outfitApiUrl}`,
  );

  try {
    // 1. Download image
    console.log(
      `[postVectorPipeline] 📥 Step 1: Downloading image from ${imageUrl}`,
    );
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) {
      throw new Error(
        `Failed to download image: ${imgResp.status} ${imgResp.statusText}`,
      );
    }
    const arrayBuffer = await imgResp.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    const contentType = imgResp.headers.get("content-type") || "image/jpeg";
    console.log(
      `[postVectorPipeline] ✅ Downloaded ${buf.length} bytes (type: ${contentType})`,
    );

    // 2. Call Python ML service for segmentation and embeddings
    console.log(
      `[postVectorPipeline] 🧠 Step 2: Calling Python ML service at ${outfitApiUrl}/analyze-post`,
    );
    const form = new FormData();
    form.append("file", buf, { filename: "post.jpg", contentType });
    form.append("user_id", String(userId));

    const headers = form.getHeaders();
    const body = await formDataToBuffer(form);
    headers["Content-Length"] = String(body.length);

    // Use a longer timeout for ML processing
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // Increased to 5 minutes for heavy SAM processing

    try {
      const mlResp = await fetch(`${outfitApiUrl}/analyze-post`, {
        method: "POST",
        body,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!mlResp.ok) {
        const errText = await mlResp.text();
        console.error(
          `[postVectorPipeline] ❌ ML service HTTP ERROR: ${mlResp.status}`,
        );
        console.error(
          `[postVectorPipeline] Error details: ${errText.substring(0, 500)}`,
        );
        throw new Error(`ML service returned ${mlResp.status}`);
      }

      const mlResult = await mlResp.json();
      const results = mlResult.results || {};
      const pipelineSuccess =
        mlResult.success === true && (!results || results.success !== false);

      if (!pipelineSuccess) {
        console.error(
          `[postVectorPipeline] ❌ ML service APPLICATION ERROR: ${mlResult.error || results.error || "Unknown error"}`,
        );
        console.error(
          `[postVectorPipeline] Full results on failure: ${JSON.stringify(results)}`,
        );
        if (mlResult.traceback || results.traceback) {
          console.error(mlResult.traceback || results.traceback);
        }
        throw new Error(
          mlResult.error || results.error || "ML pipeline failed internally",
        );
      }

      console.log(
        `[postVectorPipeline] ✅ ML success: Aggregated post-level vectors returned`,
      );

      // 3. Update the post in the DB with separate columns
      console.log(
        `[postVectorPipeline] 📝 Step 3: Updating post ${postId} with separate embedding columns`,
      );

      // ✅ FIX: Validate all embedding fields before DB write
      const {
        visual_embedding,
        text_embedding,
        combined_embedding,
        attributes,
      } = results;

      // Check each embedding is a non-empty array
      const isValidEmbedding = (emb) => Array.isArray(emb) && emb.length > 0;

      if (!isValidEmbedding(combined_embedding)) {
        console.error(
          `[postVectorPipeline] ❌ combined_embedding missing or empty — aborting DB write`,
        );
        throw new Error("ML service returned empty combined_embedding");
      }

      if (!isValidEmbedding(visual_embedding)) {
        console.warn(
          `[postVectorPipeline] ⚠️  visual_embedding missing — will store null`,
        );
      }

      if (!isValidEmbedding(text_embedding)) {
        console.warn(
          `[postVectorPipeline] ⚠️  text_embedding missing — will store null`,
        );
      }

      // Build clean attributes — strip any "unknown"/"n/a" values
      const cleanAttributes = buildCleanAttributes(attributes);
      console.log(
        "[postVectorPipeline] Generated attributes:",
        cleanAttributes,
      );

      const allEmbeddingsPresent =
        isValidEmbedding(visual_embedding) && isValidEmbedding(text_embedding);
      const updateData = {
        visual_embedding: isValidEmbedding(visual_embedding)
          ? visual_embedding
          : null,
        text_embedding: isValidEmbedding(text_embedding)
          ? text_embedding
          : null,
        combined_embedding: combined_embedding,
        attributes: cleanAttributes,
        embedding_status: allEmbeddingsPresent ? "completed" : "partial",
        embedding_updated_at: new Date().toISOString(),
      };

      const { error: dbError } = await supabaseAdmin
        .from("posts")
        .update(updateData)
        .eq("id", postId);

      if (dbError) {
        console.error(
          `[postVectorPipeline] ❌ DB update failed: ${dbError.message}`,
        );
        throw new Error(`Database update failed: ${dbError.message}`);
      }

      console.log(
        `[postVectorPipeline] ✅ Post embedding generated for post=${postId}`,
      );
      console.log(
        `[postVectorPipeline] Columns written: visual=${isValidEmbedding(visual_embedding)}, text=${isValidEmbedding(text_embedding)}, combined=true, attributes=${!!cleanAttributes}`,
      );
      console.log(
        `[postVectorPipeline] 🎉 Pipeline COMPLETE for post=${postId}`,
      );
      return results;
    } catch (fetchErr) {
      if (fetchErr.name === "AbortError") {
        console.error(`[postVectorPipeline] ❌ ML service TIMEOUT after 300s`);
        throw new Error("ML service timed out");
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error(
      `[postVectorPipeline] 💥 PIPELINE ERROR for post ${postId}: ${err.message}`,
    );

    // ✅ FIX: Ensure we mark the post as failed so it doesn't stay 'pending' forever
    try {
      console.log(
        `[postVectorPipeline] 🔄 Marking post ${postId} as failed in DB...`,
      );
      const { error: updateError } = await supabaseAdmin
        .from("posts")
        .update({
          embedding_status: "failed",
          embedding_updated_at: new Date().toISOString(),
        })
        .eq("id", postId);

      if (updateError) {
        console.error(
          `[postVectorPipeline] ❌ Failed to mark post as failed: ${updateError.message}`,
        );
      } else {
        console.log(`[postVectorPipeline] ✅ Post ${postId} marked as failed`);
      }
    } catch (dbErr) {
      console.error(
        `[postVectorPipeline] ❌ Critical DB error during failure marking: ${dbErr.message}`,
      );
    }

    return null;
  }
}

module.exports = {
  processPostVectorPipeline,
};
