import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert Web File into Base64 to avoid NextJS/Node FormData object serialization issues
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");

    const imgurFormData = new FormData();
    imgurFormData.append("image", base64Image);
    imgurFormData.append("type", "base64");

    const res = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: {
        Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
      },
      body: imgurFormData,
    });

    const data = await res.json();

    if (!data.success) {
      console.error("[Imgur API Error]:", data);
      return NextResponse.json(
        { error: data?.data?.error || "Failed to upload image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ link: data.data.link });
  } catch (error: any) {
    console.error("[Imgur API Error Detail]:", error);
    return NextResponse.json(
      { error: error?.message || "fetch failed" },
      { status: 500 }
    );
  }
}
