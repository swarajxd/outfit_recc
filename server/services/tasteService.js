const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function normalize(vec) {
  if (!Array.isArray(vec) || vec.length === 0) return null;
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? vec.map((v) => v / norm) : null;
}

/**
 * Checks if a value is a valid non-empty embedding array.
 */
function isValidEmbedding(emb) {
  return Array.isArray(emb) && emb.length > 0;
}

/**
 * Exponential moving average: alpha * old + (1-alpha) * latest, then normalize.
 * Returns `latest` (normalized) if there is no previous vector.
 * Returns `old` unchanged if `latest` is invalid.
 */
function emaUpdate(old, latest, alpha) {
  if (!isValidEmbedding(latest)) return old ?? null;
  if (!isValidEmbedding(old)) return normalize(latest);
  if (old.length !== latest.length) return normalize(latest); // dimension mismatch -> reset
  const updated = old.map((v, i) => alpha * v + (1 - alpha) * latest[i]);
  return normalize(updated);
}

/**
 * Dynamic alpha based on how many posts the user has liked.
 *
 * Early history  (< 5 likes)  : alpha = 0.50  -> new like = 50% weight
 * Growing history(5-20 likes) : alpha = 0.65  -> new like = 35% weight
 * Stable taste   (> 20 likes) : alpha = 0.75  -> new like = 25% weight
 *
 * Lower alpha = newer likes dominate more.
 * Higher alpha = existing taste is more stable.
 */
