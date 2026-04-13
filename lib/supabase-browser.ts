import { createClient } from "@supabase/supabase-js";

// These need to be exposed to the browser via next.config.ts env or NEXT_PUBLIC_ prefix
// We'll pass them from server components or API routes instead
let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser(url: string, key: string) {
  if (!client) {
    client = createClient(url, key);
  }
  return client;
}
