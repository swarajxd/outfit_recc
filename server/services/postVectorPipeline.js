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
    // Ensure we mark as failed if we can
    try {
      await supabaseAdmin.from("posts").update({ embedding_status: 'failed' }).eq("id", postId);
    } catch (e) {}
    return null;
  }

  console.log(`[postVectorPipeline] 🚀 Pipeline STARTED | User: ${userId} | Post: ${postId} | API: ${outfitApiUrl}`);

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

    // Use a longer timeout for ML processing
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // Increased to 5 minutes for heavy SAM processing

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
        const results = mlResult.results || {};
        
        if (!mlResult.success) {
            console.error(`[postVectorPipeline] ❌ ML service APPLICATION ERROR: ${mlResult.error || results.error || "Unknown error"}`);
            console.error(`[postVectorPipeline] Full results on failure: ${JSON.stringify(results)}`);
            if (mlResult.traceback || results.traceback) {
              console.error(mlResult.traceback || results.traceback);
            }
            throw new Error(mlResult.error || results.error || "ML pipeline failed internally");
        }

        console.log(`[postVectorPipeline] ✅ ML success: Aggregated post-level vectors returned`);

        // 3. Update the post in the DB with separate columns
        console.log(`[postVectorPipeline] 📝 Step 3: Updating post ${postId} with separate embedding columns`);
        
        const updateData = {
          visual_embedding: results.visual_embedding,
          text_embedding: results.text_embedding,
          combined_embedding: results.combined_embedding,
          attributes: results.attributes,
          embedding_status: 'completed',
          embedding_updated_at: new Date().toISOString()
        };

        const { error: dbError } = await supabaseAdmin
            .from("posts")
            .update(updateData)
            .eq("id", postId);

        if (dbError) {
            console.error(`[postVectorPipeline] ❌ DB update failed: ${dbError.message}`);
            throw new Error(`Database update failed: ${dbError.message}`);
        }

        console.log(`[postVectorPipeline] 🎉 Pipeline COMPLETE for post=${postId}`);
        return results;

    } catch (fetchErr) {
        if (fetchErr.name === 'AbortError') {
            console.error(`[postVectorPipeline] ❌ ML service TIMEOUT after 300s`);
            throw new Error("ML service timed out");
        }
        throw fetchErr;
    } finally {
        clearTimeout(timeout);
    }

  } catch (err) {
    console.error(`[postVectorPipeline] 💥 PIPELINE ERROR for post ${postId}: ${err.message}`);
    
    // ✅ FIX: Ensure we mark the post as failed so it doesn't stay 'pending' forever
    try {
      console.log(`[postVectorPipeline] 🔄 Marking post ${postId} as failed in DB...`);
      const { error: updateError } = await supabaseAdmin
        .from("posts")
        .update({ 
          embedding_status: 'failed',
          embedding_updated_at: new Date().toISOString()
        })
        .eq("id", postId);
      
      if (updateError) {
        console.error(`[postVectorPipeline] ❌ Failed to mark post as failed: ${updateError.message}`);
      } else {
        console.log(`[postVectorPipeline] ✅ Post ${postId} marked as failed`);
      }
    } catch (dbErr) {
      console.error(`[postVectorPipeline] ❌ Critical DB error during failure marking: ${dbErr.message}`);
    }
    
    return null;
  }
}

module.exports = {
  processPostVectorPipeline,
};
