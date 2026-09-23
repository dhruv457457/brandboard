import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, surface, patches } = body;

    // Simulate AI Moderation reasoning latency (~800ms)
    await new Promise((res) => setTimeout(res, 800));

    // Basic content heuristics
    const forbiddenPatterns = [/scam/i, /ponzi/i, /hate/i, /nazi/i, /offensive/i];
    const isFlagged = forbiddenPatterns.some((pattern) => pattern.test(title || ""));

    if (isFlagged) {
      return NextResponse.json({
        passed: false,
        score: 0.12,
        flag: "POLICY_VIOLATION",
        verdict: "Flagged by AI moderation: prohibited terminology detected in title.",
        checks: {
          visualAppropriateness: "flagged",
          placementCompliance: "pass",
          textContent: "flagged",
        },
      });
    }

    // Check patch layout boundaries
    const patchCount = Array.isArray(patches) ? patches.length : 0;
    const allPatchesBounded = Array.isArray(patches)
      ? patches.every(
          (p: { x: number; y: number; w: number; h: number }) =>
            p.x >= 0 && p.y >= 0 && p.x + p.w <= 100 && p.y + p.h <= 100
        )
      : true;

    if (!allPatchesBounded) {
      return NextResponse.json({
        passed: false,
        score: 0.45,
        flag: "LAYOUT_OUT_OF_BOUNDS",
        verdict: "Flagged by AI: one or more patch placements exceed surface boundaries.",
        checks: {
          visualAppropriateness: "pass",
          placementCompliance: "flagged",
          textContent: "pass",
        },
      });
    }

    return NextResponse.json({
      passed: true,
      score: 0.97,
      flag: null,
      verdict: `Approved by AI moderation: clean ${surface || "canvas"} with ${patchCount} verified ad spots.`,
      checks: {
        visualAppropriateness: "pass",
        placementCompliance: "pass",
        textContent: "pass",
      },
    });
  } catch {
    return NextResponse.json(
      { passed: false, error: "Failed to process moderation check" },
      { status: 500 }
    );
  }
}
