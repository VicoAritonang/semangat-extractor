import { supabase } from "@/lib/supabase";
import ExtractionClient from "@/components/ExtractionClient";
import type { ExtractionRecord } from "@/types";
import { notFound } from "next/navigation";

export default async function ExtractionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("extraction")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const record = data as ExtractionRecord;

  return (
    <ExtractionClient
      id={id}
      record={record}
      supabaseUrl={process.env.NEXT_SUPABASE_URL!}
      supabaseKey={process.env.NEXT_SUPABASE_ANON_KEY!}
    />
  );
}
