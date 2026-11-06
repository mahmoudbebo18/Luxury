// Shared Supabase client for the public pages and the React platform.
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../app/types/database';

export const supabase = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
