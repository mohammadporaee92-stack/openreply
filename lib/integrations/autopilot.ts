import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const autopilotCampaignSchema = z.object({
  sourceKey: z.string().regex(/^[a-f0-9]{64}$/),
  postId: z.string().regex(/^\d{8,40}$/),
  postUrl: z.string().url().refine((value) => {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" && (host === "instagram.com" || host === "www.instagram.com");
  }),
  keyword: z.string().trim().min(1).max(50),
  dmMessage: z.string().trim().min(1).max(1000),
  publicReply: z.string().trim().max(1000).optional(),
});

export function authorizedAutopilot(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected || expected.length < 32) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
