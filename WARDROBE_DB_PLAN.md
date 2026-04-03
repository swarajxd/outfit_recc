# Wardrobe Database & Vector Storage Plan

## Overview

This document outlines the implementation plan for:

1. Storing segmented images in Cloudinary
2. Updating JSON files with Cloudinary URLs
3. Storing visual embeddings in PostgreSQL

---

## Step 1: Set Up PostgreSQL Table for Wardrobe Vectors

Create a new table `wardrobe_items` in Supabase with the following schema:

```sql
CREATE TABLE wardrobe_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  item_id UUID NOT NULL,
  category TEXT NOT NULL,
  image_url_cloudinary TEXT,
  segmented_image_url TEXT,
  visual_embedding VECTOR(1024),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Optional: Add indexes for better performance
  UNIQUE(user_id, item_id),
  INDEX idx_user_id (user_id),
  INDEX idx_category (category)
);
```

**SQL Execution Steps:**

- [ ] Navigate to Supabase Dashboard → SQL Editor
- [ ] Run the table creation script above
- [ ] Verify table is created

---

## Step 2: Enable pgvector Extension

Enable vector support in Supabase for similarity searches.

**SQL Command:**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Steps:**

- [ ] Run this in Supabase SQL Editor
- [ ] This allows vector similarity operations like `<#>` (cosine distance)

---

## Step 3: Modify Python Wardrobe Pipeline

Update `server/outfit_model/wardrobe.py` to upload segmented images to Cloudinary.

### Changes Needed:

1. **Add Cloudinary Configuration**
   - Import cloudinary SDK
   - Configure with API credentials (from `.env`)

2. **After Image Segmentation**
   - Upload segmented image to Cloudinary
   - Retrieve Cloudinary URL from response
   - Store URL in JSON file

3. **JSON File Structure Update**

   **Current Structure:**

   ```json
   {
     "item_id": "uuid",
     "user": "user_id",
     "category": "tshirt",
     "image_path": "/local/path/to/image.png",
     "visual_embedding": [...]
   }
   ```

   **New Structure:**

   ```json
   {
     "item_id": "uuid",
     "user": "user_id",
     "category": "tshirt",
     "image_url_cloudinary": "https://res.cloudinary.com/...",
     "segmented_image_url": "https://res.cloudinary.com/...",
     "visual_embedding": [...]
   }
   ```

**Steps:**

- [ ] Update imports in `wardrobe.py`
- [ ] Add Cloudinary upload function
- [ ] Call upload after segmentation
- [ ] Update JSON field names
- [ ] Test with a sample image

---

## Step 4: Create Backend API Endpoint

Create a new Node.js endpoint to sync JSON files to PostgreSQL.

### Endpoint Details:

**Route:** `POST /api/wardrobe/sync-to-db`

**Function Workflow:**

1. Read JSON files from `server/outfit_model/wardrobe_vectors/` directory
2. For each wardrobe item:
   - Extract: `item_id`, `user_id` (from "user" field), `category`, `image_url_cloudinary`, `segmented_image_url`, `visual_embedding`
   - Connect to Supabase with admin client
   - Upsert into `wardrobe_items` table
3. Return response with:
   - Total items processed
   - Successfully inserted count
   - Failed count with errors

**Sample Response:**

```json
{
  "success": true,
  "total_processed": 5,
  "inserted": 5,
  "failed": 0,
  "message": "Successfully synced 5 wardrobe items to database"
}
```

**Implementation Location:** `server/index.js` or `server/wardrobe-sync.js`

**Steps:**

- [ ] Create endpoint in Node.js
- [ ] Add file system read logic
- [ ] Add Supabase insert/upsert logic
- [ ] Handle errors and edge cases
- [ ] Test with sample JSON files

---

## Step 5: Update Frontend Wardrobe Display

Modify the React/TypeScript frontend to fetch wardrobe items from PostgreSQL.

### Changes:

1. **Create API Service Function** (in `app/utils/` or `lib/`)
   - Function to fetch wardrobe items from `/api/wardrobe/items`
   - Query by `user_id`
   - Group by `category`

2. **Update Wardrobe Component**
   - Replace local JSON fetching with API call
   - Use `image_url_cloudinary` URLs for display
   - Handle loading/error states

3. **Benefits:**
   - Real-time wardrobe data
   - Faster CDN delivery via Cloudinary
   - Enable vector-based recommendations

**Steps:**

- [ ] Create `getWardrobeItems(userId)` API function
- [ ] Update wardrobe display component
- [ ] Update type definitions if needed
- [ ] Test end-to-end

---

