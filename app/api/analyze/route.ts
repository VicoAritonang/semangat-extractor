import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Fire-and-forget: send request to analyzer backend without waiting for response.
    // The backend will write results directly to Supabase extraction.analyzer.
    fetch(process.env.SEMANGAT_ANALYZER_URL!, {
      method: "POST",
      headers: {
        Authorization: process.env.X_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: body.input,
        extraction_id: body.extraction_id,
      }),
    }).catch((err) => {
      console.error("Analyzer request failed:", err);
    });

    return NextResponse.json({ status: "accepted" });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}
