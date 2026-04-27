const { getFullTasteProfile } = require("./tasteService");
const { getUserLikes } = require("./likeService");

// ✅ FIX: Feed ranking using multi-signal similarity

// Extracts only public-safe fields from a post row
function postToPublic(post) {
  return {
    id: post.id,
    image_url: post.image_url,
    caption: post.caption,
    owner_clerk_id: post.owner_clerk_id,
    tags: post.tags,
    created_at: post.created_at,
    attributes: post.attributes,
  };
}

function dot(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Number(a[i]) * Number(b[i]);
  return s;
}

function normalize(vec) {
  if (!Array.isArray(vec) || vec.length === 0) return null;
  const nums = vec.map((v) => Number(v));
  if (nums.some((v) => !Number.isFinite(v))) return null;
  const norm = Math.sqrt(nums.reduce((s, v) => s + v * v, 0));
  if (!Number.isFinite(norm) || norm === 0) return null;
  return nums.map((v) => v / norm);
}

/**
 * Calculates attribute overlap score (categories and colors).
 * ✅ FIX: Part 4, Step 20
 */
function getAttributeScore(userPrefs, postAttrs) {
  if (!userPrefs || !postAttrs) return 0;
  let score = 0;

  const postCats = postAttrs.categories || [];
  const postCols = postAttrs.colors || [];

  // Weight based on frequency in user preferences
  postCats.forEach((c) => {
    if (userPrefs.categories?.[c]) score += 1;
  });
  postCols.forEach((c) => {
    if (userPrefs.colors?.[c]) score += 1;
  });

  return score > 0 ? Math.min(1, score / 5) : 0;
}

/**
 * Safely computes cosine similarity between a taste vector and a post embedding.
 *
 * Returns null (not 0) when:
 *   - The taste vector for this signal is missing (NULL in DB)
 *   - The post doesn't have this embedding
 *
 * Returning null lets the scoring formula skip this signal entirely
 * instead of penalising it with a 0.
 *
 * Bug fixed: previously `dot(normalize(null), normalize([...]))` returned 0,
 * which was treated as a real signal (0 similarity) in the full formula,
 * dragging the score down when visual/text taste vectors were null.
 */
function computeSimilarity(tasteVec, postEmb) {
  // Both must be valid non-empty arrays
  if (!Array.isArray(tasteVec) || tasteVec.length === 0) return null;
  if (!Array.isArray(postEmb) || postEmb.length === 0) return null;

  const normTaste = normalize(tasteVec);
  const normPost = normalize(postEmb);

  if (!normTaste || !normPost) return null;

  return dot(normTaste, normPost);
}

