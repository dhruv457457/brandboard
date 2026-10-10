export const dynamic = "force-dynamic";

/**
 * Which build is serving this site. A tab compares it with the build it loaded, so one left open across a deploy
 * can reload itself before it asks for script files that no longer exist (see lib/recover.ts).
 */
export function GET() {
  const version = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
  return Response.json({ version }, { headers: { "cache-control": "no-store" } });
}
