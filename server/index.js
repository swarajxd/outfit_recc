require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cloudinary = require('cloudinary').v2;
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// supabase admin client (service_role key) — must be stored server-side only
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ---- Helper: verify clerk token (PLACEHOLDER) ----
// Replace this with proper Clerk server-side verification using Clerk SDK.
// For now it reads Authorization: Bearer <token> and returns a mocked user id for dev.
// IMPORTANT: Replace with Clerk verification in production.
async function verifyClerkToken(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const token = auth.split(' ')[1];
  if (!token) return null;

  // TODO: use Clerk SDK to verify token and return clerkUserId.
  // e.g. const userId = await verifyWithClerk(token);
  // Here we'll return null if token is "dev" header not present.
  // For development you can send header "Authorization: Bearer dev:<clerkUserId>"
  if (token.startsWith('dev:')) {
    return token.split(':')[1]; // dev:clerkUserId
  }

  // Production: implement token verification. See Clerk docs.
  return null;
}

// ---- endpoint: get Cloudinary signature for upload ----
app.post('/api/cloudinary-sign', async (req, res) => {
  try {
    // you can require auth here if you want
    const timestamp = Math.floor(Date.now() / 1000);
    // you might want to set folder/public_id or transformation here
    const paramsToSign = {
      timestamp,
      // optionally: folder: 'posts', public_id: 'userId/filename'
    };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
    res.json({
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (err) {
    console.error('cloudinary-sign error', err);
    res.status(500).json({ error: 'signing failed' });
  }
});

// ---- endpoint: create post record in supabase ----
app.post('/api/create-post', async (req, res) => {
  try {
    // Request body should include: image_url, image_public_id (optional), caption, tags (array)
    const clerkUserId = await verifyClerkToken(req);
    if (!clerkUserId) return res.status(401).json({ error: 'unauthenticated - implement Clerk verification' });

    const { image_url, image_public_id, caption = null, tags = [] } = req.body;
    if (!image_url) return res.status(400).json({ error: 'missing image_url' });

    const insert = {
      owner_clerk_id: clerkUserId,
      image_url,
      image_public_id: image_public_id ?? null,
      caption,
      tags: Array.isArray(tags) ? tags : [],
    };

    const { data, error } = await supabaseAdmin.from('posts').insert([insert]).select().single();
    if (error) {
      console.error('supabase insert error', error);
      return res.status(500).json({ error: error.message || error });
    }

    res.json({ ok: true, post: data });
  } catch (err) {
    console.error('create-post error', err);
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('Server running on', PORT));