async function getForYouFeed(supabaseAdmin, user_id) {
  let likedIdsSet = new Set();
  try {
    // 1. Fetch user likes for persistence
    const likedPostIds = user_id ? await getUserLikes(user_id) : [];
    likedIdsSet = new Set(likedPostIds.map(String));

    // 2. Fetch user taste profile (Part 4, Step 17)
    const taste = user_id ? await getFullTasteProfile(user_id) : null;

    if (taste) {
      console.log("User taste vector length:", taste.taste_vector?.length);
    }

    // 3. Fetch posts (only those with embeddings)
    // ✅ FIX: Include posts that have combined_embedding even if other signals are null
    // This ensures new posts appear immediately once combined embedding is ready
    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select(
        "id,image_url,caption,owner_clerk_id,tags,combined_embedding,visual_embedding,text_embedding,attributes,created_at,embedding_status",
      )
      .not("combined_embedding", "is", null) // must have at least combined
      .in("embedding_status", ["completed", "partial"]) // accept partial too
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (!posts || posts.length === 0) return [];

    console.log("Fetched posts:", posts.length);

    // 4. Score posts using available taste signals
    const now = Date.now();
    const scored = posts.map((post) => {
      const ageMs = Math.max(0, now - new Date(post.created_at).getTime());
      const ageHours = ageMs / (1000 * 60 * 60);
      const recency_score = 1 / (ageHours + 1);

      // No taste profile yet - rank by recency only
      if (!taste || !Array.isArray(taste.taste_vector)) {
        return {
          ...postToPublic(post),
          score: recency_score,
          liked: likedIdsSet.has(String(post.id)),
        };
      }

      // ✅ FIX Bug 3: computeSimilarity returns null when either vector is missing.
      // This means a null visual_taste_vector correctly falls back to combined-only,
      // rather than contributing a 0 score to the full formula.
      const sim_combined = computeSimilarity(
        taste.taste_vector,
        post.combined_embedding,
      );
      const sim_visual = computeSimilarity(
        taste.visual_taste_vector,
        post.visual_embedding,
      );
      const sim_text = computeSimilarity(
        taste.text_taste_vector,
        post.text_embedding,
      );
      const attr_score = getAttributeScore(
        taste.attribute_preferences,
        post.attributes,
      );

      let score;

      if (sim_combined !== null && sim_visual !== null && sim_text !== null) {
        // All 3 signals present - full weighted formula
        score =
          0.5 * sim_combined +
          0.2 * sim_visual +
          0.1 * sim_text +
          0.1 * attr_score +
          0.1 * recency_score;

      } else if (sim_combined !== null) {
        // Only combined available (visual/text taste vectors not yet populated)
        // This is the common case for new users or users with few likes
        score = 0.7 * sim_combined + 0.2 * attr_score + 0.1 * recency_score;

      } else {
        // No usable taste signal - fall back to recency
        score = recency_score;
      }

      return {
        ...postToPublic(post),
        liked: likedIdsSet.has(String(post.id)),
        score,
        _debug: {
          sim_combined,
          sim_visual,
          sim_text,
          attr_score,
          recency_score,
        },
      };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    console.log(
      `[for-you] User taste: ${taste ? `present (${taste.like_count || "?"} likes)` : "absent"}`,
    );
    console.log(`[for-you] Posts scored: ${scored.length}`);
    console.log(`[for-you] Top post score: ${scored[0]?.score?.toFixed(4)}`);
    console.log(
      `[for-you] Score signals: combined=${scored[0]?._debug?.sim_combined?.toFixed(3)}, visual=${scored[0]?._debug?.sim_visual?.toFixed(3) ?? "null"}, text=${scored[0]?._debug?.sim_text?.toFixed(3) ?? "null"}`,
    );

    return scored.slice(0, 20);
  } catch (err) {
    console.error("[for-you] Error generating For You feed:", err);
    return [];
  }
}

/**
 * Explore page feed ranking logic: 0.6 * recency + 0.4 * diversity
 */
async function getExploreFeed(supabaseAdmin, user_id = null) {
  let likedIdsSet = new Set();
  try {
    if (user_id) {
      const likedPostIds = await getUserLikes(user_id);
      likedIdsSet = new Set(likedPostIds.map(String));
    }

    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select(
        "id,image_url,caption,owner_clerk_id,tags,combined_embedding,attributes,created_at,embedding_status",
      )
      .not("combined_embedding", "is", null) // must have at least combined
      .in("embedding_status", ["completed", "partial"]) // accept partial too
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (!posts) return [];

    const now = Date.now();
    const scored = posts.map((post) => {
      const ageMs = Math.max(0, now - new Date(post.created_at).getTime());
      const ageHours = ageMs / (1000 * 60 * 60);
      const recency = 1 / (ageHours + 1);
      const diversity = Math.random();

      // Final Explore Score
      const score = 0.6 * recency + 0.4 * diversity;

      return {
        ...postToPublic(post),
        liked: likedIdsSet.has(String(post.id)),
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20);
  } catch (err) {
    console.error("[explore] Error generating Explore feed:", err);
    return [];
  }
}

module.exports = {
  getForYouFeed,
  getExploreFeed,
  dot,
  normalize,
};
