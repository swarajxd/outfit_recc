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
      .map((it) => it?.combined_embedding)
      .filter((v) => Array.isArray(v) && v.length === 512);
  }

  // Backward compatibility with current pipeline output.
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
  console.log("[for-you] LIKES:", likes || []);

  const likedPostIds = (likes || []).map((l) => l.post_id).filter(Boolean);
  if (likedPostIds.length === 0) return { likedRows: likes || [], likedPosts: [] };

  const { data: likedPosts, error: lpErr } = await supabaseAdmin
    .from("posts")
    .select("id,outfit_data")
    .in("id", likedPostIds);
  if (lpErr) throw lpErr;
  console.log("[for-you] LIKED POSTS:", likedPosts || []);
  return { likedRows: likes || [], likedPosts: likedPosts || [] };
}

function buildUserVector(likedPosts) {
  let all_embeddings = [];
  for (const post of likedPosts || []) {
    console.log(
      "[for-you] LIKED POST OUTFIT_DATA:",
      post?.id,
      post?.outfit_data ? "present" : "missing",
    );
    const wardrobeVectors = Array.isArray(post?.outfit_data?.wardrobe_vectors)
      ? post.outfit_data.wardrobe_vectors
      : [];
    const embs = wardrobeVectors
      .map((it) => it?.combined_embedding)
      .filter((v) => Array.isArray(v) && v.length === 512);
    all_embeddings.push(...embs.map((e) => e.map((v) => Number(v))));
  }
  console.log("TOTAL EMBEDDINGS USED:", all_embeddings.length);
  if (all_embeddings.length < 3) return null;
  if (all_embeddings.length === 0) return null;

  const dim = all_embeddings[0].length;
  const mean = new Array(dim).fill(0);
  for (const emb of all_embeddings) {
    for (let i = 0; i < dim; i++) mean[i] += emb[i];
  }
  for (let i = 0; i < dim; i++) mean[i] /= all_embeddings.length;

  const user_vector = normalize(mean);
  if (user_vector) {
    console.log("USER VECTOR BUILT");
    console.log("USER VECTOR LENGTH:", user_vector.length);
  }
  return user_vector;
}

function computeSimilarity(user_vector, post) {
  const items = extractItemEmbeddings(post?.outfit_data);
  let best_score = 0;
  for (const emb of items) {
    const embNorm = normalize(emb) || emb;
    const score = dot(user_vector, embNorm);
    if (typeof score === "number" && Number.isFinite(score)) {
      console.log("SIMILARITY SCORE:", score);
      if (score > best_score) best_score = score;
    }
  }
  return best_score;
}

async function latestPosts(supabaseAdmin, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select("id,image_url,caption,owner_clerk_id,tags,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function getForYouFeed(supabaseAdmin, user_id) {
  const { likedRows, likedPosts } = await getUserLikedPosts(supabaseAdmin, user_id);
  const likedPostIds = (likedRows || []).map((r) => r.post_id).filter(Boolean);
  console.log("[for-you]", { user_id, liked_count: likedPostIds.length });
  if (!likedPostIds.length) return latestPosts(supabaseAdmin, 20);

  const user_vector = buildUserVector(likedPosts);
  if (!user_vector) return latestPosts(supabaseAdmin, 20);

  const { data: posts, error } = await supabaseAdmin
    .from("posts")
    .select("id,image_url,caption,owner_clerk_id,tags,outfit_data,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const validPosts = (posts || []).filter(
    (post) =>
      post?.outfit_data &&
      Array.isArray(post.outfit_data.wardrobe_vectors) &&
      post.outfit_data.wardrobe_vectors.length > 0,
  );

  const scored = validPosts.map((post) => {
    let best_score = 0;
    for (const item of post.outfit_data.wardrobe_vectors || []) {
      const vector = item?.combined_embedding;
      if (!Array.isArray(vector) || vector.length !== 512) continue;
      const score = dot(user_vector, vector);
      if (typeof score === "number" && Number.isFinite(score)) {
        console.log("SIMILARITY SCORE:", score);
        best_score = Math.max(best_score, score);
      }
    }
    const similarity_score = best_score;
    console.log("[for-you] SIMILARITY:", post.id, similarity_score);
    return {
      id: post.id,
      image_url: post.image_url,
      caption: post.caption,
      owner_clerk_id: post.owner_clerk_id,
      tags: post.tags,
      created_at: post.created_at,
      similarity_score,
    };
  });
  scored.sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0));
  console.log(
    "TOP 5 POSTS:",
    scored.slice(0, 5).map((p) => ({ id: p.id, score: p.similarity_score })),
  );

  const likedIds = new Set(likedPostIds.map((x) => String(x)));
  const byRecent = [...validPosts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const recent_posts = byRecent.slice(0, 5).map((p) => ({
    id: p.id,
    image_url: p.image_url,
    caption: p.caption,
    owner_clerk_id: p.owner_clerk_id,
    tags: p.tags,
    created_at: p.created_at,
    similarity_score: 0,
  }));
  const recentIds = new Set(recent_posts.map((p) => String(p.id)));

  const similar_posts = scored
    .filter((p) => !recentIds.has(String(p.id)))
    .filter((p) => !likedIds.has(String(p.id)))
    .filter((p) => (p.similarity_score || 0) > 0.5);

  const used = new Set([...recent_posts, ...similar_posts].map((p) => String(p.id)));
  const other_posts = validPosts
    .filter((p) => !used.has(String(p.id)))
    .filter((p) => !likedIds.has(String(p.id)))
    .map((p) => ({
      id: p.id,
      image_url: p.image_url,
      caption: p.caption,
      owner_clerk_id: p.owner_clerk_id,
      tags: p.tags,
      created_at: p.created_at,
      similarity_score: 0,
    }));

  return [...recent_posts, ...similar_posts, ...other_posts].slice(0, 20);
}

module.exports = {
  getUserLikedPosts,
  buildUserVector,
  computeSimilarity,
  getForYouFeed,
  dot,
  normalize,
};

