const FormData = require("form-data");
const { createClient } = require("@supabase/supabase-js");

// ✅ NEW: Post Vector Pipeline
// This service orchestrates the process of calling the Python ML service 
// to get outfit embeddings and then storing them in Supabase.

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    console.error("[postVectorPipeline] ❌ CRITICAL: outfitApiUrl is missing from options");
    return null;
  }

  console.log(`[postVectorPipeline] 🚀 Pipeline STARTED | User: ${userId} | Post: ${postId}`);

  try {
    // 1. Download image
    console.log(`[postVectorPipeline] 📥 Step 1: Downloading image from ${imageUrl}`);
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) {
        throw new Error(`Failed to download image: ${imgResp.status} ${imgResp.statusText}`);
    }
    const arrayBuffer = await imgResp.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    const contentType = imgResp.headers.get("content-type") || "image/jpeg";
    console.log(`[postVectorPipeline] ✅ Downloaded ${buf.length} bytes (type: ${contentType})`);

    // 2. Call Python ML service for segmentation and embeddings
    console.log(`[postVectorPipeline] 🧠 Step 2: Calling Python ML service at ${outfitApiUrl}/analyze-post`);
    const form = new FormData();
    form.append("file", buf, { filename: "post.jpg", contentType });
    form.append("user_id", String(userId));

    const headers = form.getHeaders();
    const body = await formDataToBuffer(form);
    headers["Content-Length"] = String(body.length);

    // Use a longer timeout for ML processing (default is usually 0, but some proxies/envs have 30s-60s)
    // We'll set a manual timeout if possible, but fetch doesn't support it natively in standard way without AbortController
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout for heavy ML

    try {
        const mlResp = await fetch(`${outfitApiUrl}/analyze-post`, {
            method: "POST",
            body,
            headers,
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!mlResp.ok) {
            const errText = await mlResp.text();
            console.error(`[postVectorPipeline] ❌ ML service HTTP ERROR: ${mlResp.status}`);
            console.error(`[postVectorPipeline] Error details: ${errText.substring(0, 500)}`);
            throw new Error(`ML service returned ${mlResp.status}`);
        }

        const mlResult = await mlResp.json();
        if (!mlResult.success) {
            console.error(`[postVectorPipeline] ❌ ML service APPLICATION ERROR: ${mlResult.error}`);
            if (mlResult.traceback) console.error(mlResult.traceback);
            throw new Error(mlResult.error || "ML pipeline failed internally");
        }

        const outfitData = mlResult.results;
        const itemCount = outfitData.items ? outfitData.items.length : 0;
        console.log(`[postVectorPipeline] ✅ ML success: Found ${itemCount} items`);

        // 3. Store in Supabase Storage (post-vectors bucket)
        console.log(`[postVectorPipeline] 💾 Step 3: Storing raw JSON in Supabase Storage`);
        const vectorFilePath = `posts/${postId}.json`;
        const { error: storageError } = await supabaseAdmin.storage
            .from("post-vectors")
            .upload(vectorFilePath, JSON.stringify(outfitData), {
                contentType: "application/json",
                upsert: true,
            });

        if (storageError) {
            console.warn(`[postVectorPipeline] ⚠️ Storage warning: ${storageError.message}`);
        } else {
            console.log(`[postVectorPipeline] ✅ Stored in storage: ${vectorFilePath}`);
        }

        // 4. Update the post in the DB with outfit_data
        console.log(`[postVectorPipeline] 📝 Step 4: Updating post ${postId} in DB`);
        const { error: dbError } = await supabaseAdmin
            .from("posts")
            .update({ outfit_data: outfitData })
            .eq("id", postId);

        if (dbError) {
            console.error(`[postVectorPipeline] ❌ DB update failed: ${dbError.message}`);
            throw new Error(`Database update failed: ${dbError.message}`);
        }

        console.log(`[postVectorPipeline] 🎉 Pipeline COMPLETE for post=${postId}`);
        return outfitData;

    } catch (fetchErr) {
        if (fetchErr.name === 'AbortError') {
            console.error(`[postVectorPipeline] ❌ ML service TIMEOUT after 120s`);
            throw new Error("ML service timed out");
        }
        throw fetchErr;
    } finally {
        clearTimeout(timeout);
    }

  } catch (err) {
    console.error(`[postVectorPipeline] 💥 PIPELINE CRASHED: ${err.message}`);
    // Safe return null, the post creation still succeeded in the main thread
    return null;
  }
}

module.exports = {
  processPostVectorPipeline,
};
