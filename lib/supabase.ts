// src/lib/supabase.ts
import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (Constants.expoConfig?.extra as any)?.SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = (Constants.expoConfig?.extra as any)?.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
  // you may need fetch polyfills in some RN environments; expo-managed usually OK
});
