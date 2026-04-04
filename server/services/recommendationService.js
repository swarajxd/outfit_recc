const { getTasteVector } = require("./tasteService");
const { getUserLikes } = require("./likeService");

function dot(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return null;
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

function extractItemEmbeddings(outfit_data) {
  if (!outfit_data || typeof outfit_data !== "object") return [];

  const items = Array.isArray(outfit_data.items) ? outfit_data.items : null;
  if (items) {
    return items
      .map((it) => it?.embedding)
      .filter((v) => Array.isArray(v) && v.length === 512);
  }

  const vectors = Array.isArray(outfit_data.wardrobe_vectors)
    ? outfit_data.wardrobe_vectors
    : null;
  if (vectors) {
    return vectors
      .map((it) => it?.combined_embedding)
      .filter((v) => Array.isArray(v) && v.length === 512);
  }

  // Check if combined_embedding exists directly
  if (Array.isArray(outfit_data.combined_embedding) && outfit_data.combined_embedding.length === 512) {
    return [outfit_data.combined_embedding];
  }

  return [];
}

async function getForYouFeed(supabaseAdmin, user_id) {
  let likedIdsSet = new Set();
  try {
    // 1. Fetch user likes for persistence
    const likedPostIds = user_id ? await getUserLikes(user_id) : [];
    likedIdsSet = new Set(likedPostIds.map(String));
    console.log("User likes fetched:", likedPostIds);

    // 2. Fetch user taste vector
    const taste_vector = user_id ? await getTasteVector(user_id) : null;
    console.log("User taste:", taste_vector);

    // 3. Fetch a pool of posts
    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select("id,image_url,caption,owner_clerk_id,tags,outfit_data,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (error) throw error;
    if (!posts || posts.length === 0) return [];

    console.log("Ranking posts...");

    // 4. Score posts
    const now = Date.now();
    const scored = posts
      .filter(p => p.outfit_data && extractItemEmbeddings(p.outfit_data).length > 0)
      .map((post) => {
        let similarity = 0;
        if (taste_vector) {
          const items = extractItemEmbeddings(post.outfit_data);
          // Use best matching item for similarity
          let best_sim = 0;
          for (const emb of items) {
            const sim = dot(taste_vector, normalize(emb) || emb);
            if (sim > best_sim) best_sim = sim;
          }
          similarity = best_sim;
        }

        // Recency score: 1 / (current_time - created_at_ms + 1)
        // Normalize time to days or hours to keep score meaningful
        const ageMs = Math.max(0, now - new Date(post.created_at).getTime());
        const ageHours = ageMs / (1000 * 60 * 60);
        const recency_score = 1 / (ageHours + 1);

        // Final score: 0.7 * similarity + 0.3 * recency
        // If no taste vector, use recency only (similarity = 0)
        const score = taste_vector ? (0.7 * similarity + 0.3 * recency_score) : recency_score;

        return {
          id: post.id,
          image_url: post.image_url,
          caption: post.caption,
          owner_clerk_id: post.owner_clerk_id,
          tags: post.tags,
          created_at: post.created_at,
          liked: likedIdsSet.has(String(post.id)),
          score,
          similarity
        };
      });

    // 5. Sort by final score
    scored.sort((a, b) => b.score - a.score);

    if (taste_vector && scored.length > 0) {
      console.log("Feed ranked using taste + recency");
      console.log("Top post score:", scored[0].score);
    } else {
      console.log("Feed using recency-based fallback");
    }

    return scored.slice(0, 20);
  } catch (err) {
    console.error("[for-you] Error generating For You feed:", err);
    // Fallback to latest posts
    const { data } = await supabaseAdmin
      .from("posts")
      .select("id,image_url,caption,owner_clerk_id,tags,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    
    return (data || []).map(p => ({
      ...p,
      liked: likedIdsSet.has(String(p.id)),
      score: 0
    }));
  }
}

module.exports = {
  getForYouFeed,
  dot,
  normalize,
};

