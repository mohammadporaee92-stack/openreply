# Autopilot campaign integration

This integration creates one post-specific OpenReply campaign after a Zernio post is confirmed published. OpenReply remains the sole receiver of Instagram comment events. Do not enable an overlapping Zernio native comment automation or a second OpenReply campaign for the same post.

## Configuration

Set these on the OpenReply **web** deployment (not the worker):

- `OPENREPLY_INTEGRATION_SECRET`: a new random secret of at least 32 characters. Use the same value on the Autopilot worker. Do not reuse `NEXTAUTH_SECRET`, `ENCRYPTION_KEY` or the Zernio key.
- `AUTOPILOT_WORKSPACE_ID`: the exact OpenReply workspace ID that owns the connected Instagram account.
- `AUTOPILOT_INSTAGRAM_ACCOUNT_ID`: the exact OpenReply `InstagramAccount.id` for this page, **not** the Zernio account ID or Instagram username.

You can inspect the workspace/account IDs in your deployed database (or Prisma Studio) using the account already imported into OpenReply. Keep credentials in deployment settings, not GitHub or chat.

Autopilot sends `POST /api/integrations/autopilot/campaign` with `x-autopilot-secret` and a JSON body containing `sourceKey`, native numeric Instagram `postId`, Instagram `postUrl`, `keyword`, `dmMessage`, and optional `publicReply`. A request with the same `sourceKey` returns the existing campaign; a conflicting post or overlapping active campaign returns `409`. An operator-paused campaign stays paused on repeat requests.

After both apps are deployed, test with a separate Instagram account: publish one post, leave exactly one matching OpenReply campaign active, comment its keyword once, and confirm exactly one private reply and at most one public reply in OpenReply logs. If the publisher reports `UNCERTAIN`, inspect both systems before retrying.
