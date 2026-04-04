const express = require("express");
const router = express.Router();
const { getForYouFeed } = require("../services/recommendationService");

// ✅ FIX: Feed personalization
// This route handles the personalized feed generation using the taste vector and recency logic.

function setupFeedRoute(supabaseAdmin, fetchClerkUserById, mapOwnerProfileFromClerk, verifyClerkToken) {
  
  router.get("/for-you", async (req, res) => {
    try {
      const userId = await verifyClerkToken(req);
      console.log(`[for-you] Request from user: ${userId}`);
      
      // Get recommendations (personalized if userId exists, otherwise recency-based)
      const data = await getForYouFeed(supabaseAdmin, userId);

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

      const posts = (data || []).map((p) => {
        const rawImg = p.image_url || p.image_path;
        let finalImg = rawImg;
        // Handle both Cloudinary (starts with http) and local /static/ paths
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
          liked: p.liked === true, // ✅ FIX: Like persistence
          comments_count: commentCounts[p.id] || 0,
          score: p.score,
          similarity: p.similarity
        };
      });

      console.log("Posts with liked flag prepared");
      res.json({ posts });
    } catch (err) {
      console.error("for-you error", err);
      res.status(500).json({ error: err?.message || err?.toString?.() || String(err) });
    }
  });

  return router;
}

module.exports = setupFeedRoute;
