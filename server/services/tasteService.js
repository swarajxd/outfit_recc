const { createClient } = require("@supabase/supabase-js");

// ✅ NEW: User Taste Vector System
// This service handles incremental updates to the user's preference vector
// based on their interactions (likes).

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Updates the user's taste vector incrementally.
 * Uses a weighted average formula: updatedTaste = alpha * oldTaste + (1 - alpha) * newEmbedding
 * @param {string} userId - The Clerk user ID
 * @param {number[]} newEmbedding - The 512-dim embedding from the liked post
 * @returns {Promise<void>}
 */
async function updateTasteVector(userId, newEmbedding) {
  try {
    console.log(`[tasteService] Updating taste vector for user: ${userId}`);

    // STEP 3.1: VALIDATE INPUT
    if (!newEmbedding || !Array.isArray(newEmbedding) || newEmbedding.length === 0) {
      console.warn("[tasteService] Invalid embedding, skipping taste update");
      return;
    }

    // STEP 3.2: FETCH EXISTING TASTE VECTOR
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("taste_vector")
      .eq("clerk_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error(`[tasteService] Error fetching profile for ${userId}:`, fetchError);
      return;
    }

    const oldTaste = profile?.taste_vector;
    let updatedTaste;

    // STEP 3.3: HANDLE FIRST TIME USER
    if (!oldTaste) {
      console.log(`[tasteService] No existing taste vector for ${userId}, initializing with new embedding`);
      updatedTaste = [...newEmbedding];
    } else {
      // STEP 3.5: VALIDATE VECTOR LENGTH
      if (oldTaste.length !== newEmbedding.length) {
        console.warn(`[tasteService] Embedding size mismatch (old: ${oldTaste.length}, new: ${newEmbedding.length}), skipping update`);
        return;
      }

      // STEP 3.4: APPLY WEIGHTED UPDATE (CRITICAL)
      // alpha = 0.8 (preserves 80% of old taste, incorporates 20% of new)
      const alpha = 0.8;
      updatedTaste = oldTaste.map((val, i) => alpha * val + (1 - alpha) * newEmbedding[i]);
    }

    // STEP 3.6: NORMALIZE VECTOR (VERY IMPORTANT)
    const norm = Math.sqrt(updatedTaste.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      updatedTaste = updatedTaste.map(val => val / norm);
    } else {
      console.warn("[tasteService] Calculated norm is 0, skipping normalization");
    }

    // STEP 3.7: SAVE TO DATABASE
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        taste_vector: updatedTaste,
        taste_updated_at: new Date().toISOString()
      })
      .eq("clerk_id", userId);

    if (updateError) {
      console.error(`[tasteService] Error saving updated taste vector for ${userId}:`, updateError);
      return;
    }

    // STEP 3.8: ADD LOGGING
    console.log(`[tasteService] Successfully updated taste for ${userId}`);
    // console.log("Old taste:", oldTaste); // Avoid logging huge arrays in production logs usually
    // console.log("New embedding:", newEmbedding);
    // console.log("Updated taste:", updatedTaste);
  } catch (err) {
    console.error(`[tasteService] Taste update failed for user ${userId}:`, err.message);
    // DO NOT crash server
  }
}

/**
 * Fetches the user's taste vector from the profiles table.
 * @param {string} userId - The Clerk user ID
 * @returns {Promise<number[] | null>}
 */
async function getTasteVector(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("taste_vector")
      .eq("clerk_id", userId)
      .maybeSingle();

    if (error) {
      console.error(`[tasteService] Error fetching taste vector for ${userId}:`, error);
      return null;
    }

    return data?.taste_vector || null;
  } catch (err) {
    console.error(`[tasteService] Error in getTasteVector for ${userId}:`, err.message);
    return null;
  }
}

module.exports = {
  updateTasteVector,
  getTasteVector
};
