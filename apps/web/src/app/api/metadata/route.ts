import { NextResponse } from "next/server";
import { keccak256, toHex } from "viem";
import type { ListingMetadata } from "@patched/shared";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const metadata: ListingMetadata = {
      version: 1,
      title: body.title || "Untitled Listing",
      surface: body.surface || "outfit",
      eventSlug: body.eventSlug,
      sourceImage: body.sourceImage || "/mock/source-photo.jpg",
      canvasImage: body.canvasImage || "/mock/white-canvas.svg",
      patches: Array.isArray(body.patches)
        ? body.patches.map((p: { id: number; name: string; x: number; y: number; w: number; h: number; rotation?: number }, idx: number) => ({
            id: typeof p.id === "number" ? p.id : idx,
            name: p.name,
            x: Number(p.x),
            y: Number(p.y),
            w: Number(p.w),
            h: Number(p.h),
            ...(typeof p.rotation === "number" ? { rotation: p.rotation } : {}),
          }))
        : [],
      milestones: Array.isArray(body.milestones)
        ? body.milestones.map((m: { name: string; bps: number }) => ({
            name: m.name,
            bps: Number(m.bps),
          }))
        : [
            { name: "Print proof", bps: 4000 },
            { name: "Venue proof", bps: 6000 },
          ],
    };

    // Serialize deterministic JSON representation
    const jsonString = JSON.stringify(metadata);
    const metadataHash = keccak256(toHex(jsonString));

    // In production with IPFS or Supabase Storage, metadataURI points to the uploaded JSON.
    // For local / testnet demo, we construct a data or api URI:
    const metadataURI = `data:application/json;base64,${Buffer.from(jsonString).toString("base64")}`;

    return NextResponse.json({
      success: true,
      metadata,
      metadataURI,
      metadataHash,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to construct listing metadata" },
      { status: 500 }
    );
  }
}
