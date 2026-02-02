// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'Set' : 'Missing',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? 'Set' : 'Missing',
  });
  throw new Error(
    'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY',
  );
}

console.log(`Supabase client initialized: ${supabaseUrl}`);

// Client-side safe Supabase instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
