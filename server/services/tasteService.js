const { createClient } = require("@supabase/supabase-js");

// ✅ FIX: User taste vector system expanded
// This service handles incremental updates to multi-signal taste data

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalize(vec) {
  if (!Array.isArray(vec) || vec.length === 0) return null;
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return norm > 0 ? vec.map(v => v / norm) : vec;
}

/**
 * Updates the user's taste across multiple signals: combined, visual, text, and attributes.
 * @param {string} userId - Clerk ID
 * @param {object} post - Post object with embeddings and attributes
 */
async function updateUserTaste(userId, post) {
  try {
    console.log(`[tasteService] Updating multi-signal taste for user: ${userId}`);

    const { 
      combined_embedding: newComb, 
      visual_embedding: newVis, 
      text_embedding: newText,
      attributes: newAttrs 
    } = post;

    if (!newComb || !Array.isArray(newComb)) {
      console.warn("[tasteService] Missing combined embedding, skipping update");
      return;
    }

    // Fetch existing taste
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("taste_vector, visual_taste_vector, text_taste_vector, attribute_preferences")
      .eq("clerk_id", userId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const alpha = 0.8;
    const updateVector = (old, latest) => {
      if (!latest || !Array.isArray(latest)) return old;
      if (!old) return latest;
      if (old.length !== latest.length) return old;
      const updated = old.map((v, i) => alpha * v + (1 - alpha) * latest[i]);
      return normalize(updated);
    };

    const updatedComb = updateVector(profile?.taste_vector, newComb);
    const updatedVis = updateVector(profile?.visual_taste_vector, newVis);
    const updatedText = updateVector(profile?.text_taste_vector, newText);

    // Merge attributes (Step 10: Frequency tracking)
    let updatedAttrPrefs = profile?.attribute_preferences || { categories: {}, colors: {}, styles: {} };
    
    if (newAttrs) {
      const cats = newAttrs.categories || [];
      const cols = newAttrs.colors || [];
      
      cats.forEach(c => {
        updatedAttrPrefs.categories[c] = (updatedAttrPrefs.categories[c] || 0) + 1;
      });
      cols.forEach(c => {
        updatedAttrPrefs.colors[c] = (updatedAttrPrefs.colors[c] || 0) + 1;
      });
    }

    // Save
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        taste_vector: updatedComb,
        visual_taste_vector: updatedVis,
        text_taste_vector: updatedText,
        attribute_preferences: updatedAttrPrefs,
        taste_updated_at: new Date().toISOString()
      })
      .eq("clerk_id", userId);

    if (updateError) throw updateError;

    console.log("Updated user taste:", userId);
  } catch (err) {
    console.error(`[tasteService] 💥 CRITICAL: updateUserTaste failed for ${userId}:`, err.message);
  }
}

/**
 * Fetches the full taste profile for a user.
 */
async function getFullTasteProfile(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("taste_vector, visual_taste_vector, text_taste_vector, attribute_preferences")
      .eq("clerk_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`[tasteService] Error fetching full taste profile for ${userId}:`, err.message);
    return null;
  }
}

module.exports = {
  updateUserTaste,
  getFullTasteProfile,
  // Keep legacy for backward compatibility if needed
  getTasteVector: async (id) => (await getFullTasteProfile(id))?.taste_vector
};
