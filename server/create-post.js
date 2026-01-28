// server/create-post.js (Node)
import express from "express";
import bodyParser from "body-parser";
import { createClient } from "@supabase/supabase-js";
// import the Clerk server SDK to verify tokens — check Clerk docs for server verify method

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_API_KEY = process.env.CLERK_API_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const app = express();
app.use(bodyParser.json());

app.post("/api/create-post", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "missing auth" });

    // VERIFY CLERK TOKEN HERE (SDK call) -> get clerkUserId
    // Example: const clerkUserId = await verifyClerkToken(auth);
    const clerkUserId = /* verify token with Clerk and obtain user id */ null;
    if (!clerkUserId) return res.status(401).json({ error: "invalid token" });

    const { title, description, image_path, tags, email, fullName, avatar_url } = req.body;

    const { data, error } = await supabaseAdmin.rpc("create_post_with_tags", {
      p_clerk_id: clerkUserId,
      p_email: email ?? null,
      p_full_name: fullName ?? null,
      p_avatar_url: avatar_url ?? null,
      p_title: title ?? null,
      p_description: description ?? null,
      p_image_path: image_path ?? null,
      p_tags: tags ?? []
    });

    if (error) throw error;
    return res.json({ ok: true, postId: data?.[0]?.post_id ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});