## Step 6: Vector Similarity Search (Future Feature)

Once vectors are stored in PostgreSQL, enable AI-powered recommendations.

### Use Cases:

1. **Find Similar Items**

   ```sql
   SELECT * FROM wardrobe_items
   WHERE user_id = ?
   AND category = ?
   ORDER BY visual_embedding <#> ?
   LIMIT 10;
   ```

2. **Outfit Recommendations**
   - Find complementary items based on vector similarity
   - Recommend styles based on user preferences

**Steps:**

- [ ] Create recommendation endpoint
- [ ] Implement vector similarity queries
- [ ] Test with real embeddings

---

## Current Status: What's Already Done ✅

- ✅ Vector generation working (Python model)
- ✅ JSON storage working
- ✅ Cloudinary integration configured (in `server/index.js`)
- ✅ Supabase client set up

---

## What Needs to Be Added 🚀

- [ ] PostgreSQL table creation
- [ ] pgvector extension enabled
- [ ] Python: Cloudinary upload logic in `wardrobe.py`
- [ ] Node.js: Sync endpoint (`/api/wardrobe/sync-to-db`)
- [ ] Frontend: Fetch from PostgreSQL instead of JSON files
- [ ] Testing: End-to-end validation

---

## File Locations Reference

| Component       | File Path                               |
| --------------- | --------------------------------------- |
| Python Pipeline | `server/outfit_model/wardrobe.py`       |
| Node.js Backend | `server/index.js`                       |
| Frontend Types  | `app/utils/outfitEngine.ts`             |
| Frontend Hooks  | `hooks/` (create new if needed)         |
| JSON Storage    | `server/outfit_model/wardrobe_vectors/` |

---

## Environment Variables Needed

Ensure these are in `.env`:

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

OUTFIT_PORT=8000
```

---

## Timeline Estimation

| Step                    | Estimated Time | Difficulty |
| ----------------------- | -------------- | ---------- |
| 1. DB Table Setup       | 15 min         | Easy       |
| 2. pgvector Extension   | 5 min          | Easy       |
| 3. Python Modifications | 45 min         | Medium     |
| 4. Backend Endpoint     | 30 min         | Medium     |
| 5. Frontend Updates     | 30 min         | Medium     |
| 6. Testing & Debugging  | 30 min         | Medium     |
| **TOTAL**               | **~2.5 hours** | -          |

---

## Next Steps

1. ✅ Review this plan
2. ⏭️ Start with Step 1 (Create PostgreSQL table)
3. ⏭️ Proceed sequentially through each step
4. ⏭️ Test each component before moving to the next

---

**Last Updated:** March 18, 2026









📋 PLAN: Cloudinary URLs + PostgreSQL Vectors
Step 1: Set Up PostgreSQL Table for Wardrobe Vectors
 Create a new table wardrobe_items in Supabase with these columns:
id (UUID Primary Key)
user_id (String/UUID - foreign key to auth.users)
item_id (UUID - from your JSON)
category (String - "tshirt", "pants", etc.)
image_url_cloudinary (String - Cloudinary URL)
visual_embedding (VECTOR type, dimension 1024 or whatever your model uses) - Supabase supports pgvector extension
segmented_image_url (String - Cloudinary URL for segmented image)
created_at (Timestamp)
updated_at (Timestamp)
Step 2: Enable pgvector Extension (if not already enabled)
 In Supabase dashboard → SQL Editor:
Run: CREATE EXTENSION IF NOT EXISTS vector;
This enables vector similarity search later
Step 3: Modify Python Wardrobe Pipeline
 In wardrobe.py workflow:
After segmentation → Upload segmented image to Cloudinary → Get cloudinary_url
Keep the JSON files but replace image_path with image_url_cloudinary (the Cloudinary URL)

Generate embedding vector as you do now
Store both in the JSON temporarily
Step 4: Create Backend API Endpoint (Node.js)
 Create new endpoint /api/wardrobe/sync-to-db that:
Reads JSON files from wardrobe_vectors/ directory
For each wardrobe item:
Extract: item_id, user_id, category, image_url_cloudinary, visual_embedding
Insert/upsert into PostgreSQL wardrobe_items table
Returns success/failure count
Step 5: Update Frontend Wardrobe Display
 Fetch wardrobe items from PostgreSQL instead of/in addition to JSON files
 Display using Cloudinary URLs (they have CDN, faster loading)
Step 6: Vector Similarity Search (Future)
 Once vectors are in PostgreSQL, you can use pgvector for:
Finding similar items: <#> operator (cosine similarity)
Outfit recommendations based on vector distance