function dynamicAlpha(likeCount) {
  if (!likeCount || likeCount < 5) return 0.5;
  if (likeCount <= 20) return 0.65;
  return 0.75;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: updateUserTaste
// Called every time a user likes a post.
// Updates all 3 taste vectors + attribute preferences in `profiles`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Updates the user's taste profile based on a liked post.
 *
 * Taste vector update strategy:
 *   new_taste = normalize( alpha * old_taste + (1-alpha) * post_embedding )
 *
 * Where alpha is dynamic (lower when user has few likes -> recent likes matter more).
 *
 * Substitution rule (fixes NULL visual/text in posts):
 *   If the liked post has no visual_embedding -> use combined_embedding instead.
 *   If the liked post has no text_embedding   -> use combined_embedding instead.
 *   This ensures all 3 taste vectors always get populated.
 *
 * @param {string} userId - Clerk user ID
 * @param {object} post   - Post row: { combined_embedding, visual_embedding, text_embedding, attributes }
 */
async function updateUserTaste(userId, post) {
  try {
    console.log(`[tasteService] Updating taste for user: ${userId}`);

    const {
      combined_embedding: newComb,
      visual_embedding: newVis,
      text_embedding: newText,
      attributes: newAttrs,
    } = post;

    // combined_embedding is mandatory - skip if missing
    if (!isValidEmbedding(newComb)) {
      console.warn(
        "[tasteService] ⚠ Skipping: post has no combined_embedding",
      );
      return;
    }

    // ✅ FIX Bug 1: Substitute combined for missing visual/text
    // This ensures visual_taste_vector and text_taste_vector ALWAYS get populated.
    const effectiveVis = isValidEmbedding(newVis) ? newVis : newComb;
    const effectiveText = isValidEmbedding(newText) ? newText : newComb;

    console.log(
      `[tasteService] Signal availability: combined=✅ visual=${isValidEmbedding(newVis) ? "✅" : "⚠(substituted)"} text=${isValidEmbedding(newText) ? "✅" : "⚠(substituted)"}`,
    );

    // Fetch existing profile
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select(
        "taste_vector, visual_taste_vector, text_taste_vector, attribute_preferences, like_count",
      )
      .eq("clerk_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error(
        "[tasteService] ❌ Failed to fetch profile:",
        fetchError.message,
      );
      throw fetchError;
    }

    // ✅ FIX Bug 2: Dynamic alpha based on like count
    const likeCount = (profile?.like_count || 0) + 1; // +1 for this like
    const alpha = dynamicAlpha(likeCount);
    console.log(
      `[tasteService] like_count=${likeCount}, alpha=${alpha} (new like weight=${((1 - alpha) * 100).toFixed(0)}%)`,
    );

    // Update all 3 taste vectors
    const updatedComb = emaUpdate(profile?.taste_vector, newComb, alpha);
    const updatedVis = emaUpdate(
      profile?.visual_taste_vector,
      effectiveVis,
      alpha,
    );
    const updatedText = emaUpdate(
      profile?.text_taste_vector,
      effectiveText,
      alpha,
    );

    // ✅ FIX Bug 4: Update attribute preferences
    // Merge categories and colors from the liked post's attributes.
    // Falls back to empty arrays if attributes is null.
    let updatedAttrPrefs = profile?.attribute_preferences || {
      categories: {},
      colors: {},
      styles: {},
    };

    // Ensure the shape is correct even if DB had a malformed value
    if (
      typeof updatedAttrPrefs !== "object" ||
      Array.isArray(updatedAttrPrefs)
    ) {
      updatedAttrPrefs = { categories: {}, colors: {}, styles: {} };
    }
    updatedAttrPrefs.categories = updatedAttrPrefs.categories || {};
    updatedAttrPrefs.colors = updatedAttrPrefs.colors || {};
    updatedAttrPrefs.styles = updatedAttrPrefs.styles || {};

    const cats = newAttrs?.categories || [];
    const cols = newAttrs?.colors || [];
    const style = newAttrs?.style;

    cats.forEach((c) => {
      if (c && c !== "unknown" && c !== "n/a") {
        updatedAttrPrefs.categories[c] =
          (updatedAttrPrefs.categories[c] || 0) + 1;
      }
    });
    cols.forEach((c) => {
      if (c && c !== "unknown" && c !== "n/a") {
        updatedAttrPrefs.colors[c] = (updatedAttrPrefs.colors[c] || 0) + 1;
      }
    });
    if (style && style !== "unknown" && style !== "n/a") {
      updatedAttrPrefs.styles[style] = (updatedAttrPrefs.styles[style] || 0) + 1;
    }

    // Validate - don't write null vectors to DB
    if (!updatedComb) {
      console.error(
        "[tasteService] ❌ Combined taste vector computation failed - skipping DB write",
      );
      return;
    }

    // Write to DB
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        taste_vector: updatedComb,
        visual_taste_vector: updatedVis,
        text_taste_vector: updatedText,
        attribute_preferences: updatedAttrPrefs,
        like_count: likeCount,
        taste_updated_at: new Date().toISOString(),
      })
      .eq("clerk_id", userId);

    if (updateError) {
      console.error("[tasteService] ❌ DB update failed:", updateError.message);
      throw updateError;
    }

    console.log(
      `[tasteService] ✅ Taste updated | user=${userId} | alpha=${alpha} | likes=${likeCount}`,
    );
    console.log(
      `[tasteService]    categories tracked: ${Object.keys(updatedAttrPrefs.categories).join(", ") || "none"}`,
    );
    console.log(
      `[tasteService]    colors tracked: ${Object.keys(updatedAttrPrefs.colors).join(", ") || "none"}`,
    );
  } catch (err) {
    console.error(
      `[tasteService] 💥 CRITICAL: updateUserTaste failed for ${userId}:`,
      err.message,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getFullTasteProfile - used by recommendationService
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the full taste profile for a user.
 * Returns null if the user has no taste data yet (no likes).
 */
async function getFullTasteProfile(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "taste_vector, visual_taste_vector, text_taste_vector, attribute_preferences, like_count",
      )
      .eq("clerk_id", userId)
      .maybeSingle();

    if (error) throw error;

    // Only return taste if the user has actually liked something
    if (!data || !isValidEmbedding(data.taste_vector)) {
      console.log(`[tasteService] No taste profile for user ${userId} yet`);
      return null;
    }

    return data;
  } catch (err) {
    console.error(
      `[tasteService] Error fetching taste profile for ${userId}:`,
      err.message,
    );
    return null;
  }
}

module.exports = {
  updateUserTaste,
  getFullTasteProfile,
  // Legacy compat
  getTasteVector: async (id) => (await getFullTasteProfile(id))?.taste_vector,
};
