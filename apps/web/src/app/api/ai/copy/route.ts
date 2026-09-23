import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { creatorHandle, title, surface, eventName, totalFloor } = body;

    // Simulate AI copy generation latency (~500ms)
    await new Promise((res) => setTimeout(res, 500));

    const surfaceDisplay =
      surface === "car" ? "car" : surface === "hoodie" ? "team hoodie" : "outfit";
    const eventDisplay = eventName || "Token2049";
    const creatorDisplay = creatorHandle ? `@${creatorHandle}` : "I";
    const floorDisplay = totalFloor ? `$${totalFloor}` : "$600";
    const titleDisplay = title || `${creatorDisplay} at ${eventDisplay}`;

    const pitchCopy = `${titleDisplay}: Wearing high-attention brand patches on my ${surfaceDisplay} at ${eventDisplay}. Place bids in USDC on Monad testnet. All bids held safely in on-chain escrow until proof is verified.`;

    const xPosts = [
      `Selling ad space on my ${surfaceDisplay} for ${eventDisplay}.\n\nEvery patch is its own live auction in USDC on @monad_xyz. Instant refunds if outbid.\n\nBid for your brand:`,
      `Why pay \$50k for a booth when you can sponsor my chest at ${eventDisplay}?\n\nPatched auction is live now (${floorDisplay} floor). 100% on-chain escrow + proof milestones:`,
      `Just dropped my ${surfaceDisplay} ad board for ${eventDisplay} on @patched_xyz.\n\nLive bidding open in native USDC. Grab a spot before someone snipes it:`,
    ];

    const hashtags = ["#Monad", "#Token2049", "#Web3Marketing", "#Patched"];

    return NextResponse.json({
      success: true,
      pitchCopy,
      xPosts,
      hashtags,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to generate copy" },
      { status: 500 }
    );
  }
}
