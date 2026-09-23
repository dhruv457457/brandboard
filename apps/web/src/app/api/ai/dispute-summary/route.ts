import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { patchLabel, disputeReason, brandClaim } = body;

    // Simulate AI dispute evaluation latency (~750ms)
    await new Promise((res) => setTimeout(res, 750));

    const claim = brandClaim || disputeReason || "Patch visibility dispute";

    // AI dispute reasoning based on keywords
    let recommendation: "PAY_CREATOR" | "REFUND_BRAND" | "SPLIT_50_50" = "SPLIT_50_50";
    let confidence = 0.88;
    let assessment = "Proof photo shows partial obstruction of the logo area during the event.";

    if (/no[- ]show|never wore|absent|empty/i.test(claim)) {
      recommendation = "REFUND_BRAND";
      confidence = 0.94;
      assessment =
        "Proof materials fail to establish creator attendance at the designated milestone location.";
    } else if (/wrinkled|lighting|small/i.test(claim)) {
      recommendation = "PAY_CREATOR";
      confidence = 0.86;
      assessment =
        "The patch is visibly printed and worn in compliance with the agreed surface layout. Minor natural creasing is expected in fabric.";
    }

    return NextResponse.json({
      success: true,
      summary: `Dispute over patch spot "${patchLabel || "Patch"}". Brand claims: "${claim}".`,
      assessment,
      recommendation,
      confidence,
      keyObservations: [
        "Milestone photo timestamp validated within 3 hours of event opening.",
        "Logo aspect ratio matches uploaded asset within acceptable fabric tolerance.",
        "No evidence of malicious tampering or intentional concealment.",
      ],
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to generate dispute summary" },
      { status: 500 }
    );
  }
}
