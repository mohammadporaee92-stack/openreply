import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { authorizedAutopilot, autopilotCampaignSchema } from "@/lib/integrations/autopilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.OPENREPLY_INTEGRATION_SECRET;
  const workspaceId = process.env.AUTOPILOT_WORKSPACE_ID;
  const instagramAccountId = process.env.AUTOPILOT_INSTAGRAM_ACCOUNT_ID;
  if (!secret || !workspaceId || !instagramAccountId) {
    return NextResponse.json({ success: false, error: "Integration not configured" }, { status: 503 });
  }
  if (!authorizedAutopilot(request.headers.get("x-autopilot-secret"), secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = autopilotCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid campaign" }, { status: 400 });
  }

  const account = await prisma.instagramAccount.findFirst({
    where: { id: instagramAccountId, workspaceId },
    select: { id: true },
  });
  if (!account) {
    return NextResponse.json({ success: false, error: "Target account unavailable" }, { status: 409 });
  }
  const input = parsed.data;
  const name = `Autopilot ${input.sourceKey.slice(0, 32)}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialize duplicate deliveries of one logical content item without a new schema migration.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}), hashtext(${input.sourceKey}))::text`;
      const existing = await tx.automation.findFirst({
        where: { workspaceId, instagramAccountId, name },
        select: { id: true, postId: true, keywords: true, dmMessage: true,
                  publicReplyMessage: true, isActive: true },
      });
      if (existing) {
        if (existing.postId !== input.postId || existing.keywords[0] !== input.keyword ||
            existing.dmMessage !== input.dmMessage ||
            (existing.publicReplyMessage ?? "") !== (input.publicReply ?? "")) {
          return { conflict: true as const };
        }
        // Never reactivate a campaign an operator has paused.
        return { conflict: false as const, id: existing.id, active: existing.isActive, created: false };
      }
      // A second active campaign on this post can send a second DM for one comment.
      const overlap = await tx.automation.findFirst({
        where: { workspaceId, instagramAccountId, isActive: true,
                 OR: [{ postId: input.postId }, { matchAnyPost: true }] },
        select: { id: true },
      });
      if (overlap) return { conflict: true as const };
      const automation = await tx.automation.create({
        data: {
          workspaceId, instagramAccountId, name, postId: input.postId,
          postUrl: input.postUrl, keywords: [input.keyword], dmMessage: input.dmMessage,
          wholeWordMatch: true, matchAnyPost: false, matchAnyWord: false,
          publicReplyEnabled: Boolean(input.publicReply),
          publicReplyMessage: input.publicReply ?? null,
          publicReplyMessages: input.publicReply ? [input.publicReply] : [],
          isActive: true,
        },
        select: { id: true, isActive: true },
      });
      return { conflict: false as const, id: automation.id, active: automation.isActive, created: true };
    });
    if (result.conflict) {
      return NextResponse.json({ success: false, error: "Campaign binding conflict" }, { status: 409 });
    }
    return NextResponse.json({ success: true, campaignId: result.id, active: result.active },
                             { status: result.created ? 201 : 200 });
  } catch {
    return NextResponse.json({ success: false, error: "Campaign creation failed" }, { status: 500 });
  }
}
