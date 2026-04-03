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

  // Check new outfit_data format from postVectorPipeline.js
  const items = Array.isArray(outfit_data.items) ? outfit_data.items : null;
  if (items) {
    return items
      .map((it) => it?.embedding)
      .filter((v) => Array.isArray(v) && v.length === 512);
  }

  // Backward compatibility with current wardrobe pipeline output.
  const vectors = Array.isArray(outfit_data.wardrobe_vectors)
    ? outfit_data.wardrobe_vectors
    : null;
  if (vectors) {
    return vectors
      .map((it) => it?.combined_embedding)
      .filter((v) => Array.isArray(v) && v.length === 512);
  }

  return [];
}

async function getUserLikedPosts(supabaseAdmin, user_id) {
  console.log("[for-you] USER ID:", user_id);
  const { data: likes, error: likesErr } = await supabaseAdmin
    .from("likes")
    .select("*")
    .eq("user_id", user_id);
  if (likesErr) throw likesErr;
  console.log("[for-you] LIKES COUNT:", (likes || []).length);

  const likedPostIds = (likes || []).map((l) => l.post_id).filter(Boolean);
  if (likedPostIds.length === 0) return { likedRows: likes || [], likedPosts: [] };

  const { data: likedPosts, error: lpErr } = await supabaseAdmin
    .from("posts")
    .select("id,outfit_data")
    .in("id", likedPostIds);
  if (lpErr) throw lpErr;
  console.log("[for-you] LIKED POSTS COUNT:", (likedPosts || []).length);
  return { likedRows: likes || [], likedPosts: likedPosts || [] };
}

function buildUserVector(likedPosts) {
  let all_embeddings = [];
  for (const post of likedPosts || []) {
    const embs = extractItemEmbeddings(post?.outfit_data);
    all_embeddings.push(...embs.map((e) => e.map((v) => Number(v))));
  }
  
  console.log("[for-you] TOTAL EMBEDDINGS USED:", all_embeddings.length);
  if (all_embeddings.length === 0) return null;

  const dim = all_embeddings[0].length;
  const mean = new Array(dim).fill(0);
  for (const emb of all_embeddings) {
    for (let i = 0; i < dim; i++) mean[i] += emb[i];
  }
  for (let i = 0; i < dim; i++) mean[i] /= all_embeddings.length;

  const user_vector = normalize(mean);
  if (user_vector) {
    console.log("[for-you] USER VECTOR BUILT, length:", user_vector.length);
  }
  return user_vector;
}

function computeSimilarity(user_vector, post) {
  if (!user_vector) return 0;
  const items = extractItemEmbeddings(post?.outfit_data);
  let best_score = 0;
  for (const emb of items) {
    const embNorm = normalize(emb) || emb;
    const score = dot(user_vector, embNorm);
    if (typeof score === "number" && Number.isFinite(score)) {
      if (score > best_score) best_score = score;
    }
  }
  return best_score;
}

async function latestPosts(supabaseAdmin, limit = 20, likedIdsSet = new Set()) {
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("id,image_url,caption,owner_clerk_id,tags,created_at,outfit_data")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  
  return (data || []).map(p => ({
    ...p,
    is_liked: likedIdsSet.has(String(p.id)),
    similarity_score: 0
  }));
}

async function getForYouFeed(supabaseAdmin, user_id) {
  let likedIdsSet = new Set();
  try {
    const { likedRows, likedPosts } = await getUserLikedPosts(supabaseAdmin, user_id);
    const likedPostIds = (likedRows || []).map((r) => r.post_id).filter(Boolean);
    likedIdsSet = new Set(likedPostIds.map(String));
    
    console.log("[for-you] Processing for-you feed for user:", user_id);

    const user_vector = buildUserVector(likedPosts);
    
    // Fetch a pool of posts to recommend from
    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select("id,image_url,caption,owner_clerk_id,tags,outfit_data,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (error) throw error;
    if (!posts || posts.length === 0) return [];

    // Score and filter
    const scored = posts.map((post) => {
      // If we have a user vector, compute similarity
      let similarity_score = 0;
      if (user_vector) {
        similarity_score = computeSimilarity(user_vector, post);
      }
      
      return {
        ...post,
        similarity_score,
        is_liked: likedIdsSet.has(String(post.id))
      };
    });

    // Sort: 
    // 1. If user has preferences (user_vector), sort by similarity
    // 2. Otherwise, just by recency (already done by SQL query)
    if (user_vector) {
      scored.sort((a, b) => {
        // First, push already liked posts to the bottom to show new content
        const aLiked = a.is_liked ? 1 : 0;
        const bLiked = b.is_liked ? 1 : 0;
        if (aLiked !== bLiked) return aLiked - bLiked;

        // Then, sort by similarity score (descending)
        if (b.similarity_score !== a.similarity_score) {
          return b.similarity_score - a.similarity_score;
        }
        // Recency as final fallback
        return new Date(b.created_at) - new Date(a.created_at);
      });
      console.log("[for-you] Personalized sort complete. Top score:", scored[0]?.similarity_score);
    } else {
      console.log("[for-you] No user preferences found, using recency-based feed");
    }

    // Limit to 20 for the feed
    return scored.slice(0, 20);
  } catch (err) {
    console.error("[for-you] Error generating For You feed:", err);
    // Fallback to latest posts, passing the likedIdsSet if we managed to fetch it
    return latestPosts(supabaseAdmin, 20, likedIdsSet);
  }
}
module.exports = {
  getUserLikedPosts,
  buildUserVector,
  computeSimilarity,
  getForYouFeed,
  dot,
  normalize,
};

