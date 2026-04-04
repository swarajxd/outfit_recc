const { createClient } = require("@supabase/supabase-js");
const { updateTasteVector } = require("./tasteService");

// ✅ NEW: Like Service
// This service handles all logic related to post likes, including adding,
// removing, and fetching likes from Supabase.

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Adds a like to a post for a specific user.
 * Handles duplicates gracefully due to unique constraint in Supabase.
 * @param {string} userId - The Clerk user ID
 * @param {string} postId - The UUID of the post
 * @returns {Promise<{liked: boolean}>}
 */
async function addLike(userId, postId) {
  try {
    console.log(`[likeService] ➕ addLike: user=${userId}, post=${postId}`);
    
    // Check if like already exists to avoid unnecessary error logging from Supabase
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("likes")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .maybeSingle();

    if (checkError) {
      console.error(`[likeService] ❌ Error checking existing like:`, checkError);
      throw checkError;
    }

    if (existing) {
      console.log(`[likeService] ℹ️ Like already exists for user=${userId}, post=${postId}`);
      return { liked: true };
    }

    const { error } = await supabaseAdmin
      .from("likes")
      .insert([{ user_id: userId, post_id: postId }]);

    if (error) {
      console.error(`[likeService] ❌ Supabase Insert Error:`, error);
      // If it's a unique constraint violation, we still return liked: true
      if (error.code === '23505') {
        return { liked: true };
      }
      throw error;
    }

    console.log(`[likeService] ✅ Like added successfully to DB`);

    // ✅ UPDATE: Taste updated on like
    // Fetch post embedding and update user taste vector asynchronously
    (async () => {
      try {
        console.log(`[likeService] Fetching post ${postId} for taste update...`);
        const { data: post, error: postError } = await supabaseAdmin
          .from("posts")
          .select("outfit_data")
          .eq("id", postId)
          .maybeSingle();

        if (postError) {
          console.error(`[likeService] Error fetching post for taste update:`, postError);
          return;
        }

        const embedding = post?.outfit_data?.combined_embedding;
        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          console.warn("[likeService] No embedding found, skipping taste update");
          return;
        }

        console.log(`[likeService] Calling updateTasteVector for user ${userId}`);
        await updateTasteVector(userId, embedding);
      } catch (err) {
        console.error(`[likeService] Taste update failed:`, err.message);
      }
    })();

    return { liked: true };
  } catch (err) {
    console.error(`[likeService] 💥 CRITICAL ERROR in addLike:`, err.message);
    throw err;
  }
}

/**
 * Removes a like from a post for a specific user.
 * @param {string} userId - The Clerk user ID
 * @param {string} postId - The UUID of the post
 * @returns {Promise<{liked: boolean}>}
 */
async function removeLike(userId, postId) {
  try {
    console.log(`[likeService] ➖ removeLike: user=${userId}, post=${postId}`);
    
    const { error } = await supabaseAdmin
      .from("likes")
      .delete()
      .eq("user_id", userId)
      .eq("post_id", postId);

    if (error) {
      console.error(`[likeService] ❌ Supabase Delete Error:`, error);
      throw error;
    }

    console.log(`[likeService] ✅ Like removed successfully from DB`);
    return { liked: false };
  } catch (err) {
    console.error(`[likeService] 💥 CRITICAL ERROR in removeLike:`, err.message);
    throw err;
  }
}

/**
 * Toggles a like for a post (adds if not exists, removes if exists).
 * @param {string} userId - The Clerk user ID
 * @param {string} postId - The UUID of the post
 * @returns {Promise<{liked: boolean}>}
 */
async function toggleLike(userId, postId) {
  try {
    console.log("Like toggled:", userId, postId);
    const { data: existing } = await supabaseAdmin
      .from("likes")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .maybeSingle();

    if (existing) {
      return await removeLike(userId, postId);
    } else {
      return await addLike(userId, postId);
    }
  } catch (err) {
    console.error(`[likeService] Error toggling like:`, err.message);
    throw err;
  }
}

/**
 * Fetches all post IDs liked by a specific user.
 * @param {string} userId - The Clerk user ID
 * @returns {Promise<string[]>} Array of post UUIDs
 */
async function getUserLikes(userId) {
  try {
    console.log(`[likeService] 🔍 getUserLikes for user=${userId}`);
    
    const { data, error } = await supabaseAdmin
      .from("likes")
      .select("post_id")
      .eq("user_id", userId);

    if (error) {
      console.error(`[likeService] ❌ Supabase Fetch Error:`, error);
      throw error;
    }

    const likedPostIds = (data || []).map(row => row.post_id);
    console.log("User likes fetched:", likedPostIds);
    return likedPostIds;
  } catch (err) {
    console.error(`[likeService] 💥 CRITICAL ERROR in getUserLikes:`, err.message);
    throw err;
  }
}

module.exports = {
  addLike,
  removeLike,
  toggleLike,
  getUserLikes
};
