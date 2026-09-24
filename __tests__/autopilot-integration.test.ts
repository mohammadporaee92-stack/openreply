import { describe, expect, it } from "vitest";
import { authorizedAutopilot, autopilotCampaignSchema } from "@/lib/integrations/autopilot";

const input = {
  sourceKey: "a".repeat(64),
  postId: "123456789012345",
  postUrl: "https://www.instagram.com/p/example/",
  keyword: "پرامپت",
  dmMessage: "سلام، این هم متن کامل پرامپت.",
  publicReply: "در دایرکت فرستادم.",
};

describe("Autopilot campaign boundary", () => {
  it("accepts a native post id and an Instagram HTTPS URL", () => {
    expect(autopilotCampaignSchema.safeParse(input).success).toBe(true);
  });

  it("rejects Zernio ids and non-Instagram URLs", () => {
    expect(autopilotCampaignSchema.safeParse({ ...input, postId: "65f1c0a9e2b5af0012ab34cd" }).success).toBe(false);
    expect(autopilotCampaignSchema.safeParse({ ...input, postUrl: "https://instagram.com.evil.test/p/1" }).success).toBe(false);
    expect(autopilotCampaignSchema.safeParse({ ...input, postUrl: "http://instagram.com/p/1" }).success).toBe(false);
  });

  it("requires a dedicated strong shared secret", () => {
    const secret = "s".repeat(32);
    expect(authorizedAutopilot(secret, secret)).toBe(true);
    expect(authorizedAutopilot("wrong", secret)).toBe(false);
    expect(authorizedAutopilot(secret, "short")).toBe(false);
  });
});
