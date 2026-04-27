const express = require("express");
const router = express.Router();
const { getForYouFeed, getExploreFeed } = require("../services/recommendationService");

// ✅ FIX: Removed wardrobe dependency
// ✅ FIX: Feed ranking using embeddings

function setupFeedRoute(supabaseAdmin, fetchClerkUserById, mapOwnerProfileFromClerk, verifyClerkToken) {
  
  // Internal helper to map profiles and comment counts
  async function preparePostsPayload(req, data) {
    // Build owner profiles map from Clerk
    const ownerIds = Array.from(
      new Set((data || []).map((p) => p.owner_clerk_id).filter(Boolean)),
    );
    const ownerMap = new Map();
    await Promise.all(
      ownerIds.map(async (id) => {
        const clerkUser = await fetchClerkUserById(id);
        ownerMap.set(String(id), mapOwnerProfileFromClerk(clerkUser));
      }),
    );

    // Rewrite URLs and prepare final structure
    const nodeBase = `${req.protocol}://${req.get("host")}`;
    
    // Fetch comment counts for each post
    const postIds = (data || []).map((p) => p.id);
    const commentCounts = {};
    if (postIds.length > 0) {
      const { data: countsData } = await supabaseAdmin
        .from("comments")
        .select("post_id")
        .in("post_id", postIds);
      
      if (countsData) {
        countsData.forEach(c => {
          commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
        });
      }
    }

    return (data || []).map((p) => {
      const rawImg = p.image_url || p.image_path;
      let finalImg = rawImg;
      if (
        rawImg &&
        rawImg.match(
          /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+\/static\//,
        )
      ) {
        finalImg = rawImg.replace(
          /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+\/static\//,
          `${nodeBase}/static/`,
        );
      }
      
      return {
        id: p.id,
        image_url: finalImg,
        caption: p.caption,
        owner_clerk_id: p.owner_clerk_id,
        owner_profile: ownerMap.get(String(p.owner_clerk_id)) || null,
        liked: p.liked === true,
        comments_count: commentCounts[p.id] || 0,
        score: p.score,
        similarity: p.similarity
      };
    });
  }

  // ✅ FOR YOU (Personalized)
  router.get("/for-you", async (req, res) => {
    try {
      const userId = await verifyClerkToken(req);
      console.log(`[for-you] Request from user: ${userId}`);
      
      const data = await getForYouFeed(supabaseAdmin, userId);
      const posts = await preparePostsPayload(req, data);

      console.log("Fetched posts (For You):", posts.length);
      if (posts.length > 0) console.log("Top post score:", posts[0]?.score);

      res.json({ posts });
    } catch (err) {
      console.error("for-you error", err);
      res.status(500).json({ error: err?.message || String(err) });
    }
  });

  // ✅ EXPLORE (General / Trending)
  router.get("/explore", async (req, res) => {
    try {
      const userId = await verifyClerkToken(req); // Optional for liked status
      console.log(`[explore] Request from user: ${userId || 'anonymous'}`);

      const data = await getExploreFeed(supabaseAdmin, userId);
      const posts = await preparePostsPayload(req, data);

      console.log("Fetched posts (Explore):", posts.length);
      res.json({ posts });
    } catch (err) {
      console.error("explore error", err);
      res.status(500).json({ error: err?.message || String(err) });
    }
  });

  return router;
}

module.exports = setupFeedRoute;
