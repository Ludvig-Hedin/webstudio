import { z } from "zod";
import { router, procedure } from "./trpc";

// Has corresponding type in saas
export const PublishInput = z.object({
  // used to load build data from the builder see routes/rest.build.$buildId.ts
  buildId: z.string(),
  builderOrigin: z.string(),
  githubSha: z.string().optional(),

  destination: z.enum(["saas", "static"]),
  // preview support
  branchName: z.string(),
  // action log helper (not used for deployment, but for action logs readablity)
  logProjectName: z.string(),
});

export const UnpublishInput = z.object({
  domain: z.string(),
});

export const Output = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

/**
 * Deployment service for publishing sites.
 *
 * For self-hosted instances, the build data is created in the DB by domain.ts
 * and a separate Publisher Worker (Cloudflare) serves published sites dynamically
 * by fetching build data from Supabase. No per-site deployment step is needed —
 * the Worker picks up new builds automatically.
 *
 * The publish/unpublish mutations return success because the actual work
 * (creating/deleting the build record) happens upstream in domain.ts.
 **/
export const deploymentRouter = router({
  publish: procedure
    .input(PublishInput)
    .output(Output)
    .mutation(() => {
      // Build data is already created in the DB by domain.ts before this is called.
      // The Publisher Worker serves sites dynamically from the DB — no deployment step needed.
      return {
        success: true,
      };
    }),
  unpublish: procedure
    .input(UnpublishInput)
    .output(Output)
    .mutation(() => {
      // Build record is already deleted/updated in the DB by domain.ts.
      // The Publisher Worker will stop serving the site automatically.
      return {
        success: true,
      };
    }),
});
