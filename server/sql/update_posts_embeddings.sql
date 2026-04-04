-- Update posts table with separate embedding columns and status
-- ✅ NEW: Separate embedding columns
-- ✅ NEW: Background embedding update

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS visual_embedding vector(512),
ADD COLUMN IF NOT EXISTS text_embedding vector(512),
ADD COLUMN IF NOT EXISTS combined_embedding vector(512),
ADD COLUMN IF NOT EXISTS attributes jsonb,
ADD COLUMN IF NOT EXISTS embedding_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz;

-- Add indexes for similarity search and filtering
CREATE INDEX IF NOT EXISTS posts_combined_embedding_idx ON public.posts USING ivfflat (combined_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS posts_attributes_idx ON public.posts USING gin (attributes);
CREATE INDEX IF NOT EXISTS posts_embedding_status_idx ON public.posts (embedding_status);
