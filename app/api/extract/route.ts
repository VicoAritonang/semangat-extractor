import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Send as FormData with field name "data" to the backend
    const backendForm = new FormData();
    const blob = new Blob([buffer], { type: file.type || "application/octet-stream" });
    backendForm.append("data", blob, "data");

    const res = await fetch(process.env.SEMANGAT_EXTRACTOR_URL!, {
      method: "POST",
      headers: {
        Authorization: process.env.X_API_KEY!,
      },
      body: backendForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Extractor failed: ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Extract error:", error);
    return NextResponse.json(
      { error: "Extraction failed" },
      { status: 500 }
    );
  }
}
