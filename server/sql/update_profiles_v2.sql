-- Update profiles table with multi-signal taste data
-- ✅ FIX: User taste vector system expanded 

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS visual_taste_vector jsonb,
ADD COLUMN IF NOT EXISTS text_taste_vector jsonb,
ADD COLUMN IF NOT EXISTS attribute_preferences jsonb,
ADD COLUMN IF NOT EXISTS taste_updated_at timestamptz;

-- Ensure base taste_vector exists as well
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS taste_vector jsonb;
