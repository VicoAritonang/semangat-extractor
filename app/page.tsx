import { supabase } from "@/lib/supabase";
import HomeClient from "@/components/HomeClient";
import type { ExtractionRecord } from "@/types";

export default async function Home() {
  // Fetch existing extractions sorted by created_at desc
  const { data, error } = await supabase
    .from("extraction")
    .select("id, image_url, extraction, confidence, is_handwritten, analyzer, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const extractions: ExtractionRecord[] = error ? [] : (data as ExtractionRecord[]) || [];

  return (
    <HomeClient
      supabaseUrl={process.env.NEXT_SUPABASE_URL!}
      supabaseKey={process.env.NEXT_SUPABASE_ANON_KEY!}
      extractions={extractions}
    />
  );
}
